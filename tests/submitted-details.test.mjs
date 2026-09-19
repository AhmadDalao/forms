import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionDetailsModel,renderSubmissionDetails} from '../src/portal/submitted-details.js';

const sample=(extra={})=>({id:'saved-version',doc_id:'custom-document',audience:'individual',source:'online',answers:{},profile:{},signatures:{},...extra});
test('complete snapshot fields retain blanks, false, zero, choices, arrays and unknown saved keys',()=>{
 const s=sample({answers:{zero:0,no:false,blank:'',many:['a','b'],unknown:'Original value',hidden:'1000'},profile:{field_definitions:[{id:'zero',label:'Amount',ar:'المبلغ'},{id:'no',label:'Answer',ar:'الإجابة'},{id:'blank',label:'Blank',ar:'فارغ'},{id:'missing',label:'Not answered',ar:'بلا إجابة'},{id:'many',label:'Options',ar:'الخيارات',options:[{value:'a',label:'First',ar:'الأول'},{value:'b',label:'Second',ar:'الثاني'}]},{id:'hidden',label:'Calculated amount',ar:'المبلغ المحسوب',hidden:true}],section_definitions:[{id:'section',title:'Saved section',ar:'القسم المحفوظ',field_ids:['zero','no','blank','missing','many','hidden']} ]}});
 const en=submissionDetailsModel(s),rows=new Map(en.groups.flatMap(g=>g.fields).map(f=>[f.id,f]));
 assert.equal(rows.size,7);assert.equal(rows.get('zero').value,'0');assert.equal(rows.get('no').value,'No');assert.equal(rows.get('blank').value,'Not provided');assert.equal(rows.get('missing').value,'Not provided');assert.equal(rows.get('many').value,'First\nSecond');assert.equal(rows.get('hidden').value,'1000');assert.equal(rows.get('unknown').value,'Original value');
 const ar=submissionDetailsModel(s,'ar');assert.equal(ar.groups[0].label,'القسم المحفوظ');assert.equal(ar.groups[0].fields.find(f=>f.id==='many').value,'الأول\nالثاني');assert.equal(ar.groups[0].fields.find(f=>f.id==='no').value,'لا');
});
test('saved definitions win over current templates; older documents use known labels',()=>{
 const saved=sample({doc_id:'signature-form',answers:{client_name:'Saved Name'},profile:{field_definitions:[{id:'client_name',label:'Original customer label',ar:'الاسم الأصلي'}],section_definitions:[{id:'original',title:'Original section',ar:'القسم الأصلي',field_ids:['client_name']}]}});
 const current=submissionDetailsModel(saved);assert.equal(current.groups[0].fields.length,1);assert.equal(current.groups[0].fields[0].label,'Original customer label');assert.equal(current.groups[0].label,'Original section');
 const legacy=submissionDetailsModel({...saved,profile:{}});assert.ok(legacy.groups.flatMap(g=>g.fields).length>1);assert.notEqual(legacy.groups.flatMap(g=>g.fields).find(f=>f.id==='client_name').label,'Client name');
});
test('shared snapshots preserve their own values and explicit false without metadata or future blank fields',()=>{
 const s=sample({answers:{client_name:'Document-specific name'},profile:{submission_source:'online',submission_schema:2,definition_fallback:['field_definitions'],en_first:'Original shared name',email:'client@example.com',also_residence:false,legacy_key:'Saved legacy detail',field_definitions:[{id:'client_name',label:'Name',ar:'الاسم'}],shared_field_definitions:[{id:'en_first',label:'First name',ar:'الاسم الأول'},{id:'email',label:'Email',ar:'البريد',type:'email'},{id:'also_residence',label:'Use residence',ar:'استخدم الإقامة',type:'checkbox'},{id:'not_captured',label:'Never captured'}]}});
 const model=submissionDetailsModel(s),shared=model.shared.flatMap(g=>g.fields);
 assert.equal(shared.length,4);assert.equal(shared.find(f=>f.id==='also_residence').value,'No');assert.equal(shared.find(f=>f.id==='en_first').value,'Original shared name');assert.equal(model.groups[0].fields[0].value,'Document-specific name');assert.ok(!shared.some(f=>f.id==='definition_fallback'||f.id==='not_captured'));
});
test('email, phone and identifiers remain LTR while Arabic prose remains RTL',()=>{
 const s=sample({answers:{email:'person@example.com',phone:'+966501234567',id_number:'0012345678',arabic:'الرياض حي النعيم'},profile:{field_definitions:[{id:'email',type:'email'},{id:'phone',type:'tel'},{id:'id_number'},{id:'arabic'}]}});
 const fields=submissionDetailsModel(s,'ar').groups.flatMap(g=>g.fields);for(const id of ['email','phone','id_number'])assert.equal(fields.find(f=>f.id===id).direction,'ltr');assert.equal(fields.find(f=>f.id==='arabic').direction,'rtl');
});
test('text and labels escape HTML; signature images accept only saved PNG data',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
 const s=sample({answers:{unsafe:'<img src=x onerror=alert(1)> & "value"'},profile:{field_definitions:[{id:'unsafe',label:'<script>label</script>',ar:'الاسم'}],signature_definitions:[{id:'actual',label:'Actual signature'},{id:'unsafe',label:'Unsafe image'},{id:'blank',label:'Not provided'}]},signatures:{actual:png,unsafe:'javascript:alert(1)'}});
 const html=renderSubmissionDetails(s);assert.ok(html.includes('&lt;img src=x'));assert.ok(html.includes('&lt;script&gt;label'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(html.includes(`src="${png}"`));assert.equal(submissionDetailsModel(s).signatures.filter(x=>x.image).length,1);
});
test('PDF-only submissions explain missing online answers without fabricating blank form fields',()=>{
 const s=sample({doc_id:'signature-form',source:'upload',answers:{injected:'not online data'},profile:{submission_source:'upload'}});
 const model=submissionDetailsModel(s);assert.equal(model.uploaded,true);assert.equal(model.groups.length,0);assert.equal(model.signatures.length,0);const html=renderSubmissionDetails(s);assert.ok(html.includes('No online form answers were captured'));assert.ok(!html.includes('data-answer-field'));
});
