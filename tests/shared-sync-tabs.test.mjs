import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {createSharedSync} from '../src/shared-sync.js';

function storage(){const rows=new Map();return {getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}

test('document refresh retains the controller profile but receives other-tab form edits',()=>{
 const disk=storage(),a=createDraftStore(docs,()=>disk,'individual','owner'),b=createDraftStore(docs,()=>disk,'individual','owner');
 a.setShared({city:'Pending city'});b.setShared({city:'Other tab city'});
 b.save('signature-form',{...b.get('signature-form').values,client_number:'00123'},0,{},'client_number');
 a.refresh({preserveShared:true});
 assert.equal(a.profile.city,'Pending city');
 assert.equal(a.get('kyc-individual').values.city,'Pending city');
 assert.equal(a.get('signature-form').values.client_number,'00123');
 a.refresh();assert.equal(a.profile.city,'Other tab city','Default refresh still reads shared browser data');
});

test('another tab refreshing stale cloud data cannot erase a pending field on the next edit',async()=>{
 const disk=storage(),server={profile:{city:'Old city',email:'old@example.test'},revision:1,updated_at:null};
 const api=async(action,body)=>{
  if(action==='shared_profile')return {shared:structuredClone(server)};
  if(body.expectedRevision!==server.revision)throw Error('shared_profile_conflict');
  for(const [id,value] of Object.entries(body.changes)){if(value===null)delete server.profile[id];else server.profile[id]=value;}
  server.revision++;return {shared:structuredClone(server)};
 };
 const tab=()=>{const drafts=createDraftStore(docs,()=>disk,'individual','owner'),sync=createSharedSync({account:'owner',audience:'individual',drafts,api,storage:()=>disk,events:null,delay:100000});return {drafts,sync,edit(delta){drafts.setShared({...drafts.profile,...delta});sync.change(drafts.profile);}};};
 const a=tab(),b=tab();
 try{
  await a.sync.start();await b.sync.start();
  a.edit({city:'A unsaved city'});
  // These document-key events follow setShared; shared profile/metadata events
  // themselves are ignored by the signed-in main page.
  b.drafts.refresh({preserveShared:true});await b.sync.refresh();
  a.drafts.refresh({preserveShared:true});a.edit({email:'new@example.test'});
  await a.sync.flush();
  assert.equal(server.profile.city,'A unsaved city');assert.equal(server.profile.email,'new@example.test');assert.equal(a.sync.state.status,'saved');
 }finally{a.sync.dispose();b.sync.dispose();}
});

function multiTab({profile={city:'Old city',email:'old@example.test'},audience='individual'}={}){
 const disk=storage(),server={profile,revision:1,updated_at:null},tabs=[];let offline=false,saveGate=null;
 const api=async(action,body)=>{
  if(offline)throw Error('connection_failed');
  if(action==='shared_profile')return {shared:structuredClone(server)};
  if(saveGate){const gate=saveGate;saveGate=null;await gate;}
  if(body.expectedRevision!==server.revision)throw Error('shared_profile_conflict');
  assert.equal(Object.hasOwn(body.changes,'en_middle'),false);assert.equal(Object.hasOwn(body.changes,'ar_middle'),false);assert.equal(Object.hasOwn(body.changes,'auth_name'),false);
  for(const [id,value]of Object.entries(body.changes)){if(value===null)delete server.profile[id];else server.profile[id]=value;}
  server.revision++;return {shared:structuredClone(server)};
 };
 const tab=()=>{const drafts=createDraftStore(docs,()=>disk,audience,'same-owner'),sync=createSharedSync({account:'same-owner',audience,drafts,api,storage:()=>disk,events:null,delay:100000});const result={drafts,sync,edit(delta){drafts.setShared({...drafts.profile,...delta});sync.change(drafts.profile);},clear(){drafts.setShared({});sync.change({});}};tabs.push(result);return result;};
 return {tab,server,set offline(value){offline=value},gate(){let resolve;saveGate=new Promise(r=>resolve=r);return resolve;},close(){for(const tab of tabs)tab.sync.dispose();}};
}

test('disjoint offline tabs recover both field journals after closing and reopening',async()=>{
 const h=multiTab(),a=h.tab(),b=h.tab();
 try{
  await a.sync.start();await b.sync.start();h.offline=true;
  a.edit({city:'A offline city'});await a.sync.flush();b.edit({email:'B@example.test'});await b.sync.flush();a.sync.dispose();b.sync.dispose();
  const reopened=h.tab();await reopened.sync.start();assert.equal(reopened.drafts.profile.city,'A offline city');assert.equal(reopened.drafts.profile.email,'B@example.test');
  h.offline=false;await reopened.sync.retry();assert.deepEqual(h.server.profile,{city:'A offline city',email:'B@example.test'});assert.equal(reopened.sync.state.status,'saved');
 }finally{h.close();}
});

test('an old save acknowledgement preserves another tab’s newer same-field edit',async()=>{
 const h=multiTab(),a=h.tab(),b=h.tab();
 try{
  await a.sync.start();await b.sync.start();a.edit({city:'First sent city'});
  const release=h.gate(),saving=a.sync.flush();b.edit({city:'Latest explicit city',email:'New email'});release();await saving;
  assert.equal(a.drafts.profile.city,'Latest explicit city');assert.equal(a.sync.state.status,'saving');
  a.sync.dispose();b.sync.dispose();const reopened=h.tab();await reopened.sync.start();await reopened.sync.flush();
  assert.deepEqual(h.server.profile,{city:'Latest explicit city',email:'New email'});
 }finally{h.close();}
});

test('last explicit offline field edit wins while background failure cannot replace it',async()=>{
 const h=multiTab(),a=h.tab(),b=h.tab();
 try{
  await a.sync.start();await b.sync.start();h.offline=true;
  a.edit({city:'First'});b.edit({city:'Second'});a.edit({city:'Latest'});await b.sync.flush();await b.sync.refresh();a.sync.dispose();b.sync.dispose();h.offline=false;
  const reopened=h.tab();await reopened.sync.start();await reopened.sync.flush();assert.equal(h.server.profile.city,'Latest');
 }finally{h.close();}
});

test('editing a conflicted field still requires a choice after refresh and reopening',async()=>{
 const h=multiTab(),a=h.tab();
 try{
  await a.sync.start();a.edit({city:'Local'});h.server.profile.city='Elsewhere';h.server.revision++;await a.sync.flush();assert.equal(a.sync.state.status,'conflict');
  a.edit({city:'Local corrected'});await a.sync.refresh();assert.equal(a.sync.state.status,'conflict');a.sync.dispose();
  const reopened=h.tab();await reopened.sync.start();assert.equal(reopened.sync.state.status,'conflict');await reopened.sync.resolve('remote');assert.equal(reopened.drafts.profile.city,'Elsewhere');assert.equal(h.server.profile.city,'Elsewhere');
 }finally{h.close();}
});

test('null clears survive another offline tab’s disjoint edit',async()=>{
 const h=multiTab(),a=h.tab(),b=h.tab();
 try{
  await a.sync.start();await b.sync.start();h.offline=true;a.clear();await a.sync.flush();b.edit({mobile:'0551234567'});await b.sync.flush();a.sync.dispose();b.sync.dispose();h.offline=false;
  const reopened=h.tab();await reopened.sync.start();await reopened.sync.flush();assert.deepEqual(h.server.profile,{mobile:'0551234567'});
 }finally{h.close();}
});

test('corporate pending name parts omit the derived full-name alias',async()=>{
 const h=multiTab({profile:{auth_name:'First Old Family'},audience:'corporate'}),a=h.tab();
 try{await a.sync.start();a.edit({auth_first:'New'});await a.sync.flush();assert.equal(h.server.profile.auth_first,'New');}finally{h.close();}
});
