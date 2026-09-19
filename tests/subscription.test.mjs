import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {calculateSubscription,arabicRiyals,formatSubscriptionNumber} from '../src/subscription/calculations.js';
import {normalizeSubscription,missingRequired,visibleFields,sectionProgress,canonicalSubscription} from '../src/subscription/model.js';
import {cleanShared,sharedCandidates} from '../src/shared-fields.js';
import {createDraftStore} from '../src/drafts.js';
const individual=docs.find(d=>d.id==='subscription-form'),company=docs.find(d=>d.id==='subscription-company');
test('the server and browser derive identical totals from units; caller prices are ignored',()=>{
 const input=['','١٠','۱۰','10','1','2','25','101','999','1000','1000001','999999999','1,000','1,000,001','١٬٠٠٠','۹۹۹٬۹۹۹٬۹۹۹'];
 const server=JSON.parse(execFileSync('php',['-r',`require 'public/api/subscription/calculate.php';echo json_encode(array_map('subscription_calculate',json_decode($argv[1])));`,JSON.stringify(input)],{encoding:'utf8'}));
 assert.deepEqual(server,input.map(calculateSubscription));
 assert.deepEqual(calculateSubscription('10'),{fund_name:'صندوق النعيم العقاري',currency:'ريال سعودي',unit_price:'1000',units:'10',amount_subscribed:'10000',subscription_fee:'200',total_amount:'10200',total_words:'عشرة آلاف ومائتا ريال سعودي'});
});
test('invalid and fractional unit counts never produce trusted totals',()=>{
 const invalid=['0','-2','1.5','١٫٥','1e3','Infinity','1,00','1,5','1,000,','1,000٬000','1 000','9999999999','bad'];
 for(const value of invalid)assert.throws(()=>calculateSubscription(value));
 const rejected=JSON.parse(execFileSync('php',['-r',`require 'public/api/subscription/calculate.php';echo json_encode(array_map(function($v){try{subscription_calculate($v);return false;}catch(InvalidArgumentException $e){return true;}},json_decode($argv[1])));`,JSON.stringify(invalid)],{encoding:'utf8'}));
 assert.ok(rejected.every(Boolean));
 const v=normalizeSubscription(individual,{units:'1.5'});assert.equal(v.total_amount,'');assert.ok(missingRequired(individual,v,{}).includes('units'));
});
test('display grouping leaves canonical financial values numeric',()=>{
 const v=calculateSubscription('1,000');
 assert.equal(v.units,'1000');assert.equal(v.total_amount,'1020000');
 assert.equal(formatSubscriptionNumber(v.units),'1,000');
 assert.equal(formatSubscriptionNumber(v.amount_subscribed),'1,000,000');
 assert.equal(formatSubscriptionNumber(v.subscription_fee),'20,000');
 assert.equal(formatSubscriptionNumber(v.total_amount),'1,020,000');
 assert.equal(formatSubscriptionNumber(calculateSubscription('999999999').total_amount),'1,019,999,998,980');
 assert.equal(formatSubscriptionNumber(''),'');assert.equal(formatSubscriptionNumber('1.5'),'1.5');
});
test('Arabic amount wording handles scale and attached dual forms',()=>{
 assert.equal(arabicRiyals(10200),'عشرة آلاف ومائتا ريال سعودي');
 assert.equal(arabicRiyals(2040),'ألفان وأربعون ريال سعودي');
 assert.equal(arabicRiyals(200000),'مائتا ألف ريال سعودي');
 assert.equal(arabicRiyals(1000001),'مليون وواحد ريال سعودي');
});
test('third name is optional, applicant auto-follows names until deliberately edited',()=>{
 const base={first_name:'أحمد',second_name:'محمد',family_name:'العلي',nationality:'سعودي',id_type:'national',id_number:'001234',subscription_type:'new',payment_method:'transfer',units:'10'};
 let v=normalizeSubscription(individual,base);assert.equal(v.full_name,'أحمد محمد العلي');assert.equal(v.applicant_name,v.full_name);assert.deepEqual(missingRequired(individual,v,{}),[]);
 v=normalizeSubscription(individual,{...v,third_name:'عبدالله'});assert.equal(v.applicant_name,'أحمد محمد عبدالله العلي');
 v=normalizeSubscription(individual,{...v,first_name:'علي',applicant_name_first:'اسم',applicant_name_second:'',applicant_name_third:'',applicant_name_last:'مصحح',date:'2026-10-12'},{applicantEdited:true});assert.equal(v.applicant_name,'اسم مصحح');assert.equal(v.date,'2026-10-12');
});
test('nationality precedes the dropdown, ID fields follow the selected type, company details stay separate',()=>{
 assert.ok(individual.fields.findIndex(f=>f.id==='nationality')<individual.fields.findIndex(f=>f.id==='id_type'));
 assert.equal(individual.fields.find(f=>f.id==='id_type').type,'select');
 assert.equal(visibleFields(individual,{}).some(f=>f.id==='id_number'),false);
 assert.equal(visibleFields(individual,{id_type:'passport'}).some(f=>f.id==='id_number'),true);
 assert.equal(visibleFields(individual,{id_type:'passport'}).some(f=>f.id==='id_other'),false);
 assert.equal(visibleFields(individual,{id_type:'other'}).some(f=>f.id==='id_other'),true);
 assert.equal(individual.fields.some(f=>f.id.startsWith('company_')),false);
 assert.equal(company.fields.some(f=>f.id==='first_name'),false);
});
test('signature completion requires an image only for electronic signing',()=>{
 const v=normalizeSubscription(individual,{first_name:'A',second_name:'B',family_name:'C'});const section=individual.sections.find(s=>s.id==='applicant');
 assert.deepEqual(sectionProgress(individual,section,v,{}),{completed:3,total:3});
 v.signature_mode='electronic';assert.deepEqual(sectionProgress(individual,section,v,{}),{completed:3,total:4});assert.ok(missingRequired(individual,v,{}).includes('signature_mode'));
 assert.deepEqual(sectionProgress(individual,section,v,{applicant:'image'}),{completed:4,total:4});
});
test('legacy middle names survive four-part profile migration and still feed unchanged tax forms',()=>{
 const p=cleanShared('individual',{ar_first:'أحمد',ar_middle:'محمد عبدالله',ar_last:'العلي'});
 assert.equal(p.ar_second,'محمد عبدالله');assert.equal(p.ar_middle,'محمد عبدالله');
 const tax=docs.find(d=>d.id==='fatca-crs-individual');assert.equal(sharedCandidates(tax,p,{},'individual').ar_middle,'محمد عبدالله');
 assert.equal(sharedCandidates(individual,p,{},'individual').second_name,'محمد عبدالله');
 assert.deepEqual(sharedCandidates(company,p,{},'individual'),{});
});
test('new subscription data and editable applicant survive reload without crossing audiences',()=>{
 const m=new Map(),storage=()=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
 const a=createDraftStore(docs,storage,'individual');a.setShared({ar_first:'أحمد',ar_second:'محمد',ar_last:'العلي',email:'first.last@example.com'});
 const v=normalizeSubscription(individual,a.get(individual.id).values);a.save(individual.id,{...v,applicant_name:'اختبار',units:'10'},3,{},'applicant_name');
 const b=createDraftStore(docs,storage,'individual');assert.equal(b.get(individual.id).values.applicant_name,'اختبار');assert.equal(b.get(individual.id).step,3);
 const c=createDraftStore(docs,storage,'corporate');assert.equal(c.get(company.id).values.email,undefined);
});
test('PDF canonicalization requires server agreement and clears hidden ID details',async()=>{
 const fetchBefore=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,init)=>{assert.deepEqual(JSON.parse(init.body),{units:'10'});return {ok:true,json:async()=>calculateSubscription('10')};};
  const v=await canonicalSubscription(individual,{units:'10',total_amount:'1',unit_price:'1',id_type:'national',id_other:'STALE',first_name:'A',second_name:'B',family_name:'C'});
  assert.equal(v.total_amount,'10200');assert.equal(v.unit_price,'1000');assert.equal(v.id_other,undefined);
  for(const [title,expected] of [['dr','Dr. / الدكتور'],['eng','Eng. / المهندس']]){
   const custom=await canonicalSubscription(individual,{units:'10',title,id_type:'other',id_other:'وثيقة سفر'});
   assert.equal(custom.title_label,expected);assert.equal(custom.id_other,'وثيقة سفر');assert.equal(custom.id_type_label,'أخرى / Other');
  }
  globalThis.fetch=async()=>({ok:true,json:async()=>({...calculateSubscription('10'),total_amount:'1'})});await assert.rejects(()=>canonicalSubscription(individual,{units:'10'}),/calculation_mismatch/);
 }finally{globalThis.fetch=fetchBefore;}
});
test('clearing a migrated middle name does not resurrect the old value',()=>{
 const p=cleanShared('individual',{ar_first:'أحمد',ar_middle:'محمد',ar_last:'علي'});
 const cleared=cleanShared('individual',{...p,ar_second:''});assert.equal(cleared.ar_second,'');assert.equal(cleared.ar_middle,undefined);
});
test('saved legacy subscription names, IDs and applicant correction migrate into each new audience form',()=>{
 const m=new Map();const storage=()=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
 m.set('itqan.forms.v1.individual.subscription-form',JSON.stringify({values:{ar_name:'أحمد محمد عبدالله العلي',id_type:'national',id_number:'00123',units:'10',applicant_name:'أحمد العلي'},signatures:{},step:3}));
 m.set('itqan.forms.v1.corporate.subscription-form',JSON.stringify({values:{ar_name:'شركة النور',company_id_number:'40301234',company_id_type:'cr',applicant_name:'محمد العلي'},signatures:{},step:3}));
 const individualStore=createDraftStore(docs,storage,'individual'),companyStore=createDraftStore(docs,storage,'corporate');
 const a=individualStore.get('subscription-form'),b=companyStore.get('subscription-company');
 assert.equal(a.values.first_name,'أحمد');assert.equal(a.values.second_name,'محمد');assert.equal(a.values.third_name,'عبدالله');assert.equal(a.values.family_name,'العلي');assert.equal(a.values.id_number,'00123');assert.ok(a.overrides.includes('applicant_name'));
 assert.equal(b.values.company_name,'شركة النور');assert.equal(b.values.company_id_number,'40301234');assert.equal(b.values.auth_name,'محمد العلي');
});
test('retired family IDs retain their details under Other without appearing in dropdowns',()=>{
 const p=cleanShared('individual',{name_language:'ar',en_first:'Alice',en_second:'Jane',en_last:'Smith',id_type:'family',id_number:'001234'});
 const v=sharedCandidates(individual,p,{},'individual');assert.equal(v.first_name,'Alice');assert.equal(v.second_name,'Jane');assert.equal(v.id_type,'other');assert.equal(v.id_other,'بطاقة عائلية / Family ID');
 assert.equal(individual.fields.find(f=>f.id==='id_type').selectOptions.some(o=>o[0]==='family'),false);
 const legacy=normalizeSubscription(individual,{id_type:'family',id_number:'001234'});assert.equal(legacy.id_type,'other');assert.equal(legacy.id_other,v.id_other);assert.equal(legacy.id_number,'001234');
 const corporate=cleanShared('corporate',{auth_id_type:'family',auth_id:'001234'});assert.equal(corporate.auth_id_type,'other');assert.equal(corporate.auth_id_other,v.id_other);
 assert.ok(visibleFields(individual,v).some(f=>f.id==='id_number'));
});

