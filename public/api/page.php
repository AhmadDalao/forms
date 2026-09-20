<?php
declare(strict_types=1);
require_once __DIR__.'/form-access.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
try{
    $root=rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])),'/').'/';
    $route=$_GET['route']??'';
    if(!in_array($route,['','individuals','companies'],true))formAccessError('page_unavailable',404);
    $identity=formAccessIdentity();$lang=($_GET['lang']??'')==='ar'?'ar':'en';
    $redirect=function(string $target)use($root):never{header('Location: '.$root.$target, true,302);exit;};
    if(!$identity)$redirect('login/?lang='.$lang);
    if(!empty($identity['reset_required']))$redirect('my-applications/?lang='.$lang);
    $folder=$identity['role']==='client'?($identity['account_type']==='corporate'?'companies':'individuals'):'management';
    if($route===''||($identity['role']==='client'&&$route!==$folder))$redirect($folder.'/?lang='.$lang);
    $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
    if(!str_ends_with($path,'/')){
        $query=$_GET;unset($query['route']);
        $redirect($route.'/'.($query?'?'.http_build_query($query):''));
    }
    header('Content-Type: text/html; charset=utf-8');readfile(__DIR__.'/../'.$route.'/index.html');
}catch(Throwable $error){error_log('Page access: '.$error->getMessage());formAccessError('server_error',500);}
