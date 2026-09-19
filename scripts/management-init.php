<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../public/api/management-auth.php';
$dir=$argv[1]??null;$username=trim($argv[2]??'');$keepPassword=($argv[3]??'')==='--keep-password';
if(!$dir||normalizeManagementUsername($username)===null){fwrite(STDERR,"Usage: php scripts/management-init.php DATA_DIRECTORY USERNAME [--keep-password] < password-file\nChoose a non-empty username up to 80 characters.\n");exit(1);}
if($keepPassword){
    if(!is_file($dir.'/password.php')){fwrite(STDERR,"No existing password to keep.\n");exit(1);}
}else{
    $password=trim(stream_get_contents(STDIN));if(strlen($password)<14){fwrite(STDERR,"Use a password of at least 14 characters.\n");exit(1);}
}
if(!is_dir($dir))mkdir($dir,0700,true);
function storeCredential(string $file,string $value): void {
    $temp=$file.'.'.bin2hex(random_bytes(8));
    if(file_put_contents($temp,"<?php\nif (PHP_SAPI !== 'cli' && !defined('FORMS_MANAGEMENT_AUTH')) { http_response_code(404); exit; }\nreturn ".var_export($value,true).";\n",LOCK_EX)===false)throw new RuntimeException('Could not store management credentials.');
    chmod($temp,0600);if(!rename($temp,$file))throw new RuntimeException('Could not replace management credentials.');
}
if(!$keepPassword)storeCredential($dir.'/password.php',password_hash($password,PASSWORD_DEFAULT));
storeCredential($dir.'/username.php',$username);
echo $keepPassword?"Management username configured; existing password kept.\n":"Management username and password configured.\n";
echo "No existing catalogue or uploads were changed.\n";