test('restored English names reuse the matching profile and keep deliberate corrections',()=>{
 const m=new Map(),storage=()=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
 const store=createDraftStore(docs,storage,'individual');store.setShared({en_first:'Ahmad',en_second:'Mohammed',en_last:'Ali',ar_first:'أحمد',ar_second:'محمد',ar_last:'علي',name_language:'ar',title:'mr'});
 assert.equal(store.get(individual.id).values.english_name,'Ahmad Mohammed Ali');assert.equal(store.get(individual.id).values.title,'mr');
 store.save(individual.id,{...store.get(individual.id).values,english_name:'Ahmed M Ali'},0,{},'english_name');store.setShared({...store.profile,en_first:'New spelling'});
 assert.equal(store.get(individual.id).values.english_name,'Ahmed M Ali');
 assert.equal(sharedCandidates(company,store.profile,{},'individual').english_name,undefined);
});
test('legacy translated name and P.O. Box survive subscription template migration',()=>{
 const m=new Map([['itqan.forms.v1.individual.subscription-form',JSON.stringify({values:{ar_name:'أحمد محمد علي',en_name:'Ahmed Mohammed Ali',pob:'001234'}})]]);
 const store=createDraftStore(docs,()=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}),'individual');
 assert.equal(store.get(individual.id).values.english_name,'Ahmed Mohammed Ali');assert.equal(store.get(individual.id).values.po_box,'001234');
});
