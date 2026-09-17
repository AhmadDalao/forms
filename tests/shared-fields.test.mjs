import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore,DRAFT_PREFIX} from '../src/drafts.js';
import {sharedCandidates,sharedGroups} from '../src/shared-fields.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
const make=(disk,audience)=>createDraftStore(docs,()=>disk,audience);
const person={en_first:'Ahmad',en_middle:'Ali',en_last:'Dalao',ar_first:'أحمد',ar_middle:'علي',ar_last:'دلاو',phone:'001234567',mobile:'0551234567',email:'client@example.com',id_type:'national',id_number:'0012345678',client_number:'0000123',account_number:'0000405',building:'12',street:'King Road',district:'Noor',city:'Riyadh',postal:'00123',country:'Saudi Arabia'};
test('mapped targets exist and choices accept the shared values for each audience',()=>{
 for(const audience of ['individual','corporate'])for(const doc of docs){
  const p=Object.fromEntries(sharedGroups(audience).flatMap(g=>g.fields).map(f=>[f.id,f.type==='checkbox'?true:f.options?.[0][0]||'Example']));
  for(const [id,v]of Object.entries(sharedCandidates(doc,p,{signer_role:audience==='individual'?'client':'authorized',capacity:'holder'},audience))){
   const f=doc.fields.find(f=>f.id===id);assert.ok(f,doc.id+'/'+id);if(f.type==='choice'&&v)assert.ok(f.options.some(o=>o.value===v),id);
  }
 }
});
test('shared details populate corresponding individual forms but leave other people and addresses alone',()=>{
 const d=make(storage(),'individual');d.setShared(person);
 assert.equal(d.get('signature-form').values.client_name,'Ahmad Ali Dalao');
 assert.equal(d.get('signature-form').values.signer_name,undefined);
 assert.equal(d.get('terms-and-conditions').values.terms_name_0,'Ahmad Ali Dalao');
 assert.equal(d.get('terms-and-conditions').values.authorization_name_0,'Ahmad Ali Dalao');
 assert.equal(d.get('terms-and-conditions').values.terms_name_1,undefined);
 assert.equal(d.get('kyc-individual').values.phone,'001234567');
 assert.equal(d.get('kyc-individual').values.risk_client_name,'Ahmad Ali Dalao');
 assert.equal(d.get('kyc-individual').values.rep_phone,undefined);
 const tax=d.get('fatca-crs-individual').values;
 assert.equal(tax.en_middle,'Ali');assert.equal(tax.ar_first,'أحمد');assert.equal(tax.mail_city,'Riyadh');assert.equal(tax.sa_city,undefined);assert.equal(tax.outside_city,undefined);assert.equal(tax.staff_employee_id,undefined);
 d.setShared({...person,also_residence:true});assert.equal(d.get('fatca-crs-individual').values.sa_city,'Riyadh');
});
test('individual/company shared documents, preferences, signatures and clear-all are isolated',()=>{
 const disk=storage(),i=make(disk,'individual'),c=make(disk,'corporate');
 i.setShared(person);c.setShared({company_name:'Example Company',phone:'920000001',auth_name:'Company Signer'});
 assert.equal(c.get('signature-form').values.client_name,'Example Company');assert.equal(i.get('signature-form').values.client_name,'Ahmad Ali Dalao');
 assert.equal(i.get('kyc-corporate').values.company,undefined);assert.equal(c.get('kyc-individual').values.phone,undefined);
 assert.equal(c.get('fatca-crs-corporate').values.signer_0_name,'Company Signer');assert.equal(c.get('fatca-crs-corporate').values.person_0_name,undefined);
 const png='data:image/png;base64,iVBORw0KGgo'+'a'.repeat(100);i.save('signature-form',i.get('signature-form').values,0,{specimen:png});assert.equal(i.get('signature-form').signatures.specimen,png);
 assert.equal(make(disk,'corporate').get('signature-form').signatures.specimen,undefined);
 i.setPreferences({active:'signature-form',lang:'ar'});assert.equal(make(disk,'corporate').preferences.active,null);
 i.clearAll();assert.equal(make(disk,'individual').has('signature-form'),false);assert.equal(make(disk,'corporate').get('signature-form').values.client_name,'Example Company');
 i.setShared({en_first:'New client'});assert.equal(i.get('signature-form').values.client_name,'New client');
});
test('shared updates propagate while manual overrides and deliberately blank fields survive reload',()=>{
 const disk=storage(),d=make(disk,'individual');d.setShared(person);
 d.save('signature-form',{...d.get('signature-form').values,client_name:'Different Client'},0,{},'client_name');
 d.save('kyc-individual',{...d.get('kyc-individual').values,phone:''},0,{},'phone');
 d.setShared({...person,en_first:'Omar',phone:'9988'});
 assert.equal(d.get('signature-form').values.client_name,'Different Client');assert.equal(d.get('kyc-individual').values.phone,'');assert.equal(d.get('terms-and-conditions').values.terms_name_0,'Omar Ali Dalao');
 const reopened=make(disk,'individual');assert.equal(reopened.get('signature-form').values.client_name,'Different Client');assert.equal(reopened.get('kyc-individual').values.phone,undefined);
 reopened.useShared('signature-form','client_name');assert.equal(reopened.get('signature-form').values.client_name,'Omar Ali Dalao');
 reopened.clear('terms-and-conditions');assert.equal(make(disk,'individual').get('terms-and-conditions').values.terms_name_0,undefined);
 reopened.fillSharedBlanks('terms-and-conditions');assert.equal(reopened.get('terms-and-conditions').values.terms_name_0,'Omar Ali Dalao');
 reopened.setShared({});assert.equal(reopened.get('terms-and-conditions').values.terms_name_0,undefined);assert.equal(reopened.get('signature-form').values.client_name,undefined);
});
test('switching signatory role removes only auto-copied personal details',()=>{
 const d=make(storage(),'individual');d.setShared(person);
 d.save('signature-form',{...d.get('signature-form').values,signer_role:'client'},1,{},'signer_role');
 assert.equal(d.get('signature-form').values.signer_name,'Ahmad Ali Dalao');assert.equal(d.get('signature-form').values.id_number,'0012345678');
 d.save('signature-form',{...d.get('signature-form').values,signer_role:'authorized'},1,{},'signer_role');assert.equal(d.get('signature-form').values.signer_name,undefined);
 d.save('fatca-crs-individual',{...d.get('fatca-crs-individual').values,capacity:'holder'},3,{},'capacity');assert.equal(d.get('fatca-crs-individual').values.signer_ar,'أحمد علي دلاو');
 d.save('fatca-crs-individual',{...d.get('fatca-crs-individual').values,signer_ar:'وكيل آخر'},3,{},'signer_ar');
 d.save('fatca-crs-individual',{...d.get('fatca-crs-individual').values,capacity:'attorney'},3,{},'capacity');assert.equal(d.get('fatca-crs-individual').values.signer_ar,'وكيل آخر');assert.equal(d.get('fatca-crs-individual').values.signer_en,undefined);
});
test('old audience-specific drafts migrate once; ambiguous shared drafts require a folder choice',()=>{
 const disk=storage(),old=createDraftStore(docs,()=>disk);old.save('kyc-individual',{name_1:'Existing answer'},2);old.save('signature-form',{client_name:'Old shared client'},1);
 const i=make(disk,'individual'),c=make(disk,'corporate');assert.equal(i.get('kyc-individual').values.name_1,'Existing answer');assert.equal(i.get('kyc-individual').step,2);
 assert.equal(i.has('signature-form'),false);assert.equal(c.has('signature-form'),false);assert.ok(i.hasLegacy('signature-form'));
 i.setShared(person);const reopened=make(disk,'individual');assert.ok(reopened.hasLegacy('signature-form'));reopened.restoreLegacy('signature-form');
 assert.equal(reopened.get('signature-form').values.client_name,'Old shared client');c.refresh();assert.equal(c.hasLegacy('signature-form'),false);assert.equal(c.has('signature-form'),false);
 reopened.clear('kyc-individual');assert.equal(make(disk,'individual').get('kyc-individual').values.name_1,undefined);assert.equal(disk.getItem(DRAFT_PREFIX+'kyc-individual'),null);
});
test('storage failure keeps shared details and generated draft values in memory with a failure status',()=>{
 const d=createDraftStore(docs,()=>{throw Error('Blocked');},'individual');assert.equal(d.setShared(person),false);assert.equal(d.available,false);assert.equal(d.get('signature-form').values.client_name,'Ahmad Ali Dalao');assert.equal(d.profile.phone,'001234567');
});
