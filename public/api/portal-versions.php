<?php
declare(strict_types=1);
// An immutable PDF/answer snapshot per version; only archive metadata can change.
function migrateVersions(): void {
    global $db;
    if((int)$db->query('PRAGMA user_version')->fetchColumn()>=1)return;
    $db->exec('BEGIN IMMEDIATE');
    try{
        if((int)$db->query('PRAGMA user_version')->fetchColumn()<1){
            foreach(['version INTEGER NOT NULL DEFAULT 1','archived_at TEXT','replaces_id TEXT','restored_from TEXT','edited_from TEXT','source TEXT NOT NULL DEFAULT "online"','signatures TEXT'] as $column)$db->exec('ALTER TABLE submissions ADD COLUMN '.$column);
            $previous=[];
            foreach(execute('SELECT id,user_id,doc_id,audience,created_at,profile FROM submissions ORDER BY created_at,rowid')->fetchAll() as $s){
                $chain=$s['user_id'].'/'.$s['doc_id'].'/'.$s['audience'];$old=$previous[$chain]??null;
                $version=($old['version']??0)+1;
                if($old)execute('UPDATE submissions SET archived_at=? WHERE id=?',[$s['created_at'],$old['id']]);
                $profile=json_decode($s['profile'],true);
                execute('UPDATE submissions SET version=?,replaces_id=?,source=? WHERE id=?',[$version,$old['id']??null,($profile['submission_source']??'online')==='upload'?'upload':'online',$s['id']]);
                $previous[$chain]=['id'=>$s['id'],'version'=>$version];
            }
            $db->exec('CREATE UNIQUE INDEX submission_version ON submissions(user_id,doc_id,audience,version); CREATE UNIQUE INDEX submission_current ON submissions(user_id,doc_id,audience) WHERE archived_at IS NULL; PRAGMA user_version=1;');
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function requestKey(array $b): string {
    $key=$b['requestKey']??'';if(!is_string($key)||!preg_match('/^[a-f0-9-]{32,36}$/D',$key))reject('invalid_request');return $key;
}
function expectedCurrent(array $b): ?string {
    if(!array_key_exists('expectedCurrent',$b)||($b['expectedCurrent']!==null&&(!is_string($b['expectedCurrent'])||!preg_match('/^[a-f0-9]{32}$/D',$b['expectedCurrent']))))reject('invalid_request');
    return $b['expectedCurrent'];
}
function cleanSignatureImages(array $def,mixed $images,array $answers): array {
    if(!is_array($images)||count($images)>20)reject('invalid_request');
    if(($def['workflow']??'')==='subscription'&&($answers['signature_mode']??'manual')==='manual')return [];
    $out=[];$total=0;
    foreach($def['signatureSlots']??$def['signatures']??[] as $slot){
        $value=$images[$slot['id']]??null;if($value===null)continue;
        if(!is_string($value)||strlen($value)>500000||!str_starts_with($value,'data:image/png;base64,'))reject('signature_invalid');
        $bytes=base64_decode(substr($value,22),true);$size=$bytes!==false?@getimagesizefromstring($bytes):false;
        if(!$size||$size[2]!==IMAGETYPE_PNG||$size[0]>2000||$size[1]>2000||$size[0]*$size[1]>2000000)reject('signature_invalid');
        $total+=strlen($value);if($total>2500000)reject('signature_invalid');$out[$slot['id']]=$value;
    }
    return $out;
}
function saveVersion(array $s,string $sourcePath,?string $expected,?string $audit=null,bool $clientSubmission=false): array {
    global $db,$dataDir;
    $path=null;$db->exec('BEGIN IMMEDIATE');
    try{
        // Recheck under the same lock as the write: management may have changed
        // this account while its PDF was being generated or uploaded.
        if($clientSubmission&&execute('SELECT account_type FROM users WHERE id=?',[$s['user_id']])->fetchColumn()!==$s['audience'])throw new DomainException('account_type_restricted');
        $old=execute('SELECT id,created_at,version,archived_at FROM submissions WHERE user_id=? AND request_key=?',[$s['user_id'],$s['request_key']])->fetch();
        if($old){$db->exec('COMMIT');return ['submission'=>$old,'duplicate'=>true];}
        $chain=[$s['user_id'],$s['doc_id'],$s['audience']];
        $current=execute('SELECT id,version FROM submissions WHERE user_id=? AND doc_id=? AND audience=? AND archived_at IS NULL',$chain)->fetch();
        if(($current['id']??null)!==$expected)throw new DomainException('version_conflict');
        $s['id']=bin2hex(random_bytes(16));$s['created_at']=gmdate('Y-m-d\TH:i:s\Z');$s['version']=($current['version']??0)+1;$s['replaces_id']=$current['id']??null;
        $s['restored_from']??=null;$s['edited_from']??=null;$s['archived_at']=null;
        $path=$dataDir.'/pdfs/'.$s['id'].'.pdf';if(!copy($sourcePath,$path))throw new RuntimeException('PDF copy failed');
        $s['size']=filesize($path);$s['sha256']=hash_file('sha256',$path);
        if($current)execute('UPDATE submissions SET archived_at=? WHERE id=?',[$s['created_at'],$current['id']]);
        $columns=['id','user_id','doc_id','title','ar','audience','created_at','size','sha256','answers','profile','request_key','version','archived_at','replaces_id','restored_from','edited_from','source','signatures'];
        execute('INSERT INTO submissions('.implode(',',$columns).') VALUES('.implode(',',array_fill(0,count($columns),'?')).')',array_map(fn($k)=>$s[$k],$columns));
        if($audit)execute('INSERT INTO audit(client_id,event,created_at) VALUES(?,?,?)',[$s['user_id'],$audit.':'.$s['restored_from'].':'.$s['id'],$s['created_at']]);
        $db->exec('COMMIT');return ['submission'=>array_intersect_key($s,array_flip(['id','created_at','version','archived_at']))];
    }catch(Throwable $e){$db->exec('ROLLBACK');if($path&&is_file($path))unlink($path);throw $e;}
}
