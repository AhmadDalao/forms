import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftStore} from '../src/drafts.js';
import {docs} from '../src/forms/index.js';
import {rootFor} from '../src/routes.js';
test('client account drafts and profiles never read another account or anonymous storage',()=>{
 const map=new Map(),disk={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const guest=createDraftStore(docs,()=>disk,'individual');guest.save('signature-form',{client_name:'Guest'},0);
 const a=createDraftStore(docs,()=>disk,'individual','aaa'),b=createDraftStore(docs,()=>disk,'individual','bbb'),company=createDraftStore(docs,()=>disk,'corporate','aaa');
 assert.equal(a.has('signature-form'),false);a.setShared({ar_first:'أحمد',ar_last:'العلي'});a.save('signature-form',{client_name:'Account A'},1);
 assert.equal(b.has('signature-form'),false);assert.equal(company.has('signature-form'),false);assert.deepEqual(b.profile,{});
 assert.equal(guest.get('signature-form').values.client_name,'Guest');
 assert.equal(createDraftStore(docs,()=>disk,'individual','aaa').get('signature-form').values.client_name,'Account A');
 a.clearAll();assert.equal(guest.has('signature-form'),true);
});
test('account routes resolve the correct API root at both hosting locations',()=>{
 for(const path of ['login','register','account','management'])for(const end of ['','/']){
  assert.equal(rootFor('/'+path+end),'/');assert.equal(rootFor('/forms/'+path+end),'/forms/');
 }
});
