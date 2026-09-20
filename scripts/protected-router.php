<?php
// Match the production access rewrites in isolated PHP preview/audit servers.
// Set $root to the built site directory before including this router.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(preg_match('~(?:^|/)[._]~',$path)||preg_match('~^/api/(?:defaults|portal-defaults|client-profile-defaults)\.json$~',$path)){http_response_code(404);return true;}
if(preg_match('~^/preview-20260919(?:/(.*))?$~',$path,$match)){header('Location: https://forms.ahmaddalao.com/'.($match[1]??''),true,302);return true;}
$entry=null;
if(preg_match('~^/(?:index\.html)?$~',$path)){$entry='page';$_GET['route']='';}
elseif(preg_match('~^/(individuals|companies)(?:/index\.html|/)?$~',$path,$match)){$entry='page';$_GET['route']=$match[1];}
elseif(preg_match('~^/pdfs/([a-z][a-z0-9-]+)\.pdf$~',$path,$match)){$entry='template';$_GET['id']=$match[1];}
if($entry){$_SERVER['SCRIPT_NAME']='/api/'.$entry.'.php';require $root.'/api/'.$entry.'.php';return true;}
$target=realpath($root.$path);
if($target===false||($target!==$root&&!str_starts_with($target,$root.'/'))){http_response_code(404);return true;}
if(is_dir($target)){if(!str_ends_with($path,'/')){header('Location: '.$path.'/');return true;}readfile($target.'/index.html');return true;}
return false;
