import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {applyPersonNameFields} from '../src/person-names.js';
import {normalizeSubscription,visibleFields,sectionProgress,missingRequired} from '../src/subscription/model.js';
const documents=applyPersonNameFields(structuredClone(docs)),individual=documents.find(doc=>doc.id==='subscription-form'),company=documents.find(doc=>doc.id==='subscription-company');

test('English subscription names join their original PDF field and leave company English names whole',()=>{
 const values=normalizeSubscription(individual,{en_first:'Ahmad',en_second:'Ali Mohammed',en_third:'',en_last:'Al Abdul Aziz'});
 assert.equal(values.english_name,'Ahmad Ali Mohammed Al Abdul Aziz');
 assert.deepEqual(individual.fields.find(field=>field.id==='full_name').join,['first_name','second_name','third_name','family_name']);
 assert.ok(!visibleFields(individual,values).some(field=>field.id==='english_name'));
 assert.deepEqual(visibleFields(individual,values).filter(field=>field.personNameGroup==='english_name').map(field=>field.id),['en_first','en_second','en_third','en_last']);
 assert.equal(normalizeSubscription(company,{company_name:'A Company',english_name:'A Company Limited'}).english_name,'A Company Limited');
 assert.equal(company.fields.find(field=>field.id==='english_name').personNameGroup,undefined);
});
test('applicant auto-follow copies exact individual part boundaries including multiword names',()=>{
 let values=normalizeSubscription(individual,{first_name:'عبد الرحمن',second_name:'محمد علي',third_name:'',family_name:'آل عبدالعزيز'});
 assert.equal(values.applicant_name_first,'عبد الرحمن');assert.equal(values.applicant_name_second,'محمد علي');assert.equal(values.applicant_name_third,'');assert.equal(values.applicant_name_last,'آل عبدالعزيز');
 values=normalizeSubscription(individual,{...values,third_name:'أحمد'});assert.equal(values.applicant_name_third,'أحمد');assert.equal(values.applicant_name,'عبد الرحمن محمد علي أحمد آل عبدالعزيز');
 values=normalizeSubscription(individual,{...values,applicant_name_first:'Corrected',applicant_name_second:'',applicant_name_third:'',applicant_name_last:'Family',first_name:'Changed source'},{applicantEdited:true});assert.equal(values.applicant_name,'Corrected Family');
 values=normalizeSubscription(individual,{...values,applicant_name_first:'',applicant_name_last:''},{applicantEdited:true});assert.equal(values.applicant_name,'');assert.ok(missingRequired(individual,values,{}).includes('applicant_name'));
 const legacy=normalizeSubscription(individual,{first_name:'Different',applicant_name:'Previously Corrected Family'},{applicantEdited:true});assert.equal(legacy.applicant_name,'Previously Corrected Family');
});
test('company applicant follows authorized person parts without splitting the entity name',()=>{
 const values=normalizeSubscription(company,{company_name:'Long Corporate Entity Limited',auth_name_first:'Abdul Rahman',auth_name_second:'Ali',auth_name_third:'',auth_name_last:'Al Abdul Aziz'});
 assert.equal(values.auth_name,'Abdul Rahman Ali Al Abdul Aziz');assert.equal(values.full_name,'Long Corporate Entity Limited');assert.equal(values.applicant_name_first,'Abdul Rahman');assert.equal(values.applicant_name_last,'Al Abdul Aziz');assert.equal(values.applicant_name,values.auth_name);
 const legacy=normalizeSubscription(company,{auth_name:'Ahmad Ali Hassan Al Dalao'});assert.equal(legacy.applicant_name,legacy.auth_name);assert.equal(legacy.applicant_name_last,'Al Dalao');
});
test('required hidden name targets remain validated without requiring all four new parts',()=>{
 const missing=missingRequired(company,normalizeSubscription(company,{}),{});assert.ok(missing.includes('auth_name'));assert.ok(missing.includes('applicant_name'));
 const some=normalizeSubscription(company,{auth_name_first:'Ahmad'}),filled=missingRequired(company,some,{});assert.ok(!filled.includes('auth_name'));assert.ok(!filled.includes('applicant_name'));
 assert.ok(!missingRequired(individual,normalizeSubscription(individual,{}),{}).includes('english_name'));
 assert.ok(individual.fields.filter(field=>field.personNameGroup==='english_name'&&field.uiOnly).every(field=>field.optional&&!field.required));
});
test('splitting the applicant UI preserves its logical progress count',()=>{
 const values=normalizeSubscription(individual,{first_name:'A',second_name:'B',family_name:'C'}),section=individual.sections.find(section=>section.id==='applicant');
 assert.deepEqual(sectionProgress(individual,section,values,{}),{completed:3,total:3});
 values.signature_mode='electronic';assert.deepEqual(sectionProgress(individual,section,values,{}),{completed:3,total:4});assert.deepEqual(sectionProgress(individual,section,values,{applicant:'image'}),{completed:4,total:4});
});
