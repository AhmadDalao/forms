<?php
declare(strict_types=1);
// Validate recognized answers and derive full PDF names from their UI parts.
function cleanAnswers(array $def,mixed $input,string $audience): array {
    if(!is_array($input)||count($input)>500)reject('invalid_request');$out=[];
    foreach($def['fields']??[] as $f){
        // Individual-only name parts must not become company customer data.
        if(!empty($f['uiOnly'])&&isset($f['joinAudience'])&&$f['joinAudience']!==$audience)continue;
        $v=$input[$f['id']]??null;if($v===null)continue;
        if(is_array($v)){if(empty($f['multiple'])||count($v)>100)reject('invalid_request');$v=array_map(fn($x)=>textValue($x),$v);}
        else $v=textValue($v);
        if($v!==''&&$v!==[]){
            $allowed=isset($f['selectOptions'])?array_column($f['selectOptions'],0):(isset($f['options'])?array_column($f['options'],'value'):null);
            if($allowed&&array_diff(is_array($v)?$v:[$v],$allowed))reject('invalid_request');
            if(($f['type']??'')==='email'&&!filter_var($v,FILTER_VALIDATE_EMAIL))reject('email_invalid');
            if(($f['type']??'')==='date'&&(!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$v,$parts)||!checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])))reject('invalid_request');
        }
        $out[$f['id']]=$v;
    }
    foreach($def['fields']??[] as $field)if(!empty($field['join'])&&(!isset($field['joinAudience'])||$field['joinAudience']===$audience)&&array_intersect($field['join'],array_keys($out)))$out[$field['id']]=implode(' ',array_filter(array_map(fn($key)=>trim($out[$key]??''),$field['join']),fn($part)=>$part!==''));
    foreach($def['fields']??[] as $field)if(!empty($field['sum'])){
        $parts=array_map(fn($id)=>$out[$id]??'',$field['sum']);
        $out[$field['id']]=count(array_filter($parts,fn($v)=>is_numeric($v)))===count($parts)?(string)array_sum($parts):'';
    }
    if(($def['workflow']??'')==='subscription'){
        foreach($def['fields'] as $field)if(!empty($field['namePart'])&&!empty($out[$field['id']])&&!preg_match('/\p{Arabic}/u',$out[$field['id']]))reject('arabic_name_required',422);
        if(!defined('SUBSCRIPTION_LIBRARY'))define('SUBSCRIPTION_LIBRARY',true);require_once __DIR__.'/subscription/calculate.php';
        try{$calculated=subscription_calculate($out['units']??'');}catch(Throwable){reject('units_invalid',422);}
        if($calculated['units']==='')reject('form_incomplete',422);
        $out=array_merge($out,$calculated);
        foreach($def['fields'] as $f)if(!empty($f['required'])&&(empty($f['when'])||in_array($out[$f['dependsOn']]??'',$f['when'],true))&&empty($out[$f['id']]))reject('form_incomplete',422);
    }
    return $out;
}
