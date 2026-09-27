<?php
declare(strict_types=1);

function managementAccountStore(string $directory): PDO {
    $db=new PDO('sqlite:'.$directory.'/administrators.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS administrators(username TEXT PRIMARY KEY,password_hash TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS administrator_events(id INTEGER PRIMARY KEY,event TEXT NOT NULL,username TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);');
    chmod($directory.'/administrators.sqlite',0600);
    return $db;
}

function managementPassword(mixed $password,mixed $confirmation): string {
    if(!is_string($password)||mb_strlen($password)<8||strlen($password)>72)throw new DomainException('password_weak');
    if($password!==$confirmation)throw new DomainException('password_mismatch');
    return $password;
}

function managementAccountView(array $account): array {
    return array_intersect_key($account,array_flip(['username','role','created_at','created_by','updated_at','updated_by']));
}

// Only ordinary administrators can be created through the dashboard. The owner
// remains the separately provisioned superadmin; request-supplied roles are ignored.
function createManagementAdmin(string $directory,array $input,string $actor): array {
    $username=normalizeManagementUsername($input['username']??null);
    if($username===null)throw new DomainException('username_invalid');
    $password=managementPassword($input['password']??null,$input['confirm']??null);
    $db=managementAccountStore($directory);$db->exec('BEGIN IMMEDIATE');
    try{
        foreach(managementAccounts($directory) as $account)if(hash_equals($account['username'],$username))throw new DomainException('username_exists');
        $now=gmdate('Y-m-d\TH:i:s\Z');
        $db->prepare('INSERT INTO administrators VALUES(?,?,?,?,?,?)')->execute([$username,password_hash($password,PASSWORD_DEFAULT),$now,$actor,$now,$actor]);
        $db->prepare('INSERT INTO administrator_events(event,username,actor,created_at) VALUES(?,?,?,?)')->execute(['created',$username,$actor,$now]);
        $db->exec('COMMIT');
        return ['username'=>$username,'role'=>'admin','created_at'=>$now,'created_by'=>$actor,'updated_at'=>$now,'updated_by'=>$actor];
    }catch(Throwable $error){$db->exec('ROLLBACK');throw $error;}
}

function resetManagementAdmin(string $directory,array $input,string $actor): array {
    $username=normalizeManagementUsername($input['username']??null);
    $password=managementPassword($input['password']??null,$input['confirm']??null);
    $db=managementAccountStore($directory);$db->exec('BEGIN IMMEDIATE');
    try{
        $target=null;foreach(managementAccounts($directory) as $account)if($account['username']===$username)$target=$account;
        if(!$target)throw new DomainException('admin_not_found');
        if($target['role']!=='admin')throw new DomainException('admin_only');
        $now=gmdate('Y-m-d\TH:i:s\Z');
        // A legacy admin gets an explicit password override without editing its
        // original credential files. Username collisions cannot change its role.
        $db->prepare('INSERT INTO administrators VALUES(?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at,updated_by=excluded.updated_by')
            ->execute([$username,password_hash($password,PASSWORD_DEFAULT),$target['created_at']??$now,$target['created_by']??$actor,$now,$actor]);
        $db->prepare('INSERT INTO administrator_events(event,username,actor,created_at) VALUES(?,?,?,?)')->execute(['password_reset',$username,$actor,$now]);
        $db->exec('COMMIT');return ['ok'=>true];
    }catch(Throwable $error){$db->exec('ROLLBACK');throw $error;}
}
