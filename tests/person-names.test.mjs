import test from 'node:test';
import assert from 'node:assert/strict';
import {docs as builtInDocs} from '../src/forms/index.js';
import {applyPersonNameFields,personNameGroups,personNameFieldVisible,normalizePersonNames,splitPersonName,joinPersonName} from '../src/person-names.js';

const fresh=()=>applyPersonNameFields(structuredClone(builtInDocs));
const get=(documents,id)=>documents.find(doc=>doc.id===id);
test('person-name split/join keeps every English and Arabic word including compound suffixes',()=>{
 for(const full of ['','Ahmad','Ahmad Ali','Ahmad Ali Dalao','Ahmad Ali Hassan Dalao','Ahmad Ali Hassan Al Abdul Aziz','عبدالله محمد أحمد آل عبدالعزيز'])assert.equal(joinPersonName(splitPersonName(full)),full);
 assert.deepEqual(splitPersonName('Ahmad Ali Dalao'),{first:'Ahmad',second:'Ali',third:'',last:'Dalao'});
 assert.equal(splitPersonName('Ahmad Ali Hassan Al Abdul Aziz').last,'Al Abdul Aziz');
 assert.equal(joinPersonName(splitPersonName('  Ahmad\tAli  Hassan  Dalao ')),'Ahmad Ali Hassan Dalao');
});
test('schema conversion keeps each original PDF rectangle and required flags without requiring new parts',()=>{
 const original=structuredClone(builtInDocs),documents=fresh();
 for(const doc of documents)for(const group of doc.personNameGroups||[]){
  assert.equal(group.partIds.length,4);
  for(const target of group.targets){const field=doc.fields.find(f=>f.id===target.id),before=get(original,doc.id).fields.find(f=>f.id===target.id);assert.deepEqual(field.rect,before.rect);assert.equal(field.page,before.page);assert.equal(field.required,before.required);assert.deepEqual(field.join,target.join);}
  for(const id of group.partIds){const field=doc.fields.find(f=>f.id===id);assert.equal(field.uiOnly,true);assert.equal(field.rect,null);assert.notEqual(field.required,true);assert.equal(doc.sections.flatMap(s=>s.fields).filter(f=>f===field).length,1);}
  assert.equal(doc.fields.find(f=>f.id===group.partIds[2]).optional,true);
 }
 const individual=get(documents,'subscription-form'),english=personNameGroups(individual).find(g=>g.id==='english_name');assert.deepEqual(english.partIds,['en_first','en_second','en_third','en_last']);assert.equal(english.optional,true);assert.ok(english.partIds.every(id=>individual.fields.find(f=>f.id===id).optional));
 const before=JSON.stringify(documents);applyPersonNameFields(documents);assert.equal(JSON.stringify(documents),before,'Applying twice is idempotent');
});
test('shared client-name groups are individual-only and leave corporate entity controls visible',()=>{
 for(const id of ['signature-form','terms-and-conditions']){
  const doc=get(fresh(),id),gated=doc.personNameGroups.filter(g=>g.audience==='individual');assert.ok(gated.length);
  for(const group of gated){
   assert.ok(personNameGroups(doc,'individual').includes(group));assert.ok(!personNameGroups(doc,'corporate').includes(group));
   const target=doc.fields.find(f=>f.id===group.targets[0].id);assert.equal(target.hidden,undefined);assert.equal(target.joinAudience,'individual');assert.equal(personNameFieldVisible(target,'individual'),false);assert.equal(personNameFieldVisible(target,'corporate'),true);
   for(const part of group.partIds){const field=doc.fields.find(f=>f.id===part);assert.equal(personNameFieldVisible(field,'individual'),true);assert.equal(personNameFieldVisible(field,'corporate'),false);}
   const section=doc.sections.find(s=>s.fields.includes(target)),references=section.paperGroups?section.paperGroups.flatMap(g=>g.fields):section.fields.map(f=>f.id);assert.ok(references.includes(target.id));assert.ok(group.partIds.every(id=>references.includes(id)));
   const input={[target.id]:'Example Company',...Object.fromEntries(group.partIds.map((id,i)=>[id,String(i)]))};assert.deepEqual(normalizePersonNames(doc,input,{audience:'corporate'}),input);
  }
 }
});
test('only the audited person fields receive groups; company names, lists and existing structured identities stay intact',()=>{
 const documents=fresh(),excluded={
  'subscription-company':['company_name','english_name','fund_name'],
  'kyc-corporate':['company','bank_owner','owners','directors','custodian_name','risk_client_name'],
  'kyc-individual':['employer','bank','listed_company','beneficiary_identity','custodian_name'],
  'fatca-crs-corporate':['legal_name','exchange'],
 };
 for(const [docId,ids] of Object.entries(excluded))for(const id of ids)assert.equal(get(documents,docId).fields.find(f=>f.id===id).personNameGroup,undefined,docId+'/'+id);
 assert.deepEqual(personNameGroups(get(documents,'fatca-crs-corporate')).map(g=>g.id),['person_0_name','person_1_name','person_2_name','person_3_name','person_4_name','signer_0_name','signer_1_name']);
 for(const id of ['first_name','second_name','third_name','family_name'])assert.equal(get(documents,'subscription-form').fields.find(f=>f.id===id).personNameGroup,undefined);
 for(const language of ['en','ar'])assert.deepEqual(get(documents,'fatca-crs-individual').fields.find(f=>f.id===language+'_middle').join,[language+'_second',language+'_third']);
});
test('legacy English names hydrate without losing compound words, while supplied parts and intentional blanks win',()=>{
 const doc=get(fresh(),'subscription-form'),legacy={english_name:'Ahmad Ali Hassan Al Abdul Aziz',unrelated:'kept'},copy=structuredClone(legacy),next=normalizePersonNames(doc,legacy);
 assert.deepEqual(legacy,copy);assert.equal(next.en_last,'Al Abdul Aziz');assert.equal(next.english_name,legacy.english_name);assert.equal(next.unrelated,'kept');assert.deepEqual(normalizePersonNames(doc,next),next);
 assert.deepEqual(normalizePersonNames(doc,legacy,{migrate:false}),legacy);
 assert.equal(normalizePersonNames(doc,{...legacy,en_first:'Corrected',en_last:'Family'}).english_name,'Corrected Family');
 assert.equal(normalizePersonNames(doc,{...legacy,en_first:'',en_second:'',en_third:'',en_last:''}).english_name,'');
 assert.equal(normalizePersonNames(doc,{...legacy,en_first:''}).english_name,'');
 assert.deepEqual(normalizePersonNames(doc,{}),{});
});
test('KYC has one four-part name across its two original PDF boxes and keeps legacy combined words',()=>{
 const doc=get(fresh(),'kyc-individual'),group=personNameGroups(doc).find(g=>g.id==='name');
 assert.deepEqual(group.targets,[{id:'name_1',join:['name_first','name_second']},{id:'name_2',join:['name_third','name_last']}]);
 const next=normalizePersonNames(doc,{name_1:'Ahmad Ali',name_2:'Hassan Al Abdul Aziz'});assert.equal(next.name_1,'Ahmad Ali');assert.equal(next.name_2,'Hassan Al Abdul Aziz');assert.equal(next.name_last,'Al Abdul Aziz');
 const combined=normalizePersonNames(doc,{name_1:'Ahmad Ali Hassan Dalao'});assert.equal(joinPersonName([combined.name_1,combined.name_2]),'Ahmad Ali Hassan Dalao');
 const identities=doc.sections.find(s=>s.id==='identity').paperGroups.flatMap(g=>g.fields);assert.equal(identities.filter(id=>id==='name_first').length,1);assert.ok(!identities.includes('name_1'));assert.ok(!identities.includes('name_2'));
});
test('Arabic/English signers and separate controlling persons have independent parts',()=>{
 const individual=get(fresh(),'fatca-crs-individual');assert.equal(personNameGroups(individual).find(g=>g.id==='signer_ar').language,'ar');assert.equal(personNameGroups(individual).find(g=>g.id==='signer_en').language,'en');
 const next=normalizePersonNames(individual,{signer_ar:'أحمد علي حسن العلي',signer_en:'Ahmad Ali Hassan Al Ali'});assert.equal(next.signer_ar_last,'العلي');assert.equal(next.signer_en_last,'Al Ali');
 const company=get(fresh(),'fatca-crs-corporate'),people=normalizePersonNames(company,{person_0_name:'First Client Person Family',person_1_name:'Different Client Person Family'});assert.equal(people.person_0_name_first,'First');assert.equal(people.person_1_name_first,'Different');assert.equal(people.person_2_name_first,undefined);
});
