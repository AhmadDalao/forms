import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {parseNumber} from '../src/numbers.js';

const assets=['deposits','debt','equity','funds','property','derivatives','alternative'];
const php=`function textValue($x){return (string)$x;} function reject($x){throw new Exception($x);} require 'public/api/portal-answers.php'; echo json_encode(cleanAnswers(json_decode($argv[1],true),json_decode($argv[2],true),$argv[3]));`;
for(const audience of ['individual','corporate']){
 const doc=docs.find(d=>d.id==='kyc-'+audience),field=id=>doc.fields.find(f=>f.id===id);
 test(`${doc.id}: both printed portfolio columns preserve longer decimals without a character cap`,()=>{
  const answers={};
  for(const prefix of ['ideal','current'])for(const asset of assets){
   const f=field(prefix+'_'+asset);
   assert.equal(f.maxLength,undefined);assert.equal(f.numeric,true);assert.equal(f.total,prefix);
   assert.match(f.context[0],/\(%\)/);assert.match(f.context[1],/\(٪\)/);
   answers[f.id]=prefix==='ideal'?'12.345678':'١٢٫٣٤٥٦٧٨';
   assert.equal(parseNumber(answers[f.id]),12.345678);
  }
  const saved=JSON.parse(execFileSync('php',['-r',php,JSON.stringify(doc),JSON.stringify(answers),audience],{encoding:'utf8'}));
  for(const [id,value]of Object.entries(answers))assert.equal(saved[id],value);
  assert.match(doc.sections.find(s=>s.id==='portfolio').note,/100%/);
 });
 test(`${doc.id}: five paper risk questions, their score choices and explanations remain available`,()=>{
  const questions=['risk_experience','risk_age','risk_reaction','risk_duration','risk_capital'];
  for(const id of questions)assert.deepEqual(field(id).options.map(o=>o.value),id==='risk_experience'?['1','2','3']:['1','2','3','4']);
  assert.deepEqual(field('risk_total').sum,questions);
  const notes=field('risk_total').paperNotes;
  assert.equal(notes.length,3);assert.ok(notes.every(([en,ar])=>en&&ar));
  assert.match(notes[0][0],/\(1\) and \(6\): Low to medium/);
  assert.match(notes[1][0],/\(7\) and \(15\): medium to high/);
  assert.match(notes[2][0],/more than \(15\): high/);
  assert.equal(field('desired_funds').help,'Despite recommendation Itqan Capital');
  assert.match(field('risk_capital').ar,/5\. ماهي نسبة رأس المال/);
  assert.equal(field('objectives').options.find(o=>o.value==='balanced').ar,'متوازنة');
  assert.equal(field('objectives').options.find(o=>o.value==='income').label,audience==='corporate'?'Realization of Income':'Realization Income');
  assert.equal(doc.pages,7);assert.equal(doc.pdfVersion,'20261007-original-kyc');
 });
}
test('printed digit-box limits remain separate from the removed arbitrary percentage limit',()=>{
 const individual=docs.find(d=>d.id==='kyc-individual'),corporate=docs.find(d=>d.id==='kyc-corporate');
 assert.equal(individual.fields.find(f=>f.id==='dependents').maxLength,2);
 const id=corporate.fields.find(f=>f.id==='auth_id');assert.equal(id.maxLength,id.charRects.length);
});
