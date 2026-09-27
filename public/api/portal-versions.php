<?php
declare(strict_types=1);
require_once __DIR__.'/portal-workflow.php';
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
function requireCurrentPdfTemplate(array $definition,array $metadata,string $source): void {
    if($source==='online'&&isset($definition['legacyPdfLayout'])&&($metadata['pdfVersion']??null)!==($definition['pdfVersion']??null))reject('template_changed',409);
}
function expectedCurrent(array $b): ?string {
    if(!array_key_exists('expectedCurrent',$b)||($b['expectedCurrent']!==null&&(!is_string($b['expectedCurrent'])||!preg_match('/^[a-f0-9]{32}$/D',$b['expectedCurrent']))))reject('invalid_request');
    return $b['expectedCurrent'];
}
function cleanSignatureImages(array $def,mixed $images,array $answers): array {
    if(!is_array($images)||count($images)>20)reject('invalid_request');
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
function requiredSubmissionSignatureSlots(array $def,array $answers): array {
    return array_values(array_filter($def['signatureSlots']??$def['signatures']??[],function($slot)use($answers){
        if(($slot['requiredForSubmission']??true)!==false)return true;
        foreach($slot['requireWhenFields']??[] as $field){
            $value=$answers[$field]??'';
            if(is_array($value)?count($value)>0:trim((string)$value)!=='')return true;
        }
        return false;
    }));
}
function signatureSubmissionPolicy(array $def): array {
    return ['workflow'=>$def['workflow']??null,'signatureSlots'=>array_map(fn($slot)=>array_intersect_key($slot,array_flip(['id','requiredForSubmission','requireWhenFields'])),$def['signatureSlots']??$def['signatures']??[])];
}
function submissionSignatureState(array $submission,?array $definition=null): array {
    $requested=($submission['review_status']??'')==='signature_required';
    if($requested)return ['signature_state'=>'unsigned','signature_requested'=>true];
    $profile=$submission['profile']??[];$images=$submission['signatures']??null;$answers=$submission['answers']??[];
    if(is_string($profile))$profile=json_decode($profile,true)??[];
    if(is_string($images))$images=json_decode($images,true);
    if(is_string($answers))$answers=json_decode($answers,true)??[];
    $electronicOverlay=isset($profile['electronic_signature']['source_id'],$profile['electronic_signature']['source_sha256']);
    if(($submission['source']??'online')==='upload'&&!$electronicOverlay)$state=($profile['signed_confirmed']??false)===true?'uploaded':'unknown';
    elseif($images===null)$state='unknown';
    else{
        $policy=$profile['signature_submission_policy']??$definition;
        if(!$policy)$state=$images?'unknown':'unsigned';
        else{
            $required=requiredSubmissionSignatureSlots($policy,$answers);$state=$required?'electronic':'unsigned';
            foreach($required as $slot)if(!is_string($images[$slot['id']]??null)||!str_starts_with($images[$slot['id']],'data:image/png;base64,')){$state='unsigned';break;}
            if(($policy['workflow']??'')==='subscription'&&!$electronicOverlay&&($answers['signature_mode']??'')!=='electronic')$state='unsigned';
        }
    }
    return ['signature_state'=>$state,'signature_requested'=>false];
}
function submissionSigningCapability(array $submission,?array $definition): array {
    $profile=$submission['profile']??[];if(is_string($profile))$profile=json_decode($profile,true)??[];
    // A stored PDF never moves when the active Word template is redesigned.
    // Old built-ins use their frozen original layout; new versions carry their
    // server-owned layout snapshot. This fallback does not rewrite history.
    $layout=$profile['pdf_layout']??$definition['legacyPdfLayout']??$definition;
    $pages=$layout['pages']??null;$slots=$layout['signatureSlots']??$layout['signatures']??[];
    $safe=$definition!==null&&empty($definition['downloadOnly'])&&is_int($pages)&&$pages>0&&$slots!==[];
    if(($submission['source']??'online')==='upload'&&isset($profile['electronic_signature']))$safe=false;
    foreach($slots as $slot){
        $rect=$slot['rect']??[];$page=$slot['page']??null;
        if(!is_int($page)||$page<1||$page>$pages||!is_array($rect)||count($rect)!==4){$safe=false;break;}
        foreach($rect as $number)if((!is_int($number)&&!is_float($number))||!is_finite((float)$number)){$safe=false;break;}
        if(!$safe||$rect[0]<0||$rect[1]<0||$rect[2]<=0||$rect[3]<=0){$safe=false;break;}
        $size=$layout['pageSizes'][$page-1]??null;
        if($size&&($rect[0]+$rect[2]>$size[0]||$rect[1]+$rect[3]>$size[1])){$safe=false;break;}
    }
    $answers=$submission['answers']??[];if(is_string($answers))$answers=json_decode($answers,true)??[];
    $required=$layout?array_column(requiredSubmissionSignatureSlots($layout,$answers),'id'):[];
    $safe=$safe&&$required!==[];
    return ['sourceId'=>$submission['id'],'sourceSha256'=>$submission['sha256'],'expectedCurrent'=>$submission['id'],
        'expectedPages'=>$pages,'signatureSlots'=>$safe?array_values(array_map(fn($slot)=>array_intersect_key($slot,array_flip(['id','label','ar','page','rect','requiredForSubmission','requireWhenFields'])),$slots)):[],
        'requiredSignatureIds'=>$safe?$required:[],'can_sign_electronically'=>$safe];
}
function requireOnlineSignatures(array $def,array $images,array $answers,mixed $modes): void {
    if(!is_array($modes)||count($modes)>20)reject('signature_invalid');
    if(($def['workflow']??'')==='subscription'&&($answers['signature_mode']??'')!=='electronic')reject('signature_required',422);
    $required=requiredSubmissionSignatureSlots($def,$answers);
    foreach($def['signatureSlots']??$def['signatures']??[] as $slot){
        $id=$slot['id'];$mode=$modes[$id]??(isset($images[$id])?'electronic':null);
        if($mode!==null&&!in_array($mode,['manual','electronic'],true))reject('signature_invalid');
        if(!in_array($id,array_column($required,'id'),true))continue;
        if($mode!=='electronic'||!isset($images[$id]))reject('signature_required',422);
    }
    // An online form with no configured customer signing area must use a signed PDF upload.
    if(!$required)reject('signature_required',422);
}
function saveVersion(array $s,string $sourcePath,?string $expected,?string $audit=null,bool $clientSubmission=false): array {
    global $db,$dataDir;
    $path=null;$db->exec('BEGIN IMMEDIATE');
    try{
        // Recheck under the same lock as the write: management may have changed
        // this account while its PDF was being generated or uploaded.
        if($clientSubmission&&execute('SELECT account_type FROM users WHERE id=?',[$s['user_id']])->fetchColumn()!==$s['audience'])throw new DomainException('account_type_restricted');
        $old=execute('SELECT id,created_at,version,archived_at,profile FROM submissions WHERE user_id=? AND request_key=?',[$s['user_id'],$s['request_key']])->fetch();
        if($old){$old['review_required']=workflowReviewRequired($old);unset($old['profile']);$db->exec('COMMIT');return ['submission'=>$old,'duplicate'=>true];}
        if(array_key_exists('workflow_revision',$s)&&$s['workflow_revision']!==workflowSettings()['revision'])throw new DomainException('workflow_conflict');
        unset($s['workflow_revision']);
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
        $db->exec('COMMIT');return ['submission'=>array_intersect_key($s,array_flip(['id','created_at','version','archived_at']))+['review_required'=>workflowReviewRequired($s)]];
    }catch(Throwable $e){$db->exec('ROLLBACK');if($path&&is_file($path))unlink($path);throw $e;}
}
