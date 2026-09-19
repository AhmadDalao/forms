<?php
declare(strict_types=1);

// Decisions are append-only and belong to one immutable submission version.
// read_at is only a notification receipt; it never changes the decision.
function migrateReviews(): void {
    global $db;
    if((int)$db->query('PRAGMA user_version')->fetchColumn()>=4)return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $version=(int)$db->query('PRAGMA user_version')->fetchColumn();
        if($version<4){
            // SQLite cannot alter CHECK constraints. Copy the append-only log
            // inside this transaction, retaining receipts, IDs and its sequence.
            $sequence=0;
            if($version>=3){
                $sequence=(int)execute("SELECT seq FROM sqlite_sequence WHERE name='submission_reviews'")->fetchColumn();
                $db->exec('ALTER TABLE submission_reviews RENAME TO submission_reviews_previous; DROP INDEX reviews_submission;');
            }
            $db->exec("CREATE TABLE submission_reviews(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                status TEXT NOT NULL CHECK(status IN ('approved','rejected','signature_required')),
                reason_code TEXT NOT NULL DEFAULT '',reason_text TEXT NOT NULL DEFAULT '',
                admin_username TEXT NOT NULL,created_at TEXT NOT NULL,
                request_key TEXT NOT NULL,read_at TEXT,
                CHECK((status='approved' AND reason_code='' AND reason_text='') OR
                      (status='signature_required' AND reason_code='') OR
                      (status='rejected' AND reason_code IN ('missing_details','incorrect_data','other') AND (reason_code!='other' OR length(trim(reason_text))>0))),
                UNIQUE(admin_username,request_key));
                CREATE INDEX reviews_submission ON submission_reviews(submission_id,id DESC);");
            if($version>=3){
                $db->exec('INSERT INTO submission_reviews(id,submission_id,status,reason_code,reason_text,admin_username,created_at,request_key,read_at) SELECT id,submission_id,status,reason_code,reason_text,admin_username,created_at,request_key,read_at FROM submission_reviews_previous; DROP TABLE submission_reviews_previous;');
                $sequence=max($sequence,(int)execute('SELECT COALESCE(MAX(id),0) FROM submission_reviews')->fetchColumn());
                execute("DELETE FROM sqlite_sequence WHERE name='submission_reviews'");
                execute('INSERT INTO sqlite_sequence(name,seq) VALUES(?,CAST(? AS INTEGER))',['submission_reviews',$sequence]);
            }
            $db->exec('PRAGMA user_version=4;');
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function reviewJoin(): string {
    return ' LEFT JOIN submission_reviews r ON r.id=(SELECT id FROM submission_reviews WHERE submission_id=s.id ORDER BY id DESC LIMIT 1) ';
}
function reviewColumns(bool $admin=false): string {
    return ",COALESCE(r.status,'pending') AS review_status,COALESCE(r.id,0) AS review_revision,r.reason_code,r.reason_text,r.created_at AS reviewed_at".($admin?',r.admin_username AS reviewed_by':'');
}
function reviewDetails(string $id,bool $admin): array {
    $summary=execute('SELECT s.id'.reviewColumns($admin).' FROM submissions s'.reviewJoin().' WHERE s.id=?',[$id])->fetch();unset($summary['id']);
    $summary['review_history']=execute('SELECT id,status,reason_code,reason_text,created_at'.($admin?',admin_username':'').' FROM submission_reviews WHERE submission_id=? ORDER BY id DESC',[$id])->fetchAll();
    return $summary;
}
function recordReview(string $id,string $status,string $code,string $text,int $expected,string $key,string $actor): array {
    global $db;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $old=execute('SELECT * FROM submission_reviews WHERE admin_username=? AND request_key=?',[$actor,$key])->fetch();
        if($old){
            if($old['submission_id']!==$id||$old['status']!==$status||$old['reason_code']!==$code||$old['reason_text']!==$text)throw new DomainException('review_conflict');
            $result=['review'=>reviewDetails($id,true),'duplicate'=>true];$db->exec('COMMIT');return $result;
        }
        $s=execute('SELECT user_id,archived_at FROM submissions WHERE id=?',[$id])->fetch();
        if(!$s)throw new DomainException('not_found');
        if($s['archived_at']!==null)throw new DomainException('review_archived');
        $last=execute('SELECT * FROM submission_reviews WHERE submission_id=? ORDER BY id DESC LIMIT 1',[$id])->fetch();
        if((int)($last['id']??0)!==$expected)throw new DomainException('review_conflict');
        if($last&&$last['status']===$status&&$last['reason_code']===$code&&$last['reason_text']===$text)throw new DomainException('review_unchanged');
        if($last&&$last['status']==='approved')throw new DomainException('review_locked');
        $now=gmdate('Y-m-d\TH:i:s\Z');
        execute('INSERT INTO submission_reviews(submission_id,status,reason_code,reason_text,admin_username,created_at,request_key) VALUES(?,?,?,?,?,?,?)',[$id,$status,$code,$text,$actor,$now,$key]);
        $event=(int)$db->lastInsertId();
        execute('INSERT INTO audit(client_id,event,created_at) VALUES(?,?,?)',[$s['user_id'],json_encode(['event'=>'submission_review','submission_id'=>$id,'review_id'=>$event,'status'=>$status,'admin_username'=>$actor],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now]);
        $result=['review'=>reviewDetails($id,true)];$db->exec('COMMIT');return $result;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function reviewNotifications(string $user,int $before=0): array {
    $rows=execute('SELECT r.id,r.submission_id,r.status,r.reason_code,r.reason_text,r.created_at,r.read_at,s.title,s.ar,s.version,s.archived_at,EXISTS(SELECT 1 FROM submission_reviews newer WHERE newer.submission_id=r.submission_id AND newer.id>r.id) AS superseded FROM submission_reviews r JOIN submissions s ON s.id=r.submission_id WHERE s.user_id=?'.($before?' AND r.id<?':'').' ORDER BY r.id DESC LIMIT 21',$before?[$user,$before]:[$user])->fetchAll();
    $hasMore=count($rows)>20;if($hasMore)array_pop($rows);
    return ['notifications'=>$rows,'next_cursor'=>$hasMore?end($rows)['id']:null,'unread'=>(int)execute('SELECT COUNT(*) FROM submission_reviews r JOIN submissions s ON s.id=r.submission_id WHERE s.user_id=? AND r.read_at IS NULL',[$user])->fetchColumn()];
}
