import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {sharedGroups,cleanShared} from '../src/shared-fields.js';

const schemas=Object.fromEntries(['individual','corporate'].map(a=>[a,sharedGroups(a).flatMap(g=>g.fields)]));
const prelude=`
 require $argv[1].'/portal-versions.php';require $argv[1].'/portal-account-types.php';require $argv[1].'/portal-reviews.php';require $argv[1].'/portal-shared.php';
 $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$db->exec('PRAGMA foreign_keys=ON');
 $p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$schemas=$p['schemas'];
 function execute($sql,$args=[]){global $db;$q=$db->prepare($sql);$q->execute($args);return $q;}
 function reject($code,$status=400){throw new DomainException($code,$status);}
 function failure($callback){try{$callback();return null;}catch(DomainException $e){return $e->getMessage();}}
 function preserved(){return [execute('SELECT * FROM users ORDER BY id')->fetchAll(),execute('SELECT * FROM submissions ORDER BY id')->fetchAll(),execute('SELECT * FROM submission_reviews ORDER BY id')->fetchAll(),execute('SELECT * FROM audit ORDER BY id')->fetchAll(),execute('SELECT * FROM workflow_settings')->fetchAll(),execute('SELECT * FROM workflow_setting_events')->fetchAll()];}
 $db->exec('CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT);CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doc_id TEXT,title TEXT,ar TEXT,audience TEXT,created_at TEXT,size INTEGER,sha256 TEXT,answers TEXT,profile TEXT,request_key TEXT,UNIQUE(user_id,request_key))');
 migrateVersions();migrateAccountTypes();migrateReviews();migrateWorkflow();
 execute('INSERT INTO users(id,name,account_type) VALUES(?,?,?)',['individual','Individual','individual']);execute('INSERT INTO users(id,name,account_type) VALUES(?,?,?)',['corporate','Corporate','corporate']);execute('INSERT INTO users(id,name,account_type) VALUES(?,?,?)',['other','Other','individual']);
 execute('INSERT INTO submissions(id,user_id,doc_id,title,ar,audience,created_at,size,sha256,answers,profile,request_key,source,signatures) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',['legacy','individual','signature-form','Form','نموذج','individual','2026-09-19T12:00:00Z',100,'pdf-hash','{"client_name":"Submitted name"}','{"country":"Submitted country"}','legacy-request','online','{}']);
 execute('INSERT INTO submission_reviews(id,submission_id,status,reason_code,reason_text,admin_username,created_at,request_key,read_at) VALUES(?,?,?,?,?,?,?,?,?)',[41,'legacy','rejected','other','Original reason','manager','2026-09-19T13:00:00Z','legacy-review','2026-09-19T14:00:00Z']);
 execute('INSERT INTO audit VALUES(?,?,?,?)',[17,'individual','preserved-audit','2026-09-19T12:00:00Z']);
`;
function php(code,input={}){
 const r=spawnSync('php',['-r',prelude+code,resolve('public/api')],{input:JSON.stringify({...input,schemas}),encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr||r.error?.message);return JSON.parse(r.stdout);
}

test('shared profile migration is transactional, repeatable and preserves all submissions, decisions, audit and workflow rows',()=>{
 const r=php(`
  $before=preserved();$sequence=execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn();
  $db->exec('CREATE TABLE client_shared_profiles(sentinel TEXT)');$schema=execute('SELECT * FROM sqlite_schema ORDER BY name')->fetchAll();$failed=false;
  try{migrateSharedProfiles();}catch(PDOException){$failed=true;}
  $rolledBack=$schema===execute('SELECT * FROM sqlite_schema ORDER BY name')->fetchAll()&&(int)$db->query('PRAGMA user_version')->fetchColumn()===5;
  $db->exec('DROP TABLE client_shared_profiles');migrateSharedProfiles();migrateSharedProfiles();migrateVersions();migrateAccountTypes();migrateReviews();migrateWorkflow();
  echo json_encode(['failed'=>$failed,'rolledBack'=>$rolledBack,'schema'=>(int)$db->query('PRAGMA user_version')->fetchColumn(),'unchanged'=>$before===preserved(),'sequence'=>$sequence===execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn(),'profile'=>clientSharedProfile('individual','individual'),'admin'=>adminSharedProfiles('individual'),'foreignKeys'=>execute('PRAGMA foreign_key_check')->fetchAll()]);
 `);
 assert.equal(r.failed,true);assert.equal(r.rolledBack,true);assert.equal(r.schema,6);assert.equal(r.unchanged,true);assert.equal(r.sequence,true);
 assert.deepEqual(r.profile,{profile:{},revision:0,updated_at:null});assert.deepEqual(r.admin,[]);assert.deepEqual(r.foreignKeys,[]);
});

test('shared patch validation preserves blanks and false, permits partial typing, and rejects unknown/signature/invalid values',()=>{
 const valid={en_first:' أحمد ',en_second:'',country:'',also_residence:false,email:'person@',dob:'2026-',id_type:''};
 const invalid=[{signatures:{}},{signature:'data:image/png;base64,AA=='},{company_name:'Wrong audience'},{unknown:'value'},{en_middle:'Read-only alias'},{email:[]},{country:true},{also_residence:'false'},{also_residence:0},{title:'invented'},{country:'x'.repeat(2001)},{en_first:'س'.repeat(2001)},{country:'data:image/png;base64,AA=='},{country:'invalid\0control'},['country']];
 const r=php(`migrateSharedProfiles();$valid=sharedProfilePatch('individual',$p['valid'],$schemas);$errors=[];foreach($p['invalid'] as $patch)$errors[]=failure(fn()=>saveSharedProfile('individual','individual',0,$patch,$schemas));echo json_encode(['valid'=>$valid,'errors'=>$errors,'rows'=>execute('SELECT COUNT(*) FROM client_shared_profiles')->fetchColumn(),'boundary'=>sharedProfilePatch('individual',['en_first'=>str_repeat('س',2000)],$schemas)]);`,{valid,invalid});
 assert.deepEqual(r.valid,valid);assert.deepEqual(r.errors,Array(invalid.length).fill('invalid_request'));assert.equal(r.rows,0);assert.equal(r.boundary.en_first.length,2000);
});

test('patch saves preserve unrelated fields, reject stale versions, and retain explicit empty tombstones',()=>{
 const r=php(`
  migrateSharedProfiles();$before=preserved();
  $first=saveSharedProfile('individual','individual',0,['en_first'=>'Original','city'=>'Riyadh','country'=>'','also_residence'=>false,'email'=>'partial@'],$schemas);
  $second=saveSharedProfile('individual','individual',1,['city'=>'Jeddah','email'=>null],$schemas);
  $stale=failure(fn()=>saveSharedProfile('individual','individual',1,['en_first'=>'Stale overwrite'],$schemas));$afterConflict=clientSharedProfile('individual','individual');
  $clear=saveSharedProfile('individual','individual',2,['en_first'=>null,'city'=>null,'country'=>null,'also_residence'=>null],$schemas);
  $emptySave=saveSharedProfile('other','individual',0,[],$schemas);
  echo json_encode(compact('first','second','stale','afterConflict','clear','emptySave')+['stored'=>clientSharedProfile('individual','individual'),'rowCount'=>execute('SELECT COUNT(*) FROM client_shared_profiles')->fetchColumn(),'unchanged'=>$before===preserved()]);
 `);
 assert.equal(r.first.revision,1);assert.match(r.first.updated_at,/^20\d\d-\d\d-\d\dT/);assert.equal(r.second.revision,2);assert.deepEqual(r.second.profile,{en_first:'Original',city:'Jeddah',country:'',also_residence:false});
 assert.equal(r.stale,'shared_profile_conflict');assert.deepEqual(r.afterConflict,r.second);assert.deepEqual(r.clear.profile,{});assert.equal(r.clear.revision,3);assert.deepEqual(r.stored,r.clear);assert.equal(r.rowCount,2);assert.equal(r.emptySave.revision,1);assert.deepEqual(r.emptySave.profile,{});assert.equal(r.unchanged,true);
});

test('server name aliases match four-part shared names, remain canonical, and clear without resurrection',()=>{
 const profiles=[{en_second:'Ali',en_third:'Hassan',ar_second:'محمد',ar_third:'حسن'},{auth_name:'First Second Third Compound Family'},{auth_first:'First',auth_second:'Second',auth_third:'',auth_last:'Family',auth_name:'FORGED'}];
 const r=php(`
  migrateSharedProfiles();$names=[];foreach($p['profiles'] as $index=>$profile){$audience=$index===0?'individual':'corporate';$id=$audience;$expected=$index===2?1:0;$names[]=saveSharedProfile($id,$audience,$expected,$profile,$schemas);}
  $blank=saveSharedProfile('individual','individual',1,['en_second'=>'','en_third'=>'','ar_second'=>null,'ar_third'=>null],$schemas);
  $cleared=saveSharedProfile('corporate','corporate',2,['auth_first'=>null,'auth_second'=>null,'auth_third'=>null,'auth_last'=>null],$schemas);
  $tooLong=failure(fn()=>saveSharedProfile('corporate','corporate',3,['auth_first'=>str_repeat('a',1001),'auth_last'=>str_repeat('b',1001)],$schemas));
  echo json_encode(compact('names','blank','cleared','tooLong')+['afterFailure'=>clientSharedProfile('corporate','corporate')]);
 `,{profiles});
 for(const [i,p]of profiles.entries())assert.deepEqual(r.names[i].profile,cleanShared(i===0?'individual':'corporate',p));
 assert.deepEqual(r.blank.profile,{en_second:'',en_third:''});assert.deepEqual(r.cleared.profile,{});assert.equal(r.tooLong,'invalid_request');assert.deepEqual(r.afterFailure,r.cleared);
});

test('autosave keeps raw typed spaces while only derived aliases are trimmed',()=>{
 const r=php(`migrateSharedProfiles();$individual=saveSharedProfile('individual','individual',0,['en_first'=>'Abdul ','en_second'=>' Ali ','en_third'=>' Hassan ','city'=>' Riyadh ','email'=>'person@ '],$schemas);$corporate=saveSharedProfile('corporate','corporate',0,['auth_first'=>'Abdul ','auth_second'=>' Ali ','auth_last'=>' Family '],$schemas);echo json_encode(compact('individual','corporate'));`);
 assert.deepEqual(r.individual.profile,{en_first:'Abdul ',en_second:' Ali ',en_third:' Hassan ',city:' Riyadh ',email:'person@ ',en_middle:'Ali Hassan'});
 assert.deepEqual(r.corporate.profile,{auth_first:'Abdul ',auth_second:' Ali ',auth_last:' Family ',auth_name:'Abdul Ali Family'});
});

test('account and audience checks prevent profile crossover while admin history retains prior audience rows',()=>{
 const r=php(`
  migrateSharedProfiles();$individual=saveSharedProfile('individual','individual',0,['en_first'=>'Personal','country'=>'Bahrain'],$schemas);
  $corporate=saveSharedProfile('corporate','corporate',0,['company_name'=>'Independent company'],$schemas);
  $wrongRead=failure(fn()=>clientSharedProfile('individual','corporate'));$wrongSave=failure(fn()=>saveSharedProfile('individual','corporate',0,['company_name'=>'Crossed'],$schemas));$missing=failure(fn()=>clientSharedProfile('missing','individual'));
  changeAccountType('individual','corporate','individual');$oldAudience=failure(fn()=>saveSharedProfile('individual','individual',1,['en_first'=>'Queued old save'],$schemas));
  $companyNew=saveSharedProfile('individual','corporate',0,['company_name'=>'Same account company'],$schemas);$admin=adminSharedProfiles('individual');
  changeAccountType('individual','individual','corporate');
  echo json_encode(compact('individual','corporate','wrongRead','wrongSave','missing','oldAudience','companyNew','admin')+['restored'=>clientSharedProfile('individual','individual'),'other'=>clientSharedProfile('other','individual'),'independent'=>clientSharedProfile('corporate','corporate')]);
 `);
 assert.equal(r.wrongRead,'account_type_restricted');assert.equal(r.wrongSave,'account_type_restricted');assert.equal(r.missing,'account_changed');assert.equal(r.oldAudience,'account_type_restricted');assert.deepEqual(r.restored,r.individual);assert.deepEqual(r.independent,r.corporate);assert.equal(r.other.revision,0);
 assert.deepEqual(r.admin.map(row=>row.audience),['corporate','individual']);assert.deepEqual(r.admin[0].profile,{company_name:'Same account company'});assert.deepEqual(r.admin[1].profile,r.individual.profile);assert.equal(r.admin.some(row=>Object.hasOwn(row,'user_id')),false);
});

test('failed shared profile writes roll back the profile and revision without touching saved records',()=>{
 const r=php(`
  migrateSharedProfiles();$first=saveSharedProfile('individual','individual',0,['city'=>'Original'],$schemas);$before=preserved();
  $db->exec("CREATE TEMP TRIGGER reject_shared BEFORE UPDATE ON client_shared_profiles BEGIN SELECT RAISE(ABORT,'forced write failure'); END");$failed=false;
  try{saveSharedProfile('individual','individual',1,['city'=>'Lost write'],$schemas);}catch(PDOException){$failed=true;}
  echo json_encode(compact('first','failed')+['after'=>clientSharedProfile('individual','individual'),'unchanged'=>$before===preserved()]);
 `);
 assert.equal(r.failed,true);assert.deepEqual(r.after,r.first);assert.equal(r.unchanged,true);
});
