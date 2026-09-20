<?php
declare(strict_types=1);
require_once __DIR__.'/management-auth.php';
require_once __DIR__.'/session-scope.php';

// Read the existing signed-in identity before serving templates or page HTML.
// Never create a client account/database merely because someone opens a link.
function formAccessIdentity(): ?array {
    foreach(['itqan_management','itqan_client'] as $name){
        $scope=sessionScope($name);
        $cookie=$_COOKIE[$scope['name']]??null;
        if(!is_string($cookie)||!preg_match('/^[a-zA-Z0-9,-]{16,128}$/D',$cookie))continue;
        session_name($scope['name']);session_id($cookie);
        ini_set('session.use_strict_mode','1');
        session_set_cookie_params(['lifetime'=>0,'path'=>$scope['path'],'secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
        session_start();$identity=null;
        if($name==='itqan_management'){
            $owner=managementIdentity(getenv('FORMS_DATA_DIR')?:__DIR__.'/../_private/management');
            if($owner)$identity=['role'=>$owner['role'],'username'=>$owner['username']];
        }elseif(isset($_SESSION['client'],$_SESSION['version'],$_SESSION['started'],$_SESSION['last'])&&time()-$_SESSION['last']<=7200&&time()-$_SESSION['started']<=43200){
            $file=(getenv('FORMS_PORTAL_DATA_DIR')?:__DIR__.'/../_private/portal').'/clients.sqlite';
            if(is_file($file)){
                $db=new PDO('sqlite:'.$file,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
                $db->exec('PRAGMA busy_timeout=5000');
                $query=$db->prepare('SELECT id,account_type,session_version,reset_required FROM users WHERE id=?');$query->execute([$_SESSION['client']]);$user=$query->fetch();
                if($user&&$user['session_version']===$_SESSION['version'])$identity=['role'=>'client',...$user];
            }
        }
        if($identity)$_SESSION['last']=time();
        session_write_close();$_SESSION=[];
        if($identity)return $identity;
    }
    return null;
}
function formAccessError(string $error,int $status): never {
    http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
    echo json_encode(['error'=>$error]);exit;
}
function requireFormAccess(): array {
    $identity=formAccessIdentity();
    if(!$identity)formAccessError('login_required',401);
    if(!empty($identity['reset_required']))formAccessError('password_change_required',403);
    return $identity;
}
function formDocumentAllowed(array $identity,array $document): bool {
    return $identity['role']!=='client'||in_array($document['group']??'',[$identity['account_type'],'shared'],true);
}
