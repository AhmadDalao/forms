import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {cleanShared,sharedCandidates} from '../src/shared-fields.js';
import {createDraftStore} from '../src/drafts.js';
import {withAnswerTotals} from '../src/answer-totals.js';
import {submissionDetailsModel} from '../src/portal/submitted-details.js';
const kyc=docs.find(d=>d.id==='kyc-individual');
const risks={risk_experience:'2',risk_age:'2',risk_reaction:'1',risk_duration:'3',risk_capital:'2'};
const disk=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('exact legacy English duplicate is removed from Arabic storage; English and explicit distinct names survive',()=>{
 const profile=Object.fromEntries(['ar','en'].flatMap(l=>['first','second','third','last'].map((p,i)=>[l+'_'+p,['Ahmad','Ali','','Family'][i]])));
 const p=cleanShared('individual',{...profile,name_language:'ar'});
 assert.equal(p.ar_first,'');assert.equal(p.en_first,'Ahmad');assert.equal(p.name_language,'en');
 assert.equal(cleanShared('individual',{...profile,ar_first:'أحمد'}).ar_first,'أحمد');
 const storage=disk(),prefix='itqan.forms.v1.account.qa.individual.';
 storage.setItem(prefix+'shared-fields',JSON.stringify(profile));
 storage.setItem(prefix+'subscription-form',JSON.stringify({nameRowsVersion:2,values:{first_name:'Ahmad',second_name:'Ali',family_name:'Family',english_name:'Ahmad Ali Family'},shared:{},overrides:[]}));
 const store=createDraftStore(docs,()=>storage,'individual','qa');
 assert.equal(store.get('subscription-form').values.first_name,'');assert.equal(store.get('subscription-form').values.english_name,'Ahmad Ali Family');
});
test('telephone defaults use mobile without replacing a custom phone, deliberate blank or another person',()=>{
 for(const audience of ['individual','corporate']){
  const d=docs.find(d=>d.id==='kyc-'+(audience==='individual'?'individual':'corporate'));
  const v=sharedCandidates(d,{mobile:'0551234567'}, {},audience);assert.equal(v.phone,'0551234567');
  assert.equal(sharedCandidates(d,{mobile:'0551234567',phone:''},{},audience).phone,'');
  assert.equal(sharedCandidates(d,{mobile:'0551234567',phone:'0112345678'},{},audience).phone,'0112345678');
  for(const id of ['rep_phone','employer_phone','rep_id','iban','cr'])assert.ok(!v[id]);
 }
});
test('ID dropdowns retain the original checkboxes on paper and preserve representative independence',()=>{
 const primary=kyc.fields.find(f=>f.id==='id_type'),rep=kyc.fields.find(f=>f.id==='rep_type');
 assert.equal(primary.control,'select');assert.equal(primary.type,'choice');assert.ok(primary.options.every(o=>o.rect));
 assert.equal(rep.control,'select');assert.equal(rep.type,'text');assert.equal(sharedCandidates(kyc,{id_type:'passport'},{},'individual').rep_type,undefined);
});
test('risk total derives from five selected answers, clears when incomplete and cannot be forged on backend',()=>{
 assert.equal(withAnswerTotals(kyc.fields,{...risks,risk_total:'999'}).risk_total,'10');
 assert.equal(withAnswerTotals(kyc.fields,{...risks,risk_age:''}).risk_total,'');
 const php=`function textValue($x){return (string)$x;} function reject($x){throw new Exception($x);} require 'public/api/portal-answers.php'; echo json_encode(cleanAnswers(json_decode($argv[1],true),json_decode($argv[2],true),'individual'));`;
 const result=JSON.parse(execFileSync('php',['-r',php,JSON.stringify(kyc),JSON.stringify({...risks,risk_total:'999'})],{encoding:'utf8'}));assert.equal(result.risk_total,'10');
});
test('historical risk totals display from saved selections without changing immutable answers',()=>{
 const submission={id:'old',doc_id:kyc.id,audience:'individual',answers:{...risks},profile:{field_definitions:kyc.fields.map(({sum,...f})=>f)}};
 const before=JSON.stringify(submission);const model=submissionDetailsModel(submission);
 assert.equal(model.groups.flatMap(g=>g.fields).find(f=>f.id==='risk_total').value,'10');assert.equal(JSON.stringify(submission),before);
});
test('subscription rejects Latin-only text in its Arabic row before PDF generation and on server',async()=>{
 const {arabicNameErrors}=await import('../src/subscription/model.js');const doc=docs.find(d=>d.id==='subscription-form');
 assert.deepEqual(arabicNameErrors(doc,{first_name:'Ahmad',second_name:'Ali',third_name:'',family_name:'العلي'}),['first_name','second_name']);
 assert.deepEqual(arabicNameErrors(doc,{first_name:'أحمد',second_name:'علي',third_name:'',family_name:'العلي'}),[]);
 const php=`function textValue($x){return (string)$x;} function reject($x,$status=400){throw new Exception($x);} require 'public/api/portal-answers.php';try{cleanAnswers(json_decode($argv[1],true),['first_name'=>'Ahmad'],'individual');}catch(Exception $e){echo $e->getMessage();}`;
 assert.equal(execFileSync('php',['-r',php,JSON.stringify(doc)],{encoding:'utf8'}),'arabic_name_required');
});
