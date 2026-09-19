import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {docs} from '../src/forms/index.js';
import {sharedGroups} from '../src/shared-fields.js';
import {signatureSlots} from '../src/signatures.js';

const schemas=Object.fromEntries(['individual','corporate'].map(audience=>[audience,sharedGroups(audience).flatMap(group=>group.fields.map(({id,label,ar,type,options})=>({id,label,ar,type,options})))]));
const php=(operation,payload)=>{
 const result=spawnSync('php',['-r',`
  require $argv[1];
  function reject($code){throw new DomainException($code);}
  function textValue($value,$max=2000){if(!is_string($value)||mb_strlen($value)>$max)reject('invalid_request');return trim($value);}
  $p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
  try{
   if($argv[2]==='snapshot')$result=submissionProfileSnapshot($p['doc'],$p['audience'],$p['input'],$p['source']??'online',$p['schemas']);
   else{$original=$p['profile'];$result=['profile'=>submissionProfileDetails($p['profile'],$p['doc'],$p['audience'],$p['schemas']),'unchanged'=>$original===$p['profile']];}
   echo json_encode(['result'=>$result],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
  }catch(DomainException $error){echo json_encode(['error'=>$error->getMessage()]);}
 `,resolve('public/api/portal-details.php'),operation],{input:JSON.stringify({...payload,schemas}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
};
const document=id=>{const doc=docs.find(d=>d.id===id);return {...doc,signatureSlots:signatureSlots(doc)};};

test('submission snapshots preserve every recognized audience-specific shared field and reject forged labels',()=>{
 for(const audience of ['individual','corporate']){
  const input=Object.fromEntries(schemas[audience].map(field=>[field.id,field.type==='checkbox'?false:field.options?.[0]?.[0]??'Saved '+field.id]));
  input.city='';input.postal='0';
  Object.assign(input,{field_definitions:[{id:'hijack',label:'Forged'}],section_definitions:[],shared_field_definitions:[],signature_definitions:[],submission_source:'upload',submission_schema:999,unknown_key:'Drop this'});
  input[audience==='individual'?'company_name':'en_first']='Another audience';
  const {result}=php('snapshot',{doc:document('signature-form'),audience,input});
  for(const field of schemas[audience])assert.deepEqual(result[field.id],input[field.id],audience+' '+field.id);
  assert.equal(result.unknown_key,undefined);assert.equal(result[audience==='individual'?'company_name':'en_first'],undefined);
  assert.equal(result.submission_schema,2);assert.equal(result.submission_source,'online');
  assert.deepEqual(result.shared_field_definitions,schemas[audience]);
  assert.equal(result.field_definitions[0].id,document('signature-form').fields[0].id);assert.equal(result.section_definitions[0].id,'client');
  assert.deepEqual(result.signature_definitions,[{id:'specimen',label:'Specimen signature',ar:'نموذج التوقيع'}]);
  assert.equal(result.field_definitions.some(f=>f.id==='hijack'),false);
 }
});

test('shared choices and checkboxes retain typed values and reject invalid submitted values',()=>{
 const doc=document('signature-form'),audience='individual';
 for(const input of [{title:'invented'},{also_residence:'true'},{also_residence:0},{city:[]},{city:'x'.repeat(2001)}])assert.equal(php('snapshot',{doc,audience,input}).error,'invalid_request');
 const {result}=php('snapshot',{doc,audience,input:{title:'',also_residence:true,city:'',en_middle:'Ali Hassan',full_name:'Original saved name'}});
 assert.equal(result.title,'');assert.equal(result.also_residence,true);assert.equal(result.city,'');assert.equal(result.en_second,'Ali Hassan');assert.equal(result.en_middle,'Ali Hassan');assert.equal(result.full_name,'Original saved name');
});

test('all built-in snapshots carry their exact sections, choices and signature labels without drawing coordinates',()=>{
 for(const source of docs){
  const doc=document(source.id),audience=source.group==='corporate'?'corporate':'individual';
  const {result}=php('snapshot',{doc,audience,input:{}});
  assert.equal(result.field_definitions.length,source.fields.length,source.id);
  assert.deepEqual(result.section_definitions,source.sections.map(s=>({id:s.id,title:s.title,ar:s.ar,field_ids:s.fields.map(f=>f.id)})),source.id);
  assert.deepEqual(result.signature_definitions,signatureSlots(doc).map(({id,label,ar})=>({id,label,ar})),source.id);
  for(const field of source.fields){
   const saved=result.field_definitions.find(f=>f.id===field.id);
   assert.equal(saved.label,field.label);assert.equal(saved.ar,field.ar);assert.equal(saved.rect,undefined);
   if(field.options)assert.deepEqual(saved.options,field.options.map(({value,label,ar})=>({value,label,ar})));
   if(field.selectOptions)assert.deepEqual(saved.selectOptions,field.selectOptions.map(option=>option.slice(0,3)));
  }
 }
});

test('managed documents snapshot page sections including pages with only signature slots',()=>{
 const doc={id:'upload_test',pages:3,fields:[{id:'email',page:1,label:'Email',ar:'البريد الإلكتروني',type:'email',rect:[1,2,3,4]},{id:'reason',page:3,label:'Reason',ar:'السبب',type:'text'}],signatures:[{id:'signature',page:2,label:'Signature',ar:'التوقيع',rect:[1,2,3,4]}]};
 const {result}=php('snapshot',{doc,audience:'corporate',input:{company_name:'Company'}});
 assert.deepEqual(result.section_definitions,[{id:'page_1',title:'Page 1',ar:'الصفحة 1',field_ids:['email']},{id:'page_2',title:'Page 2',ar:'الصفحة 2',field_ids:[]},{id:'page_3',title:'Page 3',ar:'الصفحة 3',field_ids:['reason']}]);
 assert.deepEqual(result.signature_definitions,[{id:'signature',label:'Signature',ar:'التوقيع'}]);
});

test('uploaded PDFs never claim injected online profile answers',()=>{
 const {result}=php('snapshot',{doc:document('signature-form'),audience:'individual',source:'upload',input:{en_first:'Injected',email:'unverified@example.com',full_name:'Injected legacy name',company_name:'Wrong audience'}});
 assert.equal(result.submission_source,'upload');assert.equal(result.en_first,undefined);assert.equal(result.email,undefined);assert.equal(result.full_name,undefined);assert.equal(result.company_name,undefined);
 assert.ok(result.field_definitions.length,'Template metadata is reference material, not extracted PDF answers');
});

test('legacy detail fallback leaves stored values and captured labels unchanged',()=>{
 const profile={submission_source:'online',full_name:'Original',email:'',field_definitions:[{id:'client_name',label:'Original saved label',ar:'العنوان المحفوظ',type:'text'}]};
 const {result}=php('fallback',{doc:document('signature-form'),audience:'individual',profile});
 assert.equal(result.unchanged,true);assert.equal(result.profile.full_name,'Original');assert.equal(result.profile.email,'');assert.deepEqual(result.profile.field_definitions,profile.field_definitions);
 assert.deepEqual(result.profile.definition_fallback,['section_definitions','signature_definitions','shared_field_definitions']);
 const saved=php('snapshot',{doc:document('signature-form'),audience:'individual',input:{}}).result;
 const complete=php('fallback',{doc:null,audience:'individual',profile:saved}).result;
 assert.equal(complete.unchanged,true);assert.deepEqual(complete.profile,saved,'Complete snapshots never change when current document is unavailable');
 const removed=php('fallback',{doc:null,audience:'corporate',profile:{submission_source:'upload'}}).result;
 assert.equal(removed.profile.field_definitions,undefined);assert.equal(removed.profile.section_definitions,undefined);assert.deepEqual(removed.profile.shared_field_definitions,schemas.corporate);
});
