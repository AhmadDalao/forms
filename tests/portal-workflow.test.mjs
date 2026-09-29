import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';

const libraries=['portal-versions.php','portal-reviews.php','portal-account-types.php'].map(file=>path.resolve('public/api',file));
const prelude=`
 require_once $argv[1];require_once $argv[2];require_once $argv[3];
 $db=new PDO($argv[4],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
 function execute($sql,$args=[]){global $db;$q=$db->prepare($sql);$q->execute($args);return $q;}
 function failure($callback){try{$callback();return null;}catch(DomainException $e){return $e->getMessage();}}
 function preserved(){return [execute('SELECT * FROM users ORDER BY id')->fetchAll(),execute('SELECT * FROM submissions ORDER BY id')->fetchAll(),execute('SELECT * FROM submission_reviews ORDER BY id')->fetchAll(),execute('SELECT * FROM audit ORDER BY id')->fetchAll()];}
`;
const schema=`
 $db->exec('CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT);
  CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doc_id TEXT,title TEXT,ar TEXT,audience TEXT,created_at TEXT,size INTEGER,sha256 TEXT,answers TEXT,profile TEXT,request_key TEXT,UNIQUE(user_id,request_key))');
 execute('INSERT INTO users VALUES(?,?)',['client','Client']);
 migrateVersions();migrateAccountTypes();migrateReviews();
 function seed($id,$profile='{}',$doc=null,$archived=null){
  execute('INSERT INTO submissions(id,user_id,doc_id,title,ar,audience,created_at,size,sha256,answers,profile,request_key,archived_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$id,'client',$doc??$id,'Form','نموذج','individual','2026-09-19T12:00:00Z',100,'original-hash','{"name":"original"}',$profile,'request-'.$id,$archived]);
 }
`;
function php(code,{dsn='sqlite::memory:',args=[]}={}){
 const result=spawnSync('php',['-r',prelude+code,...libraries,dsn,...args],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr||result.error?.message);return JSON.parse(result.stdout);
}
function waitForLine(child,line,stdout,stderr){
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);child.stdout.off('data',check);child.off('error',failed);child.off('close',closed);};
  const failed=error=>{cleanup();reject(error);};
  const closed=(code,signal)=>failed(Error(`PHP exited before ${line} (code ${code}, signal ${signal}): ${stderr()}${stdout()}`));
  const check=()=>{if(stdout().split(/\r?\n/).includes(line)){cleanup();resolve();}};
  const timer=setTimeout(()=>failed(Error(`Timed out waiting for ${line}: ${stderr()}${stdout()}`)),5000);
  child.stdout.on('data',check);child.once('error',failed);child.once('close',closed);
  if(child.exitCode!==null||child.signalCode!==null)closed(child.exitCode,child.signalCode);else check();
 });
}

test('workflow migration is repeatable, preserves exact legacy data and rolls back a partial migration',()=>{
 const r=php(schema+`
  seed('legacy');seed('archived','{"old":"profile"}',null,'2026-09-19T13:00:00Z');
  execute('INSERT INTO submission_reviews(id,submission_id,status,reason_code,reason_text,admin_username,created_at,request_key,read_at) VALUES(?,?,?,?,?,?,?,?,?)',[37,'legacy','rejected','other','Original note','first.admin','2026-09-19T12:30:00Z','old-review','2026-09-19T12:40:00Z']);
  execute('INSERT INTO audit VALUES(?,?,?,?)',[52,'client','original-audit','2026-09-19T12:30:00Z']);
  $before=preserved();$sequence=execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn();
  $db->exec('CREATE TABLE workflow_setting_events(sentinel TEXT)');
  $schemaBefore=execute('SELECT * FROM sqlite_schema ORDER BY name')->fetchAll();$failed=false;
  try{migrateWorkflow();}catch(PDOException){$failed=true;}
  $rollback=$schemaBefore===execute('SELECT * FROM sqlite_schema ORDER BY name')->fetchAll()&&$before===preserved()&&(int)$db->query('PRAGMA user_version')->fetchColumn()===4;
  $db->exec('DROP TABLE workflow_setting_events');migrateWorkflow();$first=workflowDetails();
  migrateVersions();migrateAccountTypes();migrateReviews();migrateWorkflow();$second=workflowDetails();
  echo json_encode(compact('failed','rollback','first','second')+['preserved'=>$before===preserved(),'sequence'=>$sequence===execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn(),'schema'=>(int)$db->query('PRAGMA user_version')->fetchColumn(),'public'=>workflowSettings(),'foreignKeys'=>execute('PRAGMA foreign_key_check')->fetchAll()]);
 `);
 assert.equal(r.failed,true);assert.equal(r.rollback,true);assert.equal(r.preserved,true);assert.equal(r.sequence,true);assert.equal(r.schema,5);
 assert.deepEqual(r.public,{review_enabled:true,revision:0});assert.deepEqual(r.first,r.second);assert.deepEqual(r.first.history,[]);
 assert.deepEqual(r.first.workflow,{review_enabled:true,revision:0,updated_at:null,updated_by:null});assert.deepEqual(r.foreignKeys,[]);
});

