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

function managementOwner(string $directory): bool {
    $username=managementUsername($directory);
    return $username!==null && is_file($directory.'/password.php') &&
        !empty($_SESSION['owner']) && isset($_SESSION['owner_username'],$_SESSION['last'],$_SESSION['started']) &&
        hash_equals($username,$_SESSION['owner_username']) &&
        time()-$_SESSION['last']<1800 && time()-$_SESSION['started']<28800;
}
