<?php
declare(strict_types=1);
// Private client accounts and immutable submission snapshots. No public file URLs.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
umask(0077);
require_once __DIR__.'/portal-versions.php';
require_once __DIR__.'/portal-account-types.php';
require_once __DIR__.'/portal-reviews.php';
require_once __DIR__.'/portal-workflow.php';
require_once __DIR__.'/portal-details.php';
require_once __DIR__.'/portal-answers.php';
require_once __DIR__.'/portal-shared.php';
require_once __DIR__.'/management-auth.php';
require_once __DIR__.'/session-scope.php';
function reply(array $data, int $status=200): never { global $workflowReady; if(!empty($workflowReady)&&!isset($data['workflow']))$data['workflow']=workflowSettings(); http_response_code($status); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit; }
function reject(string $code,int $status=400): never { reply(['error'=>$code],$status); }
function body(): array {
    if((int)($_SERVER['CONTENT_LENGTH']??0)>65536)reject('request_large',413);
    try{$b=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);}catch(Throwable){reject('invalid_request');}
    if(!is_array($b))reject('invalid_request');return $b;
}
function textValue(mixed $v,int $max=2000): string {
    if(!is_string($v)||mb_strlen($v)>$max||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u',$v))reject('invalid_request');return trim($v);
}
function mobile(mixed $value): string {
    $v=textValue($value,40);$v=strtr($v,array_combine(preg_split('//u','٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
    $v=preg_replace('/[\s()\-]/','',$v);$v=preg_replace('/^(?:\+966|00966|966|0)/','',$v);
    if(!preg_match('/^5[0-9]{8}$/D',$v))reject('phone_invalid');return '+966'.$v;
}
function passwordValue(mixed $v): string {if(!is_string($v)||mb_strlen($v)<8||strlen($v)>72)reject('password_weak');return $v;}
function execute(string $sql,array $params=[]): PDOStatement {global $db;$s=$db->prepare($sql);$s->execute($params);return $s;}
function rate(string $key,int $limit,int $seconds): void {
    global $db;$key=hash('sha256',$key);$now=time();
    $db->exec('BEGIN IMMEDIATE');
    try{$r=execute('SELECT * FROM rates WHERE key=?',[$key])->fetch();
        if(!$r||$r['expires']<=$now){execute('INSERT OR REPLACE INTO rates VALUES(?,?,?)',[$key,1,$now+$seconds]);}
        elseif($r['attempts']>=$limit){$db->exec('COMMIT');header('Retry-After: '.max(1,$r['expires']-$now));reject('rate_limited',429);}
        else execute('UPDATE rates SET attempts=attempts+1 WHERE key=?',[$key]);
        execute('DELETE FROM rates WHERE expires<?',[$now]);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function userView(array $u): array {return array_intersect_key($u,array_flip(['id','name','phone','email','account_type','created_at','last_login','reset_required']));}
function currentUser(bool $required=true,bool $allowReset=false): ?array {
    if(!isset($_SESSION['client'],$_SESSION['version'],$_SESSION['started'],$_SESSION['last'])||time()-$_SESSION['last']>7200||time()-$_SESSION['started']>43200){if($required)reject('login_required',401);return null;}
    $u=execute('SELECT * FROM users WHERE id=?',[$_SESSION['client']])->fetch();
    if(!$u||$u['session_version']!==$_SESSION['version']){$_SESSION=['csrf'=>bin2hex(random_bytes(24))];if($required)reject('login_required',401);return null;}
    $_SESSION['last']=time();if($u['reset_required']&&!$allowReset)reject('password_change_required',403);return $u;
}
function startClient(array $u): void {session_regenerate_id(true);$_SESSION=['client'=>$u['id'],'version'=>$u['session_version'],'csrf'=>bin2hex(random_bytes(24)),'started'=>time(),'last'=>time()];}
function ownerRequired(): void {
    global $managementDir;
    if(!managementOwner($managementDir))reject('admin_required',401);
    $_SESSION['last']=time();
}
function catalogue(?string $audience=null): array {
    global $managementDir;
    $base=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR);
    $file=$managementDir.'/state.json';$published=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR)['published']:$base;
    // The subscription rebuild split a former shared card into two audience-specific forms.
    foreach($base['documents'] as $d)if(in_array($d['id'],['subscription-form','subscription-company'],true)){
        $found=false;foreach($published['documents'] as &$old)if($old['id']===$d['id']){$found=true;if($old['group']==='shared')$old=$d;}unset($old);
        if(!$found)$published['documents'][]=$d;
    }
    if($audience!==null){
        $order=$published['orders'][$audience]??$base['orders'][$audience]??[];
        $documents=array_values(array_filter($published['documents'],fn($d)=>in_array($d['group'],[$audience,'shared'],true)));
        usort($documents,fn($a,$b)=>(array_search($a['id'],$order,true)===false?PHP_INT_MAX:array_search($a['id'],$order,true))<=>(array_search($b['id'],$order,true)===false?PHP_INT_MAX:array_search($b['id'],$order,true)));
        return $documents;
    }
    return $published['documents'];
}
function findDefinition(string $id,string $audience,bool $upload=false): ?array {
    $defs=json_decode(file_get_contents(__DIR__.'/portal-defaults.json'),true,512,JSON_THROW_ON_ERROR);
    foreach(catalogue() as $d)if($d['id']===$id&&in_array($d['group'],[$audience,'shared'],true)&&($upload||!$d['downloadOnly']))return [...$d,...($defs[$id]??[]), 'title'=>$d['title'],'ar'=>$d['ar']];
    return null;
}
function definition(string $id,string $audience,bool $upload=false): array {return findDefinition($id,$audience,$upload)??reject('document_unavailable',404);}
// Only a default, never-switched review site accepts legacy clients without a mode revision.
function requestedWorkflow(array $meta): array {
    $workflow=workflowSettings();$revision=$meta['workflowRevision']??null;
    if($revision===null&&$workflow['revision']===0)return $workflow;
    if(!is_int($revision)||$revision!==$workflow['revision'])reject('workflow_conflict',409);
    return $workflow;
}
function versionReceipt(array $row): array {$row=array_merge($row,submissionPresentation($row));$row['review_required']=workflowReviewRequired($row);unset($row['profile']);return $row;}
function reviewEligibleSql(): string {return "COALESCE(json_type(s.profile,'$.review_required'),'')!='false'";}
function submissionRows(?string $user=null,?int $limit=null,bool $admin=false,bool $currentOnly=false): array {
    $where=[];if($user!==null)$where[]='s.user_id=?';if($currentOnly)$where[]='s.archived_at IS NULL';
    return withSignatureStates(execute('SELECT s.id,s.user_id,s.doc_id,s.title,s.ar,s.audience,s.created_at,s.size,s.sha256,s.version,s.archived_at,s.replaces_id,s.restored_from,s.edited_from,s.source,u.name,u.phone,u.email,u.account_type'.signatureStateColumns().reviewColumns($admin||$user===null).' FROM submissions s JOIN users u ON u.id=s.user_id'.reviewJoin().($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY s.created_at DESC,s.rowid DESC'.($limit?' LIMIT '.$limit:''),$user!==null?[$user]:[])->fetchAll());
}
function signatureStateColumns(): string {return ',s.answers AS signature_answers,s.profile AS signature_profile,s.signatures AS signature_images';}
function withSignatureStates(array $rows): array {
    $definitions=[];$reviewEnabled=workflowSettings()['review_enabled'];
    foreach($rows as &$row){
        $key=$row['doc_id'].'/'.$row['audience'];
        if(!array_key_exists($key,$definitions))$definitions[$key]=findDefinition($row['doc_id'],$row['audience'],true);
        $snapshot=[...$row,'answers'=>$row['signature_answers'],'profile'=>$row['signature_profile'],'signatures'=>$row['signature_images']];
        $allowed=$row['archived_at']===null&&$row['audience']===$row['account_type'];
        $row=array_merge($row,submissionSignatureState($snapshot,$definitions[$key]),[
            ...submissionPresentation($snapshot),'review_required'=>workflowReviewRequired($snapshot),'workflow_enabled'=>$reviewEnabled,
            'can_replace'=>$allowed&&$definitions[$key]!==null,
            'can_sign_electronically'=>$allowed&&submissionSigningCapability($snapshot,$definitions[$key])['can_sign_electronically']]);
        unset($row['signature_answers'],$row['signature_profile'],$row['signature_images']);
    }unset($row);return $rows;
}
function submissionDetails(array $s,bool $admin): array {
    $s=array_merge($s,reviewDetails($s['id'],$admin));unset($s['request_key']);
    $definition=findDefinition($s['doc_id'],$s['audience'],true);
    $s['answers']=json_decode($s['answers'],true);$s['profile']=submissionProfileDetails(json_decode($s['profile'],true),$definition,$s['audience']);$s['signatures']=$s['signatures']===null?null:json_decode($s['signatures'],true);
    $s['current_id']=execute('SELECT id FROM submissions WHERE user_id=? AND doc_id=? AND audience=? AND archived_at IS NULL',[$s['user_id'],$s['doc_id'],$s['audience']])->fetchColumn()?:null;
    $allowed=$s['archived_at']===null&&$s['audience']===execute('SELECT account_type FROM users WHERE id=?',[$s['user_id']])->fetchColumn();
    return array_merge($s,submissionSignatureState($s,$definition),[
        ...submissionPresentation($s),'review_required'=>workflowReviewRequired($s),'workflow_enabled'=>workflowSettings()['review_enabled'],
        'can_replace'=>$allowed&&$definition!==null,
        'can_sign_electronically'=>$allowed&&submissionSigningCapability($s,$definition)['can_sign_electronically']]);
}
function fileName(string $name): string {return mb_substr(trim(preg_replace('/[^\p{L}\p{N}_ -]/u','',$name)),0,100)?:'client';}
function attachment(string $type,string $name,bool $inline=false): void {
    header('Content-Type: '.$type);header('Content-Disposition: '.($inline?'inline':'attachment').'; filename="document.'.($type==='application/zip'?'zip':'pdf').'"; filename*=UTF-8\'\''.rawurlencode($name));
}
function submittedPdf(): array {
    $f=$_FILES['pdf']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name']))reject('upload_failed');
    if($f['size']<50)reject('pdf_invalid');
    if($f['size']>20971520)reject('request_large',413);
    $bytes=file_get_contents($f['tmp_name']);
    if(!str_starts_with($bytes,'%PDF-')||!str_contains(substr($bytes,-2048),'%%EOF')||(new finfo(FILEINFO_MIME_TYPE))->buffer($bytes)!=='application/pdf')reject('pdf_invalid');
    return $f;
}
try {
    $dataDir=getenv('FORMS_PORTAL_DATA_DIR')?:__DIR__.'/../_private/portal';
    $managementDir=getenv('FORMS_DATA_DIR')?:__DIR__.'/../_private/management';
    if(!is_dir($dataDir)&&!mkdir($dataDir,0700,true))reject('storage_unavailable',503);
    if(!is_dir($dataDir.'/pdfs'))mkdir($dataDir.'/pdfs',0700,true);
    $db=new PDO('sqlite:'.$dataDir.'/clients.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    $db->exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,email TEXT NOT NULL DEFAULT "",password TEXT NOT NULL,created_at TEXT NOT NULL,last_login TEXT,session_version INTEGER NOT NULL DEFAULT 1,reset_required INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doc_id TEXT NOT NULL,title TEXT NOT NULL,ar TEXT NOT NULL,audience TEXT NOT NULL,created_at TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,answers TEXT NOT NULL,profile TEXT NOT NULL,request_key TEXT NOT NULL,UNIQUE(user_id,request_key));
      CREATE INDEX IF NOT EXISTS submissions_user ON submissions(user_id);
      CREATE TABLE IF NOT EXISTS rates(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,client_id TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL);');
    migrateVersions();
    migrateAccountTypes();
    migrateReviews();
    migrateWorkflow();$workflowReady=true;
    migrateSharedProfiles();
    migrateDirectIntake();
    $action=$_GET['action']??'session';$admin=str_starts_with($action,'admin_');
    $https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';
    $scope=sessionScope($admin?'itqan_management':'itqan_client');session_name($scope['name']);ini_set('session.use_strict_mode','1');session_set_cookie_params(['lifetime'=>0,'path'=>$scope['path'],'secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(24));
    if($admin)ownerRequired();
    if($_SERVER['REQUEST_METHOD']==='POST'&&(empty($_SERVER['HTTP_X_CSRF_TOKEN'])||!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN'])))reject('csrf_invalid',403);
    $mutations=['register','login','logout','password','profile','shared_profile_save','submit','sign_submission','admin_reset','admin_restore','admin_account_type','admin_review','admin_workflow_update','notification_read'];
    if(in_array($action,$mutations,true)&&$_SERVER['REQUEST_METHOD']!=='POST')reject('method',405);
    if(!in_array($action,$mutations,true)&&$_SERVER['REQUEST_METHOD']!=='GET')reject('method',405);
    $now=gmdate('Y-m-d\TH:i:s\Z');$ip=$_SERVER['REMOTE_ADDR']??'local';
    if($action==='session')reply(['user'=>($u=currentUser(false,true))?userView($u):null,'csrf'=>$_SESSION['csrf']]);
    if($action==='register'){
        rate('register:'.$ip,10,3600);$b=body();$first=textValue($b['first_name']??'',79);$last=textValue($b['last_name']??'',79);
        if($first===''||$last==='')reject('registration_name_invalid');$name=$first.' '.$last;
        $phone=mobile($b['phone']??'');$password=passwordValue($b['password']??'');if($password!==($b['confirm']??''))reject('password_mismatch');
        $type=accountType($b['account_type']??null);
        $id=bin2hex(random_bytes(16));
        try{execute('INSERT INTO users(id,name,phone,password,created_at,last_login,account_type) VALUES(?,?,?,?,?,?,?)',[$id,$name,$phone,password_hash($password,PASSWORD_DEFAULT),$now,$now,$type]);}
        catch(PDOException $e){if($e->getCode()==='23000')reject('phone_exists',409);throw $e;}
        $u=execute('SELECT * FROM users WHERE id=?',[$id])->fetch();startClient($u);reply(['user'=>userView($u),'csrf'=>$_SESSION['csrf']],201);
    }
    if($action==='login'){
        rate('login-ip:'.$ip,40,900);$b=body();$phone=mobile($b['phone']??'');rate('login:'.$phone,10,900);
        $password=$b['password']??'';if(!is_string($password)||strlen($password)>1000)reject('login_invalid',401);
        $u=execute('SELECT * FROM users WHERE phone=?',[$phone])->fetch();
        $dummy='$2y$10$QOt6TWFhTXLW9YnNiS3E6uhYKZeyhKFN3EqfHFCFq3GJ37Rw6xm6e';
        if(!password_verify($password,$u['password']??$dummy)||!$u)reject('login_invalid',401);
        execute('UPDATE users SET last_login=? WHERE id=?',[$now,$u['id']]);execute('DELETE FROM rates WHERE key=?',[hash('sha256','login:'.$phone)]);
        startClient($u);reply(['user'=>userView($u),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='logout'){$_SESSION=[];session_destroy();reply(['ok'=>true]);}
    if($action==='admin_workflow')reply(workflowDetails());
    if($action==='admin_workflow_update')reject('workflow_disabled',409);
    if($action==='admin_dashboard'){
        $stats=execute('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM submissions) AS submissions,(SELECT COUNT(*) FROM submissions WHERE archived_at IS NULL) AS active_submissions,(SELECT COUNT(DISTINCT user_id) FROM submissions) AS submitted_users')->fetch();
        $counts=execute('SELECT doc_id,audience,title,ar,COUNT(*) AS count,SUM(archived_at IS NULL) AS active_count,COUNT(DISTINCT user_id) AS clients FROM submissions GROUP BY doc_id,audience')->fetchAll();
        $categories=catalogue();
        foreach($counts as $c)if(!in_array($c['doc_id'],array_column($categories,'id'),true))$categories[]=['id'=>$c['doc_id'],'title'=>$c['title'],'ar'=>$c['ar'],'group'=>'shared','downloadOnly'=>false];
        reply(['stats'=>$stats,'categories'=>$categories,'counts'=>$counts,'recent'=>submissionRows(null,12,true,true),'review_counts'=>workflowSettings()['review_enabled']?execute("SELECT COALESCE(r.status,'pending') AS status,COUNT(*) AS count FROM submissions s".reviewJoin().' WHERE s.archived_at IS NULL AND '.reviewEligibleSql().' GROUP BY status')->fetchAll():[]]);
    }
    if($action==='admin_review_queue'||$action==='admin_submissions'){
        $direct=$action==='admin_submissions';
        if(!$direct&&!workflowSettings()['review_enabled'])reject('workflow_disabled',409);
        $status=$direct?'all':($_GET['status']??'pending');$audience=$_GET['audience']??'all';$sort=$_GET['sort']??'oldest';
        if(!in_array($status,['pending','approved','rejected','signature_required','all'],true)||!in_array($audience,['individual','corporate','all'],true)||!in_array($sort,['oldest','newest'],true))reject('invalid_request');
        $document=textValue($_GET['doc_id']??'all',100);$query=textValue($_GET['q']??'',160);
        $pageValue=$_GET['page']??'1';if(!is_string($pageValue)||!preg_match('/^[0-9]{1,6}$/D',$pageValue))reject('invalid_request');
        $page=max(1,min(100000,(int)$pageValue));$offset=($page-1)*30;
        $where=' WHERE s.archived_at IS NULL'.($direct?'':' AND '.reviewEligibleSql());$params=[];
        if($audience!=='all'){$where.=' AND s.audience=?';$params[]=$audience;}
        if($document!==''&&$document!=='all'){$where.=' AND s.doc_id=?';$params[]=$document;}
        if($query!==''){
            $search='%'.str_replace(['\\','%','_'],['\\\\','\\%','\\_'],$query).'%';
            $where.=" AND (u.name LIKE ? ESCAPE '\\' OR u.phone LIKE ? ESCAPE '\\' OR s.id LIKE ? ESCAPE '\\')";
            array_push($params,$search,$search,$search);
        }
        $from=' FROM submissions s JOIN users u ON u.id=s.user_id'.reviewJoin();
        $counts=['all'=>0,'pending'=>0,'approved'=>0,'rejected'=>0,'signature_required'=>0];
        foreach(execute("SELECT COALESCE(r.status,'pending') AS status,COUNT(*) AS count".$from.$where.' GROUP BY status',$params)->fetchAll() as $count){$counts[$count['status']]=(int)$count['count'];$counts['all']+=(int)$count['count'];}
        if($status!=='all'){$where.=" AND COALESCE(r.status,'pending')=?";$params[]=$status;}
        $direction=$sort==='newest'?' DESC':' ASC';
        $rows=withSignatureStates(execute('SELECT s.id,s.user_id,s.title,s.ar,s.doc_id,s.audience,s.created_at,s.version,s.archived_at,s.restored_from,s.source,s.sha256,u.name,u.phone,u.account_type'.signatureStateColumns().reviewColumns(true).$from.$where.' ORDER BY s.created_at'.$direction.',s.rowid'.$direction.' LIMIT 30 OFFSET '.$offset,$params)->fetchAll());
        $documents=[];foreach(catalogue() as $document)$documents[$document['id']]=array_intersect_key($document,array_flip(['id','title','ar']));
        foreach(execute('SELECT doc_id,title,ar FROM submissions WHERE rowid IN (SELECT MAX(rowid) FROM submissions GROUP BY doc_id) ORDER BY rowid DESC')->fetchAll() as $document)if(!isset($documents[$document['doc_id']]))$documents[$document['doc_id']]=['id'=>$document['doc_id'],'title'=>$document['title'],'ar'=>$document['ar']];
        reply(['submissions'=>$rows,'total'=>$counts[$status],'page'=>$page,'counts'=>$counts,'documents'=>array_values($documents)]);
    }
    if($action==='admin_review')reject('workflow_disabled',409);
    if($action==='admin_users'){
        $q=mb_substr((string)($_GET['q']??''),0,160);$q='%'.str_replace(['\\','%','_'],['\\\\','\\%','\\_'],$q).'%';
        $page=max(1,min(100000,(int)($_GET['page']??1)));$offset=($page-1)*30;
        $where=" WHERE name LIKE ? ESCAPE '\' OR phone LIKE ? ESCAPE '\' OR email LIKE ? ESCAPE '\'";
        $count=execute('SELECT COUNT(*) FROM users'.$where,[$q,$q,$q])->fetchColumn();
        $users=execute('SELECT id,name,phone,email,account_type,created_at,last_login,reset_required,(SELECT COUNT(*) FROM submissions s WHERE s.user_id=users.id) AS submissions,(SELECT COUNT(*) FROM submissions s WHERE s.user_id=users.id AND archived_at IS NULL) AS active_submissions FROM users'.$where.' ORDER BY created_at DESC,rowid DESC LIMIT 30 OFFSET '.$offset,[$q,$q,$q])->fetchAll();
        reply(['users'=>$users,'total'=>(int)$count,'page'=>$page]);
    }
    if($action==='admin_client'){
        $u=execute('SELECT * FROM users WHERE id=?',[$_GET['id']??''])->fetch();if(!$u)reject('not_found',404);
        reply(['user'=>userView($u),'submissions'=>submissionRows($u['id'],null,true),'shared_profiles'=>adminSharedProfiles($u['id']),'documents'=>catalogue($u['account_type'])]);
    }
    if($action==='admin_account_type'){
        if(!managementPermissions($managementDir)['change_account_type'])reject('account_type_forbidden',403);
        $b=body();$id=textValue($b['id']??'',40);$type=accountType($b['account_type']??null);$expected=accountType($b['expected_type']??null);
        reply(['user'=>userView(changeAccountType($id,$type,$expected))]);
    }
    if($action==='admin_reset'){
        $b=body();$id=textValue($b['id']??'',40);rate('reset:'.$ip,30,3600);
        $temporary=rtrim(strtr(base64_encode(random_bytes(18)),'+/','-_'),'=').'aA7!';
        $db->beginTransaction();
        if(execute('UPDATE users SET password=?,reset_required=1,session_version=session_version+1 WHERE id=?',[password_hash($temporary,PASSWORD_DEFAULT),$id])->rowCount()!==1){$db->rollBack();reject('not_found',404);}
        execute('INSERT INTO audit(client_id,event,created_at) VALUES(?,?,?)',[$id,'owner_password_reset',$now]);$db->commit();
        reply(['temporary_password'=>$temporary]);
    }
    if($action==='admin_restore'){
        $b=body();$key=requestKey($b);$expected=expectedCurrent($b);rate('restore:'.$ip,30,60);
        $s=execute('SELECT * FROM submissions WHERE id=?',[textValue($b['id']??'',40)])->fetch();if(!$s)reject('not_found',404);
        if($old=execute('SELECT id,created_at,version,archived_at,profile FROM submissions WHERE user_id=? AND request_key=?',[$s['user_id'],$key])->fetch())reply(['submission'=>versionReceipt($old),'duplicate'=>true]);
        if($s['archived_at']===null)reject('version_conflict',409);
        $s['restored_from']=$s['id'];$s['edited_from']=null;$s['request_key']=$key;
        reply(saveVersion($s,$dataDir.'/pdfs/'.$s['id'].'.pdf',$expected,'owner_restore'),201);
    }
    $u=$admin?null:currentUser(true,$action==='password');
    if($action==='shared_profile'||$action==='shared_profile_save'){
        $b=$action==='shared_profile'?$_GET:body();
        if(($b['account']??null)!==$u['id'])reject('account_changed',409);
        $audience=accountType($b['audience']??null);
        if($audience!==$u['account_type'])reject('account_type_restricted',403);
        if($action==='shared_profile')reply(['shared'=>clientSharedProfile($u['id'],$audience)]);
        $revision=$b['expectedRevision']??null;
        if(!is_int($revision)||$revision<0||!array_key_exists('changes',$b))reject('invalid_request');
        reply(['shared'=>saveSharedProfile($u['id'],$audience,$revision,$b['changes'])]);
    }
    if($action==='password'){
        rate('password:'.$u['id'],10,900);$b=body();$old=$b['current']??'';if(!is_string($old)||!password_verify($old,$u['password']))reject('current_password_invalid',401);
        $password=passwordValue($b['password']??'');if($password!==($b['confirm']??''))reject('password_mismatch');if(password_verify($password,$u['password']))reject('password_different');
        execute('UPDATE users SET password=?,reset_required=0,session_version=session_version+1 WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$u['id']]);
        $u=execute('SELECT * FROM users WHERE id=?',[$u['id']])->fetch();startClient($u);reply(['user'=>userView($u),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='profile'){
        $b=body();if(array_key_exists('account_type',$b))reject('account_type_managed',403);
        $name=textValue($b['name']??'',160);$email=textValue($b['email']??'',254);if(mb_strlen($name)<2)reject('name_invalid');if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))reject('email_invalid');
        execute('UPDATE users SET name=?,email=? WHERE id=?',[$name,$email,$u['id']]);reply(['ok'=>true]);
    }
    if($action==='notifications')reply(reviewNotifications($u['id'],max(0,(int)($_GET['before']??0))));
    if($action==='notification_read'){
        $b=body();$id=$b['id']??null;if(!is_int($id)||$id<1)reject('invalid_request');
        if(!execute('SELECT r.id FROM submission_reviews r JOIN submissions s ON s.id=r.submission_id WHERE r.id=? AND s.user_id=?',[$id,$u['id']])->fetch())reject('not_found',404);
        execute('UPDATE submission_reviews SET read_at=COALESCE(read_at,?) WHERE id=?',[$now,$id]);reply(['ok'=>true]);
    }
    if($action==='submissions')reply(['user'=>userView($u),'submissions'=>submissionRows($u['id'])]);
    if($action==='signing_details'){
        $s=execute('SELECT * FROM submissions WHERE id=? AND user_id=?',[textValue($_GET['id']??'',40),$u['id']])->fetch();if(!$s)reject('not_found',404);
        if($s['audience']!==$u['account_type'])reject('account_type_restricted',403);
        if($s['archived_at']!==null)reject('version_conflict',409);
        $doc=findDefinition($s['doc_id'],$s['audience'],true);
        reply(['signing'=>submissionSigningCapability($s,$doc),'submission'=>submissionDetails($s,false)]);
    }
    if($action==='sign_submission'){
        rate('submit:'.$u['id'],30,60);
        if((int)($_SERVER['CONTENT_LENGTH']??0)>24500000)reject('request_large',413);
        try{$meta=json_decode($_POST['metadata']??'',true,32,JSON_THROW_ON_ERROR);}catch(Throwable){reject('invalid_request');}
        if(!is_array($meta)||strlen($_POST['metadata']??'')>3500000)reject('invalid_request');
        if(($meta['account']??'')!==$u['id'])reject('account_changed',409);
        $key=requestKey($meta);$expected=expectedCurrent($meta);
        $s=execute('SELECT * FROM submissions WHERE id=? AND user_id=?',[textValue($meta['sourceId']??'',40),$u['id']])->fetch();if(!$s)reject('not_found',404);
        if($s['audience']!==$u['account_type'])reject('account_type_restricted',403);
        if(($meta['sourceSha256']??null)!==$s['sha256'])reject('version_conflict',409);
        if($old=execute('SELECT id,created_at,version,archived_at,edited_from,profile FROM submissions WHERE user_id=? AND request_key=?',[$u['id'],$key])->fetch()){
            if($old['edited_from']!==$s['id'])reject('version_conflict',409);unset($old['edited_from']);reply(['submission'=>versionReceipt($old),'duplicate'=>true]);
        }
        if($s['archived_at']!==null||$expected!==$s['id'])reject('version_conflict',409);
        $workflow=requestedWorkflow($meta);
        $doc=findDefinition($s['doc_id'],$s['audience'],true);
        if(!submissionSigningCapability($s,$doc)['can_sign_electronically'])reject('electronic_signing_unavailable',422);
        $answers=json_decode($s['answers'],true);$profile=json_decode($s['profile'],true);
        $signingAnswers=$answers;if(($doc['workflow']??'')==='subscription')$signingAnswers['signature_mode']='electronic';
        $signatures=cleanSignatureImages($doc,$meta['signatures']??[],$signingAnswers);
        if($workflow['review_enabled'])requireOnlineSignatures($doc,$signatures,$signingAnswers,[]);
        elseif(!$signatures)reject('signature_image_required',422);
        $f=submittedPdf();
        // The browser overlays these images on the authenticated original PDF;
        // retain its snapshot and provenance, including PDF-only upload source.
        if(($doc['workflow']??'')==='subscription'&&$s['source']==='online')$answers['signature_mode']='electronic';
        $profile['submission_mode']='direct';$profile['review_required']=false;$s['workflow_revision']=$workflow['revision'];
        $profile['electronic_signature']=['source_id'=>$s['id'],'source_sha256'=>$s['sha256']];
        $profile['signature_submission_policy']=signatureSubmissionPolicy($doc);
        $s['answers']=json_encode($answers,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);$s['profile']=json_encode($profile,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        $s['signatures']=json_encode((object)$signatures,JSON_THROW_ON_ERROR);$s['request_key']=$key;$s['edited_from']=$s['id'];$s['restored_from']=null;
        $result=saveVersion($s,$f['tmp_name'],$expected,null,true);reply($result,empty($result['duplicate'])?201:200);
    }
    if($action==='submit'){
        rate('submit:'.$u['id'],30,60);
        if((int)($_SERVER['CONTENT_LENGTH']??0)>24500000)reject('request_large',413);
        try{$meta=json_decode($_POST['metadata']??'',true,32,JSON_THROW_ON_ERROR);}catch(Throwable){reject('invalid_request');}
        if(!is_array($meta)||strlen($_POST['metadata']??'')>3500000)reject('invalid_request');
        if(($meta['account']??'')!==$u['id'])reject('account_changed',409);
        $audience=$meta['audience']??'';if(!in_array($audience,['individual','corporate'],true))reject('invalid_request');
        if($audience!==$u['account_type'])reject('account_type_restricted',403);
        $key=requestKey($meta);$expected=expectedCurrent($meta);
        if($old=execute('SELECT id,created_at,version,archived_at,profile FROM submissions WHERE user_id=? AND request_key=?',[$u['id'],$key])->fetch())reply(['submission'=>versionReceipt($old),'duplicate'=>true]);
        $workflow=requestedWorkflow($meta);
        $source=($meta['source']??'online')==='upload'?'upload':'online';
        $doc=definition(textValue($meta['document']??'',100),$audience,$source==='upload');$answers=$source==='upload'?[]:cleanAnswers($doc,$meta['values']??[],$audience);
        $editedFrom=$meta['editedFrom']??null;
        if($editedFrom!==null&&!execute('SELECT id FROM submissions WHERE id=? AND user_id=? AND doc_id=? AND audience=?', [textValue($editedFrom,40),$u['id'],$doc['id'],$audience])->fetch())reject('not_found',404);
        $signatures=$source==='upload'?[]:cleanSignatureImages($doc,$meta['signatures']??[],$answers);
        if($source==='upload'){
            if($workflow['review_enabled']&&($meta['signedConfirmed']??false)!==true)reject('signed_confirmation_required',422);
        }elseif($workflow['review_enabled'])requireOnlineSignatures($doc,$signatures,$answers,$meta['signatureModes']??[]);
        $profile=submissionProfileSnapshot($doc,$audience,$meta['profile']??[],$source);
        $profile['submission_mode']='direct';$profile['review_required']=false;
        if($source==='upload')$profile['signed_confirmed']=($meta['signedConfirmed']??false)===true;
        // cleanAnswers validates this document's email fields. Shared autosave
        // may contain unfinished answers from other forms; retain that snapshot
        // without blocking this save or promoting an invalid account email.
        $email=$answers['email']??($profile['email']??'');
        if(!filter_var($email,FILTER_VALIDATE_EMAIL))$email='';
        $f=submittedPdf();
        $result=saveVersion(['workflow_revision'=>$workflow['revision'],'user_id'=>$u['id'],'doc_id'=>$doc['id'],'title'=>$doc['title'],'ar'=>$doc['ar'],'audience'=>$audience,'answers'=>json_encode($answers,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'profile'=>json_encode($profile,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'request_key'=>$key,'source'=>$source,'signatures'=>json_encode((object)$signatures,JSON_THROW_ON_ERROR),'edited_from'=>$editedFrom],$f['tmp_name'],$expected,null,true);
        if($email!==''&&$u['email']==='')execute('UPDATE users SET email=? WHERE id=?',[$email,$u['id']]);
        reply($result,empty($result['duplicate'])?201:200);
    }
    if(in_array($action,['detail','admin_detail','pdf','admin_pdf'],true)){
        $s=execute('SELECT * FROM submissions WHERE id=?',[$_GET['id']??''])->fetch();
        if(!$s||(!$admin&&$s['user_id']!==$u['id']))reject('not_found',404);
        if(str_ends_with($action,'detail'))reply(['submission'=>submissionDetails($s,$admin)]);
        $path=$dataDir.'/pdfs/'.$s['id'].'.pdf';if(!is_file($path))reject('not_found',404);
        attachment('application/pdf',fileName($s['title']).'-v'.$s['version'].'-'.substr($s['created_at'],0,10).'.pdf',($_GET['inline']??'')==='1');
        header("Content-Security-Policy: sandbox; default-src 'none'; frame-ancestors 'self'");header('Content-Length: '.filesize($path));session_write_close();readfile($path);exit;
    }
    if(in_array($action,['zip','admin_zip'],true)){
        if($admin){$u=execute('SELECT * FROM users WHERE id=?',[$_GET['id']??''])->fetch();if(!$u)reject('not_found',404);}
        $history=($_GET['history']??'')==='1';$rows=array_filter(submissionRows($u['id']),fn($s)=>$history||$s['archived_at']===null);if(!$rows)reject('no_submissions',404);
        $tmp=tempnam($dataDir,'archive-');register_shutdown_function(static function()use($tmp){if(is_file($tmp))unlink($tmp);});
        $zip=new ZipArchive();if($zip->open($tmp,ZipArchive::OVERWRITE)!==true)reject('storage_unavailable',503);
        foreach($rows as $s){$path=$dataDir.'/pdfs/'.$s['id'].'.pdf';if(!is_file($path))reject('storage_unavailable',503);$zip->addFile($path,fileName($s['title']).'-'.$s['audience'].'-v'.$s['version'].'-'.str_replace([':', 'T','Z'],['-','_',''],$s['created_at']).'-'.substr($s['id'],0,8).'.pdf');}
        $zip->close();attachment('application/zip',fileName($u['name']).($history?'-history':'').'.zip');header('Content-Length: '.filesize($tmp));session_write_close();readfile($tmp);unlink($tmp);exit;
    }
    reject('not_found',404);
}catch(DomainException $e){reject($e->getMessage(),match($e->getMessage()){'invalid_request'=>400,'account_type_restricted'=>403,'not_found'=>404,default=>409});}
catch(Throwable $e){error_log('Client portal: '.$e->getMessage());reject('server_error',500);}
