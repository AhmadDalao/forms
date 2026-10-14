<?php
declare(strict_types=1);

// The website footer is independent of PDF templates and catalogue revisions.
function websiteAddress(mixed $value): string {
    if(!is_string($value)||mb_strlen($value)>1000||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u',$value))throw new DomainException('website_address_invalid');
    $lines=array_values(array_filter(array_map(fn($line)=>preg_replace('/^\s+|\s+$/u','',$line),explode("\n",str_replace(["\r\n","\r"],"\n",$value))),fn($line)=>$line!==''));
    if(!$lines||count($lines)>8)throw new DomainException('website_address_invalid');
    return implode("\n",$lines);
}

function websiteSettingsDefault(): array {
    $source=json_decode(file_get_contents(__DIR__.'/national-address.json'),true,32,JSON_THROW_ON_ERROR);
    $parts=explode(' | ',$source['text']);
    $address=count($parts)===5?$parts[0]."\n".implode(' · ',array_slice($parts,1,2))."\n".implode(' · ',array_slice($parts,3)):$source['text'];
    return ['national_address'=>websiteAddress($address),'revision'=>0,'updated_at'=>null,'updated_by'=>null];
}

function websiteSettingsView(array $state): array {
    if(!array_key_exists('website',$state))return websiteSettingsDefault();
    $value=$state['website'];
    if(!is_array($value)||!is_int($value['revision']??null)||$value['revision']<0||
        !is_string($value['national_address']??null)||websiteAddress($value['national_address'])!==$value['national_address']||
        !(is_string($value['updated_at']??null)||array_key_exists('updated_at',$value)&&$value['updated_at']===null)||
        !(is_string($value['updated_by']??null)||array_key_exists('updated_by',$value)&&$value['updated_by']===null))throw new RuntimeException('Invalid stored website settings.');
    return array_intersect_key($value,array_flip(['national_address','revision','updated_at','updated_by']));
}

function websiteSettingsLocked(string $directory,callable $callback,bool $write=false): array {
    // Public sessions must not provision private storage just to read defaults.
    if(!is_dir($directory)){
        if($write)throw new RuntimeException('Website settings storage is unavailable.');
        $state=[];return $callback($state);
    }
    $lock=fopen($directory.'/state.lock','c+');
    if(!$lock||!flock($lock,$write?LOCK_EX:LOCK_SH))throw new RuntimeException('Website settings storage is unavailable.');
    $temp=null;
    try{
        $file=$directory.'/state.json';
        $state=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR):[];
        if(!is_array($state))throw new RuntimeException('Invalid management state.');
        $original=$state;$result=$callback($state);
        if($write&&$state!==$original){
            if(!$original){
                $base=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR);
                $state=['revision'=>0,'draft'=>$base,'published'=>$base,'history'=>[]]+$state;
            }
            $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
            $temp=$file.'.'.bin2hex(random_bytes(6));
            if(file_put_contents($temp,$json,LOCK_EX)!==strlen($json)||!chmod($temp,0600)||!rename($temp,$file))throw new RuntimeException('Could not save website settings.');
            $temp=null;
        }
        return $result;
    }finally{
        if($temp!==null&&is_file($temp))unlink($temp);
        flock($lock,LOCK_UN);fclose($lock);
    }
}

function websiteSettings(string $directory): array {
    return websiteSettingsLocked($directory,fn($state)=>websiteSettingsView($state));
}

function websitePublicSettings(string $directory): array {
    return ['national_address'=>websiteSettings($directory)['national_address']];
}

function saveWebsiteSettings(string $directory,array $body,string $actor): array {
    $address=websiteAddress($body['national_address']??null);$revision=$body['revision']??null;
    if(!is_int($revision)||$revision<0)throw new DomainException('website_address_invalid');
    return websiteSettingsLocked($directory,function(&$state)use($address,$revision,$actor){
        $current=websiteSettingsView($state);
        // An identical retry after a lost response must not create a revision.
        if($current['national_address']===$address&&$revision<=$current['revision'])return $current;
        if($revision!==$current['revision'])throw new DomainException('website_settings_conflict');
        $state['website']=['national_address'=>$address,'revision'=>$current['revision']+1,'updated_at'=>gmdate('Y-m-d\TH:i:s\Z'),'updated_by'=>$actor];
        return $state['website'];
    },true);
}
