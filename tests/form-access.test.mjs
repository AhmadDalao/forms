import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('document access matches authenticated category; management can inspect both',()=>{
 const script=`require 'public/api/form-access.php';
 $result=[];foreach([['role'=>'client','account_type'=>'individual'],['role'=>'client','account_type'=>'corporate'],['role'=>'admin'],['role'=>'superadmin']] as $identity){
 $result[]=array_map(fn($group)=>formDocumentAllowed($identity,['group'=>$group]),['individual','corporate','shared']);}
 echo json_encode($result);`;
 const run=spawnSync('php',['-r',script],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),[[true,false,true],[false,true,true],[true,true,true],[true,true,true]]);
});

test('anonymous access never creates account storage or starts a browser session',()=>{
 const script=`require 'public/api/form-access.php';$_COOKIE=[];
 echo json_encode([formAccessIdentity(),session_status()===PHP_SESSION_NONE]);`;
 const run=spawnSync('php',['-r',script],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),[null,true]);
});
