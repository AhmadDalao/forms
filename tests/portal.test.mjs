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
 for(const path of ['login','register','account','management','my-applications'])for(const end of ['','/']){
  assert.equal(rootFor('/'+path+end),'/');assert.equal(rootFor('/forms/'+path+end),'/forms/');
 }
});
test('submission editing keeps original blanks and signatures without replacing normal drafts',()=>{
 const map=new Map(),disk={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const normal=createDraftStore(docs,()=>disk,'individual','aaa');normal.setShared({en_first:'New',en_last:'Profile',name_language:'en',id_number:'555'});normal.save('signature-form',{client_name:'Unsubmitted working draft'},0);
 const id='a'.repeat(32),edit=createDraftStore(docs,()=>disk,'individual','aaa',id);
 const original={id,current_id:id,version:1,answers:{client_name:'Original client',signer_name:''},signatures:{},profile:{}};
 edit.loadSubmission('signature-form',original);assert.equal(edit.get('signature-form').values.client_name,'Original client');assert.equal(edit.get('signature-form').values.signer_name,undefined);
 edit.setShared({...edit.profile,en_first:'Changed again'});assert.equal(edit.get('signature-form').values.client_name,'Original client');assert.equal(edit.get('signature-form').values.signer_name,undefined);
 edit.save('signature-form',{client_name:'Edited locally'},1,{},'client_name');
 const reload=createDraftStore(docs,()=>disk,'individual','aaa',id);reload.loadSubmission('signature-form',original);assert.equal(reload.get('signature-form').values.client_name,'Edited locally');assert.equal(reload.get('signature-form').step,1);
 assert.equal(createDraftStore(docs,()=>disk,'individual','aaa').get('signature-form').values.client_name,'Unsubmitted working draft');
 assert.notEqual(edit.prefix,normal.prefix);assert.equal(edit.basePrefix,normal.basePrefix);
 reload.submitted('signature-form',{id:'b'.repeat(32)});assert.equal(reload.get('signature-form').revision.expectedCurrent,'b'.repeat(32));
 const reopened=createDraftStore(docs,()=>disk,'individual','aaa',id);reopened.loadSubmission('signature-form',{...original,current_id:'b'.repeat(32)});assert.equal(reopened.get('signature-form').values.client_name,'Original client');assert.equal(reopened.get('signature-form').revision.expectedCurrent,'b'.repeat(32));
 reload.clear('signature-form');assert.equal(reload.get('signature-form').revision.sourceId,id);
});

test('clear all removes audience edit drafts without clearing other accounts or company edits',()=>{
 const map=new Map(),disk={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const id='a'.repeat(32),snapshot={id,current_id:id,version:1,answers:{client_name:'Client'},signatures:{},profile:{}};
 const normal=createDraftStore(docs,()=>disk,'individual','a');
 const edit=createDraftStore(docs,()=>disk,'individual','a',id),company=createDraftStore(docs,()=>disk,'corporate','a',id),other=createDraftStore(docs,()=>disk,'individual','b',id);
 for(const store of [edit,company,other])store.loadSubmission('signature-form',snapshot);
 normal.clearAll();assert.equal(disk.getItem(edit.prefix+'signature-form'),null);assert.ok(disk.getItem(company.prefix+'signature-form'));assert.ok(disk.getItem(other.prefix+'signature-form'));
});
