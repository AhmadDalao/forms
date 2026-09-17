import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {catalogueFor} from '../src/catalogue.js';
import {createDraftStore} from '../src/drafts.js';
test('each audience has one numbered six-document catalogue, including download-only consent',()=>{
 for(const audience of ['individual','corporate']){
  const entries=catalogueFor(docs,audience);
  assert.deepEqual(entries.map(d=>d.number),[1,2,3,4,5,6]);
  assert.deepEqual(entries.map(d=>d.id),['subscription-form','kyc-'+audience,'signature-form','al-naeem-terms-consent','fatca-crs-'+audience,'terms-and-conditions']);
  assert.equal(entries[3].downloadOnly,true);assert.equal(entries.filter(d=>d.group==='shared').length,4);
  assert.ok(entries.every(d=>d.title&&d.ar));
 }
 assert.deepEqual(catalogueFor(docs,null),[]);
});
test('subscription shares only matching audience details; entity IDs and other people remain independent',()=>{
 const memory=new Map(),storage=()=>({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)});
 const individual=createDraftStore(docs,storage,'individual'),corporate=createDraftStore(docs,storage,'corporate');
 individual.setShared({en_first:'Ahmad',en_last:'Ali',ar_first:'أحمد',ar_last:'علي',account_number:'000123',id_number:'001234',id_type:'national',phone:'+966551234567',city:'Riyadh'});
 corporate.setShared({company_name:'شركة النور',auth_name:'فهد',auth_id:'991111',phone:'920001111'});
 const i=individual.get('subscription-form').values,c=corporate.get('subscription-form').values;
 assert.equal(i.en_name,'Ahmad Ali');assert.equal(i.ar_name,'أحمد علي');assert.equal(i.client_account,'000123');assert.equal(i.id_number,'001234');assert.equal(i.id_type,'national');assert.equal(i.phone,'+966551234567');
 assert.equal(c.ar_name,'شركة النور');assert.equal(c.en_name,undefined);assert.equal(c.applicant_name,'فهد');assert.equal(c.id_number,undefined);assert.equal(c.company_id_number,undefined);assert.equal(c.phone,'920001111');
 assert.equal(i.fund_name,undefined);assert.equal(i.signature_verified,undefined);assert.equal(i.staff_manager,undefined);
 individual.save('subscription-form',{...i,phone:'MANUAL'},0,{},'phone');individual.setShared({phone:'SHARED'});assert.equal(individual.get('subscription-form').values.phone,'MANUAL');
 individual.clearAll();assert.equal(corporate.get('subscription-form').values.phone,'920001111');
});
