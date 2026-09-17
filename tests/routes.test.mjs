import test from 'node:test';
import assert from 'node:assert/strict';
import {audienceFor,rootFor,visibleIn} from '../src/routes.js';
test('folder links accept a trailing slash and keep legacy template paths usable',()=>{
 for(const slash of ['','/'])for(const [path,group,root]of [['/individuals','individual','/'],['/companies','corporate','/'],['/forms/individuals','individual','/forms/'],['/forms/companies','corporate','/forms/']]){
  assert.equal(audienceFor(path+slash),group);assert.equal(rootFor(path+slash),root);
 }
 assert.equal(audienceFor('/'),null);assert.equal(rootFor('/forms/'),'/forms/');
});
test('shared forms are in both folders, audience-specific drafts cannot open in the wrong folder',()=>{
 assert.equal(visibleIn({group:'shared'},'individual'),true);
 assert.equal(visibleIn({group:'shared'},'corporate'),true);
 assert.equal(visibleIn({group:'individual'},'corporate'),false);
 assert.equal(visibleIn({group:'corporate'},'individual'),false);
});
