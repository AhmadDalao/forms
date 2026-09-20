import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {cleanShared,sharedRules,sharedCandidates} from '../src/shared-fields.js';
const disk=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const store=(storage=disk(),audience='individual',account='qa')=>createDraftStore(docs,()=>storage,audience,account);
const edit=(s,doc,id,value)=>s.save(doc,{...s.get(doc).values,[id]:value},0,{},id);
const name=(s,doc,prefix,parts)=>['first','second','third','last'].forEach((part,i)=>edit(s,doc,prefix+'_'+part,parts[i]));

test('subscription language rows stay separate in both directions and English never fills the Arabic row',()=>{
 const d=disk(),s=store(d);name(s,'subscription-form','en',['Omar','Ali','','Al Ghamdi']);
 assert.ok(!s.get('subscription-form').values.first_name);assert.equal(s.get('fatca-crs-individual').values.en_middle,'Ali');
 for(const [i,key] of ['first_name','second_name','third_name','family_name'].entries())edit(s,'subscription-form',key,['عمر','علي','','الغامدي'][i]);
 assert.equal(s.get('fatca-crs-individual').values.ar_first,'عمر');assert.equal(s.get('fatca-crs-individual').values.en_first,'Omar');
 edit(s,'fatca-crs-individual','en_second','Hassan');assert.equal(s.get('subscription-form').values.en_second,'Hassan');assert.equal(s.get('subscription-form').values.second_name,'علي');
 assert.equal(store(d).get('subscription-form').values.english_name,'Omar Hassan Al Ghamdi');
});
test('company Arabic and English names round-trip without changing the authorized person',()=>{
 const s=store(disk(),'corporate');edit(s,'subscription-company','company_name','شركة النور');edit(s,'subscription-company','english_name','Al Noor Company');
 assert.equal(s.get('fatca-crs-corporate').values.legal_name,'Al Noor Company');assert.equal(s.get('kyc-corporate').values.company,'شركة النور');
 edit(s,'fatca-crs-corporate','legal_name','Al Noor Investment Company');assert.equal(s.get('subscription-company').values.english_name,'Al Noor Investment Company');assert.equal(s.get('subscription-company').values.company_name,'شركة النور');
 assert.ok(!s.profile.auth_first);assert.ok(!s.get('fatca-crs-corporate').values.person_0_name);
 edit(s,'subscription-company','english_name','');assert.equal(s.get('fatca-crs-corporate').values.legal_name,'');
});
for(const [id,role,selected,prefix] of [['signature-form','signer_role','client','signer_name'],['fatca-crs-individual','capacity','holder','signer_en']])for(const before of [true,false])test(`${id}: common names work with role selected ${before?'before':'after'} entering them`,()=>{
 const s=store();if(before)edit(s,id,role,selected);name(s,id,prefix,['Abdul Rahman','Ali','','Al Ghamdi']);if(!before)edit(s,id,role,selected);
 assert.equal(s.profile.en_first,'Abdul Rahman');assert.equal(s.profile.en_last,'Al Ghamdi');assert.equal(s.get('subscription-form').values.english_name,'Abdul Rahman Ali Al Ghamdi');
 edit(s,id,role,'other');name(s,id,prefix,['Different','Person','','Family']);assert.equal(s.profile.en_first,'Abdul Rahman');
});
test('signature ID types recognize paper labels and update after a later correction',()=>{
 const s=store();edit(s,'signature-form','id_type','Passport');edit(s,'signature-form','id_number','001234');edit(s,'signature-form','signer_role','client');
 assert.equal(s.get('subscription-form').values.id_type,'passport');assert.equal(s.get('kyc-individual').values.id_number,'001234');
 edit(s,'subscription-form','id_type','national');assert.equal(s.get('signature-form').values.id_type,'National ID');
 edit(s,'signature-form','id_type','جواز سفر');assert.equal(s.profile.id_type,'passport');
 edit(s,'signature-form','id_type','Emergency travel document');assert.equal(s.profile.id_type,'other');assert.equal(s.profile.id_other,'Emergency travel document');
});
test('residence-first address prefills ordinary mailing fields, with city and district joined only on paper',()=>{
 const s=store();edit(s,'fatca-crs-individual','sa_city','Riyadh');edit(s,'fatca-crs-individual','sa_district','Al Nakheel');
 assert.equal(s.get('subscription-form').values.city,'Riyadh');assert.equal(s.get('kyc-individual').values.city,'Riyadh Al Nakheel');assert.equal(s.get('kyc-individual').values.address_city,'Riyadh');
 edit(s,'kyc-individual','address_district','Al Malqa');assert.equal(s.get('subscription-form').values.district,'Al Malqa');assert.equal(s.get('fatca-crs-individual').values.sa_district,'Al Nakheel');
 edit(s,'fatca-crs-individual','sa_city','Jeddah');assert.equal(s.get('subscription-form').values.city,'Jeddah');
 assert.ok(!s.get('fatca-crs-individual').values.outside_city);assert.ok(!s.get('fatca-crs-individual').values.tax_country_0);
});
test('deliberately different addresses and explicit blank countries survive shared edits and browser reload',()=>{
 const d=disk(),s=store(d);edit(s,'subscription-form','city','Riyadh');edit(s,'fatca-crs-individual','sa_city','Dammam');edit(s,'subscription-form','city','Jeddah');
 assert.equal(s.get('fatca-crs-individual').values.sa_city,'Dammam');assert.equal(s.get('fatca-crs-individual').values.mail_city,'Jeddah');
 edit(s,'fatca-crs-individual','sa_country','');s.initializeCountries('fatca-crs-individual','en');assert.equal(s.get('fatca-crs-individual').values.sa_country,'');
 assert.equal(store(d).get('fatca-crs-individual').values.sa_city,'Dammam');assert.equal(store(d).get('fatca-crs-individual').values.sa_country,'');
});
test('company addresses share without the removed switches while head office and other people stay independent',()=>{
 const s=store(disk(),'corporate');edit(s,'kyc-corporate','city','Riyadh');edit(s,'kyc-corporate','street','King Road');
 assert.equal(s.get('fatca-crs-corporate').values.residence_city,'Riyadh');assert.equal(s.get('subscription-company').values.city,'Riyadh');assert.match(s.get('kyc-corporate').values.contact_address,/Riyadh/);
 edit(s,'kyc-corporate','contact_address','Independent postal delivery address');edit(s,'kyc-corporate','city','Jeddah');
 assert.equal(s.get('kyc-corporate').values.contact_address,'Independent postal delivery address');assert.match(s.get('kyc-corporate').values.address,/Jeddah/);
 assert.ok(!s.get('fatca-crs-corporate').values.head_city);assert.ok(!s.get('kyc-corporate').values.auth_city);
});
test('new shared keys survive cleaning, stay scoped, and every mapping points to a real field',()=>{
 const profile={company_name_ar:'شركة النور',company_name_en:'Al Noor',address_primary_role:'registered',registered_city:'Riyadh',mail_city:'Jeddah',mail_country:''};
 assert.deepEqual(cleanShared('corporate',profile),profile);assert.ok(!cleanShared('individual',profile).company_name_en);
 for(const audience of ['individual','corporate'])for(const doc of docs)for(const id of Object.keys(sharedRules(doc,{signer_role:audience==='individual'?'client':'authorized',capacity:'holder'},{},audience)))assert.ok(doc.fields.some(f=>f.id===id),doc.id+'/'+id);
});
test('legacy Latin subscription names migrate to their English row without altering historical snapshots',()=>{
 const d=disk(),prefix='itqan.forms.v1.account.qa.individual.';
 d.setItem(prefix+'subscription-form',JSON.stringify({values:{first_name:'Old',second_name:'Ali',family_name:'Family'},shared:{},overrides:[]}));
 const s=store(d);assert.equal(s.get('subscription-form').values.english_name,'Old Ali Family');assert.ok(!s.get('subscription-form').values.first_name);
 s.save('subscription-form',{...s.get('subscription-form').values,first_name:'أحمد'},0,{},'first_name');assert.equal(store(d).get('subscription-form').values.first_name,'أحمد');
 const revision=createDraftStore(docs,()=>d,'individual','qa','a'.repeat(32));revision.loadSubmission('subscription-form',{id:'a'.repeat(32),current_id:'a'.repeat(32),version:1,answers:{first_name:'Historic',second_name:'Ali',family_name:'Family'},profile:{},signatures:{}});assert.equal(revision.get('subscription-form').values.first_name,'Historic');
});
test('explicit company language blanks do not fall back to legacy names',()=>{
 const doc=docs.find(d=>d.id==='subscription-company');
 assert.equal(sharedCandidates(doc,{company_name:'Legacy English',company_name_en:''},{},'corporate').english_name,'');
 assert.equal(sharedCandidates(doc,{company_name:'شركة قديمة',company_name_ar:''},{},'corporate').company_name,'');
});
test('company combined postal codes share both components while a separate head office never seeds the main address',()=>{
 const s=store(disk(),'corporate');edit(s,'fatca-crs-corporate','head_city','London');edit(s,'fatca-crs-corporate','head_postal','SW1A 1AA');
 assert.ok(!s.profile.city);assert.ok(!s.profile.postal);assert.ok(!s.get('subscription-company').values.city);
 edit(s,'fatca-crs-corporate','residence_postal','12345 6789');assert.equal(s.get('subscription-company').values.postal,'12345');assert.equal(s.get('subscription-company').values.additional,'6789');
 edit(s,'fatca-crs-corporate','residence_postal','');assert.equal(s.get('subscription-company').values.postal,'');assert.equal(s.get('subscription-company').values.additional,'');assert.equal(s.get('fatca-crs-corporate').values.head_postal,'SW1A 1AA');
});
