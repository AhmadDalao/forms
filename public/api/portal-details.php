<?php
declare(strict_types=1);
// Capture server-owned labels beside each immutable answer snapshot. Client
// metadata never defines fields, labels, sections or another audience's values.
function sharedFieldDefinitions(string $audience,?array $schemas=null): array {
    $schemas??=json_decode(file_get_contents(__DIR__.'/client-profile-defaults.json'),true,512,JSON_THROW_ON_ERROR);
    return $schemas[$audience]??[];
}

function cleanSharedSnapshot(string $audience,mixed $input,array $definitions): array {
    if(!is_array($input))reject('invalid_request');
    // Older drafts store their middle names together. Keep edit compatibility
    // through the current second-name field, without inventing a new question.
    if($audience==='individual')foreach(['en','ar'] as $language){
        if(!array_key_exists($language.'_second',$input)&&array_key_exists($language.'_middle',$input))$input[$language.'_second']=$input[$language.'_middle'];
    }
    $values=[];
    foreach($definitions as $field){
        $id=$field['id'];if(!array_key_exists($id,$input))continue;
        $value=$input[$id];
        if($field['type']==='checkbox'){
            if(!is_bool($value))reject('invalid_request');
            $values[$id]=$value;continue;
        }
        $value=textValue($value);
        if($value!==''&&!empty($field['options'])&&!in_array($value,array_column($field['options'],0),true))reject('invalid_request');
        $values[$id]=$value;
    }
    // These existing derived aliases are consumed by shared-name propagation.
    if($audience==='individual')foreach(['en','ar'] as $language){
        if(array_key_exists($language.'_second',$values)||array_key_exists($language.'_third',$values)){
            $values[$language.'_middle']=implode(' ',array_filter([$values[$language.'_second']??'',$values[$language.'_third']??''],fn($value)=>$value!==''));
        }
    }
    // Keep this pre-existing submission value when an old version is edited.
    // It is not a new shared question and never supplies trusted field labels.
    if(array_key_exists('full_name',$input))$values['full_name']=textValue($input['full_name']);
    return $values;
}

function documentFieldDefinitions(array $doc): array {
    return array_map(function($field){
        $result=array_intersect_key($field,array_flip(['id','label','ar','type','hidden','uiOnly','joinAudience']));
        if(isset($field['options']))$result['options']=array_map(fn($option)=>array_intersect_key($option,array_flip(['value','label','ar'])),$field['options']);
        if(isset($field['selectOptions']))$result['selectOptions']=array_map(fn($option)=>array_slice($option,0,3),$field['selectOptions']);
        return $result;
    },$doc['fields']??[]);
}

function documentSectionDefinitions(array $doc): array {
    $fields=$doc['fields']??[];$allowed=array_column($fields,'id');$sections=[];
    if(isset($doc['sections']))foreach($doc['sections'] as $section){
        $ids=$section['field_ids']??array_column($section['fields']??[],'id');
        $sections[]=['id'=>$section['id'],'title'=>$section['title'],'ar'=>$section['ar'],'field_ids'=>array_values(array_intersect($ids,$allowed))];
    }
    else{
        // Uploaded documents use the same page-based sections as the web editor.
        $signatures=$doc['signatureSlots']??$doc['signatures']??[];
        for($page=1;$page<=($doc['pages']??0);$page++){
            $ids=array_column(array_filter($fields,fn($field)=>($field['page']??null)===$page),'id');
            if($ids||array_filter($signatures,fn($slot)=>($slot['page']??null)===$page))$sections[]=['id'=>'page_'.$page,'title'=>'Page '.$page,'ar'=>'الصفحة '.$page,'field_ids'=>array_values($ids)];
        }
    }
    return $sections;
}

function documentSignatureDefinitions(array $doc): array {
    return array_map(fn($slot)=>array_intersect_key($slot,array_flip(['id','label','ar'])),$doc['signatureSlots']??$doc['signatures']??[]);
}

function submissionProfileSnapshot(array $doc,string $audience,mixed $input,string $source,?array $schemas=null): array {
    $shared=sharedFieldDefinitions($audience,$schemas);
    return [...cleanSharedSnapshot($audience,$source==='upload'?[]:$input,$shared),
        'submission_source'=>$source,'submission_schema'=>2,
        'field_definitions'=>documentFieldDefinitions($doc),'section_definitions'=>documentSectionDefinitions($doc),
        'shared_field_definitions'=>$shared,'signature_definitions'=>documentSignatureDefinitions($doc),
        'signature_submission_policy'=>['workflow'=>$doc['workflow']??null,'signatureSlots'=>array_map(fn($slot)=>array_intersect_key($slot,array_flip(['id','requiredForSubmission','requireWhenFields'])),$doc['signatureSlots']??$doc['signatures']??[])]];
}

function submissionProfileDetails(array $profile,?array $doc,string $audience,?array $schemas=null): array {
    // Read-only fallback for old versions: never rewrite their stored snapshot.
    $fallback=[];
    foreach(['field_definitions'=>'documentFieldDefinitions','section_definitions'=>'documentSectionDefinitions','signature_definitions'=>'documentSignatureDefinitions'] as $key=>$function){
        if(!array_key_exists($key,$profile)&&$doc!==null){$profile[$key]=$function($doc);$fallback[]=$key;}
    }
    if(!array_key_exists('shared_field_definitions',$profile)){$profile['shared_field_definitions']=sharedFieldDefinitions($audience,$schemas);$fallback[]='shared_field_definitions';}
    if($fallback)$profile['definition_fallback']=$fallback;
    return $profile;
}
