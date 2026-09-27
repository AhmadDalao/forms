<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../public/api/portal-database.php';
require_once __DIR__.'/../public/api/management-accounts.php';
$root=$argv[1]??'';
if($root===''||count($argv)!==2){fwrite(STDERR,"Usage: php scripts/installation-init.php /absolute/path/to/private-data\n");exit(1);}
umask(0077);
try{
    foreach(['management','portal'] as $folder)if(!is_dir($root.'/'.$folder)&&!mkdir($root.'/'.$folder,0700,true))throw new RuntimeException('Cannot create private data directory.');
    $db=initializePortalDatabase($root.'/portal');managementAccountStore($root.'/management');
    if($db->query('PRAGMA integrity_check')->fetchColumn()!=='ok')throw new RuntimeException('Database check failed.');
    echo 'Database ready (schema '.(int)$db->query('PRAGMA user_version')->fetchColumn()."). Existing records preserved.\n";
}catch(Throwable $error){fwrite(STDERR,$error->getMessage()."\n");exit(1);}