test('direct intake migration preserves clients, answers, archived PDFs and decision history, is atomic and repeatable',()=>{
 const r=php(schema+`
  migrateWorkflow();seed('legacy');seed('archived','{"review_required":false}',null,'2026-09-19T13:00:00Z');
  execute("INSERT INTO submission_reviews(submission_id,status,reason_code,reason_text,admin_username,created_at,request_key) VALUES('legacy','rejected','other','Original decision','original.admin','2026-09-19','old-decision')");
  $db->exec('PRAGMA user_version=6');$before=preserved();$workflowBefore=workflowDetails();
  $db->exec("CREATE TRIGGER refuse_direct_update BEFORE UPDATE ON workflow_settings BEGIN SELECT RAISE(ABORT,'forced failure'); END");
  $failed=false;try{migrateDirectIntake();}catch(PDOException){$failed=true;}
  $rollback=$before===preserved()&&$workflowBefore===workflowDetails()&&(int)$db->query('PRAGMA user_version')->fetchColumn()===6;
  $db->exec('DROP TRIGGER refuse_direct_update');migrateDirectIntake();$first=workflowDetails();migrateDirectIntake();$second=workflowDetails();
  echo json_encode(compact('failed','rollback','first','second')+['preserved'=>$before===preserved(),'schema'=>(int)$db->query('PRAGMA user_version')->fetchColumn(),'direct'=>submissionPresentation(['profile'=>['submission_mode'=>'direct','review_required'=>false]]),'legacy'=>submissionPresentation(['profile'=>[]]),'saved'=>submissionPresentation(['profile'=>['review_required'=>false]])]);
 `);
 assert.equal(r.failed,true);assert.equal(r.rollback,true);assert.equal(r.preserved,true);assert.equal(r.schema,7);assert.deepEqual(r.first,r.second);
 assert.equal(r.first.workflow.review_enabled,false);assert.equal(r.first.workflow.updated_by,'system:direct-intake');assert.equal(r.first.history.length,1);
 assert.deepEqual(r.direct,{submission_mode:'direct',presentation_status:'received'});assert.equal(r.legacy.presentation_status,'received');assert.equal(r.saved.presentation_status,'saved');
});

test('workflow changes record actors, reject coercion/stale/no-op requests, and retry without duplicate events',()=>{
 const r=php(schema+`
  migrateWorkflow();seed('legacy');$before=preserved();
  $invalid=[];foreach([0,1,'false','true',null,[]] as $value)$invalid[]=failure(fn()=>updateWorkflow($value,0,'invalid','owner'));
  $noop=failure(fn()=>updateWorkflow(true,0,'noop','owner'));
  $off=updateWorkflow(false,0,'off-key','owner');
  $stale=failure(fn()=>updateWorkflow(true,0,'stale','second.owner'));
  $reuse=failure(fn()=>updateWorkflow(true,0,'off-key','owner'));
  $retryOff=updateWorkflow(false,0,'off-key','owner');
  $on=updateWorkflow(true,1,'on-key','second.owner');
  $retryAfterLaterChange=updateWorkflow(false,0,'off-key','owner');
  $changedExpected=failure(fn()=>updateWorkflow(false,2,'off-key','owner'));
  $noopNow=failure(fn()=>updateWorkflow(true,2,'noop-now','owner'));
  echo json_encode(compact('invalid','noop','off','stale','reuse','retryOff','on','retryAfterLaterChange','changedExpected','noopNow')+['public'=>workflowSettings(),'preserved'=>$before===preserved()]);
 `);
 assert.deepEqual(r.invalid,Array(6).fill('invalid_request'));assert.equal(r.noop,'workflow_unchanged');assert.equal(r.noopNow,'workflow_unchanged');
 assert.equal(r.stale,'workflow_conflict');assert.equal(r.reuse,'workflow_conflict');assert.equal(r.changedExpected,'workflow_conflict');
 assert.equal(r.off.workflow.review_enabled,false);assert.equal(r.off.workflow.revision,1);assert.equal(r.off.workflow.updated_by,'owner');
 assert.match(r.off.workflow.updated_at,/^\d{4}-\d{2}-\d{2}T.*Z$/);assert.equal(r.retryOff.duplicate,true);
 assert.deepEqual(r.on.history.map(e=>[e.revision,e.review_enabled,e.admin_username]),[[2,true,'second.owner'],[1,false,'owner']]);
 assert.equal(r.on.history.every(e=>!('request_key' in e)&&!('expected_revision' in e)),true);
 assert.equal(r.retryAfterLaterChange.duplicate,true);assert.deepEqual(r.retryAfterLaterChange.workflow,r.on.workflow);
 assert.deepEqual(r.public,{review_enabled:true,revision:2});assert.equal(r.preserved,true);
});

