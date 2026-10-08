import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {cleanShared,sharedCandidates,sharedGroups} from '../src/shared-fields.js';

const familyDetail='بطاقة عائلية / Family ID';
const disk=()=>{const rows=new Map();return {getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};};
const create=(storage,audience,revision=null)=>createDraftStore(docs,()=>storage,audience,'identity-owner',revision);
const change=(store,doc,field,value)=>store.save(doc,{...store.get(doc).values,[field]:value},0,{},field);
const cases=[
 {audience:'individual',doc:'kyc-individual',type:'id_type',detail:'id_other',subscription:'subscription-form'},
 {audience:'corporate',doc:'kyc-corporate',type:'auth_id_type',detail:'auth_id_other',subscription:'subscription-company'},
];

// Exercise the actual select renderer, without loading the browser application.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const fieldHTML=main.slice(main.indexOf('function fieldHTML(f){'),main.indexOf('\nfunction fieldsHTML('));
const renderSelect=(field,value='')=>vm.runInNewContext(`(${fieldHTML})`,{
 personNameFieldVisible:()=>true,fieldValue:(f,values)=>values[f.id]??'',values:{[field.id]:value},audience:'individual',
 t:en=>en,e:value=>String(value),errors:[],
})(field);

for(const row of cases){
 const {audience,doc,type,detail,subscription}=row;
 const definition=docs.find(d=>d.id===doc);
 const editSharedType=(store,value)=>audience==='individual'?change(store,subscription,type,value):store.setShared({...store.profile,[type]:value});
 test(`${doc} renders its authored Family ID choice for a new answer`,()=>{
  const field=definition.fields.find(f=>f.id===type),option=field.options.find(o=>o.value==='family');
  assert.ok(option);
  assert.ok(renderSelect(field).includes(`<option value="family" >${option.label} / ${option.ar}</option>`));
  const shared=sharedGroups(audience).flatMap(g=>g.fields).find(f=>f.id===type);
  assert.ok(!shared.options.some(o=>o[0]==='family'));
  if(audience==='individual')assert.ok(!docs.find(d=>d.id===subscription).fields.find(f=>f.id===type).selectOptions.some(o=>o[0]==='family'));
 });
 test(`${doc} Family ID survives save, profile normalization and reload without restoring the subscription option`,()=>{
  const storage=disk(),store=create(storage,audience);
  change(store,doc,type,'family');
  assert.equal(store.profile[type],'other');assert.equal(store.profile[detail],familyDetail);
  assert.equal(store.get(doc).values[type],'family');
  if(audience==='individual')assert.equal(store.get(doc).values[detail],'');
  if(audience==='individual'){assert.equal(store.get(subscription).values[type],'other');assert.equal(store.get(subscription).values[detail],familyDetail);}
  store.setShared(cleanShared(audience,JSON.parse(JSON.stringify(store.profile))));
  const reopened=create(storage,audience);
  assert.equal(reopened.get(doc).values[type],'family');assert.equal(reopened.profile[detail],familyDetail);
  if(audience==='individual')assert.equal(reopened.get(subscription).values[type],'other');
  assert.deepEqual(create(storage,audience==='individual'?'corporate':'individual').profile,{});
 });
 test(`${doc} clearing or changing Family ID cannot resurrect its shared marker`,()=>{
  const storage=disk(),store=create(storage,audience);
  change(store,doc,type,'family');
  const values={...store.get(doc).values};delete values[type];store.save(doc,values,0,{},type);
  assert.equal(store.profile[type],'');assert.equal(store.profile[detail],undefined);
  assert.equal(create(storage,audience).get(doc).values[type],'');
  change(store,doc,type,'family');change(store,doc,type,'passport');
  assert.equal(store.profile[type],'passport');assert.equal(store.profile[detail],undefined);
  assert.equal(create(storage,audience).get(doc).values[type],'passport');
  change(store,doc,type,'family');
  editSharedType(store,'national');
  assert.equal(store.get(doc).values[type],'national');assert.equal(store.profile[detail],undefined);
 });
 test(`${doc} recognizes only the exact shared Family ID representation`,()=>{
  const mapped=profile=>sharedCandidates(definition,cleanShared(audience,profile),{},audience);
  assert.equal(mapped({[type]:'family'})[type],'family');
  assert.equal(mapped({[type]:'other',[detail]:familyDetail})[type],'family');
  for(const label of ['Travel document','وثيقة سفر','Family ID','بطاقة عائلية',familyDetail+' ']){
   const profile=cleanShared(audience,{[type]:'other',[detail]:label});
   assert.equal(profile[detail],label);
   assert.equal(sharedCandidates(definition,profile,{},audience)[type],audience==='individual'?'other':'');
  }
  assert.equal(mapped({[type]:'',[detail]:familyDetail})[type],'');
  assert.equal(mapped({[type]:'other',[detail]:''})[type],audience==='individual'?'other':'');
 });
 test(`${doc} historical revisions retain their captured identity while live details change`,()=>{
  const storage=disk(),store=create(storage,audience);
  change(store,doc,type,'family');
  const snapshot={id:'f'.repeat(32),current_id:'f'.repeat(32),version:1,answers:{[type]:'family'},signatures:{},profile:{[type]:'other',[detail]:familyDetail}};
  const original=JSON.stringify(snapshot),revision=create(storage,audience,snapshot.id);
  revision.loadSubmission(doc,snapshot);
  editSharedType(store,'passport');revision.setShared(store.profile);
  assert.equal(revision.get(doc).values[type],'family');
  assert.equal(create(storage,audience,snapshot.id).get(doc).values[type],'family');
  assert.equal(create(storage,audience).get(doc).values[type],'passport');
  assert.equal(JSON.stringify(snapshot),original);
  change(revision,doc,type,'national');
  assert.equal(create(storage,audience).profile[type],'national');
  assert.equal(revision.get(doc).values[type],'national');assert.equal(JSON.stringify(snapshot),original);
 });
}

test('individual Other can be deliberately selected after Family without keeping its old detail',()=>{
 const storage=disk(),store=create(storage,'individual');
 change(store,'kyc-individual','id_type','family');change(store,'kyc-individual','id_type','other');
 assert.equal(store.get('kyc-individual').values.id_type,'other');assert.equal(store.profile.id_other,'');
 change(store,'kyc-individual','id_other','Travel document');
 assert.equal(store.profile.id_other,'Travel document');assert.equal(store.get('subscription-form').values.id_other,'Travel document');
 assert.equal(create(storage,'individual').get('kyc-individual').values.id_other,'Travel document');
 change(store,'kyc-individual','id_other','');assert.equal(create(storage,'individual').profile.id_other,'');
});

test('representative ID remains independent of customer Family ID',()=>{
 const storage=disk(),store=create(storage,'individual'),rep=docs.find(d=>d.id==='kyc-individual').fields.find(f=>f.id==='rep_type');
 change(store,'kyc-individual','rep_type','جواز سفر / Passport');
 change(store,'kyc-individual','id_type','family');
 assert.equal(create(storage,'individual').get('kyc-individual').values.rep_type,'جواز سفر / Passport');
 const profile=store.profile;change(store,'kyc-individual','rep_type','');assert.deepEqual(store.profile,profile);
 assert.ok(!rep.dropdownOptions.some(o=>o.value==='family'));
});
