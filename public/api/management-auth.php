<?php
declare(strict_types=1);

function normalizeManagementUsername(mixed $value): ?string {
    if(!is_string($value)||mb_strlen($value)>80||preg_match('/[\x00-\x1F\x7F]/u',$value))return null;
    $value=trim($value);
    return $value===''?null:mb_strtolower($value,'UTF-8');
}

function managementUsername(string $directory): ?string {
    if(!is_file($directory.'/username.php'))return null;
    if(!defined('FORMS_MANAGEMENT_AUTH'))define('FORMS_MANAGEMENT_AUTH',true);
    return normalizeManagementUsername(require $directory.'/username.php');
}

function managementAccounts(string $directory): array {
    if(!defined('FORMS_MANAGEMENT_AUTH'))define('FORMS_MANAGEMENT_AUTH',true);
    $accounts=[];
    foreach(['admin'=>'','superadmin'=>'superadmin-'] as $role=>$prefix){
        $nameFile=$directory.'/'.$prefix.'username.php';$passwordFile=$directory.'/'.$prefix.'password.php';
        if(!is_file($nameFile)||!is_file($passwordFile))continue;
        $username=normalizeManagementUsername(require $nameFile);$hash=require $passwordFile;
        if($username===null||!is_string($hash)||empty(password_get_info($hash)['algo']))continue;
        // A duplicate identity must never silently promote the existing administrator.
        if($role==='superadmin'&&isset($accounts['admin'])&&hash_equals($accounts['admin']['username'],$username))continue;
        $accounts[$role]=['username'=>$username,'role'=>$role,'password_hash'=>$hash,
            'credential_version'=>hash('sha256',$role."\0".$username."\0".$hash)];
    }
    if(is_file($directory.'/administrators.sqlite')){
        $db=new PDO('sqlite:'.$directory.'/administrators.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $db->exec('PRAGMA busy_timeout=5000');
        foreach($db->query('SELECT * FROM administrators ORDER BY created_at,username') as $row){
            $username=normalizeManagementUsername($row['username']);$hash=$row['password_hash'];
            if($username===null||empty(password_get_info($hash)['algo'])||($accounts['superadmin']['username']??null)===$username)continue;
            $key=($accounts['admin']['username']??null)===$username?'admin':'user:'.$username;
            $accounts[$key]=$row+['role'=>'admin','credential_version'=>hash('sha256',"admin\0".$username."\0".$hash)];
        }
    }
    return $accounts;
}

function managementIdentity(string $directory): ?array {
    if(empty($_SESSION['owner'])||!is_string($_SESSION['owner_username']??null)||!is_string($_SESSION['owner_credentials']??null)||
        !is_int($_SESSION['last']??null)||!is_int($_SESSION['started']??null)||
        time()-$_SESSION['last']>=1800||time()-$_SESSION['started']>=28800)return null;
    foreach(managementAccounts($directory) as $account){
        if(hash_equals($account['username'],$_SESSION['owner_username'])&&hash_equals($account['credential_version'],$_SESSION['owner_credentials'])){
            return ['username'=>$account['username'],'role'=>$account['role']];
        }
    }
    return null;
}

function managementOwner(string $directory): bool {
    return managementIdentity($directory)!==null;
}

function managementPermissions(string $directory): array {
    $superadmin=(managementIdentity($directory)['role']??null)==='superadmin';
    return ['manage_documents'=>$superadmin,'change_account_type'=>$superadmin,'manage_workflow'=>$superadmin,'manage_admins'=>$superadmin];
}

function managementCanManageDocuments(string $directory): bool {return managementPermissions($directory)['manage_documents'];}