test('a failed workflow update rolls back both the event and current setting',()=>{
 const r=php(schema+`
  migrateWorkflow();$before=workflowDetails();
  $db->exec("CREATE TRIGGER refuse_workflow_update BEFORE UPDATE ON workflow_settings BEGIN SELECT RAISE(ABORT,'forced failure'); END");
  $failed=false;try{updateWorkflow(false,0,'failed','owner');}catch(PDOException){$failed=true;}
  $unchanged=$before===workflowDetails();$db->exec('DROP TRIGGER refuse_workflow_update');
  $success=updateWorkflow(false,0,'failed','owner');echo json_encode(compact('failed','unchanged','success'));
 `);
 assert.equal(r.failed,true);assert.equal(r.unchanged,true);assert.equal(r.success.workflow.revision,1);assert.equal(r.success.history.length,1);assert.equal(r.success.duplicate,undefined);
});

test('enrolled reviews remain actionable when disabled, while legacy and direct versions stay read-only',()=>{
 const r=php(schema+`
  migrateWorkflow();seed('enrolled','{"submission_mode":"review","review_required":true}');seed('legacy');seed('tool','{"submission_mode":"direct","review_required":false}');
  $one=recordReview('enrolled','signature_required','','Sign page 1',0,'request','admin');
  execute('UPDATE submission_reviews SET read_at=?',['2026-09-19T13:00:00Z']);$before=preserved();updateWorkflow(false,0,'off','owner');
  $retry=recordReview('enrolled','signature_required','','Sign page 1',0,'request','admin');$retryPreserved=$before===preserved();
  $legacy=failure(fn()=>recordReview('legacy','approved','','',0,'legacy','admin'));
  $tool=failure(fn()=>recordReview('tool','approved','','',0,'tool','admin'));
  $approved=recordReview('enrolled','approved','','',1,'approve','second.admin');
  $locked=failure(fn()=>recordReview('enrolled','signature_required','','Again',2,'locked','admin'));
  echo json_encode(compact('retry','retryPreserved','legacy','tool','approved','locked')+['notifications'=>reviewNotifications('client'),'private'=>reviewNotifications('other')]);
 `);
 assert.equal(r.retry.duplicate,true);assert.equal(r.retryPreserved,true);assert.equal(r.legacy,'workflow_not_required');assert.equal(r.tool,'workflow_not_required');
 assert.equal(r.approved.review.review_status,'approved');assert.equal(r.locked,'review_locked');assert.equal(r.notifications.unread,1);assert.equal(r.private.notifications.length,0);
});

