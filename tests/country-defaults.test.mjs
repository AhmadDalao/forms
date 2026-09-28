import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {countryFields,defaultCountries} from '../src/countries.js';
import {createDraftStore} from '../src/drafts.js';
import {sharedGroups} from '../src/shared-fields.js';

const saudi={en:'Saudi Arabia',ar:'المملكة العربية السعودية'};
const storage=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};
};
const doc=id=>docs.find(d=>d.id===id);
const record=values=>({values,overrides:[],shared:{},signatures:{},signatureModes:{},step:0});
const expected={
 'signature-form':[],
 'al-naeem-terms-consent':[],
 'subscription-form':['country'],
 'subscription-company':['inc_country','country'],
 'terms-and-conditions':[],
 'fatca-crs-individual':['birth_country','sa_country','mail_country'],
 'fatca-crs-corporate':['inc_country','residence_country','head_country','tax_country_0','tax_country_1','tax_country_2',...Array.from({length:5},(_,i)=>`person_${i}_country`)],
 'kyc-individual':['country','bank_country'],
 'kyc-corporate':['registration_country','inc_country','bank_country'],
};
const optionalCorporate=['tax_country_1','tax_country_2',...Array.from({length:5},(_,i)=>`person_${i}_country`)];

test('country defaults cover existing ordinary country fields without nationality or foreign-only answers',()=>{
 assert.deepEqual(Object.fromEntries(docs.map(d=>[d.id,countryFields(d).map(f=>f.id).sort()])),Object.fromEntries(Object.entries(expected).map(([id,fields])=>[id,[...fields].sort()])));
 for(const d of docs){
  const selected=countryFields(d);
  assert.equal(new Set(selected.map(f=>f.id)).size,selected.length,d.id+' has no duplicated country default');
  for(const f of selected){
   const schema=d.fields.find(field=>field.id===f.id);assert.ok(schema,d.id+'/'+f.id);
   assert.equal(schema.type,'text');assert.ok(!schema.readOnly&&!schema.readonly&&!schema.disabled&&!schema.locked,d.id+'/'+f.id+' remains editable');
   for(const trigger of f.whenAny||[]){assert.notEqual(trigger,f.id,'A default cannot activate its own row');assert.ok(d.fields.some(field=>field.id===trigger),d.id+'/'+trigger);}
  }
  for(const f of d.fields.filter(f=>/nationality|overseas_countries/.test(f.id)))assert.equal(selected.some(s=>s.id===f.id),false,d.id+'/'+f.id);
 }
 for(const id of ['outside_country','tax_country_0','tax_country_1','tax_country_2'])assert.equal(countryFields(doc('fatca-crs-individual')).some(f=>f.id===id),false,id);
 const conditional=countryFields(doc('fatca-crs-corporate')).filter(f=>f.whenAny?.length).map(f=>f.id);
 assert.deepEqual(conditional.sort(),[...optionalCorporate].sort());
});

test('new forms receive editable Saudi country defaults in either language without activating optional rows',()=>{
 for(const lang of ['en','ar'])for(const d of docs){
  const schema=structuredClone(d),original=record({}),before=structuredClone(original),next=defaultCountries(d,original,lang);
  const ids=(expected[d.id]||[]).filter(id=>d.id!=='fatca-crs-corporate'||!optionalCorporate.includes(id));
  assert.deepEqual(next.values,Object.fromEntries(ids.map(id=>[id,saudi[lang]])),d.id+'/'+lang);
  assert.deepEqual(Object.keys(next.countryDefaults||{}).sort(),[...ids].sort());
  assert.deepEqual(original,before,'Initialization must not mutate an existing record');assert.deepEqual(d,schema,'Defaults must not change the official schema');
  assert.deepEqual(defaultCountries(d,next,lang),next,'Repeated initialization is stable');
 }
});

test('chosen values, explicit blanks and overrides survive country initialization unchanged',()=>{
 const d=doc('fatca-crs-individual'),original={...record({birth_country:'United Kingdom',sa_country:'',mail_country:'  ',outside_country:'France',tax_country_0:'Canada'}),overrides:['birth_country','mail_country']};
 const next=defaultCountries(d,original,'ar');assert.deepEqual(next.values,original.values);assert.deepEqual(next.countryDefaults||{},{});
 const suppressed=defaultCountries(doc('kyc-individual'),{...record({}),overrides:['country','bank_country']});
 assert.deepEqual(suppressed.values,{});assert.deepEqual(suppressed.countryDefaults||{},{});
});

