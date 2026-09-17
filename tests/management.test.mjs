import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDocument,loadCatalogue} from '../src/management/catalogue.js';
import {catalogueFor} from '../src/catalogue.js';
import {sharedCandidates} from '../src/shared-fields.js';
const record={id:'upload_test',title:'Shared',ar:'مشترك',pages:2,group:'shared',pdfVersion:'abc',fields:[{id:'name',label:'Name',ar:'الاسم',page:1,rect:[10,10,200,20],type:'text',shared:{individual:'full_name_en',corporate:'company_name'}},{id:'email',label:'Email',ar:'البريد',page:2,rect:[10,10,200,20],type:'email',shared:{individual:'email',corporate:'email'}}],signatures:[{id:'sign',label:'Signature',ar:'التوقيع',page:2,rect:[10,80,150,30]}]};
test('custom documents preserve page structure and independent signature areas',()=>{const doc=runtimeDocument(record);assert.equal(doc.custom,true);assert.deepEqual(doc.sections.map(s=>s.page),[1,2]);assert.equal(doc.sections[1].fields[0].id,'email');assert.deepEqual(doc.signing,[2]);assert.deepEqual(doc.signatureSlots,record.signatures);});
test('custom fields copy only their current audience profile',()=>{const doc=runtimeDocument(record);assert.deepEqual(sharedCandidates(doc,{en_first:'Sara',en_last:'Ali',email:'person@example.com',company_name:'Wrong'},{},'individual'),{name:'Sara Ali',email:'person@example.com'});assert.deepEqual(sharedCandidates(doc,{company_name:'Company',email:'business@example.com',en_first:'Wrong'},{},'corporate'),{name:'Company',email:'business@example.com'});assert.deepEqual(sharedCandidates({...doc,group:'individual'},{company_name:'Wrong'},{},'corporate'),{});});
test('catalogue uses separate audience orders and continuous card numbers',()=>{const a={...record,id:'a',order:{individual:2,corporate:1}},b={...record,id:'b',order:{individual:1,corporate:2}};assert.deepEqual(catalogueFor([],'individual',[a,b]).map(d=>[d.id,d.number]),[['b',1],['a',2]]);assert.deepEqual(catalogueFor([],'corporate',[a,b]).map(d=>[d.id,d.number]),[['a',1],['b',2]]);});
test('unavailable management API keeps existing forms usable',async()=>{const oldFetch=global.fetch;global.fetch=async()=>{throw Error('offline')};try{const built=[{id:'original'}];assert.deepEqual(await loadCatalogue(built),{docs:built,cards:null});}finally{global.fetch=oldFetch;}});

import {layoutConflicts,assertLayout} from '../src/management/layout.js';
test('overlapping text, choice and signature areas block PDF generation',()=>{
 const d={fields:[{id:'name',page:1,rect:[10,10,100,20]},{id:'choice',type:'choice',page:1,options:[{rect:[50,15,10,10]}]}],signatures:[{id:'sign',page:1,rect:[100,15,60,20]}]};
 assert.equal(layoutConflicts(d).length,2);assert.throws(()=>assertLayout(d),e=>e.layout&&e.fields.includes('name')&&e.fields.includes('choice')&&e.fields.includes('sign'));
});
test('touching borders and identical positions on separate pages are allowed',()=>{
 assert.deepEqual(layoutConflicts({fields:[{id:'a',page:1,rect:[10,10,100,20]},{id:'b',page:1,rect:[10,30,100,20]},{id:'c',page:2,rect:[10,10,100,20]}]}),[]);
});
