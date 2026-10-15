import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';

test('old account-terms drafts cannot supply consent signatures or dates to the new fund terms',()=>{
 const old=JSON.parse(readFileSync('reference/documents/archived/terms-13-page-schema.json'));
 const current=docs.find(d=>d.id===old.id),image='data:image/png;base64,'+readFileSync('tests/fixtures/signature.png').toString('base64');
 for(const audience of ['individual','corporate']){
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  createDraftStore([old],()=>storage,audience).save(old.id,{terms_name_0:'Former signer',authorization_name_0:'Former signer',terms_date:'2020-01-01',authorization_date:'2020-01-02',terms_consent:'yes',authorization_consent:'yes'},2,{terms_0:image,authorization_0:image});
  const before=[...memory.entries()],reopened=createDraftStore([current],()=>storage,audience).get(current.id);
  assert.deepEqual(reopened.signatures,{});assert.deepEqual(reopened.signatureModes,{});
  assert.ok(!Object.keys(reopened.values).some(k=>/^(terms_|authorization_)/.test(k)));
  assert.equal(reopened.values.date,undefined);
  assert.deepEqual([...memory.entries()],before,'Reading the current form does not rewrite the old stored record');
 }
});

test('catalogue upgrades obsolete default copy while preserving owner descriptions and ordering',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'approved-terms-catalogue-'));
 try{
  copyFileSync('public/api/document-catalogue.php',path.join(directory,'document-catalogue.php'));
  const doc=docs.find(d=>d.id==='terms-and-conditions');writeFileSync(path.join(directory,'defaults.json'),JSON.stringify({documents:[{...doc,builtin:true}]}));
  const old={...doc,builtin:true,pages:13,pdfVersion:'20261014-riyadh-address',title:'Owner title',description:'Current PDF: Itqan’s general account terms and telephone / fax instructions.',arDescription:'الملف الحالي: شروط إتقان العامة للحساب وتعليمات الهاتف والفاكس.'};
  const cases=[{documents:[old],orders:{individual:[doc.id]}},{documents:[{...old,description:'Owner description',arDescription:'وصف المالك'}],orders:{corporate:[doc.id]}}];
  const r=spawnSync('php',['-r','require $argv[1];echo json_encode(array_map("currentBuiltinPresentation",json_decode(stream_get_contents(STDIN),true)));',path.join(directory,'document-catalogue.php')],{input:JSON.stringify(cases),encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
  assert.equal(result[0].documents[0].description,doc.description);assert.equal(result[0].documents[0].arDescription,doc.arDescription);
  assert.equal(result[1].documents[0].description,'Owner description');assert.equal(result[1].documents[0].arDescription,'وصف المالك');
  for(let i=0;i<2;i++){assert.equal(result[i].documents[0].pages,38);assert.equal(result[i].documents[0].pdfVersion,doc.pdfVersion);assert.equal(result[i].documents[0].title,'Owner title');assert.deepEqual(result[i].orders,cases[i].orders);}
 }finally{rmSync(directory,{recursive:true,force:true});}
});
