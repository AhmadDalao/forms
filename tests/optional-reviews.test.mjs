import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
function run(code){const dir=mkdtempSync(path.join(tmpdir(),'optional-review-'));try{const r=spawnSync('php',['-r',`
 require $argv[1];$dataDir=$argv[2];$db=initializePortalDatabase($dataDir);
 function failure($f){try{$f();return null;}catch(DomainException $e){return $e->getMessage();}}
 function snapshot(){return [execute('SELECT * FROM users')->fetchAll(),execute('SELECT * FROM submissions')->fetchAll(),execute('SELECT * FROM submission_reviews')->fetchAll(),execute('SELECT * FROM audit')->fetchAll(),execute('SELECT * FROM workflow_setting_events')->fetchAll()];}
 execute('INSERT INTO users(id,name,phone,password,created_at,account_type) VALUES(?,?,?,?,?,?)',['client','Test','+966500000001','hash','2026-09-29','individual']);
 $pdf=$dataDir.'/fixture.pdf';file_put_contents($pdf,'%PDF-1.4 immutable fixture %%EOF');
 function save($doc,$expected=null,$extra=[]){global $pdf;$s=['user_id'=>'client','doc_id'=>$doc,'title'=>'Test','ar'=>'اختبار','audience'=>'individual','answers'=>'{"name":"Original"}','profile'=>'{"submission_mode":"direct","review_required":false}','request_key'=>bin2hex(random_bytes(16)),'source'=>'online','signatures'=>'{}'];return saveVersion(array_merge($s,$extra),$pdf,$expected,null,true)['submission'];}
 ${code}`,path.resolve('public/api/portal-database.php'),dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}finally{rmSync(dir,{recursive:true,force:true});}}
test('schema 8 preserves legacy rows, high-water IDs, indexes, receipts and workflow; rollback is atomic',()=>{
 const r=run(`
 $direct=save('direct');$db->exec('DROP TABLE submission_reviews; PRAGMA user_version=2');migrateReviews();$db->exec('PRAGMA user_version=7');
 execute('INSERT INTO submission_reviews VALUES(?,?,?,?,?,?,?,?,?)',[15,$direct['id'],'rejected','missing_details','','old.admin','2026-09-20','old-decision','2026-09-21']);
 execute('INSERT INTO submission_reviews VALUES(?,?,?,?,?,?,?,?,?)',[99,$direct['id'],'approved','','','old.admin','2026-09-21','deleted',null]);execute('DELETE FROM submission_reviews WHERE id=99');
 $db->exec('CREATE INDEX review_receipts ON submission_reviews(read_at)');$before=snapshot();$hashes=execute('SELECT sha256 FROM submissions')->fetchAll();
 $db->exec("PRAGMA ignore_check_constraints=ON; UPDATE submission_reviews SET reason_code='bad' WHERE id=15; PRAGMA ignore_check_constraints=OFF");$bad=snapshot();$schema=execute('SELECT * FROM sqlite_master ORDER BY name')->fetchAll();$failed=false;
 try{migrateOptionalReviews();}catch(PDOException){$failed=true;}
 $rollback=$bad===snapshot()&&$schema===execute('SELECT * FROM sqlite_master ORDER BY name')->fetchAll()&&(int)$db->query('PRAGMA user_version')->fetchColumn()===7;
 execute("UPDATE submission_reviews SET reason_code='missing_details' WHERE id=15");migrateOptionalReviews();migrateOptionalReviews();
 echo json_encode(['failed'=>$failed,'rollback'=>$rollback,'preserved'=>$before===snapshot(),'version'=>(int)$db->query('PRAGMA user_version')->fetchColumn(),'sequence'=>execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn(),'indexes'=>array_column(execute('PRAGMA index_list(submission_reviews)')->fetchAll(),'name'),'fk'=>execute('PRAGMA foreign_key_check')->fetchAll(),'integrity'=>execute('PRAGMA integrity_check')->fetchColumn(),'workflow'=>workflowSettings(),'hashes'=>$hashes===execute('SELECT sha256 FROM submissions')->fetchAll()]);
 `);assert.equal(r.failed,true);assert.equal(r.rollback,true);assert.equal(r.preserved,true);assert.equal(r.version,8);assert.equal(r.sequence,99);assert.ok(r.indexes.includes('reviews_submission'));assert.ok(r.indexes.includes('review_receipts'));assert.deepEqual(r.fk,[]);assert.equal(r.integrity,'ok');assert.equal(r.workflow.review_enabled,false);assert.equal(r.hashes,true);
});
test('server enrollment ignores client metadata and follows open cases across switches, with immutable replacements',()=>{
 const r=run(`
 $direct=save('a',null,['profile'=>'{"submission_mode":"review","review_required":true}']);updateWorkflow(true,1,'on','owner');
 $notEnrolled=failure(fn()=>recordReview($direct['id'],'approved','','',0,'old','admin'));
 $first=save('b');$correction=recordReview($first['id'],'correction_required','','Correct the name',0,'correct','admin');updateWorkflow(false,2,'off','owner');
 $second=save('b',$first['id']);$request=recordReview($second['id'],'signature_required','','',0,'sign','admin');
 $before=snapshot();$unsigned=failure(fn()=>save('b',$second['id']));$unchanged=$before===snapshot();
 $third=save('b',$second['id'],['signature_complete'=>true]);$approval=recordReview($third['id'],'approved','','Thank you',0,'approve','admin');
 $locked=failure(fn()=>recordReview($third['id'],'correction_required','','Change', $approval['review']['review_revision'],'locked','admin'));
 $retry=save('b',$second['id'],['request_key'=>execute('SELECT request_key FROM submissions WHERE id=?',[$third['id']])->fetchColumn()]);
 $fourth=save('b',$third['id']);$archived=failure(fn()=>recordReview($second['id'],'approved','','',$request['review']['review_revision'],'stale','admin'));
 $badNote=failure(fn()=>recordReview($fourth['id'],'rejected','other',' ',0,'no-note','admin'));
 echo json_encode(compact('direct','notEnrolled','first','second','unsigned','unchanged','third','approval','locked','retry','fourth','archived','badNote')+['original'=>execute('SELECT * FROM submissions WHERE id=?',[$first['id']])->fetch(),'history'=>reviewDetails($first['id'],true)]);
 `);assert.equal(r.direct.submission_mode,'direct');assert.equal(r.notEnrolled,'workflow_not_required');for(const v of [r.first,r.second,r.third])assert.equal(v.presentation_status,'pending');assert.equal(r.unsigned,'signature_required');assert.equal(r.unchanged,true);assert.equal(r.approval.review.reason_text,'Thank you');assert.equal(r.locked,'review_locked');assert.equal(r.retry.presentation_status,'approved');assert.equal(r.retry.id,r.third.id);assert.equal(r.fourth.submission_mode,'direct');assert.equal(r.archived,'review_archived');assert.equal(r.badNote,'review_reason_required');assert.equal(JSON.parse(r.original.answers).name,'Original');assert.equal(r.history.review_status,'correction_required');
});
