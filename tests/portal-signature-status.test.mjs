import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';

const image='data:image/png;base64,'+readFileSync(new URL('./fixtures/signature.png',import.meta.url)).toString('base64');
const document=id=>{const doc=docs.find(doc=>doc.id===id);return {...doc,signatureSlots:signatureSlots(doc)};};
function evaluate(cases){
 const result=spawnSync('php',['-r',`
  require $argv[1];$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];
  foreach($cases as $c){$before=$c['submission'];$out[]=['state'=>submissionSignatureState($c['submission'],$c['definition']),'signing'=>submissionSigningCapability($c['submission'],$c['definition']),'unchanged'=>$before===$c['submission']];}
  echo json_encode($out,JSON_THROW_ON_ERROR);
 `,resolve('public/api/portal-versions.php')],{input:JSON.stringify(cases),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');return JSON.parse(result.stdout);
}
const base={id:'a'.repeat(32),sha256:'b'.repeat(64),source:'online',profile:{},answers:{},signatures:{},review_status:'pending'};

test('signature status distinguishes electronic, missing, claimed uploads and unknown legacy files without mutating snapshots',()=>{
 const definition=document('signature-form'),overlays={electronic_signature:{source_id:'c'.repeat(32),source_sha256:'d'.repeat(64)}};
 const cases=[
  [{},'unsigned'],[{signatures:null},'unknown'],[{signatures:{specimen:image}},'electronic'],
  [{source:'upload'},'unknown'],[{source:'upload',profile:{signed_confirmed:true}},'uploaded'],
  [{source:'upload',profile:{signed_confirmed:'true'}},'unknown'],
  [{source:'upload',profile:overlays,signatures:{specimen:image}},'electronic'],
  [{source:'upload',profile:overlays,signatures:{}},'unsigned'],
  [{review_status:'signature_required',signatures:{specimen:image}},'electronic'],
  [{review_status:'signature_required',source:'upload',profile:{signed_confirmed:true}},'uploaded'],
 ];
 const results=evaluate(cases.map(([changes])=>({definition,submission:{...base,...changes}})));
 for(let i=0;i<cases.length;i++){
  assert.equal(results[i].state.signature_state,cases[i][1],JSON.stringify(cases[i][0]));
  assert.equal(results[i].state.signature_requested,cases[i][0].review_status==='signature_required');
  assert.equal(results[i].unchanged,true);
 }
});

test('frozen signature policy and conditional signers determine status, while legacy manual subscriptions stay unsigned',()=>{
 const terms=document('terms-and-conditions'),subscription=document('subscription-form');
 const cases=[
  {definition:terms,submission:{...base,signatures:{terms_0:image,authorization_0:image}}},
  {definition:terms,submission:{...base,answers:{terms_name_1:'Second signer'},signatures:{terms_0:image,authorization_0:image}}},
  {definition:terms,submission:{...base,answers:{terms_name_1:'Second signer'},signatures:{terms_0:image,terms_1:image,authorization_0:image}}},
  {definition:subscription,submission:{...base,answers:{signature_mode:'manual'},signatures:{applicant:image}}},
  {definition:subscription,submission:{...base,answers:{signature_mode:'electronic'},signatures:{applicant:image}}},
  {definition:{pages:1,signatureSlots:[{id:'new_slot',page:1,rect:[1,1,20,10]}]},submission:{...base,profile:{signature_submission_policy:{signatureSlots:[{id:'original_slot'}]}},signatures:{original_slot:image}}},
  {definition:null,submission:{...base,profile:{signature_submission_policy:{signatureSlots:[{id:'original_slot'}]}},signatures:{original_slot:image}}},
 ];
 assert.deepEqual(evaluate(cases).map(result=>result.state.signature_state),['electronic','unsigned','electronic','unsigned','electronic','electronic','electronic']);
});

test('signing capability exposes only configured safe positions and blocks missing layouts, downloads and repeat upload overlays',()=>{
 const definition={id:'managed',pages:2,pageSizes:[[595,842],[595,842]],signatureSlots:[{id:'client',label:'Client',ar:'العميل',page:2,rect:[10,20,200,40],private:'drop'}]};
 const cases=[
  {definition,submission:base},
  {definition:null,submission:base},
  {definition:{...definition,downloadOnly:true},submission:base},
  {definition:{...definition,pages:undefined},submission:base},
  {definition:{...definition,signatureSlots:[]},submission:base},
  {definition:{...definition,signatureSlots:[{...definition.signatureSlots[0],requiredForSubmission:false}]},submission:base},
  {definition:{...definition,signatureSlots:[{...definition.signatureSlots[0],page:3}]},submission:base},
  {definition:{...definition,signatureSlots:[{...definition.signatureSlots[0],rect:[500,20,200,40]}]},submission:base},
  {definition,submission:{...base,source:'upload',profile:{electronic_signature:{source_id:'old',source_sha256:'hash'}}}},
 ];
 const results=evaluate(cases);
 assert.equal(results[0].signing.can_sign_electronically,true);assert.equal(results[0].signing.sourceId,base.id);assert.equal(results[0].signing.sourceSha256,base.sha256);
 assert.equal(results[0].signing.expectedPages,2);assert.equal(results[0].signing.expectedCurrent,base.id);assert.deepEqual(results[0].signing.requiredSignatureIds,['client']);
 assert.equal(results[0].signing.signatureSlots[0].private,undefined);
 for(const result of results.slice(1)){assert.equal(result.signing.can_sign_electronically,false);assert.deepEqual(result.signing.signatureSlots,[]);assert.deepEqual(result.signing.requiredSignatureIds,[]);}
});

test('all current editable builtin documents have configured signing capability and source snapshots stay byte-equivalent',()=>{
 const cases=docs.filter(doc=>!doc.downloadOnly).map(doc=>({definition:document(doc.id),submission:{...base,answers:JSON.stringify({}),profile:'{}',signatures:'{}'}}));
 for(const result of evaluate(cases)){assert.equal(result.signing.can_sign_electronically,true);assert.ok(result.signing.requiredSignatureIds.length);assert.equal(result.unchanged,true);}
});
