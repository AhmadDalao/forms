import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {cleanSignatureModes,signatureSlots} from '../src/signatures.js';
import {normalizeSubscription} from '../src/subscription/model.js';
const doc=id=>docs.find(d=>d.id===id);
test('new identity controls are ordered together and obsolete identity/fax inputs are absent',()=>{
 for(const d of docs){
  assert.ok(!d.fields.some(f=>/^(issue_place|rep_issue|rep_place|rep_fax|auth_issue_place|auth_issue_date)$/.test(f.id)));
  for(const row of d.identityRows||[]){const section=d.sections.find(s=>s.fields.some(f=>f.id===row[0]));assert.deepEqual(section.fields.filter(f=>row.includes(f.id)).map(f=>f.id),row);}
 }
 assert.equal(doc('kyc-individual').fields.find(f=>f.id==='rep_email').type,'email');
 assert.equal(doc('signature-form').fields.find(f=>f.id==='id_type').control,'select');
});
test('new signature choices are empty; saved explicit choices and images remain',()=>{
 for(const d of docs){assert.deepEqual(cleanSignatureModes(d,{}),{});for(const slot of signatureSlots(d))assert.equal(cleanSignatureModes(d,{[slot.id]:'manual'})[slot.id],'manual');}
 for(const d of docs.filter(d=>d.workflow==='subscription'))assert.equal(normalizeSubscription(d,{}).signature_mode,'');
});
test('terms start with a read-only original-document step and declaration follows signer role',()=>{
 assert.deepEqual(doc('terms-and-conditions').sections.map(s=>s.id),['document','terms','authorization']);
 assert.equal(doc('terms-and-conditions').sections[0].documentOnly,true);
 const fatca=doc('fatca-crs-individual');assert.equal(fatca.sections.at(-1).id,'signatory');assert.equal(fatca.sections.at(-1).fields[0].id,'capacity');
});
test('fillable consent reuses only the matching audience name and supports its own signature',()=>{
 const disk=new Map(),storage=()=>({getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)});
 for(const audience of ['individual','corporate']){
  const drafts=createDraftStore(docs,storage,audience);
  drafts.setShared(audience==='individual'?{ar_first:'أحمد',ar_second:'محمد',ar_last:'علي',name_language:'ar'}:{company_name_ar:'شركة النور',company_name:'شركة النور'});
  assert.equal(drafts.get('al-naeem-terms-consent').values.investor_name,audience==='individual'?'أحمد محمد علي':'شركة النور');
 }
 assert.deepEqual(signatureSlots(doc('al-naeem-terms-consent')).map(s=>s.id),['investor']);
});
