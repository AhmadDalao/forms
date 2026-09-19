import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {docs} from '../src/forms/index.js';
import {sharedGroups} from '../src/shared-fields.js';
import {signatureSlots} from '../src/signatures.js';

// Generate definitions from this checkout; no build or existing dist is needed.
const definition=id=>{const d=docs.find(d=>d.id===id);return {...d,signatureSlots:signatureSlots(d)};};
const schemas=Object.fromEntries(['individual','corporate'].map(a=>[a,sharedGroups(a).flatMap(g=>g.fields)]));
const subscription={first_name:'Ahmad',second_name:'Mohammed',family_name:'Ali',nationality:'Saudi Arabian',id_type:'national',id_number:'1000012345',company_name:'Example Holdings LLC',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name:'Authorized Original Name',subscription_type:'new',payment_method:'transfer',units:'10',applicant_name:'Original Applicant',date:'2026-09-20',signature_mode:'electronic'};
const base=d=>d.workflow==='subscription'?{...subscription}:{};
const applicable=(d,audience)=>d.fields.filter(f=>f.join&&(!f.joinAudience||f.joinAudience===audience));
const php=(operation,payload,dir='')=>{
 const r=spawnSync('php',['-r',`
  require $argv[1].'/portal-answers.php';require $argv[1].'/portal-details.php';require $argv[1].'/portal-versions.php';
  function reject($code,$status=400){throw new DomainException($code,$status);}
  function textValue($value,$max=2000){if(!is_string($value)||mb_strlen($value)>$max)reject('invalid_request');return trim($value);}
  function execute($sql,$args=[]){global $db;$s=$db->prepare($sql);$s->execute($args);return $s;}
  $p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
  if($argv[2]==='clean'){
   $results=[];foreach($p['cases'] as $case){try{$results[]=['answers'=>cleanAnswers($case['doc'],$case['values'],$case['audience'])];}catch(DomainException $e){$results[]=['error'=>$e->getMessage(),'status'=>$e->getCode()];}}
   echo json_encode($results,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
  }
  if($argv[2]==='snapshot'){
   $answers=cleanAnswers($p['doc'],$p['values'],$p['audience']);
   $profile=submissionProfileSnapshot($p['doc'],$p['audience'],[],'online',$p['schemas']);
   echo json_encode(['answers'=>$answers,'profile'=>$profile],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
  }
  if($argv[2]==='requiredSignatures'){
   $answers=cleanAnswers($p['doc'],$p['values'],$p['audience']);
   echo json_encode(array_column(requiredSubmissionSignatureSlots($p['doc'],$answers),'id'));exit;
  }
  $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  $db->exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,account_type TEXT); CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT);
   CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doc_id TEXT,title TEXT,ar TEXT,audience TEXT,created_at TEXT,size INTEGER,sha256 TEXT,answers TEXT,profile TEXT,request_key TEXT,UNIQUE(user_id,request_key))');
  execute('INSERT INTO users VALUES(?,?)',['client',$p['audience']]);migrateVersions();
  $dataDir=$argv[3];mkdir($dataDir.'/pdfs');$source=$dataDir.'/source.pdf';file_put_contents($source,'%PDF-1.4 immutable test fixture %%EOF');
  $expected=null;$saved=[];
  foreach($p['versions'] as $index=>$version){
   $doc=$version['doc'];$answers=cleanAnswers($doc,$version['values'],$p['audience']);$profile=submissionProfileSnapshot($doc,$p['audience'],[],'online',$p['schemas']);
   $result=saveVersion(['user_id'=>'client','doc_id'=>$doc['id'],'title'=>$doc['title'],'ar'=>$doc['ar'],'audience'=>$p['audience'],'answers'=>json_encode($answers),'profile'=>json_encode($profile),'request_key'=>'names-'.$index,'source'=>'online','signatures'=>'{}','edited_from'=>$expected],$source,$expected);
   $expected=$result['submission']['id'];$saved[]=execute('SELECT * FROM submissions WHERE id=?',[$expected])->fetch();
  }
  $rows=execute('SELECT * FROM submissions ORDER BY version')->fetchAll();
  foreach($rows as &$row){$row['answers']=json_decode($row['answers'],true);$row['profile']=submissionProfileDetails(json_decode($row['profile'],true),$p['versions'][count($p['versions'])-1]['doc'],$p['audience'],$p['schemas']);}unset($row);
  echo json_encode(['rows'=>$rows,'original_answers_unchanged'=>execute('SELECT answers FROM submissions WHERE id=?',[$saved[0]['id']])->fetchColumn()===$saved[0]['answers'],'original_profile_unchanged'=>execute('SELECT profile FROM submissions WHERE id=?',[$saved[0]['id']])->fetchColumn()===$saved[0]['profile']],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 `,resolve('public/api'),operation,dir],{input:JSON.stringify({...payload,schemas}),encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr||r.error?.message);return JSON.parse(r.stdout);
};

test('server joins recognized personal-name parts and ignores forged full PDF targets across current schemas',()=>{
 const cases=[],expected=[];
 for(const source of docs)for(const audience of source.group==='shared'?['individual','corporate']:[source.group]){
  const d=definition(source.id),fields=applicable(d,audience);if(!fields.length)continue;
  const values=base(d),targets={};
  for(const f of fields){for(const [i,id] of f.join.entries())values[id]=[' أحمد ',' محمد ',' حسن ',' الدلاو '][i];values[f.id]='FORGED FULL NAME';}
  for(const f of fields)targets[f.id]=f.join.map(id=>values[id]?.trim()||'').filter(Boolean).join(' ');
  cases.push({doc:d,audience,values});expected.push(targets);
 }
 assert.ok(cases.some(c=>c.doc.id==='kyc-individual'),'Current name schema must be loaded');
 const results=php('clean',{cases});
 for(const [i,result]of results.entries()){assert.equal(result.error,undefined,cases[i].doc.id);for(const [id,name]of Object.entries(expected[i]))assert.equal(result.answers[id],name,cases[i].doc.id+'/'+id);}
});

test('blank or partially supplied parts are authoritative while legacy complete strings stay intact',()=>{
 const d=definition('signature-form'),target=d.fields.find(f=>f.id==='signer_name');assert.ok(target.join?.length===4);
 const cases=[
  {values:{signer_name:'Legacy Compound Family Name'}},
  {values:{signer_name:'Stale name',...Object.fromEntries(target.join.map(id=>[id,'']))}},
  {values:{signer_name:'Stale name',[target.join[0]]:' First only '}},
  {values:{signer_name:'Stale name',...Object.fromEntries(target.join.map((id,i)=>[id,['First','Second','','Compound Family'][i]]))}},
 ].map(c=>({doc:d,audience:'individual',...c}));
 assert.deepEqual(php('clean',{cases}).map(r=>r.answers.signer_name),['Legacy Compound Family Name','','First only','First Second Compound Family']);
});

test('individual-only parts cannot overwrite corporate entity names or cross into saved corporate answers',()=>{
 const cases=[];
 for(const id of ['signature-form','terms-and-conditions']){
  const d=definition(id),gated=d.fields.filter(f=>f.joinAudience==='individual'&&f.join);assert.ok(gated.length,id);
  const values={};for(const f of gated){values[f.id]='Example Holdings LLC';for(const part of f.join)values[part]='Injected personal part';}
  cases.push({doc:d,audience:'corporate',values});
 }
 const results=php('clean',{cases});
 for(const [i,r]of results.entries())for(const f of cases[i].doc.fields.filter(f=>f.joinAudience==='individual')){
  if(f.uiOnly)assert.equal(r.answers[f.id],undefined,f.id);else if(f.join)assert.equal(r.answers[f.id],'Example Holdings LLC',f.id);
 }
 const company=definition('subscription-company'),result=php('clean',{cases:[{doc:company,audience:'corporate',values:{...subscription,english_name:'Example International Holdings LLC',en_first:'Forged',en_second:'Person',en_third:'Parts',en_last:'Name'}}]})[0];
 assert.equal(result.answers.english_name,'Example International Holdings LLC');assert.equal(result.answers.company_name,subscription.company_name);
});

test('subscription English parts are canonical while required answers, dates and totals keep their existing rules',()=>{
 const d=definition('subscription-form'),english=d.fields.find(f=>f.id==='english_name');assert.deepEqual(english.join,['en_first','en_second','en_third','en_last']);
 const values={...subscription,english_name:'FORGED',en_first:' Ahmad ',en_second:' Mohammed ',en_third:'',en_last:' Al Dalao ',full_name:'FORGED',total_amount:'1',subscription_fee:'0'};
 const required=d.fields.filter(f=>f.required&&!f.uiOnly&&(!f.when||f.when.includes(values[f.dependsOn])));
 const cases=[{doc:d,audience:'individual',values},...required.map(f=>({doc:d,audience:'individual',values:{...values,[f.id]:''}})),{doc:d,audience:'individual',values:{...values,date:'2026-02-30'}},{doc:d,audience:'individual',values:{...values,en_first:['not a name']}}];
 const [valid,...failures]=php('clean',{cases});
 assert.equal(valid.answers.english_name,'Ahmad Mohammed Al Dalao');assert.equal(valid.answers.full_name,'Ahmad Mohammed Ali');assert.equal(valid.answers.date,'2026-09-20');assert.equal(valid.answers.total_amount,'10200');assert.equal(valid.answers.subscription_fee,'200');
 for(const [i,result]of failures.entries())assert.equal(result.error,i<required.length?'form_incomplete':'invalid_request','Invalid required/date/name input must reject case '+i);
 const legacy=php('clean',{cases:[{doc:d,audience:'individual',values:{...subscription,english_name:'Legacy Unsplit English Name'}}]})[0];assert.equal(legacy.answers.english_name,'Legacy Unsplit English Name');
});

test('current snapshots capture visible name parts and hidden PDF name targets from the server definition',()=>{
 for(const id of ['signature-form','kyc-individual','fatca-crs-corporate','subscription-form']){
  const d=definition(id),audience=d.group==='corporate'?'corporate':'individual',values=base(d);
  assert.ok(d.fields.some(f=>f.personNamePart),id+' has visible name parts');
  for(const f of applicable(d,audience))for(const [i,part]of f.join.entries())values[part]=['First','Second','','Family'][i];
  const r=php('snapshot',{doc:d,audience,values});
  for(const f of d.fields.filter(f=>f.personNamePart||f.personNameDerived)){
   const saved=r.profile.field_definitions.find(s=>s.id===f.id);assert.ok(saved,id+'/'+f.id);assert.equal(saved.label,f.label);assert.equal(saved.ar,f.ar);assert.equal(saved.hidden,f.hidden);assert.equal(saved.uiOnly,f.uiOnly);assert.equal(saved.joinAudience,f.joinAudience);assert.equal(saved.rect,undefined);
   assert.ok(r.profile.section_definitions.some(section=>section.field_ids.includes(f.id)),id+'/'+f.id+' belongs to a captured section');
  }
 }
});

test('a supplemental signer entered through name parts still requires the existing customer signature slot',()=>{
 for(const [id,target,slot,audience]of [['terms-and-conditions','terms_name_1','terms_1','individual'],['kyc-individual','representative_name','representative','individual'],['fatca-crs-corporate','signer_1_name','signatory_1','corporate']]){
  const d=definition(id),parts=d.fields.find(f=>f.id===target).join;
  assert.ok(php('requiredSignatures',{doc:d,audience,values:{[parts[0]]:'Additional signer'}}).includes(slot),id+' must not bypass signature policy with UI-only parts');
  assert.equal(php('requiredSignatures',{doc:d,audience,values:{[target]:'Old name',...Object.fromEntries(parts.map(part=>[part,'']))}}).includes(slot),false,id+' clearing the name parts also clears its derived signature requirement');
 }
});

test('new four-part versions preserve archived legacy names, original labels and earlier part snapshots',()=>{
 const dir=mkdtempSync(join(tmpdir(),'portal-person-names-'));
 try{
  const d=definition('signature-form'),target=d.fields.find(f=>f.id==='signer_name'),parts=target.join;assert.equal(parts.length,4);
  const legacy=structuredClone(d);legacy.fields=legacy.fields.filter(f=>!f.personNamePart);for(const f of legacy.fields){delete f.join;delete f.joinAudience;delete f.personNameDerived;if(f.id==='signer_name')f.label='Original saved signer label';}
  for(const section of legacy.sections)section.fields=section.fields.filter(f=>legacy.fields.some(field=>field.id===f.id));
  const values=Object.fromEntries(parts.map((id,i)=>[id,['First','Second','Third','Family'][i]]));
  const r=php('versions',{audience:'individual',versions:[{doc:legacy,values:{signer_name:'Legacy Unsplit Signer'}},{doc:d,values},{doc:d,values:{...values,[parts[2]]:''}}]},dir);
  assert.equal(r.original_answers_unchanged,true);assert.equal(r.original_profile_unchanged,true);assert.equal(r.rows.length,3);
  assert.equal(r.rows[0].answers.signer_name,'Legacy Unsplit Signer');assert.equal(r.rows[0].profile.field_definitions.find(f=>f.id==='signer_name').label,'Original saved signer label');assert.equal(r.rows[0].profile.field_definitions.some(f=>parts.includes(f.id)),false);
  assert.equal(r.rows[1].answers.signer_name,'First Second Third Family');assert.equal(r.rows[1].answers[parts[2]],'Third');assert.equal(r.rows[2].answers.signer_name,'First Second Family');assert.equal(r.rows[2].answers[parts[2]],'');
  assert.ok(r.rows[0].archived_at);assert.ok(r.rows[1].archived_at);assert.equal(r.rows[2].archived_at,null);assert.equal(r.rows[2].replaces_id,r.rows[1].id);assert.equal(r.rows[1].replaces_id,r.rows[0].id);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
