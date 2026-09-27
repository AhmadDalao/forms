import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,statSync,unlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

const library=resolve('public/api/management-auth.php');
const account=(dir,role='admin')=>JSON.parse(execFileSync('php',['-r',
 `require $argv[1];echo json_encode(managementAccounts($argv[2])[$argv[3]]??null);`,library,dir,role],{encoding:'utf8'}));
const sessionFor=record=>({owner:true,owner_username:record.username,owner_credentials:record.credential_version,started:Math.floor(Date.now()/1000),last:Math.floor(Date.now()/1000)});
const access=(dir,session)=>JSON.parse(execFileSync('php',['-r',
 `require $argv[1];$_SESSION=json_decode($argv[3],true);echo json_encode(['owner'=>managementOwner($argv[2]),'identity'=>managementIdentity($argv[2]),'documents'=>managementCanManageDocuments($argv[2])]);`,library,dir,JSON.stringify(session)],{encoding:'utf8'}));
const permissions=(dir,session)=>JSON.parse(execFileSync('php',['-r',
 `require $argv[1];$_SESSION=json_decode($argv[3],true);echo json_encode(managementPermissions($argv[2]));`,library,dir,JSON.stringify(session)],{encoding:'utf8'}));

test('management requires a chosen username; adding it preserves password and rejects old sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'forms-management-auth-'));
 const init=(args,input='Test-password-for-management-2026!')=>spawnSync('php',['scripts/management-init.php',dir,...args],{input,encoding:'utf8'});
 const authenticated=(username,last=Math.floor(Date.now()/1000))=>access(dir,{...sessionFor(account(dir)),owner_username:username,last}).owner;
 try{
  assert.equal(init([]).status,1,'Never invent a username');
  assert.equal(init(['Chosen.Owner']).status,0);
  const hash=readFileSync(join(dir,'password.php'));
  writeFileSync(join(dir,'state.json'),'existing catalogue');
  assert.equal(authenticated('chosen.owner'),true);
  assert.equal(authenticated(null),false,'Password-only sessions are not owners');
  assert.equal(authenticated('wrong.owner'),false);
  assert.equal(authenticated('chosen.owner',0),false);
  assert.equal(init(['New.Owner','--keep-password'],'').status,0);
  assert.deepEqual(readFileSync(join(dir,'password.php')),hash);
  assert.equal(readFileSync(join(dir,'state.json'),'utf8'),'existing catalogue');
  assert.equal(authenticated('chosen.owner'),false,'Username changes revoke old management sessions');
  assert.equal(authenticated('new.owner'),true);
  assert.equal(statSync(join(dir,'username.php')).mode&0o777,0o600);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('superadmin bootstrap is additive, private, collision-safe and refuses replacement',()=>{
 const dir=mkdtempSync(join(tmpdir(),'forms-superadmin-auth-'));
 const init=(name,password='A-strong-superadmin-password-2026!')=>spawnSync('php',['scripts/management-superadmin-init.php',dir,name],{input:password,encoding:'utf8'});
 try{
  assert.equal(spawnSync('php',['scripts/management-init.php',dir,'Original.Admin'],{input:'Original-strong-password-2026!'}).status,0);
  const legacy=['username.php','password.php'].map(name=>readFileSync(join(dir,name)));
  writeFileSync(join(dir,'state.json'),'original catalogue and history');
  assert.equal(init('original.admin').status,1,'Role names cannot collide after normalization');
  assert.equal(init('superadmin','short').status,1);
  assert.equal(init('   ').status,1);
  assert.equal(existsSync(join(dir,'superadmin-password.php')),false);
  assert.equal(init(' SUPERADMIN ').status,0);
  const created=['superadmin-username.php','superadmin-password.php'].map(name=>readFileSync(join(dir,name)));
  assert.equal(account(dir,'superadmin').username,'superadmin');
  assert.equal(init('new.superadmin','Another-strong-password-2026!').status,1);
  ['username.php','password.php'].forEach((name,i)=>assert.deepEqual(readFileSync(join(dir,name)),legacy[i]));
  ['superadmin-username.php','superadmin-password.php'].forEach((name,i)=>{
   assert.deepEqual(readFileSync(join(dir,name)),created[i]);
   assert.equal(statSync(join(dir,name)).mode&0o777,0o600);
   assert.match(created[i].toString(),/FORMS_MANAGEMENT_AUTH/);
  });
  assert.equal(readFileSync(join(dir,'state.json'),'utf8'),'original catalogue and history');
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('server credentials determine privileges and credential changes revoke stale sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'forms-management-roles-'));
 try{
  assert.equal(spawnSync('php',['scripts/management-init.php',dir,'admin'],{input:'Admin-test-password-2026!'}).status,0);
  assert.equal(spawnSync('php',['scripts/management-superadmin-init.php',dir,'superadmin'],{input:'Superadmin-test-password-2026!'}).status,0);
  const admin=sessionFor(account(dir)),superadmin=sessionFor(account(dir,'superadmin'));
  assert.deepEqual(access(dir,admin),{owner:true,identity:{username:'admin',role:'admin'},documents:false});
  assert.deepEqual(access(dir,superadmin),{owner:true,identity:{username:'superadmin',role:'superadmin'},documents:true});
  assert.deepEqual(permissions(dir,admin),{manage_documents:false,change_account_type:false,manage_workflow:false,manage_admins:false});
  assert.deepEqual(permissions(dir,superadmin),{manage_documents:true,change_account_type:true,manage_workflow:true,manage_admins:true});
  assert.deepEqual(permissions(dir,{}),{manage_documents:false,change_account_type:false,manage_workflow:false,manage_admins:false});
  assert.equal(permissions(dir,{...admin,role:'superadmin',owner_role:'superadmin',permissions:{change_account_type:true}}).change_account_type,false,'Only the authenticated server role can change account type');
  assert.equal(access(dir,{...admin,role:'superadmin',owner_role:'superadmin',permissions:{manage_documents:true}}).documents,false,'Session role claims cannot elevate an admin');
  assert.equal(access(dir,{...admin,owner_username:'superadmin'}).owner,false,'A copied username is not an authenticated identity');
  assert.equal(access(dir,{...superadmin,owner_credentials:admin.owner_credentials}).owner,false);
  assert.equal(access(dir,{...superadmin,owner_credentials:undefined}).owner,false,'Legacy unbound sessions must sign in again');
  assert.equal(access(dir,{...superadmin,last:0}).owner,false);
  assert.equal(access(dir,{...superadmin,started:0}).owner,false);
  assert.equal(access(dir,{...superadmin,owner_username:[]}).owner,false,'Malformed sessions fail closed');
  const php=value=>`<?php return '${value.replaceAll('\\','\\\\').replaceAll("'","\\'")}';`;
  const superName=join(dir,'superadmin-username.php');
  writeFileSync(superName,php('renamed.superadmin'));
  assert.equal(access(dir,superadmin).owner,false,'Renaming revokes the old identity');
  writeFileSync(superName,php('superadmin'));
  writeFileSync(join(dir,'superadmin-password.php'),php(account(dir).password_hash));
  assert.equal(access(dir,superadmin).owner,false,'Replacing the password revokes existing sessions');
  assert.equal(permissions(dir,superadmin).change_account_type,false,'Credential changes revoke account-type permission immediately');
  assert.equal(access(dir,admin).owner,true,'Superadmin changes leave ordinary admin access intact');
  unlinkSync(join(dir,'superadmin-password.php'));
  assert.equal(access(dir,superadmin).owner,false,'Removing a credential revokes access immediately');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