test('each optional corporate tax and controlling-person row defaults only once another row answer exists',()=>{
 const d=doc('fatca-crs-corporate');
 for(const field of countryFields(d).filter(f=>f.whenAny?.length)){
  for(const trigger of field.whenAny){
   const next=defaultCountries(d,record({[trigger]:'Example answer'}),'ar');assert.equal(next.values[field.id],saudi.ar,field.id+' triggered by '+trigger);
   for(const untouched of optionalCorporate.filter(id=>id!==field.id))assert.equal(next.values[untouched],undefined,untouched+' remains an unused row');
   const cleared=defaultCountries(d,{...next,values:{...next.values,[trigger]:''}},'ar');assert.equal(cleared.values[field.id],undefined,'Clearing '+trigger+' removes only its automatic country');assert.equal(cleared.countryDefaults?.[field.id],undefined);
  }
  const blank=defaultCountries(d,record(Object.fromEntries(field.whenAny.map(id=>[id,'  ']))));assert.equal(blank.values[field.id],undefined);
 }
});

test('optional-row country removal preserves explicit country answers and blank overrides',()=>{
 const d=doc('fatca-crs-corporate');
 for(const id of optionalCorporate){
  const explicit=defaultCountries(d,record({[id]:'Bahrain'}));assert.equal(explicit.values[id],'Bahrain');
  const blank=defaultCountries(d,{...record({[id]:''}),overrides:[id]});assert.equal(blank.values[id],'');
  assert.equal(blank.countryDefaults?.[id],undefined);
 }
});

test('country initialization persists only the opened form and manual blank overrides survive reload',()=>{
 const disk=storage(),d=doc('kyc-individual'),store=createDraftStore(docs,()=>disk,'individual');
 assert.equal(disk.m.size,0);assert.equal(store.initializeCountries(d.id,'en'),true);
 assert.equal(store.get(d.id).values.country,saudi.en);assert.equal(store.get(d.id).values.bank_country,saudi.en);assert.equal(disk.m.size,1);assert.equal(store.has('subscription-form'),false);
 store.save(d.id,{...store.get(d.id).values,country:'Qatar'},0,{},'country');
 store.save(d.id,{...store.get(d.id).values,bank_country:''},0,{},'bank_country');
 const reopened=createDraftStore(docs,()=>disk,'individual');reopened.initializeCountries(d.id,'ar');
 assert.equal(reopened.get(d.id).values.country,'Qatar');assert.equal(reopened.get(d.id).values.bank_country||'','');assert.ok(reopened.get(d.id).overrides.includes('bank_country'));
 assert.equal(reopened.get(d.id).countryDefaults?.country,undefined);assert.equal(reopened.get(d.id).countryDefaults?.bank_country,undefined);
});

test('shared country edits replace automatic fallbacks, link corrections and preserve explicit blanks until another edit',()=>{
 const disk=storage(),d=doc('kyc-individual'),store=createDraftStore(docs,()=>disk,'individual');store.initializeCountries(d.id);
 store.setShared({country:'United Arab Emirates'});assert.equal(store.get(d.id).values.country,'United Arab Emirates');assert.equal(store.get(d.id).values.bank_country,saudi.en);
 assert.equal(store.get(d.id).countryDefaults?.country,undefined);
 store.save(d.id,{...store.get(d.id).values,country:'Qatar'},0,{},'country');assert.equal(store.profile.country,'Qatar');store.setShared({country:'Bahrain'});assert.equal(store.get(d.id).values.country,'Bahrain');
 store.save(d.id,{...store.get(d.id).values,country:''},0,{},'country');
 const reopened=createDraftStore(docs,()=>disk,'individual');reopened.initializeCountries(d.id);assert.equal(reopened.get(d.id).values.country||'','');reopened.setShared({country:'Kuwait'});assert.equal(reopened.get(d.id).values.country,'Kuwait');
 reopened.useShared(d.id,'country');assert.equal(reopened.get(d.id).values.country,'Kuwait');
});

