<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../public/api/installation-backup.php';
if(count($argv)!==4){fwrite(STDERR,"Usage: php scripts/backup-installation.php MANAGEMENT_DIRECTORY PORTAL_DIRECTORY DESTINATION.zip\n");exit(1);}
try{installationBackup($argv[1],$argv[2],$argv[3]);echo "Private backup created and checked. Store it outside the web root.\n";}
catch(Throwable $error){fwrite(STDERR,$error->getMessage()."\n");exit(1);}
