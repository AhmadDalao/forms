<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$dir=$argv[1]??null;if(!$dir){fwrite(STDERR,"Usage: php scripts/management-init.php DATA_DIRECTORY < password-file\n");exit(1);}
$password=trim(stream_get_contents(STDIN));if(strlen($password)<14){fwrite(STDERR,"Use a password of at least 14 characters.\n");exit(1);}
if(!is_dir($dir))mkdir($dir,0700,true);
file_put_contents($dir.'/password.php',"<?php\nif (PHP_SAPI !== 'cli' && !defined('FORMS_MANAGEMENT_AUTH')) { http_response_code(404); exit; }\nreturn ".var_export(password_hash($password,PASSWORD_DEFAULT),true).";\n");chmod($dir.'/password.php',0600);
echo "Management password configured. No existing catalogue or uploads were changed.\n";
