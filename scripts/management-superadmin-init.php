<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../public/api/management-auth.php';
$dir=$argv[1]??'';$username=normalizeManagementUsername($argv[2]??null);
if($dir===''||$username===null||count($argv)!==3){fwrite(STDERR,"Usage: php scripts/management-superadmin-init.php DATA_DIRECTORY USERNAME < password-file\n");exit(1);}
$password=rtrim(stream_get_contents(STDIN),"\r\n");
if(strlen($password)<14||strlen($password)>72){fwrite(STDERR,"Use a password of 14–72 bytes.\n");exit(1);}
umask(0077);
if(!is_dir($dir)&&!mkdir($dir,0700,true)){fwrite(STDERR,"Could not create the private directory.\n");exit(1);}
$lock=fopen($dir.'/superadmin-init.lock','c+');
if(!$lock||!flock($lock,LOCK_EX)){fwrite(STDERR,"Could not lock the private directory.\n");exit(1);}
$created=[];
try{
    foreach(['superadmin-username.php','superadmin-password.php'] as $file)if(file_exists($dir.'/'.$file))throw new RuntimeException('Superadmin credentials already exist; no files were changed.');
    foreach(managementAccounts($dir) as $account)if(hash_equals($account['username'],$username))throw new RuntimeException('Choose a username different from an existing administrator.');
    foreach(['superadmin-password.php'=>password_hash($password,PASSWORD_DEFAULT),'superadmin-username.php'=>$username] as $file=>$value){
        $path=$dir.'/'.$file;$handle=fopen($path,'x');
        if(!$handle)throw new RuntimeException('Could not create superadmin credentials.');
        $created[]=$path;chmod($path,0600);
        $content="<?php\nif (PHP_SAPI !== 'cli' && !defined('FORMS_MANAGEMENT_AUTH')) { http_response_code(404); exit; }\nreturn ".var_export($value,true).";\n";
        if(fwrite($handle,$content)!==strlen($content)){fclose($handle);throw new RuntimeException('Could not store superadmin credentials.');}
        fclose($handle);
    }
    echo "Superadmin credentials created. Existing administrator, catalogue, uploads and client data were kept.\n";
}catch(Throwable $error){foreach($created as $file)unlink($file);fwrite(STDERR,$error->getMessage()."\n");exit(1);}
finally{flock($lock,LOCK_UN);fclose($lock);}
