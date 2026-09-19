import test from 'node:test';
import assert from 'node:assert/strict';
import {audienceFor,rootFor,visibleIn,storagePrefixFor} from '../src/routes.js';
test('folder links accept a trailing slash and keep legacy template paths usable',()=>{
 for(const slash of ['','/'])for(const [path,group,root]of [['/individuals','individual','/'],['/companies','corporate','/'],['/forms/individuals','individual','/forms/'],['/forms/companies','corporate','/forms/']]){
  assert.equal(audienceFor(path+slash),group);assert.equal(rootFor(path+slash),root);
 }
 assert.equal(audienceFor('/'),null);assert.equal(rootFor('/forms/'),'/forms/');
});
test('hosted previews isolate drafts and portal preferences from live storage',()=>{
 const prefix='itqan.forms.v1.';
 assert.equal(storagePrefixFor('/',prefix),prefix);
 assert.equal(storagePrefixFor('/forms/',prefix),prefix);
 for(const page of ['individuals','companies','management','login','register','account','my-applications']){
  const root=rootFor('/preview-20260919/'+page+'/');
  assert.equal(root,'/preview-20260919/');
  assert.equal(storagePrefixFor(root,prefix),'itqan.forms.v1.site.%2Fpreview-20260919%2F.');
 }
 assert.notEqual(storagePrefixFor('/preview-a/',prefix),storagePrefixFor('/preview-b/',prefix));
});
test('shared forms are in both folders, audience-specific drafts cannot open in the wrong folder',()=>{
 assert.equal(visibleIn({group:'shared'},'individual'),true);
 assert.equal(visibleIn({group:'shared'},'corporate'),true);
 assert.equal(visibleIn({group:'individual'},'corporate'),false);
 assert.equal(visibleIn({group:'corporate'},'individual'),false);
});
