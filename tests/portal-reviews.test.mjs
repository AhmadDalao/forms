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
  $before=execute('SELECT * FROM submissions')->fetchAll();migrateReviews();migrateReviews();
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
 assert.equal(r.schema,3);assert.equal(r.unchanged,true);assert.equal(r.pending.review_status,'pending');assert.equal(r.pending.review_revision,0);
 assert.equal(r.duplicate.duplicate,true);assert.equal(r.stale,true);assert.equal(r.archived,true);assert.deepEqual(r.old,r.read);
 assert.equal(r.two.review.review_history[0].admin_username,'second.admin');assert.equal(r.two.review.review_history[1].admin_username,'first.admin');
 assert.equal(r.client.reviewed_by,undefined);assert.equal(r.client.review_history[0].admin_username,undefined);
 assert.equal(r.fresh.review_status,'pending');assert.equal(r.fresh.review_history.length,0);assert.equal(r.notifications.unread,1);assert.equal(r.private.notifications.length,0);
 assert.equal(r.page1.notifications.length,20);assert.equal(r.page2.notifications.length,6);assert.equal(r.page2.next_cursor,null);
 assert.equal(new Set([...r.page1.notifications,...r.page2.notifications].map(n=>n.id)).size,26);assert.equal(r.page1.unread,25);
 assert.equal(r.count,26);assert.equal(r.audit.length,26);assert.equal(JSON.parse(r.audit[1].event).admin_username,'second.admin');
});
