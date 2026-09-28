import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {sharedEdit} from '../src/shared-fields.js';
const disk=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};
const create=(storage,audience='individual',account='owner',revision=null)=>createDraftStore(docs,()=>storage,audience,account,revision);
const change=(store,id,field,value)=>store.save(id,{...store.get(id).values,[field]:value},0,{},field);
const parts=['first','second','third','last'];
const name=(store,id,prefix,values)=>parts.forEach((part,i)=>change(store,id,prefix+'_'+part,values[i]));

for(const language of ['en','ar'])for(const source of ['subscription-form','kyc-individual','signature-form','terms-and-conditions','fatca-crs-individual'])test(`primary name entered in ${source}/${language} fills every matching form with four exact parts`,()=>{
 const storage=disk(),store=create(storage),values=language==='ar'?['عبد الرحمن','محمد','','آل غامدي']:['Abdul Rahman','Mohammed','','Al Ghamdi'];
 if(source==='subscription-form')for(const [i,field]of (language==='ar'?['first_name','second_name','third_name','family_name']:parts.map(p=>'en_'+p)).entries())change(store,source,field,values[i]);
 else name(store,source,source==='kyc-individual'?'name':source==='signature-form'?'client_name':source==='terms-and-conditions'?'terms_name_0':language,values);
 for(const [i,part]of parts.entries())assert.equal(store.profile[language+'_'+part],values[i]);
 const full=values.filter(Boolean).join(' ');
 for(const [id,field]of [['signature-form','client_name'],['terms-and-conditions','terms_name_0'],['terms-and-conditions','authorization_name_0'],['kyc-individual','risk_client_name']])assert.equal(store.get(id).values[field],full,id+'/'+field);
 assert.equal(store.get('kyc-individual').values.name_1,values.slice(0,2).join(' '));
 assert.equal(store.get('kyc-individual').values.name_2,values[3]);
 for(const [i,field]of (language==='ar'?['first_name','second_name','third_name','family_name']:parts.map(p=>'en_'+p)).entries())assert.equal(store.get('subscription-form').values[field],values[i]);
 for(const [i,part]of parts.entries())assert.equal(store.get('fatca-crs-individual').values[language+'_'+part],values[i]);
 const reloaded=create(storage);assert.deepEqual(reloaded.profile,store.profile);assert.equal(reloaded.get('signature-form').values.client_name,full);
 assert.deepEqual(create(storage,'corporate').profile,{});assert.deepEqual(create(storage,'individual','other-owner').profile,{});
});

test('English and Arabic name rows keep independent compound parts and do not replace the selected primary language',()=>{
 const s=create(disk());name(s,'fatca-crs-individual','ar',['عبد الرحمن','محمد','حسن','آل غامدي']);
 name(s,'subscription-form','en',['Abdul Rahman','Mohammed','Hasan','Al Ghamdi']);
 assert.equal(s.profile.name_language,'ar');assert.equal(s.profile.ar_first,'عبد الرحمن');assert.equal(s.profile.en_first,'Abdul Rahman');
 assert.equal(s.get('signature-form').values.client_name,'عبد الرحمن محمد حسن آل غامدي');
 assert.equal(s.get('subscription-form').values.english_name,'Abdul Rahman Mohammed Hasan Al Ghamdi');
 change(s,'fatca-crs-individual','en_second','Khalid');assert.equal(s.get('subscription-form').values.en_second,'Khalid');assert.equal(s.profile.ar_second,'محمد');
 change(s,'subscription-form','first_name','');assert.equal(s.profile.ar_first,'');assert.equal(s.get('subscription-form').values.first_name,'');assert.equal(s.get('signature-form').values.client_name,'محمد حسن آل غامدي');
});

test('clearing a choice by removing its key also clears matching choices in other forms',()=>{
 const s=create(disk());change(s,'fatca-crs-individual','gender','male');
 const values={...s.get('kyc-individual').values};delete values.gender;s.save('kyc-individual',values,0,{},'gender');
 assert.equal(s.profile.gender,'');assert.equal(s.get('fatca-crs-individual').values.gender,'');
});

test('common contact and identity edits propagate both ways, including clearing, old overrides, and reopening',()=>{
 const storage=disk(),s=create(storage);
 const matrix=[['email','email','email','client.qa@example.test'],['phone','phone','phone','0130000001'],['mobile','mobile','mobile','0553334444'],['nationality','nationality','nationality','Syrian'],['id_type','id_type','id_type','passport'],['id_number','id_number','id_number','0012345678'],['building','building','building','1001'],['street','street','street','King Road'],['postal','postal','postal','00555'],['additional','postal_additional','additional','0066']];
 for(const [subscription,kyc,key,value]of matrix){
  change(s,'kyc-individual',kyc,value);assert.equal(s.profile[key],value);assert.equal(s.get('subscription-form').values[subscription],value);
  const correction=key==='id_type'?'national':value+'2';change(s,'subscription-form',subscription,correction);assert.equal(s.get('kyc-individual').values[kyc],correction);
 }
 change(s,'subscription-form','email','');assert.equal(s.profile.email,'');assert.equal(s.get('kyc-individual').values.email,'');
 const reopened=create(storage);assert.equal(reopened.profile.email,'');assert.ok(!reopened.get('kyc-individual').values.email);
 const record=reopened.get('kyc-individual');storage.setItem(reopened.prefix+'kyc-individual',JSON.stringify({...record,values:{...record.values,email:'Old override'},overrides:['email']}));
 reopened.refresh();change(reopened,'subscription-form','email','latest@example.test');assert.equal(reopened.get('kyc-individual').values.email,'latest@example.test');assert.ok(!reopened.get('kyc-individual').overrides.includes('email'));
});

