<?php
// Local production-build preview only. Production uses Apache's .htaccess.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(preg_match('~(?:^|/)[._]~',rawurldecode($path))){http_response_code(404);exit;}
$root=realpath(__DIR__.'/../dist');$target=realpath($root.$path);
if($target===false||($target!==$root&&!str_starts_with($target,$root.'/'))){http_response_code(404);exit;}
if(is_dir($target)){if(!str_ends_with($path,'/')){header('Location: '.$path.'/');exit;}readfile($target.'/index.html');return true;}
return false;
