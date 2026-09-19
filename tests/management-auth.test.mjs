import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

test('management requires a chosen username; adding it preserves password and rejects old sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'forms-management-auth-'));
 const init=(args,input='Test-password-for-management-2026!')=>spawnSync('php',['scripts/management-init.php',dir,...args],{input,encoding:'utf8'});
 const authenticated=(username,last=Date.now()/1000)=>JSON.parse(execFileSync('php',['-r',
  `require $argv[1];$_SESSION=['owner'=>true,'owner_username'=>json_decode($argv[3],true),'started'=>time(),'last'=>(int)$argv[4]];echo json_encode(managementOwner($argv[2]));`,
  resolve('public/api/management-auth.php'),dir,JSON.stringify(username),String(last)],{encoding:'utf8'}));
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
