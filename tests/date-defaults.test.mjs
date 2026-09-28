import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {defaultDates,today} from '../src/dates.js';
import {createDraftStore} from '../src/drafts.js';

const storage=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};
};
const terms=docs.find(d=>d.id==='terms-and-conditions');
const completionDates={
 'signature-form':['date'],
 'al-naeem-terms-consent':['date'],
 'terms-and-conditions':['terms_date','authorization_date'],
 'fatca-crs-individual':['date'],
 'fatca-crs-corporate':['date'],
};

test('only document completion dates default, while personal and historical dates remain unanswered',()=>{
 const optedIn=Object.fromEntries(docs.filter(d=>d.fields.some(f=>f.defaultToday)).map(d=>[d.id,d.fields.filter(f=>f.defaultToday).map(f=>f.id)]));
 assert.deepEqual(optedIn,completionDates);
 for(const doc of docs){
  const values=defaultDates(doc,{values:{},overrides:[]},'2026-09-19');
  assert.deepEqual(values,Object.fromEntries((completionDates[doc.id]||[]).map(id=>[id,'2026-09-19'])),doc.id);
 }
 const historical={
  'kyc-individual':['dob','id_expiry','rep_expiry'],
  'kyc-corporate':['incorporation','expiry','auth_expiry'],
  'fatca-crs-individual':['dob'],
  'fatca-crs-corporate':Array.from({length:5},(_,i)=>`person_${i}_dob`),
 };
 for(const [docId,ids]of Object.entries(historical)){
  const doc=docs.find(d=>d.id===docId),values=defaultDates(doc,{values:{}},'2026-09-19');
  for(const id of ids){assert.equal(doc.fields.find(f=>f.id===id)?.type,'date',`${docId}/${id}`);assert.equal(values[id],undefined,`${docId}/${id}`);}
 }
});

test('opening a form initializes and persists its dates without creating drafts for unopened forms',()=>{
 for(const audience of [null,'individual','corporate']){
  const disk=storage(),store=createDraftStore(docs,()=>disk,audience);
  assert.equal(disk.m.size,0);
  for(const doc of docs)assert.equal(store.has(doc.id),false,doc.id);
  assert.equal(store.initializeDates(terms.id),true);
  assert.deepEqual(store.get(terms.id).values,{terms_date:today(),authorization_date:today()});
  assert.equal(store.has(terms.id),true);
  assert.equal(store.has('signature-form'),false);
  assert.equal(disk.m.size,1);
  const saved=disk.getItem(store.prefix+terms.id);
  store.initializeDates(terms.id);
  assert.equal(disk.getItem(store.prefix+terms.id),saved);
  assert.deepEqual(createDraftStore(docs,()=>disk,audience).get(terms.id).values,store.get(terms.id).values);
 }
});

test('chosen dates and explicit blanks survive initialization, edits, and reopening',()=>{
 const record={values:{terms_date:'2025-04-08',authorization_date:''},overrides:[]};
 assert.deepEqual(defaultDates(terms,record,'2026-09-19'),record.values);
 assert.deepEqual(record.values,{terms_date:'2025-04-08',authorization_date:''});
 const disk=storage(),store=createDraftStore(docs,()=>disk,'individual');
 store.initializeDates(terms.id);
 store.save(terms.id,{terms_date:'2025-04-08',authorization_date:''},1,{},'authorization_date');
 const reopened=createDraftStore(docs,()=>disk,'individual');
 assert.ok(reopened.get(terms.id).overrides.includes('authorization_date'));
 reopened.initializeDates(terms.id);
 assert.equal(reopened.get(terms.id).values.terms_date,'2025-04-08');
 assert.equal(reopened.get(terms.id).values.authorization_date,undefined);
 assert.equal(reopened.get(terms.id).step,1);
});

test('clearing a form removes dates and opening it again starts with today',()=>{
 const disk=storage(),store=createDraftStore(docs,()=>disk,'individual');
 store.save(terms.id,{terms_date:'2025-04-08',authorization_date:''},1,{},'authorization_date');
 store.clear(terms.id);
 assert.equal(store.has(terms.id),false);
 const reopened=createDraftStore(docs,()=>disk,'individual');
 assert.equal(reopened.has(terms.id),false);
 reopened.initializeDates(terms.id);
 assert.deepEqual(reopened.get(terms.id).values,{terms_date:today(),authorization_date:today()});
 reopened.clearAll();
 assert.equal(createDraftStore(docs,()=>disk,'individual').has(terms.id),false);
});

test('opening submitted revisions never changes historical dates or fills their blank dates',()=>{
 const disk=storage(),revisionId='a'.repeat(32),store=createDraftStore(docs,()=>disk,'individual','customer',revisionId);
 const snapshot={id:revisionId,current_id:revisionId,version:1,answers:{terms_date:'2024-02-07'},signatures:{},profile:{}};
 const original=structuredClone(snapshot);
 store.loadSubmission(terms.id,snapshot);
 const record=structuredClone(store.get(terms.id)),saved=disk.getItem(store.prefix+terms.id);
 store.initializeDates(terms.id);
 assert.deepEqual(store.get(terms.id),record);
 assert.equal(disk.getItem(store.prefix+terms.id),saved);
 assert.deepEqual(snapshot,original);
 const reopened=createDraftStore(docs,()=>disk,'individual','customer',revisionId);
 reopened.initializeDates(terms.id);
 assert.equal(reopened.get(terms.id).values.terms_date,'2024-02-07');
 assert.equal(reopened.get(terms.id).values.authorization_date,undefined);
 assert.deepEqual(defaultDates(terms,{values:{},revision:{sourceId:revisionId}},'2026-09-19'),{});
});

test('individual and company copies of shared forms keep independent dates',()=>{
 const disk=storage(),individual=createDraftStore(docs,()=>disk,'individual'),company=createDraftStore(docs,()=>disk,'corporate');
 company.save(terms.id,{terms_date:'2023-01-02',authorization_date:'2023-01-03'},1);
 const savedCompany=disk.getItem(company.prefix+terms.id);
 individual.initializeDates(terms.id);
 assert.deepEqual(individual.get(terms.id).values,{terms_date:today(),authorization_date:today()});
 assert.equal(disk.getItem(company.prefix+terms.id),savedCompany);
 company.initializeDates(terms.id);
 individual.clear(terms.id);
 assert.deepEqual(createDraftStore(docs,()=>disk,'corporate').get(terms.id).values,{terms_date:'2023-01-02',authorization_date:'2023-01-03'});
 assert.equal(individual.initializeDates('fatca-crs-corporate'),false);
 assert.equal(company.initializeDates('fatca-crs-individual'),false);
});

test('today uses the local calendar day and zero-pads month and day',()=>{
 assert.equal(today(new Date(2026,0,3,12)),'2026-01-03');
 const moduleUrl=new URL('../src/dates.js',import.meta.url).href;
 for(const [zone,instant,expected]of [
  ['Asia/Riyadh','2026-09-18T22:30:00Z','2026-09-19'],
  ['America/Los_Angeles','2026-09-19T01:30:00Z','2026-09-18'],
 ]){
  const script=`import {today} from ${JSON.stringify(moduleUrl)}; process.stdout.write(today(new Date(${JSON.stringify(instant)})));`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:zone},encoding:'utf8'}),expected);
 }
});