test('company legal names, registration and primary signatory link without populating controllers or private bank details',()=>{
 const storage=disk(),s=create(storage,'corporate');
 change(s,'fatca-crs-corporate','legal_name','Test Company');assert.equal(s.get('subscription-company').values.english_name,'Test Company');assert.equal(s.get('kyc-corporate').values.company,'Test Company');assert.equal(s.get('signature-form').values.client_name,'Test Company');
 change(s,'kyc-corporate','cr','CR000333');assert.equal(s.profile.company_id_number,'CR000333');assert.equal(s.get('subscription-company').values.company_id_number,'CR000333');
 name(s,'kyc-corporate','auth_name',['Abdul Rahman','Ali','','Al Ghamdi']);
 assert.equal(s.profile.auth_first,'Abdul Rahman');assert.equal(s.get('subscription-company').values.auth_name,'Abdul Rahman Ali Al Ghamdi');assert.equal(s.get('fatca-crs-corporate').values.signer_0_name,'Abdul Rahman Ali Al Ghamdi');
 change(s,'signature-form','signer_role','authorized');assert.equal(s.get('signature-form').values.signer_name,'Abdul Rahman Ali Al Ghamdi');
 change(s,'signature-form','signer_name_second','Hassan');assert.equal(s.get('subscription-company').values.auth_name_second,'Hassan');
 const before=s.profile;
 for(const [doc,id]of [['fatca-crs-corporate','person_0_name_first'],['fatca-crs-corporate','signer_1_name_first'],['kyc-corporate','contact_name_first'],['kyc-corporate','bank_owner'],['subscription-company','applicant_name_first']])change(s,doc,id,'Independent');
 assert.deepEqual(s.profile,before);assert.equal(create(storage,'individual').get('signature-form').values.client_name,undefined);
});

test('representatives, unrelated address roles and ambiguous combined text remain independent',()=>{
 const s=create(disk());change(s,'subscription-form','city','Riyadh');change(s,'subscription-form','district','Al Nakheel');
 assert.equal(s.get('kyc-individual').values.city,'Riyadh Al Nakheel');assert.equal(s.get('fatca-crs-individual').values.mail_city,'Riyadh');
 const before=s.profile;
 for(const [doc,id]of [['kyc-individual','representative_name_first'],['kyc-individual','rep_phone'],['kyc-individual','bank_country'],['kyc-individual','city'],['fatca-crs-individual','outside_city'],['signature-form','signer_name_first'],['terms-and-conditions','terms_name_1_first'],['subscription-form','applicant_name_first']])change(s,doc,id,'Independent');
 assert.deepEqual(s.profile,before);
 change(s,'signature-form','signer_role','client');change(s,'signature-form','signer_name_first','Actual');assert.equal(s.profile.en_first,'Actual');
 change(s,'signature-form','signer_role','authorized');change(s,'signature-form','signer_name_first','Other');assert.equal(s.profile.en_first,'Actual');
});

test('only explicit common corrections in historical revisions update live details, while snapshots and other revision answers stay frozen',()=>{
 const storage=disk(),normal=create(storage);name(normal,'signature-form','client_name',['Current','Ali','','Family']);
 const snapshot={id:'a'.repeat(32),current_id:'a'.repeat(32),version:1,answers:{client_name:'Historic Ahmed Family',email:'old@example.test'},signatures:{},profile:{en_first:'Historic'}};
 const original=JSON.stringify(snapshot),edit=create(storage,'individual','owner',snapshot.id);edit.loadSubmission('signature-form',snapshot);
 assert.equal(edit.profile.en_first,'Current');assert.equal(create(storage).get('signature-form').values.client_name,'Current Ali Family');
 change(edit,'signature-form','client_name_first','Corrected');assert.equal(edit.get('signature-form').values.client_name,'Corrected Ahmed Family');assert.equal(edit.profile.en_first,'Corrected');
 assert.equal(create(storage).get('signature-form').values.client_name,'Corrected Ali Family');assert.equal(create(storage).get('subscription-form').values.en_first,'Corrected');assert.equal(create(storage).profile.en_second,'Ali');
 change(normal,'signature-form','client_name_first','Newest');edit.setShared(normal.profile);assert.equal(edit.get('signature-form').values.client_name,'Corrected Ahmed Family');
 assert.equal(create(storage).get('signature-form').values.client_name,'Newest Ali Family');assert.equal(JSON.stringify(snapshot),original);
 const blankDisk=disk(),blankEdit=create(blankDisk,'individual','owner',snapshot.id);blankEdit.loadSubmission('signature-form',snapshot);change(blankEdit,'signature-form','client_name_first','Typed');
 assert.equal(create(blankDisk).profile.en_first,'Typed');assert.equal(create(blankDisk).profile.en_second,undefined);assert.equal(create(blankDisk).profile.en_last,undefined);
});

test('only explicit edited fields reverse-copy; save/initialization cannot publish defaults or imported snapshots',()=>{
 const s=create(disk());s.save('subscription-form',{first_name:'Unconfirmed',email:'old@example.test'},0);assert.deepEqual(s.profile,{});
 s.initializeCountries('subscription-form');s.initializeDates('subscription-form');assert.deepEqual(s.profile,{});
 const doc=docs.find(d=>d.id==='fatca-crs-individual');assert.deepEqual(sharedEdit(doc,{title:'other'}, {},'individual','title'),{});
});
