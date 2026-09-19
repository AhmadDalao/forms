import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/forms/signature.js';
import '../src/forms/kyc-individual.js';
import {docs} from '../src/schema.js';
import {createDraftStore,DRAFT_PREFIX} from '../src/drafts.js';
import {parseNumber} from '../src/numbers.js';
function memoryStorage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};}
test('a new browser session restores answers, Arabic text, leading zeros and section',()=>{
 const disk=memoryStorage(),first=createDraftStore(docs,()=>disk);
 first.save('signature-form',{client_name:'أحمد علي',client_number:'00012',signer_role:'client'},1);
 first.setPreferences({lang:'ar',active:'signature-form'});
 const reopened=createDraftStore(docs,()=>disk);
 assert.deepEqual(reopened.get('signature-form').values,{client_name:'أحمد علي',client_number:'00012',signer_role:'client'});
 assert.equal(reopened.get('signature-form').step,1);assert.equal(reopened.preferences.lang,'ar');
});
test('clear one and clear all remove only this app’s drafts',()=>{
 const disk=memoryStorage(),store=createDraftStore(docs,()=>disk);disk.setItem('another-app','keep');
 store.save('signature-form',{client_name:'One'},1);store.save('kyc-individual',{name_1:'Two'},2);
 store.clear('signature-form');assert.equal(store.has('signature-form'),false);assert.equal(store.has('kyc-individual'),true);
 assert.equal(createDraftStore(docs,()=>disk).has('signature-form'),false);
 store.clearAll();assert.equal(createDraftStore(docs,()=>disk).has('kyc-individual'),false);assert.equal(disk.getItem('another-app'),'keep');
});
test('blocked storage keeps answers in memory and reports saving unavailable',()=>{
 const store=createDraftStore(docs,()=>{throw new Error('Blocked');});
 assert.equal(store.save('signature-form',{client_name:'Keep me'},1),false);
 assert.equal(store.get('signature-form').values.client_name,'Keep me');assert.equal(store.available,false);
});
test('a successful preference write cannot hide a failed answer save',()=>{
 const disk=memoryStorage(),write=disk.setItem;
 disk.setItem=(k,v)=>{if(k.endsWith('signature-form'))throw new Error('Full');write(k,v);};
 const store=createDraftStore(docs,()=>disk);store.save('signature-form',{client_name:'Keep me'},0);store.setPreferences({lang:'ar'});
 assert.equal(store.available,false);
});
test('corrupt and obsolete stored fields are ignored safely',()=>{
 const disk=memoryStorage();disk.setItem(DRAFT_PREFIX+'signature-form','{');
 assert.equal(createDraftStore(docs,()=>disk).has('signature-form'),false);
 disk.setItem(DRAFT_PREFIX+'signature-form',JSON.stringify({step:99,values:{client_name:'Valid',unknown:'ignore',signer_role:'invalid'}}));
 const restored=createDraftStore(docs,()=>disk).get('signature-form');assert.equal(restored.step,1);assert.deepEqual(restored.values,{client_name:'Valid'});
});
test('Arabic, Persian and Latin percentage entries have the same numeric meaning',()=>{
 for(const v of ['١٠٠','۱۰۰','100','١٠٠٪','100%'])assert.equal(parseNumber(v),100);
 assert.equal(parseNumber('١٢٫٥'),12.5);assert.equal(parseNumber('۱٬۲۳۴'),1234);assert.equal(parseNumber('0'),0);
 for(const v of ['','abc','20 dollars','١٢x'])assert.equal(parseNumber(v),null);
});
const samplePNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
test('signature-only drafts restore and clear independently of other forms',()=>{
 const disk=memoryStorage(),first=createDraftStore(docs,()=>disk);
 first.save('signature-form',{},1,{specimen:samplePNG});
 first.save('kyc-individual',{name_1:'Another client'},0,{client:samplePNG});
 const reopened=createDraftStore(docs,()=>disk);
 assert.equal(reopened.has('signature-form'),true);
 assert.deepEqual(reopened.get('signature-form').signatures,{specimen:samplePNG});
 reopened.clear('signature-form');
 assert.deepEqual(createDraftStore(docs,()=>disk).get('signature-form').signatures,{});
 assert.deepEqual(reopened.get('kyc-individual').signatures,{client:samplePNG});
 reopened.clearAll();assert.equal(createDraftStore(docs,()=>disk).has('kyc-individual'),false);
});
test('saved signatures accept only known slots and bounded PNG data',()=>{
 const disk=memoryStorage();
 disk.setItem(DRAFT_PREFIX+'kyc-individual',JSON.stringify({signatures:{client:samplePNG,representative:'https://example.com/signature.png',staff:samplePNG}}));
 const record=createDraftStore(docs,()=>disk).get('kyc-individual');
 assert.deepEqual(record.signatures,{client:samplePNG});
});
test('a failed signature save retains the image in memory and reports the failure',()=>{
 const disk=memoryStorage();disk.setItem=()=>{throw Error('QuotaExceeded');};
 const store=createDraftStore(docs,()=>disk);
 assert.equal(store.save('signature-form',{},0,{specimen:samplePNG}),false);
 assert.equal(store.has('signature-form'),true);assert.equal(store.available,false);
 assert.equal(store.get('signature-form').signatures.specimen,samplePNG);
});

test('a signature request clears rejected images once without losing a replacement draft or original snapshot',()=>{
 const disk=memoryStorage(),account='a'.repeat(32),version='b'.repeat(32),original={id:version,current_id:version,version:1,answers:{client_name:'Original name'},profile:{email:'original@example.com'},signatures:{specimen:samplePNG}};
 const normal=createDraftStore(docs,()=>disk,'individual',account);normal.save('signature-form',{client_name:'Separate draft'},0,{specimen:samplePNG});
 const store=createDraftStore(docs,()=>disk,'individual',account,version);store.loadSubmission('signature-form',original);store.beginSignatureRequest('signature-form',10);
 assert.deepEqual(store.get('signature-form').signatures,{});assert.equal(store.get('signature-form').signatureModes.specimen,'electronic');assert.equal(store.get('signature-form').values.client_name,'Original name');
 store.save('signature-form',store.get('signature-form').values,1,{specimen:samplePNG});
 const reopened=createDraftStore(docs,()=>disk,'individual',account,version);reopened.loadSubmission('signature-form',original);reopened.beginSignatureRequest('signature-form',10);
 assert.equal(reopened.get('signature-form').signatures.specimen,samplePNG,'Reload does not erase a newly uploaded replacement');
 reopened.beginSignatureRequest('signature-form',11);assert.deepEqual(reopened.get('signature-form').signatures,{});
 assert.equal(original.signatures.specimen,samplePNG);assert.equal(normal.get('signature-form').values.client_name,'Separate draft');assert.equal(normal.get('signature-form').signatures.specimen,samplePNG);
});
