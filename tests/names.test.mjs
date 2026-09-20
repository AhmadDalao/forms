import test from 'node:test';
import assert from 'node:assert/strict';
import {nameParts} from '../src/names.js';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('four-part names preserve legacy middle text and leave third optional',()=>{
 assert.deepEqual(nameParts({en_middle:'Ali bin Hassan'}),{en_middle:'Ali bin Hassan',en_second:'Ali bin Hassan'});
 assert.equal(nameParts({en_middle:'old',en_second:'Ali',en_third:'Hassan'}).en_middle,'Ali Hassan');
 assert.equal(nameParts({ar_second:'علي',ar_third:''}).ar_middle,'علي');
 assert.equal(nameParts({en_middle:'old',en_second:''}).en_middle,'');
});
test('tax names reuse four shared parts and preserve manual corrections and deliberate clearing',()=>{
 const disk=storage(),d=createDraftStore(docs,()=>disk,'individual');
 d.setShared({en_first:'Ahmad',en_second:'Ali',en_third:'Hassan',en_last:'Dalao'});
 const id='fatca-crs-individual';assert.equal(d.get(id).values.en_middle,'Ali Hassan');assert.equal(d.get(id).values.en_third,'Hassan');
 d.save(id,{...d.get(id).values,en_second:''},0,{},'en_second');d.save(id,{...d.get(id).values,en_third:''},0,{},'en_third');
 assert.equal(d.get(id).values.en_middle,'');
 const reopened=createDraftStore(docs,()=>disk,'individual');assert.equal(reopened.get(id).values.en_middle,'');
 assert.equal(reopened.profile.en_second,'');assert.equal(reopened.get('subscription-form').values.en_second,'');
});
test('every visible split customer name uses four parts; PDF middle boxes are derived only',()=>{
 const d=docs.find(d=>d.id==='fatca-crs-individual');
 for(const language of ['en','ar']){
  assert.deepEqual(d.sections[0].paperGroups.find(g=>g.fields.includes(language+'_first')).fields.filter(id=>!d.fields.find(f=>f.id===id).hidden),['first','second','third','last'].map(k=>language+'_'+k));
  assert.equal(d.fields.find(f=>f.id===language+'_third').optional,true);
  assert.equal(d.fields.find(f=>f.id===language+'_middle').hidden,true);
 }
 for(const doc of docs)for(const field of doc.fields.filter(f=>!f.hidden))assert.doesNotMatch(field.label,/Middle|First\/Middle\/Last/);
});
