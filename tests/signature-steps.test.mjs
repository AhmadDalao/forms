import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {signatureSlots,sectionSignatureSlots} from '../src/signatures.js';
import {runtimeDocument} from '../src/management/catalogue.js';
import {createDraftStore} from '../src/drafts.js';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}

test('every existing signature belongs to exactly one relevant signing step',()=>{
 const expected={
  'signature-form':{specimen:'signatory'},
  'terms-and-conditions':{terms_0:'terms',terms_1:'terms',terms_2:'terms',authorization_0:'authorization',authorization_1:'authorization',authorization_2:'authorization'},
  'fatca-crs-individual':{signatory:'signatory',relationship_manager:'staff'},
  'fatca-crs-corporate':{signatory_0:'signatories',signatory_1:'signatories'},
  'kyc-individual':{representative:'disclosures',client:'suitability'},
  'kyc-corporate':{client:'suitability'},
 };
 for(const [id,mapping] of Object.entries(expected)){
  const doc=docs.find(d=>d.id===id);
  for(const slot of signatureSlots(doc))assert.deepEqual(doc.sections.filter(s=>sectionSignatureSlots(doc,s).some(x=>x.id===slot.id)).map(s=>s.id),[mapping[slot.id]],id+' '+slot.id);
 }
 const custom=runtimeDocument({id:'custom-signing',pages:2,fields:[],signatures:[{id:'signer',page:2,rect:[20,20,50,20]}]});
 assert.deepEqual(custom.sections.map(s=>s.id),['page_2']);
 assert.equal(sectionSignatureSlots(custom,custom.sections[0])[0].id,'signer');
});

test('legacy signatures migrate to electronic while manual clears only the selected signer',()=>{
 const disk=storage(),store=createDraftStore(docs,()=>disk,'individual','client-a');
 disk.setItem(store.prefix+'kyc-individual',JSON.stringify({values:{name_1:'Saved client'},signatures:{client:image,representative:image},step:2}));
 store.refresh();assert.deepEqual(store.get('kyc-individual').signatureModes,{representative:'electronic',client:'electronic'});
 store.setSignatureMode('kyc-individual','representative','manual');
 // A stale image snapshot cannot reinsert a deliberately cleared signature.
 store.save('kyc-individual',store.get('kyc-individual').values,2,{client:image,representative:image});
 const reopened=createDraftStore(docs,()=>disk,'individual','client-a').get('kyc-individual');
 assert.deepEqual(reopened.signatures,{client:image});assert.equal([reopened.values.name_1,reopened.values.name_2].filter(Boolean).join(' '),'Saved client');
 assert.deepEqual(reopened.signatureModes,{representative:'manual',client:'electronic'});
});

test('mode-only drafts persist, stay audience/account/version scoped and reset with the form',()=>{
 const disk=storage(),store=createDraftStore(docs,()=>disk,'individual','client-a');
 store.setSignatureMode('signature-form','specimen','electronic');
 store.save('signature-form',{},1,{});
 const reopened=createDraftStore(docs,()=>disk,'individual','client-a');
 assert.equal(reopened.has('signature-form'),true);assert.equal(reopened.get('signature-form').step,1);
 assert.equal(reopened.get('signature-form').signatureModes.specimen,'electronic');
 for(const [audience,account] of [['corporate','client-a'],['individual','client-b']])assert.deepEqual(createDraftStore(docs,()=>disk,audience,account).get('signature-form').signatureModes,{});
 const version=createDraftStore(docs,()=>disk,'individual','client-a','a'.repeat(32));
 version.loadSubmission('signature-form',{id:'a'.repeat(32),answers:{client_name:'Archived client'},signatures:{specimen:image},profile:{}});
 version.setSignatureMode('signature-form','specimen','manual');
 assert.equal(reopened.get('signature-form').signatureModes.specimen,'electronic');
 assert.equal(version.get('signature-form').values.client_name,'Archived client');
 assert.deepEqual(version.get('signature-form').signatures,{});
 assert.equal(reopened.setSignatureMode('signature-form','unknown','electronic'),false);
 assert.equal(reopened.setSignatureMode('signature-form','specimen','invalid'),false);
 reopened.clear('signature-form');assert.equal(reopened.has('signature-form'),false);assert.deepEqual(reopened.get('signature-form').signatureModes,{});
});
