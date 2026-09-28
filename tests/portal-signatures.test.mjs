import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {docs} from '../src/forms/index.js';
import {signatureSlots,submissionSigningState} from '../src/signatures.js';

const image='data:image/png;base64,'+readFileSync(new URL('./fixtures/signature.png',import.meta.url)).toString('base64');
const document=id=>({...docs.find(doc=>doc.id===id),signatureSlots:signatureSlots(docs.find(doc=>doc.id===id))});
function validate(doc,{images={},answers={},modes={}}={}){
 const result=spawnSync('php',['-r',`
  require $argv[1];
  function reject($code,$status=400){throw new DomainException($code,$status);}
  $p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
  try{$images=cleanSignatureImages($p['doc'],$p['images'],$p['answers']);requireOnlineSignatures($p['doc'],$images,$p['answers'],$p['modes']);echo json_encode(['images'=>(object)$images]);}
  catch(DomainException $e){echo json_encode(['error'=>$e->getMessage(),'status'=>$e->getCode()]);}
 `,resolve('public/api/portal-versions.php')],{input:JSON.stringify({doc,images,answers,modes}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
const required={error:'signature_required',status:422};

test('every online built-in requires its customer signature and accepts complete electronic images',()=>{
 const expected={
  'subscription-form':['applicant'],'subscription-company':['applicant'],
  'signature-form':['specimen'],'terms-and-conditions':['terms_0','authorization_0'],
  'fatca-crs-individual':['signatory'],'fatca-crs-corporate':['signatory_0'],
  'kyc-individual':['client'],'kyc-corporate':['client'],
 };
 for(const [id,ids] of Object.entries(expected)){
  const doc=document(id),answers=doc.workflow==='subscription'?{signature_mode:'electronic'}:{};
  assert.deepEqual(validate(doc,{answers}),required,id+' missing all');
  const images=Object.fromEntries(ids.map(id=>[id,image]));
  assert.deepEqual(validate(doc,{answers,images}),{images},id+' legacy image implies electronic');
  assert.deepEqual(validate(doc,{answers,images,modes:Object.fromEntries(ids.map(id=>[id,'electronic']))}),{images},id);
  for(const slot of ids){
   assert.deepEqual(validate(doc,{answers,images:{...images,[slot]:undefined}}),required,id+' missing '+slot);
   assert.deepEqual(validate(doc,{answers,images,modes:{[slot]:'manual'}}),required,id+' stale image '+slot);
  }
 }
});

test('additional named signers and representatives require their own electronic image',()=>{
 for(const [id,slot,fields,base] of [
  ['terms-and-conditions','terms_1',['terms_name_1'],{terms_0:image,authorization_0:image}],
  ['terms-and-conditions','terms_2',['terms_name_2'],{terms_0:image,authorization_0:image}],
  ['terms-and-conditions','authorization_1',['authorization_name_1'],{terms_0:image,authorization_0:image}],
  ['terms-and-conditions','authorization_2',['authorization_name_2'],{terms_0:image,authorization_0:image}],
  ['fatca-crs-corporate','signatory_1',['signer_1_name','signer_1_capacity'],{signatory_0:image}],
  ['kyc-individual','representative',['representative_name','rep_id','rep_type','rep_expiry','rep_phone','rep_email'],{client:image}],
 ]){
  const doc=document(id);
  for(const field of fields){
   assert.deepEqual(validate(doc,{images:base,answers:{[field]:' '},modes:{[slot]:'manual'}}),{images:base},id+' unused '+field);
   assert.deepEqual(validate(doc,{images:base,answers:{[field]:'Named participant'}}),required,id+' '+field);
   const images={...base,[slot]:image};
   assert.deepEqual(validate(doc,{images,answers:{[field]:'Named participant'}}),{images},id+' signed '+field);
   assert.deepEqual(validate(doc,{images,answers:{[field]:'Named participant'},modes:{[slot]:'manual'}}),required,id+' manual '+field);
  }
 }
});

test('manual subscriptions and staff-only signatures cannot authorize an online submission',()=>{
 for(const id of ['subscription-form','subscription-company']){
  const doc=document(id);
  for(const mode of [undefined,'manual'])assert.deepEqual(validate(doc,{images:{applicant:image},answers:{signature_mode:mode},modes:{applicant:'electronic'}}),required);
 }
 const doc=document('fatca-crs-individual');
 assert.deepEqual(validate(doc,{images:{relationship_manager:image}}),required);
 assert.deepEqual(validate(doc,{images:{signatory:image},modes:{relationship_manager:'manual'}}),{images:{signatory:image}});
});

test('managed slots default to required and documents with no customer signing area use signed upload',()=>{
 const doc={id:'managed',signatures:[{id:'first'},{id:'second'}]};
 assert.deepEqual(validate(doc,{images:{first:image}}),required);
 assert.deepEqual(validate(doc,{images:{first:image,second:image}}),{images:{first:image,second:image}});
 for(const signatures of [[],[{id:'staff',requiredForSubmission:false}]])assert.deepEqual(validate({id:'managed',signatures},{images:{staff:image}}),required);
});

test('invalid signature data and explicit invalid modes cannot pass electronic validation',()=>{
 const doc=document('signature-form');
 for(const bad of ['data:image/svg+xml;base64,PHN2Zy8+','https://example.com/signature.png','data:image/png;base64,broken'])assert.deepEqual(validate(doc,{images:{specimen:bad}}),{error:'signature_invalid',status:400});
 for(const modes of [{specimen:'invalid'},{specimen:[]},'electronic'])assert.deepEqual(validate(doc,{images:{specimen:image},modes}),{error:'signature_invalid',status:400});
 assert.deepEqual(validate(doc,{images:{forged:image}}),required);
});

test('browser and server agree on current builtin signature policies',()=>{
 for(const original of docs.filter(doc=>!doc.downloadOnly)){
  const doc=document(original.id),slots=signatureSlots(doc),answers=doc.workflow==='subscription'?{signature_mode:'electronic'}:{};
  const all=Object.fromEntries(slots.map(slot=>[slot.id,image]));
  const scenarios=[{images:{},answers},{images:all,answers},{images:all,answers:{...answers,signature_mode:'manual'}}];
  for(const slot of slots){
   scenarios.push({images:{...all,[slot.id]:undefined},answers});
   scenarios.push({images:all,answers,modes:{[slot.id]:'manual'}});
   for(const field of slot.requireWhenFields||[])scenarios.push({images:{...all,[slot.id]:undefined},answers:{...answers,[field]:'Used row'}});
  }
  for(const scenario of scenarios)assert.equal(!validate(doc,scenario).error,submissionSigningState(doc,scenario.answers,scenario.images,scenario.modes).ready,doc.id);
 }
});