test('shared country initialization is audience-specific and does not refill deliberately cleared profile countries',()=>{
 const disk=storage(),individual=createDraftStore(docs,()=>disk,'individual','customer'),company=createDraftStore(docs,()=>disk,'corporate','customer');
 individual.initializeSharedCountries('en');company.initializeSharedCountries('ar');
 assert.equal(individual.profile.country,saudi.en);assert.equal(individual.profile.inc_country,undefined);assert.equal(company.profile.country,saudi.ar);assert.equal(company.profile.inc_country,saudi.ar);
 assert.equal(individual.profile.nationality,undefined);assert.equal(company.profile.auth_nationality,undefined);
 for(const audience of ['individual','corporate'])for(const field of sharedGroups(audience).flatMap(g=>g.fields).filter(f=>['country','inc_country'].includes(f.id)))assert.ok(!field.readOnly&&!field.readonly&&!field.disabled&&!field.locked);
 individual.setShared({...individual.profile,country:''});const reopened=createDraftStore(docs,()=>disk,'individual','customer');reopened.initializeSharedCountries('ar');assert.equal(reopened.profile.country||'','');
 assert.equal(createDraftStore(docs,()=>disk,'corporate','customer').profile.country,saudi.ar);
 assert.equal(createDraftStore(docs,()=>disk,'individual','other-customer').profile.country,undefined);
});

test('corporate optional country defaults are added and removed during ordinary draft saves',()=>{
 const disk=storage(),id='fatca-crs-corporate',store=createDraftStore(docs,()=>disk,'corporate');store.initializeCountries(id);
 store.save(id,{...store.get(id).values,person_2_name:'Controller'},3,{},'person_2_name');assert.equal(store.get(id).values.person_2_country,saudi.en);
 const reopened=createDraftStore(docs,()=>disk,'corporate');reopened.initializeCountries(id);assert.equal(reopened.get(id).countryDefaults.person_2_country,saudi.en);
 reopened.save(id,{...reopened.get(id).values,person_2_name:''},3,{},'person_2_name');assert.equal(reopened.get(id).values.person_2_country,undefined);
 reopened.save(id,{...reopened.get(id).values,person_2_country:'Bahrain'},3,{},'person_2_country');
 reopened.save(id,{...reopened.get(id).values,person_2_name:'',person_2_tin:''},3,{},'person_2_tin');assert.equal(reopened.get(id).values.person_2_country,'Bahrain');
 assert.equal(reopened.get(id).values.person_1_country,undefined);
});

test('submitted revisions keep original countries and unanswered fields across initialization and reload',()=>{
 const disk=storage(),id='fatca-crs-corporate',sourceId='a'.repeat(32),store=createDraftStore(docs,()=>disk,'corporate','customer',sourceId);
 const snapshot={id:sourceId,current_id:sourceId,version:3,answers:{inc_country:'Bahrain',head_country:'',person_1_name:'Original controller'},signatures:{},profile:{}},original=structuredClone(snapshot);
 store.loadSubmission(id,snapshot);const before=structuredClone(store.get(id)),saved=disk.getItem(store.prefix+id);store.initializeCountries(id,'ar');assert.deepEqual(store.get(id),before);assert.equal(disk.getItem(store.prefix+id),saved);assert.deepEqual(snapshot,original);
 const reopened=createDraftStore(docs,()=>disk,'corporate','customer',sourceId);reopened.initializeCountries(id,'en');assert.equal(reopened.get(id).values.inc_country,'Bahrain');assert.equal(reopened.get(id).values.head_country||'','');assert.equal(reopened.get(id).values.person_1_country,undefined);
 assert.deepEqual(defaultCountries(doc(id),{...record({}),revision:{sourceId}},'ar').values,{});
});

test('country initialization remains isolated between audiences/accounts and handles unavailable storage',()=>{
 const disk=storage(),individual=createDraftStore(docs,()=>disk,'individual','one'),company=createDraftStore(docs,()=>disk,'corporate','one');
 individual.initializeCountries('subscription-form','en');company.initializeCountries('subscription-company','ar');
 assert.equal(individual.get('subscription-form').values.country,saudi.en);assert.equal(company.get('subscription-company').values.country,saudi.ar);
 assert.equal(individual.initializeCountries('subscription-company'),false);assert.equal(company.initializeCountries('subscription-form'),false);assert.equal(createDraftStore(docs,()=>disk,'individual','two').get('subscription-form').values.country,undefined);
 const blocked=createDraftStore(docs,()=>{throw Error('Storage blocked');},'individual');assert.equal(blocked.initializeCountries('kyc-individual'),false);assert.equal(blocked.available,false);assert.equal(blocked.get('kyc-individual').values.country,saudi.en);
});
