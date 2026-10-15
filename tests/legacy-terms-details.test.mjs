import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyTermsDefinitions,legacyTermsDefinitionsFor} from '../src/portal/legacy-terms-definitions.js';
import {submissionDetailsModel,renderSubmissionDetails} from '../src/portal/submitted-details.js';

const archived=JSON.parse(readFileSync('reference/documents/archived/terms-13-page-schema.json'));
const fields=model=>model.groups.flatMap(group=>group.fields);
const base={id:'synthetic-history',doc_id:'terms-and-conditions',audience:'individual',source:'online',profile:{},answers:{terms_consent:'yes',authorization_consent:'no',terms_name_0:'Saved Investor',terms_date:'2026-09-28'},signatures:{}};

test('compact legacy terms labels exactly match the frozen schema without PDF geometry',()=>{
 const expected=archived.fields.map(field=>{
  const out=Object.fromEntries(['id','label','ar','type','hidden','uiOnly','joinAudience','sum'].filter(k=>k in field).map(k=>[k,field[k]]));
  if(field.options)out.options=field.options.map(({value,label,ar})=>({value,label,ar}));return out;
 });
 assert.deepEqual(legacyTermsDefinitions.field_definitions,expected);
 assert.deepEqual(legacyTermsDefinitions.section_definitions,archived.sections.map(s=>({id:s.id,title:s.title,ar:s.ar,field_ids:s.fields.map(f=>f.id)})));
 assert.deepEqual(legacyTermsDefinitions.signature_definitions,archived.signatureSlots.map(({id,label,ar})=>({id,label,ar})));
});

test('13-page and retired 24-page details retain bilingual old questions and signer labels',()=>{
 for(const pages of [13,24])for(const lang of ['en','ar']){
  const submission={...base,profile:{pdf_layout:{pages}}},before=structuredClone(submission),model=submissionDetailsModel(submission,lang),rows=fields(model);
  assert.deepEqual(model.groups.map(g=>g.id),['terms','authorization']);
  assert.equal(rows.find(f=>f.id==='terms_consent').value,lang==='en'?'Yes':'نعم');
  assert.equal(rows.find(f=>f.id==='authorization_consent').value,lang==='en'?'No':'لا');
  assert.equal(rows.find(f=>f.id==='terms_name_0').value,'Saved Investor');
  assert.equal(rows.find(f=>f.id==='terms_date').direction,'ltr');
  assert.equal(rows.some(f=>f.id==='investor_name'||f.id==='date'),false);
  assert.deepEqual(model.signatures.map(s=>s.id),['terms_0','terms_1','terms_2','authorization_0','authorization_1','authorization_2']);
  assert.equal(model.signatures[0].label,lang==='en'?'Account terms — signer 1':'شروط الحساب — الموقع 1');
  assert.deepEqual(submission,before);
 }
});

test('legacy keys and signature policy identify pre-snapshot terms, while explicit current layouts take precedence',()=>{
 for(const submission of [base,{...base,answers:{authorization_name_2_last:'Saved'}},{...base,answers:{},signatures:{terms_0:'stored'}},{...base,answers:{},profile:{signature_submission_policy:{signatureSlots:[{id:'authorization_0'}]}}}])assert.equal(legacyTermsDefinitionsFor(submission),legacyTermsDefinitions);
 assert.equal(legacyTermsDefinitionsFor({...base,profile:{pdf_layout:{pages:38}}}),null);
 assert.equal(legacyTermsDefinitionsFor({...base,doc_id:'signature-form'}),null);
 assert.equal(legacyTermsDefinitionsFor({...base,answers:{investor_name:'Current',date:'2026-10-15'}}),null);
 assert.equal(fields(submissionDetailsModel(base)).find(f=>f.id==='authorization_consent').label,legacyTermsDefinitions.field_definitions.find(f=>f.id==='authorization_consent').label);
});

test('captured definitions win independently; only API-marked current fallbacks are replaced',()=>{
 const profile={pdf_layout:{pages:13},field_definitions:[{id:'terms_name_0',label:'Captured name',ar:'الاسم المحفوظ',type:'text'}],section_definitions:[{id:'captured',title:'Captured section',ar:'القسم المحفوظ',field_ids:['terms_name_0']}],signature_definitions:[{id:'terms_0',label:'Captured signer',ar:'الموقع المحفوظ'}]};
 const model=submissionDetailsModel({...base,profile});assert.equal(fields(model).find(f=>f.id==='terms_name_0').label,'Captured name');assert.equal(model.groups[0].label,'Captured section');assert.equal(model.signatures[0].label,'Captured signer');
 const marked={...profile,definition_fallback:['section_definitions','signature_definitions'],section_definitions:[{id:'investor',title:'Current investor',field_ids:['investor_name','date']}],signature_definitions:[{id:'investor',label:'Current investor'}]};
 const mixed=submissionDetailsModel({...base,profile:marked});assert.equal(fields(mixed).find(f=>f.id==='terms_name_0').label,'Captured name');assert.equal(mixed.groups[0].id,'terms');assert.equal(mixed.signatures[0].id,'terms_0');
 marked.field_definitions=[{id:'investor_name',label:'Current investor'},{id:'date',label:'Current date'}];marked.definition_fallback.push('field_definitions');
 const fallback=submissionDetailsModel({...base,profile:marked});assert.equal(fields(fallback).some(f=>f.id==='investor_name'||f.id==='date'),false);assert.equal(fields(fallback).find(f=>f.id==='terms_name_0').label,'Client Name');
 const empty=submissionDetailsModel({...base,profile:{...profile,field_definitions:[],section_definitions:[],signature_definitions:[]},answers:{}});assert.deepEqual(empty.groups,[]);assert.deepEqual(empty.signatures,[]);
});

test('company histories hide individual name parts, unknown answers remain escaped, and uploads stay PDF-only',()=>{
 const submission={...base,audience:'corporate',answers:{terms_name_0:'Saved Company',terms_name_0_first:'Wrong audience',old_extra:'<script>unsafe()</script>'}},model=submissionDetailsModel(submission);
 assert.equal(fields(model).some(f=>f.id==='terms_name_0_first'),false);assert.equal(fields(model).find(f=>f.id==='terms_name_0').value,'Saved Company');assert.equal(fields(model).find(f=>f.id==='old_extra').value,'<script>unsafe()</script>');
 const html=renderSubmissionDetails(submission);assert.ok(html.includes('&lt;script&gt;unsafe()&lt;/script&gt;'));assert.ok(!html.includes('<script>'));
 const uploaded=submissionDetailsModel({...submission,source:'upload'});assert.deepEqual(uploaded.groups,[]);assert.deepEqual(uploaded.signatures,[]);
});
