<?php
declare(strict_types=1);
function sessionScope(string $name,?string $script=null): array {
    $path=rtrim(dirname(dirname($script??$_SERVER['SCRIPT_NAME']??'/api/index.php')),'/').'/';
    if(in_array($path,['/','/forms/'],true))return ['name'=>$name,'path'=>'/'];
    return ['name'=>$name.'_'.substr(hash('sha256',$path),0,12),'path'=>$path];
}