test('version saves reject stale workflow revisions before writing or archiving and preserve eligibility on restore',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'workflow-versions-'));
 try{
  const r=php(schema+`
   migrateWorkflow();$dataDir=$argv[5];mkdir($dataDir.'/pdfs');$source=$dataDir.'/source.pdf';file_put_contents($source,'%PDF-1.4 synthetic immutable fixture %%EOF');
   $snapshot=['user_id'=>'client','doc_id'=>'signature-form','title'=>'Form','ar'=>'نموذج','audience'=>'individual','answers'=>'{"name":"original"}','profile'=>'{"review_required":true,"preserved":"source"}','request_key'=>'first','source'=>'online','signatures'=>'{}','workflow_revision'=>0];
   $first=saveVersion($snapshot,$source,null,null,true);$id=$first['submission']['id'];
   $before=preserved();$files=glob($dataDir.'/pdfs/*');updateWorkflow(false,0,'off','owner');
   $snapshot['request_key']='stale';$stale=failure(fn()=>saveVersion($snapshot,$source,$id,null,true));
   $noChanges=$before===preserved()&&$files===glob($dataDir.'/pdfs/*');
   $snapshot['request_key']='first';$retry=saveVersion($snapshot,$source,null,null,true);
   $snapshot['request_key']='tool';$snapshot['profile']='{"review_required":false,"preserved":"tool"}';$snapshot['workflow_revision']=1;
   $tool=saveVersion($snapshot,$source,$id,null,true);$toolId=$tool['submission']['id'];
   $original=execute('SELECT * FROM submissions WHERE id=?',[$id])->fetch();$original['request_key']='restore';$original['restored_from']=$id;
   $restored=saveVersion($original,$source,$toolId,'owner_restore');
   $stored=execute('SELECT * FROM submissions WHERE id=?',[$restored['submission']['id']])->fetch();
   $toolStored=execute('SELECT * FROM submissions WHERE id=?',[$toolId])->fetch();
   updateWorkflow(true,1,'on','owner');$toolRequired=workflowReviewRequired($toolStored);
   $restoredReview=recordReview($stored['id'],'signature_required','','Sign this restored version',0,'restored-review','admin');
   echo json_encode(compact('first','stale','noChanges','retry','tool','restored','stored','toolStored','toolRequired','restoredReview')+['schemaColumns'=>array_column(execute('PRAGMA table_info(submissions)')->fetchAll(),'name'),'original'=>execute('SELECT * FROM submissions WHERE id=?',[$id])->fetch()]);
  `,{args:[dir]});
  assert.equal(r.stale,'workflow_conflict');assert.equal(r.noChanges,true);assert.equal(r.retry.duplicate,true);assert.equal(r.retry.submission.review_required,true);
  assert.equal(r.first.submission.review_required,true);assert.equal(r.tool.submission.review_required,true);assert.equal(r.restored.submission.review_required,true);
  assert.equal(r.toolRequired,true);assert.equal(r.stored.profile,r.original.profile);assert.equal(r.stored.answers,r.original.answers);assert.equal(r.stored.sha256,r.original.sha256);
  assert.equal(r.stored.restored_from,r.original.id);assert.notEqual(r.original.archived_at,null);assert.notEqual(r.toolStored.archived_at,null);assert.equal(r.stored.archived_at,null);
  assert.equal(r.schemaColumns.includes('workflow_revision'),false);assert.equal(r.restoredReview.review.review_status,'signature_required');
  assert.equal(readdirSync(path.join(dir,'pdfs')).length,3);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('review writes serialize behind a concurrent toggle without enrolling legacy versions',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'workflow-lock-')),dsn='sqlite:'+path.join(dir,'clients.sqlite');let toggle,review;
 try{
  php(schema+`seed('legacy');migrateWorkflow();echo json_encode(workflowSettings());`,{dsn});
  // Pause the real update helper while it holds BEGIN IMMEDIATE, immediately before updating the singleton.
  toggle=spawn('php',['-r',prelude+`
   $db->sqliteCreateFunction('hold_for_review',function(){fwrite(STDOUT,"locked\\n");fflush(STDOUT);fread(STDIN,1);return 1;});
   $db->exec('CREATE TEMP TRIGGER hold_update BEFORE UPDATE ON workflow_settings BEGIN SELECT hold_for_review(); END');
   echo json_encode(updateWorkflow(false,0,'off','owner'));
  `,...libraries,dsn],{stdio:['pipe','pipe','pipe']});
  let toggleOut='',toggleError='';toggle.stdout.on('data',s=>toggleOut+=s);toggle.stderr.on('data',s=>toggleError+=s);
  // PHP diagnostics and pipe chunk boundaries can arrive before the lock marker.
  await waitForLine(toggle,'locked',()=>toggleOut,()=>toggleError);
  review=spawn('php',['-r',prelude+`fwrite(STDOUT,"ready\\n");fflush(STDOUT);echo json_encode(['error'=>failure(fn()=>recordReview('legacy','approved','','',0,'review','admin'))]);`,...libraries,dsn],{stdio:['ignore','pipe','pipe']});
  let reviewOut='',reviewError='';review.stdout.on('data',s=>reviewOut+=s);review.stderr.on('data',s=>reviewError+=s);
  const toggleExit=once(toggle,'close'),reviewExit=once(review,'close');
  await waitForLine(review,'ready',()=>reviewOut,()=>reviewError);toggle.stdin.end('x');
  const [[a],[b]]=await Promise.all([toggleExit,reviewExit]);assert.equal(a,0,toggleError);assert.equal(b,0,reviewError);
  assert.deepEqual(JSON.parse(reviewOut.slice(reviewOut.indexOf('ready\n')+'ready\n'.length)),{error:'workflow_not_required'});
  const final=php(`echo json_encode(['workflow'=>workflowSettings(),'reviews'=>execute('SELECT * FROM submission_reviews')->fetchAll(),'audit'=>execute('SELECT * FROM audit')->fetchAll()]);`,{dsn});
  assert.deepEqual(final.workflow,{review_enabled:false,revision:1});assert.deepEqual(final.reviews,[]);assert.deepEqual(final.audit,[]);
 }finally{toggle?.kill();review?.kill();rmSync(dir,{recursive:true,force:true});}
});
