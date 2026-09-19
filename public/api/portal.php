<?php
declare(strict_types=1);
// Private client accounts and immutable submission snapshots. No public file URLs.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
umask(0077);
require_once __DIR__.'/portal-versions.php';
function reply(array $data, int $status=200): never { http_response_code($status); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit; }
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
function passwordValue(mixed $v): string {if(!is_string($v)||mb_strlen($v)<12||strlen($v)>72)reject('password_weak');return $v;}
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
function userView(array $u): array {return array_intersect_key($u,array_flip(['id','name','phone','email','created_at','last_login','reset_required']));}
function currentUser(bool $required=true,bool $allowReset=false): ?array {
    if(!isset($_SESSION['client'],$_SESSION['version'],$_SESSION['started'],$_SESSION['last'])||time()-$_SESSION['last']>7200||time()-$_SESSION['started']>43200){if($required)reject('login_required',401);return null;}
    $u=execute('SELECT * FROM users WHERE id=?',[$_SESSION['client']])->fetch();
    if(!$u||$u['session_version']!==$_SESSION['version']){$_SESSION=['csrf'=>bin2hex(random_bytes(24))];if($required)reject('login_required',401);return null;}
    $_SESSION['last']=time();if($u['reset_required']&&!$allowReset)reject('password_change_required',403);return $u;
}
function startClient(array $u): void {session_regenerate_id(true);$_SESSION=['client'=>$u['id'],'version'=>$u['session_version'],'csrf'=>bin2hex(random_bytes(24)),'started'=>time(),'last'=>time()];}
function ownerRequired(): void {
    if(empty($_SESSION['owner'])||!isset($_SESSION['last'],$_SESSION['started'])||time()-$_SESSION['last']>=1800||time()-$_SESSION['started']>=28800)reject('admin_required',401);
    $_SESSION['last']=time();
}
function catalogue(): array {
    global $managementDir;
    $base=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR);
    $file=$managementDir.'/state.json';$published=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR)['published']:$base;
    // The subscription rebuild split a former shared card into two audience-specific forms.
    foreach($base['documents'] as $d)if(in_array($d['id'],['subscription-form','subscription-company'],true)){
        $found=false;foreach($published['documents'] as &$old)if($old['id']===$d['id']){$found=true;if($old['group']==='shared')$old=$d;}unset($old);
        if(!$found)$published['documents'][]=$d;
    }
    return $published['documents'];
}
function definition(string $id,string $audience,bool $upload=false): array {
    $defs=json_decode(file_get_contents(__DIR__.'/portal-defaults.json'),true,512,JSON_THROW_ON_ERROR);
    foreach(catalogue() as $d)if($d['id']===$id&&in_array($d['group'],[$audience,'shared'],true)&&($upload||!$d['downloadOnly']))return [...($defs[$id]??$d), 'title'=>$d['title'],'ar'=>$d['ar']];
    reject('document_unavailable',404);
}
function cleanAnswers(array $def,mixed $input): array {
    if(!is_array($input)||count($input)>500)reject('invalid_request');$out=[];
    foreach($def['fields']??[] as $f){$v=$input[$f['id']]??null;if($v===null)continue;
        if(is_array($v)){if(empty($f['multiple'])||count($v)>100)reject('invalid_request');$v=array_map(fn($x)=>textValue($x),$v);}
        else $v=textValue($v);
        if($v!==''&&$v!==[]){
            $allowed=isset($f['selectOptions'])?array_column($f['selectOptions'],0):(isset($f['options'])?array_column($f['options'],'value'):null);
            if($allowed&&array_diff(is_array($v)?$v:[$v],$allowed))reject('invalid_request');
            if(($f['type']??'')==='email'&&!filter_var($v,FILTER_VALIDATE_EMAIL))reject('email_invalid');
            if(($f['type']??'')==='date'&&(!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$v,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])))reject('invalid_request');
        }
        $out[$f['id']]=$v;
    }
    if(($def['workflow']??'')==='subscription'){
        define('SUBSCRIPTION_LIBRARY',true);require_once __DIR__.'/subscription/calculate.php';
        try{$calculated=subscription_calculate($out['units']??'');}catch(Throwable){reject('units_invalid',422);}
        if($calculated['units']==='')reject('form_incomplete',422);
        $out=array_merge($out,$calculated);
        foreach($def['fields'] as $f)if(!empty($f['required'])&&(empty($f['when'])||in_array($out[$f['dependsOn']]??'',$f['when'],true))&&empty($out[$f['id']]))reject('form_incomplete',422);
    }
    return $out;
}
function submissionRows(?string $user=null,?int $limit=null): array {
    return execute('SELECT s.id,s.user_id,s.doc_id,s.title,s.ar,s.audience,s.created_at,s.size,s.sha256,s.version,s.archived_at,s.replaces_id,s.restored_from,s.edited_from,s.source,u.name,u.phone,u.email FROM submissions s JOIN users u ON u.id=s.user_id'.($user?' WHERE s.user_id=?':'').' ORDER BY s.created_at DESC,s.rowid DESC'.($limit?' LIMIT '.$limit:''),$user?[$user]:[])->fetchAll();
}
function fileName(string $name): string {return mb_substr(trim(preg_replace('/[^\p{L}\p{N}_ -]/u','',$name)),0,100)?:'client';}
function attachment(string $type,string $name,bool $inline=false): void {
    header('Content-Type: '.$type);header('Content-Disposition: '.($inline?'inline':'attachment').'; filename="document.'.($type==='application/zip'?'zip':'pdf').'"; filename*=UTF-8\'\''.rawurlencode($name));
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
    $action=$_GET['action']??'session';$admin=str_starts_with($action,'admin_');
    $https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';
    session_name($admin?'itqan_management':'itqan_client');ini_set('session.use_strict_mode','1');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(24));
    if($admin)ownerRequired();
    if($_SERVER['REQUEST_METHOD']==='POST'&&(empty($_SERVER['HTTP_X_CSRF_TOKEN'])||!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN'])))reject('csrf_invalid',403);
    $mutations=['register','login','logout','password','profile','submit','admin_reset','admin_restore'];
    if(in_array($action,$mutations,true)&&$_SERVER['REQUEST_METHOD']!=='POST')reject('method',405);
    if(!in_array($action,$mutations,true)&&$_SERVER['REQUEST_METHOD']!=='GET')reject('method',405);
    $now=gmdate('Y-m-d\TH:i:s\Z');$ip=$_SERVER['REMOTE_ADDR']??'local';
    if($action==='session')reply(['user'=>($u=currentUser(false,true))?userView($u):null,'csrf'=>$_SESSION['csrf']]);
    if($action==='register'){
        rate('register:'.$ip,10,3600);$b=body();$first=textValue($b['first_name']??'',79);$last=textValue($b['last_name']??'',79);
        if($first===''||$last==='')reject('registration_name_invalid');$name=$first.' '.$last;
        $phone=mobile($b['phone']??'');$password=passwordValue($b['password']??'');if($password!==($b['confirm']??''))reject('password_mismatch');
        $id=bin2hex(random_bytes(16));
        try{execute('INSERT INTO users(id,name,phone,password,created_at,last_login) VALUES(?,?,?,?,?,?)',[$id,$name,$phone,password_hash($password,PASSWORD_DEFAULT),$now,$now]);}
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
    if($action==='admin_dashboard'){
        $stats=execute('SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM submissions) AS submissions,(SELECT COUNT(*) FROM submissions WHERE archived_at IS NULL) AS active_submissions,(SELECT COUNT(DISTINCT user_id) FROM submissions) AS submitted_users')->fetch();
        $counts=execute('SELECT doc_id,audience,title,ar,COUNT(*) AS count,SUM(archived_at IS NULL) AS active_count,COUNT(DISTINCT user_id) AS clients FROM submissions GROUP BY doc_id,audience')->fetchAll();
        $categories=catalogue();
        foreach($counts as $c)if(!in_array($c['doc_id'],array_column($categories,'id'),true))$categories[]=['id'=>$c['doc_id'],'title'=>$c['title'],'ar'=>$c['ar'],'group'=>'shared','downloadOnly'=>false];
        reply(['stats'=>$stats,'categories'=>$categories,'counts'=>$counts,'recent'=>submissionRows(null,12)]);
    }
    if($action==='admin_users'){
        $q=mb_substr((string)($_GET['q']??''),0,160);$q='%'.str_replace(['\\','%','_'],['\\\\','\\%','\\_'],$q).'%';
        $page=max(1,min(100000,(int)($_GET['page']??1)));$offset=($page-1)*30;
        $where=" WHERE name LIKE ? ESCAPE '\' OR phone LIKE ? ESCAPE '\' OR email LIKE ? ESCAPE '\'";
        $count=execute('SELECT COUNT(*) FROM users'.$where,[$q,$q,$q])->fetchColumn();
        $users=execute('SELECT id,name,phone,email,created_at,last_login,reset_required,(SELECT COUNT(*) FROM submissions s WHERE s.user_id=users.id) AS submissions,(SELECT COUNT(*) FROM submissions s WHERE s.user_id=users.id AND archived_at IS NULL) AS active_submissions FROM users'.$where.' ORDER BY created_at DESC,rowid DESC LIMIT 30 OFFSET '.$offset,[$q,$q,$q])->fetchAll();
        reply(['users'=>$users,'total'=>(int)$count,'page'=>$page]);
    }
    if($action==='admin_client'){
        $u=execute('SELECT * FROM users WHERE id=?',[$_GET['id']??''])->fetch();if(!$u)reject('not_found',404);
        reply(['user'=>userView($u),'submissions'=>submissionRows($u['id'])]);
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
        if($old=execute('SELECT id,created_at,version,archived_at FROM submissions WHERE user_id=? AND request_key=?',[$s['user_id'],$key])->fetch())reply(['submission'=>$old,'duplicate'=>true]);
        if($s['archived_at']===null)reject('version_conflict',409);
        $s['restored_from']=$s['id'];$s['edited_from']=null;$s['request_key']=$key;
        reply(saveVersion($s,$dataDir.'/pdfs/'.$s['id'].'.pdf',$expected,'owner_restore'),201);
    }
    $u=$admin?null:currentUser(true,$action==='password');
    if($action==='password'){
        rate('password:'.$u['id'],10,900);$b=body();$old=$b['current']??'';if(!is_string($old)||!password_verify($old,$u['password']))reject('current_password_invalid',401);
        $password=passwordValue($b['password']??'');if($password!==($b['confirm']??''))reject('password_mismatch');if(password_verify($password,$u['password']))reject('password_different');
        execute('UPDATE users SET password=?,reset_required=0,session_version=session_version+1 WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$u['id']]);
        $u=execute('SELECT * FROM users WHERE id=?',[$u['id']])->fetch();startClient($u);reply(['user'=>userView($u),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='profile'){
        $b=body();$name=textValue($b['name']??'',160);$email=textValue($b['email']??'',254);if(mb_strlen($name)<2)reject('name_invalid');if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))reject('email_invalid');
        execute('UPDATE users SET name=?,email=? WHERE id=?',[$name,$email,$u['id']]);reply(['ok'=>true]);
    }
    if($action==='submissions')reply(['user'=>userView($u),'submissions'=>submissionRows($u['id'])]);
    if($action==='submit'){
        rate('submit:'.$u['id'],30,60);
        if((int)($_SERVER['CONTENT_LENGTH']??0)>24500000)reject('request_large',413);
        try{$meta=json_decode($_POST['metadata']??'',true,32,JSON_THROW_ON_ERROR);}catch(Throwable){reject('invalid_request');}
        if(!is_array($meta)||strlen($_POST['metadata']??'')>3500000)reject('invalid_request');
        if(($meta['account']??'')!==$u['id'])reject('account_changed',409);
        $key=requestKey($meta);$expected=expectedCurrent($meta);
        if($old=execute('SELECT id,created_at,version,archived_at FROM submissions WHERE user_id=? AND request_key=?',[$u['id'],$key])->fetch())reply(['submission'=>$old,'duplicate'=>true]);
        $audience=$meta['audience']??'';if(!in_array($audience,['individual','corporate'],true))reject('invalid_request');
        $source=($meta['source']??'online')==='upload'?'upload':'online';
        $doc=definition(textValue($meta['document']??'',100),$audience,$source==='upload');$answers=$source==='upload'?[]:cleanAnswers($doc,$meta['values']??[]);
        $editedFrom=$meta['editedFrom']??null;
        if($editedFrom!==null&&!execute('SELECT id FROM submissions WHERE id=? AND user_id=? AND doc_id=? AND audience=?', [textValue($editedFrom,40),$u['id'],$doc['id'],$audience])->fetch())reject('not_found',404);
        $signatures=$source==='upload'?[]:cleanSignatureImages($doc,$meta['signatures']??[],$answers);
        $profile=['submission_source'=>$source];foreach(['email','phone','mobile','company_name','full_name','building','street','district','city','postal','country'] as $k)if(isset($meta['profile'][$k]))$profile[$k]=textValue($meta['profile'][$k]);
        $profile['field_definitions']=array_map(fn($f)=>array_intersect_key($f,array_flip(['id','label','ar','type','hidden','options','selectOptions'])),$doc['fields']??[]);
        $email=$profile['email']??($answers['email']??'');if($email!==''&&!filter_var($email,FILTER_VALIDATE_EMAIL))reject('email_invalid');
        $f=$_FILES['pdf']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name']))reject('upload_failed');
        if($f['size']<50)reject('pdf_invalid');
        if($f['size']>20971520)reject('request_large',413);
        $bytes=file_get_contents($f['tmp_name']);
        if(!str_starts_with($bytes,'%PDF-')||!str_contains(substr($bytes,-2048),'%%EOF')||(new finfo(FILEINFO_MIME_TYPE))->buffer($bytes)!=='application/pdf')reject('pdf_invalid');
        $result=saveVersion(['user_id'=>$u['id'],'doc_id'=>$doc['id'],'title'=>$doc['title'],'ar'=>$doc['ar'],'audience'=>$audience,'answers'=>json_encode($answers,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'profile'=>json_encode($profile,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'request_key'=>$key,'source'=>$source,'signatures'=>json_encode((object)$signatures,JSON_THROW_ON_ERROR),'edited_from'=>$editedFrom],$f['tmp_name'],$expected);
        if($email!==''&&$u['email']==='')execute('UPDATE users SET email=? WHERE id=?',[$email,$u['id']]);
        reply($result,empty($result['duplicate'])?201:200);
    }
    if(in_array($action,['detail','admin_detail','pdf','admin_pdf'],true)){
        $s=execute('SELECT * FROM submissions WHERE id=?',[$_GET['id']??''])->fetch();
        if(!$s||(!$admin&&$s['user_id']!==$u['id']))reject('not_found',404);
        if(str_ends_with($action,'detail')){unset($s['request_key']);$s['answers']=json_decode($s['answers'],true);$s['profile']=json_decode($s['profile'],true);$s['signatures']=$s['signatures']===null?null:json_decode($s['signatures'],true);$s['current_id']=execute('SELECT id FROM submissions WHERE user_id=? AND doc_id=? AND audience=? AND archived_at IS NULL',[$s['user_id'],$s['doc_id'],$s['audience']])->fetchColumn()?:null;reply(['submission'=>$s]);}
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
}catch(DomainException $e){reject($e->getMessage(),409);}
catch(Throwable $e){error_log('Client portal: '.$e->getMessage());reject('server_error',500);}
