// Semantic contract audited against the supplied paper labels. This manifest is
// deliberately independent of sharedCandidates so an omitted mapping fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {normalizeSubscription} from '../src/subscription/model.js';
import {sharedGroups} from '../src/shared-fields.js';
const disk=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const address={short_address:'ABCD1234',building:'1122',street:'King Faisal Street',district:'Al Nakheel',city:'Al Khobar',postal:'03456',additional:'0078',country:'United Arab Emirates'};
const person={en_first:'Abdul Rahman',en_second:'Bilal',en_third:'Charles',en_last:'Al Ghamdi',ar_first:'عبد الرحمن',ar_second:'بلال',ar_third:'حسن',ar_last:'الغامدي',name_language:'en',title:'dr',gender:'male',dob:'1991-03-24',nationality:'Syrian',id_type:'other',id_other:'Travel document',id_number:'0011223344',phone:'0130123456',mobile:'0557654321',email:'individual.qa@example.test',client_number:'0000111',account_number:'0000222',...address,also_residence:true};
const company={company_name:'شركة التدقيق المستقلة',company_name_ar:'شركة التدقيق المستقلة',company_name_en:'Independent Audit Company',inc_country:'United Kingdom',company_id_type:'license',company_id_number:'LIC003344',client_number:'0000333',account_number:'0000444',phone:'0139988776',mobile:'0551122334',email:'company.qa@example.test',...address,city:'Company City',also_residence:true,also_head:true,also_mail:true,auth_first:'Company Signer',auth_second:'Ali',auth_third:'Hasan',auth_last:'Al Madani',auth_id_type:'other',auth_id_other:'Emergency passport',auth_id:'0099887766'};
for(const profile of [person,company])for(const role of ['mail','residence',...(profile===company?['registered','head']:[])])for(const key of Object.keys(address))profile[role+'_'+key]=profile[key];
company.registered_address_text=company.mail_address_text=['building','street','district','city','postal','additional','country'].map(k=>company[k]).join(' ');
const full=parts=>parts.filter(Boolean).join(' ');
const personParts=(p,lang)=>['first','second','third','last'].map(part=>p[lang+'_'+part]);
function expected(p,audience){
 const en=personParts(p,'en'),ar=personParts(p,'ar'),auth=personParts(p,'auth'),parts=p.name_language==='ar'?ar:en;
 const name=audience==='individual'?full(parts):(p.company_name_ar||p.company_name),signer=audience==='individual'?name:full(auth);
 const selected=audience==='individual'?parts:auth;
 const address=full(['building','street','district','city','postal','additional','country'].map(key=>p[key]));
 const out={
  'signature-form':{client_name:name,client_number:p.client_number,account_number:p.account_number,signer_name:signer,id_number:audience==='individual'?p.id_number:p.auth_id,id_type:audience==='individual'?p.id_other:p.auth_id_other},
  'terms-and-conditions':{terms_name_0:name,authorization_name_0:name},
 };
 const split=(doc,prefix,values)=>['first','second','third','last'].forEach((key,i)=>out[doc][prefix+'_'+key]=values[i]||'');
 if(audience==='individual'){
  out['subscription-form']={client_account:p.account_number,title:p.title,first_name:ar[0],second_name:ar[1],third_name:ar[2],family_name:ar[3],nationality:p.nationality,id_type:p.id_type,id_other:p.id_other,id_number:p.id_number,english_name:full(en),phone:p.phone,mobile:p.mobile,...Object.fromEntries(['short_address','building','street','additional','district','postal','city','email','country'].map(key=>[key,p[key]]))};
  split('subscription-form','en',en);split('signature-form','client_name',parts);split('signature-form','signer_name',parts);
  for(const prefix of ['terms_name_0','authorization_name_0'])split('terms-and-conditions',prefix,parts);
  out['kyc-individual']={name_1:full(parts.slice(0,2)),name_2:full(parts.slice(2)),risk_client_name:name,title:p.title,gender:p.gender,dob:p.dob,nationality:p.nationality,id_type:p.id_type,id_other:p.id_other,id_number:p.id_number,phone:p.phone,mobile:p.mobile,email:p.email,building:p.building,street:p.street,postal:p.postal,country:p.country,city:full([p.city,p.district]),postal_additional:p.additional};
  split('kyc-individual','name',parts);split('kyc-individual','risk_client_name',parts);
  out['fatca-crs-individual']={title:'other',gender:p.gender,dob:p.dob,signer_en:full(en),signer_ar:full(ar)};
  for(const lang of ['en','ar']){for(const key of ['first','second','third','last'])out['fatca-crs-individual'][lang+'_'+key]=p[lang+'_'+key];out['fatca-crs-individual'][lang+'_middle']=full([p[lang+'_second'],p[lang+'_third']]);}
  split('fatca-crs-individual','signer_en',en);split('fatca-crs-individual','signer_ar',ar);
  for(const prefix of ['mail','sa'])for(const key of ['building','street','district','city','postal','country'])out['fatca-crs-individual'][prefix+'_'+key]=p[key];
 }else{
  out['subscription-company']={client_account:p.account_number,company_name:p.company_name_ar,inc_country:p.inc_country,company_id_type:p.company_id_type,company_id_number:p.company_id_number,auth_name:signer,auth_id:p.auth_id,english_name:p.company_name_en,phone:p.phone,mobile:p.mobile,...Object.fromEntries(['short_address','building','street','additional','district','postal','city','email','country'].map(key=>[key,p[key]]))};
  split('subscription-company','auth_name',auth);split('signature-form','signer_name',auth);
  out['kyc-corporate']={company:name,risk_client_name:name,inc_country:p.inc_country,cr:p.company_id_number,address,business_phone:p.phone,contact_address:address,auth_name:signer,auth_id:p.auth_id,...Object.fromEntries(['building','street','district','city','postal','additional','phone','mobile','email'].map(key=>[key,p[key]]))};
  split('kyc-corporate','auth_name',auth);
  out['fatca-crs-corporate']={legal_name:p.company_name_en,inc_country:p.inc_country,signer_0_name:signer};split('fatca-crs-corporate','signer_0_name',auth);
  for(const prefix of ['residence','head'])for(const key of ['building','street','district','city','postal','country'])out['fatca-crs-corporate'][prefix+'_'+key]=key==='postal'?full([p.postal,p.additional]):p[key];
 }
 return out;
}
for(const audience of ['individual','corporate'])for(const language of ['en','ar'])test(`all shared details reach their exact paper recipients: ${audience}/${language}`,()=>{
 const p=structuredClone(audience==='individual'?person:company);if(audience==='individual')p.name_language=language;
 const storage=disk(),store=createDraftStore(docs,()=>storage,audience,'qa-semantic-owner');store.setShared(p);
 store.save('signature-form',{...store.get('signature-form').values,signer_role:audience==='individual'?'client':'authorized'},1,{},'signer_role');
 if(audience==='individual')store.save('fatca-crs-individual',{...store.get('fatca-crs-individual').values,capacity:'holder'},3,{},'capacity');
 const wanted=expected(p,audience);
 for(const [docId,values]of Object.entries(wanted))for(const [id,value]of Object.entries(values)){
  assert.ok(docs.find(d=>d.id===docId).fields.some(f=>f.id===id),`Expected target exists: ${docId}/${id}`);
  assert.equal(store.get(docId).values[id]||'',value||'',`${docId}/${id}`);
 }
 const reopened=createDraftStore(docs,()=>storage,audience,'qa-semantic-owner');
 for(const [docId,values]of Object.entries(wanted))for(const [id,value]of Object.entries(values))assert.equal(reopened.get(docId).values[id]||'',value||'',`Reload ${docId}/${id}`);
 const subscription=docs.find(d=>d.id===(audience==='individual'?'subscription-form':'subscription-company'));
 const sub=normalizeSubscription(subscription,store.get(subscription.id).values);assert.equal(sub.applicant_name,audience==='individual'?full(personParts(p,'ar')):full(personParts(p,'auth')));
 for(const [docId,ids]of Object.entries(audience==='individual'?{'kyc-individual':['representative_name','rep_id','rep_phone','rep_fax','employer_phone','bank','iban'],'fatca-crs-individual':['outside_city','tax_tin_0','staff_employee_id','staff_cif','staff_account_holder','staff_account_holder_first','staff_account_holder_second','staff_account_holder_third','staff_account_holder_last'],'terms-and-conditions':['terms_name_1','terms_name_2','authorization_name_1','authorization_name_2']}:{'kyc-corporate':['contact_name','bank_owner','bank_account','auth_phone','auth_mobile','auth_email','auth_city','auth_nationality','registration_country'],'fatca-crs-corporate':['person_0_name','person_0_tin','signer_1_name','inc_city','us_tin'],'terms-and-conditions':['terms_name_1','terms_name_2','authorization_name_1','authorization_name_2']}))for(const id of ids)assert.ok(!store.get(docId).values[id],`Unrelated recipient must stay empty: ${docId}/${id}`);
 const opposite=createDraftStore(docs,()=>storage,audience==='individual'?'corporate':'individual','qa-semantic-owner'),other=createDraftStore(docs,()=>storage,audience,'qa-other-owner');assert.deepEqual(opposite.profile,{});assert.deepEqual(other.profile,{});
});
test('semantic audit fixtures cover every currently exposed shared field',()=>{
 for(const [audience,p]of [['individual',person],['corporate',company]])for(const field of sharedGroups(audience).flatMap(group=>group.fields).filter(field=>!field.hidden))assert.ok(Object.hasOwn(p,field.id),'Missing fixture '+audience+'/'+field.id);
});
test('nationality and registration edits update shared data and follow subsequent account changes',()=>{
 for(const [audience,docId,field,key,profile]of [['individual','kyc-individual','nationality','nationality',person],['corporate','kyc-corporate','cr','company_id_number',company]]){
  const storage=disk(),store=createDraftStore(docs,()=>storage,audience,'qa-owner');store.setShared(profile);
  store.save(docId,{...store.get(docId).values,[field]:'Manual correction'},0,{},field);
  assert.equal(store.profile[key],'Manual correction');
  store.setShared({...profile,[key]:'New shared answer'});assert.equal(store.get(docId).values[field],'New shared answer');
  const reopened=createDraftStore(docs,()=>storage,audience,'qa-owner');assert.equal(reopened.get(docId).values[field],'New shared answer');
  reopened.save(docId,{...reopened.get(docId).values,[field]:''},0,{},field);assert.equal(reopened.profile[key],'');
  reopened.setShared({...profile,[key]:'Later account answer'});assert.equal(reopened.get(docId).values[field],'Later account answer');
 }
});
