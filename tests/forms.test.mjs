import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {hasValue} from '../src/schema.js';
const field=(doc,id)=>docs.find(d=>d.id===doc).fields.find(f=>f.id===id);
test('unchanged documents keep every printed customer field available without conditional rules',()=>{
 for(const doc of docs.filter(d=>!d.workflow))for(const f of doc.fields){
  assert.equal('when' in f,false,`${doc.id}/${f.id}`);
  assert.equal('whenAll' in f,false,`${doc.id}/${f.id}`);
  assert.equal(f.noPrint,undefined,`${doc.id}/${f.id}`);
 }
});
test('all three printed US TIN lines exist without an invented selector',()=>{
 for(const id of ['ssn','itin','atin']){
  const f=field('fatca-crs-individual',id);
  assert.equal(f.maxLength,9);
  assert.ok(f.rect&&f.page>=1);
 }
 assert.equal(field('fatca-crs-individual','tin_type'),undefined);
});
test('printed details remain mapped for users to fill or skip themselves',()=>{
 for(const [doc,ids] of [
  ['fatca-crs-individual',['permanent_details','tax_country_0','tax_tin_0','tax_reason_0','tax_explanation_0','capacity_other','staff_account_holder','staff_employee_id','staff_cif']],
  ['fatca-crs-corporate',['us_tin','giin_3','giin_4','giin_5','exchange','person_0_name','person_4_tin']],
  ['kyc-individual',['title_other','id_other','sector_other','listed_company','beneficiary_identity','representative_name','rep_fax','other_currency']],
  ['kyc-corporate',['other_currency']]
 ])for(const id of ids)assert.ok(field(doc,id)?.rect,`${doc}/${id}`);
});
test('zero and identifiers with leading zeros are answers',()=>{
 assert.equal(hasValue('0'),true);assert.equal(hasValue('00001234'),true);
 assert.equal(hasValue('   '),false);assert.equal(hasValue([]),false);
});
test('eight fillable documents (separate subscription audiences) retain valid page mappings and field IDs',()=>{
 assert.equal(docs.length,8);
 for(const d of docs){assert.equal(new Set(d.fields.map(f=>f.id)).size,d.fields.length);for(const f of d.fields)assert.ok(f.page>=1&&f.page<=d.pages);}
});
