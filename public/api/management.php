<?php
declare(strict_types=1);
// Role-protected catalogue management. Customer answers never reach this endpoint.
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');
const MAX_PDF = 20971520;
require_once __DIR__.'/management-auth.php';
require_once __DIR__.'/session-scope.php';
$dataDir = getenv('FORMS_DATA_DIR') ?: __DIR__ . '/../_private/management';
function respond(array $value, int $code = 200): never { http_response_code($code); echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit; }
function fail(string $message, int $code = 400): never { respond(['error'=>$message],$code); }
function input(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2097152) fail('Request is too large.',413);
    try { $value=json_decode(file_get_contents('php://input'),true,64,JSON_THROW_ON_ERROR); } catch(Throwable $e) { fail('Invalid JSON.'); }
    if(!is_array($value))fail('Invalid request.'); return $value;
}
function initial(): array { $base=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR); return ['revision'=>0,'draft'=>$base,'published'=>$base,'history'=>[]]; }
function locked(callable $callback, bool $write = false): mixed {
    global $dataDir;
    if(!is_dir($dataDir)){$state=initial();return $callback($state);}
    $lock=fopen($dataDir.'/state.lock','c+'); if(!$lock||!flock($lock,$write?LOCK_EX:LOCK_SH))fail('Storage is unavailable.',503);
    try {
        $file=$dataDir.'/state.json';$state=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR):initial();
        $result=$callback($state);
        if($write){$temp=$file.'.'.bin2hex(random_bytes(6));file_put_contents($temp,json_encode($state,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX);chmod($temp,0600);rename($temp,$file);}
        return $result;
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
function owner(): bool {global $dataDir;return managementOwner($dataDir);}
function requireOwner(): void {if(!owner())fail('Please sign in again.',401);$_SESSION['last']=time();}
function requireDocumentManager(): void {global $dataDir;if(!managementCanManageDocuments($dataDir))fail('Only the superadmin can manage documents.',403);}
function sessionResponse(): array {
    global $dataDir;$identity=managementIdentity($dataDir);
    return ['authenticated'=>$identity!==null,'configured'=>count(managementAccounts($dataDir))>0,'csrf'=>$_SESSION['csrf'],
        'username'=>$identity['username']??null,'role'=>$identity['role']??null,'permissions'=>['manage_documents'=>($identity['role']??null)==='superadmin']];
}
function csrf(): void {if(!hash_equals($_SESSION['csrf']??'',$_SERVER['HTTP_X_CSRF_TOKEN']??'')||empty($_SESSION['csrf']))fail('Refresh the page and try again.',403);}
function expected(array $state,array $body): void {if(($body['revision']??-1)!==$state['revision'])fail('Another window changed this draft. Reload before saving.',409);}
function stringValue(mixed $value,int $max=1000): string {if(!is_string($value)||mb_strlen($value)>$max)fail('Invalid text value.');return trim($value);}
function rect(mixed $v,array $size): array {if(!is_array($v)||count($v)!==4)fail('Invalid field rectangle.');foreach($v as $n)if(!is_numeric($n)||!is_finite((float)$n))fail('Invalid field coordinate.');$v=array_map('floatval',$v);if($v[0]<0||$v[1]<0||$v[2]<2||$v[3]<2||$v[0]+$v[2]>$size[0]+.1||$v[1]+$v[3]>$size[1]+.1)fail('A field is outside its page.');return $v;}
function cleanFields(array $list,array $sizes,bool $signatures=false): array {
    if(count($list)>400)fail('At most 400 fields are supported.');$out=[];$ids=[];
    foreach($list as $f){
        if(!is_array($f)||!preg_match('/^[a-z][a-z0-9_]{0,79}$/',$f['id']??'')||isset($ids[$f['id']]))fail('Invalid or duplicate field ID.');$ids[$f['id']]=true;
        $page=$f['page']??0;if(!is_int($page)||!isset($sizes[$page-1]))fail('Invalid field page.');
        $x=['id'=>$f['id'],'page'=>$page,'label'=>stringValue($f['label']??''),'ar'=>stringValue($f['ar']??'')];
        if($signatures){$x['rect']=rect($f['rect']??null,$sizes[$page-1]);$out[]=$x;continue;}
        $type=$f['type']??'text';if(!in_array($type,['text','email','tel','date','choice','select'],true))fail('Unsupported field type.');$x['type']=$type;
        if($type==='choice'){
            if(!is_array($f['options']??null)||count($f['options'])<1||count($f['options'])>50)fail('A choice needs options.');
            $x['options']=[];$values=[];
            foreach($f['options'] as $option){$value=stringValue($option['value']??'',100);if($value===''||isset($values[$value]))fail('Invalid choice value.');$values[$value]=true;$x['options'][]=['value'=>$value,'label'=>stringValue($option['label']??''),'ar'=>stringValue($option['ar']??''),'rect'=>rect($option['rect']??null,$sizes[$page-1])];}
            $x['multiple']=($f['multiple']??false)===true;$x['rect']=null;
        }else{
            $x['rect']=rect($f['rect']??null,$sizes[$page-1]);
            $x['direction']=in_array($f['direction']??'', ['auto','ltr','rtl'],true)?$f['direction']:'auto';
            $x['fontSize']=max(5,min(18,(float)($f['fontSize']??10)));$x['minFontSize']=5;$x['padding']=2;$x['multiline']=($f['multiline']??false)===true;
            if($type==='select'){
                if(!is_array($f['selectOptions']??null)||count($f['selectOptions'])<1||count($f['selectOptions'])>100)fail('A dropdown needs options.');
                $x['selectOptions']=array_map(fn($o)=>[stringValue($o[0]??'',100),stringValue($o[1]??''),stringValue($o[2]??'')],$f['selectOptions']);
            }
            foreach(['individual','corporate'] as $group)if(!empty($f['shared'][$group])){
                $key=stringValue($f['shared'][$group],80);
                if(!in_array($key,['full_name','full_name_en','full_name_ar','full_address','en_first','en_middle','en_last','ar_first','ar_middle','ar_last','dob','id_number','phone','mobile','email','client_number','account_number','building','street','district','city','postal','additional','country','company_name','inc_country','auth_name','auth_id'],true))fail('Invalid shared field.');
                if(($group==='corporate'&&in_array($key,['full_name_en','full_name_ar','en_first','en_middle','en_last','ar_first','ar_middle','ar_last','dob','id_number'],true))||($group==='individual'&&in_array($key,['company_name','inc_country','auth_name','auth_id'],true)))fail('Shared field belongs to the other audience.');
                $x['shared'][$group]=$key;
            }
        }
        $out[]=$x;
    }return $out;
}
function cleanDocument(array $r,array $old): array {
    $out=$old;
    foreach(['title','ar','description','arDescription'] as $key)$out[$key]=stringValue($r[$key]??'');
    if($old['builtin'])return $out;
    if(!in_array($r['group']??'', ['individual','corporate','shared'],true))fail('Choose an audience.');$out['group']=$r['group'];
    $out['downloadOnly']=($r['downloadOnly']??false)===true;
    $out['fields']=cleanFields($r['fields']??[], $old['pageSizes']);$out['signatures']=cleanFields($r['signatures']??[], $old['pageSizes'],true);
    $out['reviewed']=($old['reviewed']??false)&&json_encode([$out['fields'],$out['signatures'],$out['downloadOnly']])===json_encode([$old['fields'],$old['signatures'],$old['downloadOnly']]);
    return $out;
}
function cleanOrders(array $orders,array $documents): array {
    $out=[];foreach(['individual','corporate'] as $group){$ids=array_column(array_filter($documents,fn($d)=>$d['group']===$group||$d['group']==='shared'),'id');$order=$orders[$group]??[];
    if(!is_array($order)||count($order)!==count(array_unique($order))||array_diff($ids,$order)||array_diff($order,$ids))fail('The document order is incomplete.');$out[$group]=array_values($order);}return $out;
}
function checkLayout(array $d): void {
    $boxes=[];
    foreach($d['fields']??[] as $f){$rects=$f['type']==='choice'?array_column($f['options'],'rect'):[$f['rect']];foreach($rects as $r)$boxes[]=['id'=>$f['id'],'page'=>$f['page'],'rect'=>$r];}
    foreach($d['signatures']??[] as $f)$boxes[]=$f;
    for($i=0;$i<count($boxes);$i++)for($j=$i+1;$j<count($boxes);$j++){
        $a=$boxes[$i];$b=$boxes[$j];if($a['page']!==$b['page'])continue;$r=$a['rect'];$s=$b['rect'];
        if(min($r[0]+$r[2],$s[0]+$s[2])-max($r[0],$s[0])>.5&&min($r[1]+$r[3],$s[1]+$s[3])-max($r[1],$s[1])>.5)fail('Answer areas overlap on page '.$a['page'].'. Move or resize them before publishing.');
    }
}
function publishable(array $d): void {
    if($d['title']===''||$d['ar']==='')fail('Every document needs an English and Arabic title.');
    if($d['builtin']||$d['downloadOnly'])return;
    checkLayout($d);
    if(empty($d['reviewed']))fail('Review the new document’s fields and samples before publishing.');
    if(!$d['fields']&&!$d['signatures'])fail('Add fields or choose download only.');
    foreach(array_merge($d['fields'],$d['signatures']) as $f){if($f['label']===''||$f['ar']==='')fail('Every field needs English and Arabic labels.');foreach($f['options']??[] as $o)if($o['label']===''&&$o['ar']==='')fail('A choice label is missing.');}
}
try {
    $action=$_GET['action']??'session';
    if($action==='catalogue'){respond(locked(fn($s)=>$s['published']));}
    $https=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off');
    $scope=sessionScope('itqan_management');session_name($scope['name']);session_set_cookie_params(['lifetime'=>0,'path'=>$scope['path'],'secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);ini_set('session.use_strict_mode','1');session_start();
    $_SESSION['csrf']??=bin2hex(random_bytes(24));
    $accounts=managementAccounts($dataDir);$configured=count($accounts)>0;
    if($action==='session')respond(sessionResponse());
    if($action==='document'){
        $id=$_GET['id']??'';if(!preg_match('/^upload_[a-f0-9]{24}$/',$id))fail('Document not found.',404);
        $document=locked(function($s)use($id){global $dataDir;foreach(managementCanManageDocuments($dataDir)?['draft','published']:['published'] as $version)foreach($s[$version]['documents'] as $d)if($d['id']===$id)return $d;return null;});
        if(!$document)fail('Document not found.',404);
        $path=$dataDir.'/uploads/'.$id.'.pdf';if(!is_file($path))fail('Document not found.',404);
        header('Content-Type: application/pdf');header('Content-Disposition: attachment; filename="'.$id.'.pdf"');header('Content-Length: '.filesize($path));session_write_close();readfile($path);exit;
    }
    if(($_SERVER['REQUEST_METHOD']??'GET')==='POST')csrf();
    if($action==='login'){
        if($_SERVER['REQUEST_METHOD']!=='POST')fail('POST required.',405);if(!$configured)fail('Management has not been configured.',503);
        $body=input();$password=$body['password']??'';$loginUsername=normalizeManagementUsername($body['username']??null);
        if(!is_string($password)||strlen($password)>1000)$password='';
        // Persistent rate limit survives a new cookie or browser session.
        $rateFile=$dataDir.'/login-'.hash('sha256',$_SERVER['REMOTE_ADDR']??'local').'.json';$lock=fopen($rateFile,'c+');flock($lock,LOCK_EX);$raw=stream_get_contents($lock);$rate=$raw?json_decode($raw,true):['at'=>time(),'count'=>0];
        if(time()-$rate['at']>900)$rate=['at'=>time(),'count'=>0];
        if($rate['count']>=10){flock($lock,LOCK_UN);fclose($lock);fail('Too many attempts. Try again in 15 minutes.',429);}
        $account=null;foreach($accounts as $candidate)if($loginUsername!==null&&hash_equals($candidate['username'],$loginUsername)){$account=$candidate;break;}
        $dummy='$2y$10$QOt6TWFhTXLW9YnNiS3E6uhYKZeyhKFN3EqfHFCFq3GJ37Rw6xm6e';
        $passwordOk=password_verify($password,$account['password_hash']??$dummy);$ok=$account!==null&&$passwordOk;$rate['count']=$ok?0:$rate['count']+1;rewind($lock);ftruncate($lock,0);fwrite($lock,json_encode($rate));flock($lock,LOCK_UN);fclose($lock);
        if(!$ok)fail('Incorrect username or password.',401);session_regenerate_id(true);$_SESSION=['owner'=>true,'owner_username'=>$account['username'],'owner_credentials'=>$account['credential_version'],'last'=>time(),'started'=>time(),'csrf'=>bin2hex(random_bytes(24))];respond(sessionResponse());
    }
    requireOwner();
    if($action==='logout'){if($_SERVER['REQUEST_METHOD']!=='POST')fail('POST required.',405);$_SESSION=[];session_destroy();respond(['ok'=>true]);}
    requireDocumentManager();
    if($action==='state')respond(locked(fn($s)=>$s));
    if($_SERVER['REQUEST_METHOD']!=='POST')fail('POST required.',405);
    if($action==='upload'){
        $file=$_FILES['pdf']??null;if(!$file||$file['error']!==UPLOAD_ERR_OK)fail('Upload failed. Check the PDF size limit.');
        if($file['size']>MAX_PDF||$file['size']<8)fail('PDFs must be smaller than 20 MB.',413);
        $handle=fopen($file['tmp_name'],'rb');$header=fread($handle,5);fclose($handle);if($header!=='%PDF-'||strtolower(pathinfo($file['name'],PATHINFO_EXTENSION))!=='pdf')fail('Upload a PDF file.');
        try{$meta=json_decode($_POST['metadata']??'',true,64,JSON_THROW_ON_ERROR);}catch(Throwable $e){fail('Could not read the PDF details.');}
        $sizes=$meta['pageSizes']??[];if(!is_array($sizes)||count($sizes)<1||count($sizes)>50)fail('PDFs must contain 1–50 pages.');
        foreach($sizes as $size)if(!is_array($size)||count($size)!==2||!is_numeric($size[0])||!is_numeric($size[1])||min($size)<20||max($size)>2500)fail('Unsupported page size.');
        $id='upload_'.bin2hex(random_bytes(12));$old=['id'=>$id,'builtin'=>false,'pages'=>count($sizes),'pageSizes'=>$sizes,'pdfVersion'=>hash_file('sha256',$file['tmp_name']),'number'=>99,'fields'=>[],'signatures'=>[],'downloadOnly'=>false,'reviewed'=>false,'importedWidgets'=>($meta['importedWidgets']??false)===true];
        $document=cleanDocument($meta,$old);$result=locked(function(&$s)use($document,$file,$id){global $dataDir;if((int)($_POST['revision']??-1)!==$s['revision'])fail('Another window changed the draft. Reload and retry.',409);if(count($s['draft']['documents'])>=100)fail('The catalogue supports 100 documents.');
            if(!is_dir($dataDir.'/uploads'))mkdir($dataDir.'/uploads',0700,true);if(!move_uploaded_file($file['tmp_name'],$dataDir.'/uploads/'.$id.'.pdf'))fail('Could not store the PDF.',503);chmod($dataDir.'/uploads/'.$id.'.pdf',0600);
            $s['draft']['documents'][]=$document;foreach(['individual','corporate'] as $group)if($document['group']===$group||$document['group']==='shared')$s['draft']['orders'][$group][]=$id;$s['revision']++;return $s;
        },true);respond($result);
    }
    $body=input();
    $result=locked(function(&$s)use($action,$body){expected($s,$body);
        if($action==='save'){
            $incoming=$body['draft']??[];$rows=$incoming['documents']??[];
            if(count($rows)!==count($s['draft']['documents']))fail('Document list changed. Reload and retry.');
            $clean=[];foreach($s['draft']['documents'] as $old){$matches=array_values(array_filter($rows,fn($r)=>($r['id']??null)===$old['id']));if(count($matches)!==1)fail('Invalid document list.');$clean[]=cleanDocument($matches[0],$old);}
            $s['draft']=['documents'=>$clean,'orders'=>cleanOrders($incoming['orders']??[],$clean)];
        }elseif($action==='remove'){
            $id=$body['id']??'';$found=false;foreach($s['draft']['documents'] as $d)if($d['id']===$id){if($d['builtin'])fail('Existing documents cannot be removed.');$found=true;}if(!$found)fail('Document not found.',404);
            $s['draft']['documents']=array_values(array_filter($s['draft']['documents'],fn($d)=>$d['id']!==$id));foreach(['individual','corporate'] as $g)$s['draft']['orders'][$g]=array_values(array_diff($s['draft']['orders'][$g],[$id]));
        }elseif($action==='review'){
            $found=false;foreach($s['draft']['documents'] as &$d)if($d['id']===($body['id']??'')){$d['reviewed']=true;publishable($d);$found=true;}unset($d);if(!$found)fail('Document not found.',404);
        }elseif($action==='publish'){
            foreach($s['draft']['documents'] as $d)publishable($d);
            array_unshift($s['history'],['published_at'=>gmdate('c'),'catalogue'=>$s['published']]);$s['history']=array_slice($s['history'],0,10);$s['published']=$s['draft'];$s['published_at']=gmdate('c');
        }elseif($action==='restore'){
            $previous=$s['history'][0]['catalogue']??null;if(!$previous)fail('No previous publication exists.');
            $s['draft']=$previous; // Restore into draft first; publication is always explicit.
        }else fail('Unknown action.',404);
        $s['revision']++;return $s;
    },true);respond($result);
} catch(Throwable $error){error_log('Forms management: '.$error->getMessage());fail('Management could not complete the request. Your published catalogue is unchanged.',500);}
