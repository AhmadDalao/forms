import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
test('preview client and management sessions cannot reuse live cookies',()=>{
 const scope=(name,path)=>JSON.parse(execFileSync('php',['-r','require $argv[1];echo json_encode(sessionScope($argv[2],$argv[3]));',resolve('public/api/session-scope.php'),name,path],{encoding:'utf8'}));
 for(const name of ['itqan_client','itqan_management']){
  assert.deepEqual(scope(name,'/api/portal.php'),{name,path:'/'});
  assert.deepEqual(scope(name,'/forms/api/portal.php'),{name,path:'/'});
  const preview=scope(name,'/preview-20260919/api/portal.php');
  assert.notEqual(preview.name,name);
  assert.equal(preview.path,'/preview-20260919/');
  assert.deepEqual(scope(name,'/preview-20260919/api/management.php'),preview);
  assert.notEqual(scope(name,'/other-preview/api/portal.php').name,preview.name);
 }
});
