import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

test('review migration preserves snapshots; decisions and receipts remain tied to exact versions',()=>{
 const result=spawnSync('php',['-r',`
  require $argv[1];
  $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  function execute($sql,$args=[]){global $db;$q=$db->prepare($sql);$q->execute($args);return $q;}
  $db->exec('PRAGMA foreign_keys=ON; PRAGMA user_version=2; CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,ar TEXT,version INTEGER,archived_at TEXT,answers TEXT,sha256 TEXT); CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT)');
  execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?)',['old','client','Form','نموذج',1,null,'original answers','original hash']);
  $before=execute('SELECT * FROM submissions')->fetchAll();migrateReviews();migrateReviews();migrateWorkflow();
  $pending=reviewDetails('old',true);$unchanged=$before===execute('SELECT * FROM submissions')->fetchAll();
  $one=recordReview('old','rejected','missing_details','Complete your name',0,'key-1','first.admin');
  $duplicate=recordReview('old','rejected','missing_details','Complete your name',0,'key-1','first.admin');
  $stale=false;try{recordReview('old','approved','','',0,'key-2','second.admin');}catch(DomainException $e){$stale=$e->getMessage()==='review_conflict';}
  $two=recordReview('old','approved','','',$one['review']['review_revision'],'key-3','second.admin');
  $old=execute('SELECT * FROM submission_reviews WHERE id=1')->fetch();
  execute('UPDATE submission_reviews SET read_at=? WHERE id=1',['2026-09-19T12:00:00Z']);
  $read=execute('SELECT * FROM submission_reviews WHERE id=1')->fetch();unset($old['read_at'],$read['read_at']);
  $client=reviewDetails('old',false);$unchanged=$unchanged&&$before===execute('SELECT * FROM submissions')->fetchAll();
  execute('UPDATE submissions SET archived_at=? WHERE id=?',['2026-09-19T13:00:00Z','old']);
  execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?)',['new','client','Form','نموذج',2,null,'new answers','new hash']);
  $archived=false;try{recordReview('old','rejected','other','Reason',$two['review']['review_revision'],'key-4','second.admin');}catch(DomainException $e){$archived=$e->getMessage()==='review_archived';}
  $fresh=reviewDetails('new',true);$notifications=reviewNotifications('client');$private=reviewNotifications('someone-else');
  // More than a page of events: distinct IDs, stable cursor and accurate unread count.
  for($i=0;$i<24;$i++){$r=recordReview('new','rejected','other','Correction '.$i,$i?($r['review']['review_revision']):0,'page-'.$i,'first.admin');}
  $page1=reviewNotifications('client');$page2=reviewNotifications('client',$page1['next_cursor']);
  $count=execute('SELECT COUNT(*) FROM submission_reviews')->fetchColumn();$audit=execute('SELECT * FROM audit ORDER BY id')->fetchAll();
  echo json_encode(compact('pending','unchanged','one','two','duplicate','stale','old','read','client','archived','fresh','notifications','private','page1','page2','count','audit')+['schema'=>$db->query('PRAGMA user_version')->fetchColumn()]);
 `,path.resolve('public/api/portal-reviews.php')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const r=JSON.parse(result.stdout);
 assert.equal(r.schema,5);assert.equal(r.unchanged,true);assert.equal(r.pending.review_status,'pending');assert.equal(r.pending.review_revision,0);
 assert.equal(r.duplicate.duplicate,true);assert.equal(r.stale,true);assert.equal(r.archived,true);assert.deepEqual(r.old,r.read);
 assert.equal(r.two.review.review_history[0].admin_username,'second.admin');assert.equal(r.two.review.review_history[1].admin_username,'first.admin');
 assert.equal(r.client.reviewed_by,undefined);assert.equal(r.client.review_history[0].admin_username,undefined);
 assert.equal(r.fresh.review_status,'pending');assert.equal(r.fresh.review_history.length,0);assert.equal(r.notifications.unread,1);assert.equal(r.private.notifications.length,0);
 assert.equal(r.page1.notifications.length,20);assert.equal(r.page2.notifications.length,6);assert.equal(r.page2.next_cursor,null);
 assert.equal(new Set([...r.page1.notifications,...r.page2.notifications].map(n=>n.id)).size,26);assert.equal(r.page1.unread,25);
 assert.equal(r.count,26);assert.equal(r.audit.length,26);assert.equal(JSON.parse(r.audit[1].event).admin_username,'second.admin');
});

test('schema 3 review migration is atomic and preserves history, receipts, audit, snapshots, and AUTOINCREMENT',()=>{
 const result=spawnSync('php',['-r',`
  require $argv[1];
  $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  function execute($sql,$args=[]){global $db;$q=$db->prepare($sql);$q->execute($args);return $q;}
  $db->exec("PRAGMA foreign_keys=ON; PRAGMA user_version=3;
   CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,ar TEXT,version INTEGER,archived_at TEXT,answers TEXT,sha256 TEXT);
   CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT);
   CREATE TABLE submission_reviews(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('approved','rejected')),
    reason_code TEXT NOT NULL DEFAULT '',reason_text TEXT NOT NULL DEFAULT '',
    admin_username TEXT NOT NULL,created_at TEXT NOT NULL,
    request_key TEXT NOT NULL,read_at TEXT,
    CHECK((status='approved' AND reason_code='' AND reason_text='') OR
          (status='rejected' AND reason_code IN ('missing_details','incorrect_data','other') AND (reason_code!='other' OR length(trim(reason_text))>0))),
    UNIQUE(admin_username,request_key));
   CREATE INDEX reviews_submission ON submission_reviews(submission_id,id DESC);");
  foreach([
   ['archived','client','Form','نموذج',1,'2026-09-19T13:00:00Z','original archived answers','archived hash'],
   ['active','client','Form','نموذج',2,null,'current immutable answers','current hash'],
   ['replacement','client','Other form','نموذج آخر',2,null,'replacement immutable answers','replacement hash'],
   ['private','other-client','Private form','خاص',1,null,'private immutable answers','private hash']
  ] as $row)execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?)',$row);
  foreach([
   [2,'archived','approved','','','first.admin','2026-09-18T10:00:00Z','old-2','2026-09-18T11:00:00Z'],
   [7,'active','rejected','missing_details','Complete your name','first.admin','2026-09-19T10:00:00Z','old-7','2026-09-19T11:00:00Z'],
   [19,'active','rejected','incorrect_data','Correct the address','second.admin','2026-09-19T12:00:00Z','old-19',null],
   [27,'private','rejected','incorrect_data','Private note','private.admin','2026-09-19T12:30:00Z','old-27',null]
  ] as $row){
   execute('INSERT INTO submission_reviews VALUES(?,?,?,?,?,?,?,?,?)',$row);
   execute('INSERT INTO audit(id,client_id,event,created_at) VALUES(?,?,?,?)',[$row[0],$row[1]==='private'?'other-client':'client',json_encode(['event'=>'submission_review','review_id'=>$row[0],'status'=>$row[2],'admin_username'=>$row[5]]),$row[6]]);
  }
  // A deleted historical event must never have its ID reused by the rebuilt table.
  execute('INSERT INTO submission_reviews VALUES(?,?,?,?,?,?,?,?,?)',[90,'active','approved','','','second.admin','2026-09-19T12:45:00Z','deleted-90',null]);
  execute('DELETE FROM submission_reviews WHERE id=90');
  function snapshot(){global $db;return [
   'submissions'=>execute('SELECT * FROM submissions ORDER BY id')->fetchAll(),
   'reviews'=>execute('SELECT * FROM submission_reviews ORDER BY id')->fetchAll(),
   'audit'=>execute('SELECT * FROM audit ORDER BY id')->fetchAll(),
   'sequence'=>execute('SELECT seq FROM sqlite_sequence WHERE name=?',['submission_reviews'])->fetchColumn(),
   'history'=>reviewDetails('active',true),
   'notifications'=>reviewNotifications('client')
  ];}
  // Force a copy failure after the table rebuild starts and prove the transaction restores everything.
  $db->exec("PRAGMA ignore_check_constraints=ON; UPDATE submission_reviews SET reason_code='invalid_legacy_code' WHERE id=7; PRAGMA ignore_check_constraints=OFF;");
  $rollbackBefore=snapshot();$schemaBefore=execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')->fetchAll();
  $migrationFailed=false;try{migrateReviews();}catch(PDOException $e){$migrationFailed=str_contains($e->getMessage(),'CHECK constraint failed');}
  $rolledBack=$rollbackBefore===snapshot()&&$schemaBefore===execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')->fetchAll()&&(int)$db->query('PRAGMA user_version')->fetchColumn()===3;
  execute('UPDATE submission_reviews SET reason_code=? WHERE id=7',['missing_details']);
  $before=snapshot();migrateReviews();$after=snapshot();migrateReviews();$repeated=snapshot();
  $indexes=execute('PRAGMA index_list(submission_reviews)')->fetchAll();
  $foreignKeys=execute('PRAGMA foreign_key_check')->fetchAll();
  $fresh=reviewDetails('replacement',true);
  migrateWorkflow();
  $one=recordReview('active','signature_required','','',19,'signature-empty','review.admin');
  $duplicate=recordReview('active','signature_required','','',19,'signature-empty','review.admin');
  $stale=false;try{recordReview('active','approved','','',19,'stale','review.admin');}catch(DomainException $e){$stale=$e->getMessage()==='review_conflict';}
  $keyConflict=false;try{recordReview('active','signature_required','','Different reason',91,'signature-empty','review.admin');}catch(DomainException $e){$keyConflict=$e->getMessage()==='review_conflict';}
  $two=recordReview('active','signature_required','','Please sign page 2',91,'signature-note','review.admin');
  $unchanged=false;try{recordReview('active','signature_required','','Please sign page 2',92,'signature-again','review.admin');}catch(DomainException $e){$unchanged=$e->getMessage()==='review_unchanged';}
  $archived=false;try{recordReview('archived','signature_required','','Please sign',2,'archived','review.admin');}catch(DomainException $e){$archived=$e->getMessage()==='review_archived';}
  $constraints=[];$beforeInvalid=snapshot();
  foreach([
   ['approved','other',''],['approved','','Unexpected explanation'],
   ['rejected','',''],['rejected','other','   '],['rejected','unknown','Reason'],
   ['signature_required','other','Please sign'],['pending','','']
  ] as $i=>$decision){
   try{execute('INSERT INTO submission_reviews(submission_id,status,reason_code,reason_text,admin_username,created_at,request_key) VALUES(?,?,?,?,?,?,?)',array_merge(['active'],$decision,['constraint.admin','2026-09-19T14:00:00Z','invalid-'.$i]));$constraints[]=false;}
   catch(PDOException $e){$constraints[]=str_contains($e->getMessage(),'CHECK constraint failed');}
  }
  $invalidUnchanged=$beforeInvalid===snapshot();
  $rejected=recordReview('active','rejected','other','Correct the name',92,'rejected','review.admin');
  $approved=recordReview('active','approved','','',93,'approved','review.admin');
  $client=reviewDetails('active',false);$notifications=reviewNotifications('client');$private=reviewNotifications('unrelated-client');
  $audit=execute('SELECT * FROM audit WHERE id>27 ORDER BY id')->fetchAll();
  $snapshotsUnchanged=$before['submissions']===execute('SELECT * FROM submissions ORDER BY id')->fetchAll();
  echo json_encode(compact('migrationFailed','rolledBack','before','after','repeated','indexes','foreignKeys','fresh','one','duplicate','stale','keyConflict','two','unchanged','archived','constraints','invalidUnchanged','rejected','approved','client','notifications','private','audit','snapshotsUnchanged')+['schema'=>$db->query('PRAGMA user_version')->fetchColumn()]);
 `,path.resolve('public/api/portal-reviews.php')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const r=JSON.parse(result.stdout);
 assert.equal(r.migrationFailed,true);assert.equal(r.rolledBack,true);
 assert.equal(r.schema,5);assert.deepEqual(r.after,r.before);assert.deepEqual(r.repeated,r.before);
 assert.equal(r.before.sequence,90);assert.deepEqual(r.before.reviews.map(row=>row.id),[2,7,19,27]);
 assert.equal(r.indexes.some(index=>index.name==='reviews_submission'),true);assert.deepEqual(r.foreignKeys,[]);
 assert.equal(r.fresh.review_status,'pending');assert.equal(r.fresh.review_revision,0);assert.deepEqual(r.fresh.review_history,[]);
 assert.equal(r.one.review.review_status,'signature_required');assert.equal(r.one.review.review_revision,91);assert.equal(r.one.review.reason_code,'');assert.equal(r.one.review.reason_text,'');
 assert.equal(r.duplicate.duplicate,true);assert.equal(r.stale,true);assert.equal(r.keyConflict,true);assert.equal(r.unchanged,true);assert.equal(r.archived,true);
 assert.equal(r.two.review.review_revision,92);assert.equal(r.two.review.reason_text,'Please sign page 2');assert.equal(r.two.review.reason_code,'');
 assert.deepEqual(r.constraints,Array(7).fill(true));assert.equal(r.invalidUnchanged,true);
 assert.equal(r.rejected.review.review_revision,93);assert.equal(r.rejected.review.review_status,'rejected');
 assert.equal(r.approved.review.review_revision,94);assert.equal(r.approved.review.review_status,'approved');
 assert.equal(r.client.reviewed_by,undefined);assert.equal(r.client.review_history.every(event=>event.admin_username===undefined),true);
 assert.deepEqual(r.client.review_history.map(event=>event.id),[94,93,92,91,19,7]);
 assert.equal(r.notifications.notifications.length,7);assert.equal(r.notifications.unread,5);
 assert.equal(r.notifications.notifications.some(event=>event.submission_id==='private'),false);assert.equal(r.private.notifications.length,0);
 assert.equal(r.notifications.notifications.find(event=>event.id===92).status,'signature_required');
 assert.equal(r.notifications.notifications.find(event=>event.id===92).superseded,1);
 assert.equal(r.notifications.notifications.find(event=>event.id===7).read_at,'2026-09-19T11:00:00Z');
 assert.equal(r.audit.length,4);assert.deepEqual(r.audit.map(row=>JSON.parse(row.event).review_id),[91,92,93,94]);
 assert.equal(JSON.parse(r.audit[0].event).status,'signature_required');assert.equal(r.snapshotsUnchanged,true);
});

test('approved versions reject later decisions without changing audit or notifications; retries and new versions still work',()=>{
 const result=spawnSync('php',['-r',`
  require $argv[1];
  $db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  function execute($sql,$args=[]){global $db;$q=$db->prepare($sql);$q->execute($args);return $q;}
  $db->exec('PRAGMA foreign_keys=ON; PRAGMA user_version=2; CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,ar TEXT,version INTEGER,archived_at TEXT); CREATE TABLE audit(id INTEGER PRIMARY KEY,client_id TEXT,event TEXT,created_at TEXT)');
  execute('INSERT INTO submissions VALUES(?,?,?,?,?,?)',['approved','client','Form','نموذج',1,null]);migrateReviews();migrateWorkflow();
  $approved=recordReview('approved','approved','','',0,'approve-key','first.admin');
  $before=[execute('SELECT * FROM submission_reviews')->fetchAll(),execute('SELECT * FROM audit')->fetchAll(),reviewNotifications('client')];
  $blocked=[];
  foreach(['first.admin','second.admin'] as $actor)foreach(['rejected','signature_required'] as $status){
   try{recordReview('approved',$status,$status==='rejected'?'other':'','New decision',1,$actor.'-'.$status,$actor);$blocked[]=false;}
   catch(DomainException $e){$blocked[]=$e->getMessage()==='review_locked';}
  }
  $unchanged=$before===[execute('SELECT * FROM submission_reviews')->fetchAll(),execute('SELECT * FROM audit')->fetchAll(),reviewNotifications('client')];
  $retry=recordReview('approved','approved','','',0,'approve-key','first.admin');
  execute('UPDATE submissions SET archived_at=? WHERE id=?',['2026-09-19T20:00:00Z','approved']);
  execute('INSERT INTO submissions VALUES(?,?,?,?,?,?)',['new-version','client','Form','نموذج',2,null]);
  $fresh=recordReview('new-version','signature_required','','Sign page 1',0,'new-key','second.admin');
  echo json_encode(compact('blocked','unchanged','retry','fresh'));
 `,path.resolve('public/api/portal-reviews.php')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const r=JSON.parse(result.stdout);
 assert.deepEqual(r.blocked,[true,true,true,true]);assert.equal(r.unchanged,true);assert.equal(r.retry.duplicate,true);
 assert.equal(r.fresh.review.review_status,'signature_required');assert.equal(r.fresh.review.review_history.length,1);
});
