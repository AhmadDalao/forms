<?php
declare(strict_types=1);
require_once __DIR__.'/portal-details.php';

// Shared working data is separate from every immutable submitted snapshot.
function migrateSharedProfiles(): void {
    global $db;
    if((int)$db->query('PRAGMA user_version')->fetchColumn()>=6)return;
    $db->exec('BEGIN IMMEDIATE');
    try{
        $version=(int)$db->query('PRAGMA user_version')->fetchColumn();
        if($version<5)throw new LogicException('Workflow migration must run before shared profile migration');
        if($version<6)$db->exec("CREATE TABLE client_shared_profiles(
            user_id TEXT NOT NULL REFERENCES users(id),
            audience TEXT NOT NULL CHECK(audience IN ('individual','corporate')),
            profile TEXT NOT NULL CHECK(json_valid(profile) AND json_type(profile)='object'),
            revision INTEGER NOT NULL CHECK(revision>0),updated_at TEXT NOT NULL,
            PRIMARY KEY(user_id,audience)); PRAGMA user_version=6;");
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

function sharedProfileAudience(string $account,string $audience): void {
    if(!in_array($audience,['individual','corporate'],true))throw new DomainException('invalid_request');
    $type=execute('SELECT account_type FROM users WHERE id=?',[$account])->fetchColumn();
    if($type===false)throw new DomainException('account_changed');
    if($type!==$audience)throw new DomainException('account_type_restricted');
}

function sharedProfileView(?array $row): array {
    return ['profile'=>(object)($row?json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR):[]),
        'revision'=>$row?(int)$row['revision']:0,'updated_at'=>$row['updated_at']??null];
}

function clientSharedProfile(string $account,string $audience): array {
    global $db;$db->beginTransaction();
    try{
        sharedProfileAudience($account,$audience);
        $row=execute('SELECT profile,revision,updated_at FROM client_shared_profiles WHERE user_id=? AND audience=?',[$account,$audience])->fetch();
        $result=sharedProfileView($row?:null);$db->commit();return $result;
    }catch(Throwable $e){$db->rollBack();throw $e;}
}

function adminSharedProfiles(string $account): array {
    return array_map(fn($row)=>['audience'=>$row['audience']]+sharedProfileView($row),execute('SELECT audience,profile,revision,updated_at FROM client_shared_profiles WHERE user_id=? ORDER BY audience',[$account])->fetchAll());
}

function sharedProfilePatch(string $audience,mixed $changes,?array $schemas=null): array {
    if(!is_array($changes)||count($changes)>100||($changes!==[]&&array_is_list($changes)))throw new DomainException('invalid_request');
    $fields=array_column(sharedFieldDefinitions($audience,$schemas),null,'id');$patch=[];
    foreach($changes as $id=>$value){
        if(!is_string($id)||!isset($fields[$id]))throw new DomainException('invalid_request');
        if($value===null){$patch[$id]=null;continue;}
        $field=$fields[$id];
        if(($field['type']??'')==='checkbox'){
            if(!is_bool($value))throw new DomainException('invalid_request');
        }else{
            if(!is_string($value)||!mb_check_encoding($value,'UTF-8')||mb_strlen($value)>2000||preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u',$value)||str_starts_with(ltrim($value),'data:image/'))throw new DomainException('invalid_request');
            if($value!==''&&!empty($field['options'])&&!in_array($value,array_column($field['options'],0),true))throw new DomainException('invalid_request');
            // Autosave accepts incomplete email/date text while the client types.
            // Sending a finished form still runs the existing answer validation.
        }
        $patch[$id]=$value;
    }
    return $patch;
}

function canonicalSharedProfile(string $audience,array $profile,array $patch): array {
    if($audience==='individual')foreach(['en','ar'] as $lang){
        unset($profile[$lang.'_middle']);
        $middle=implode(' ',array_filter(array_map('trim',[$profile[$lang.'_second']??'',$profile[$lang.'_third']??'']),fn($v)=>$v!==''));
        if($middle!=='')$profile[$lang.'_middle']=$middle;
    }
    if($audience==='corporate'){
        $keys=['auth_first','auth_second','auth_third','auth_last'];
        if(array_intersect($keys,array_keys($profile)))$profile['auth_name']=implode(' ',array_filter(array_map(fn($key)=>trim($profile[$key]??''),$keys),fn($v)=>$v!==''));
        elseif(array_intersect($keys,array_keys($patch)))unset($profile['auth_name']);
        elseif(!empty($profile['auth_name'])){
            $words=preg_split('/\s+/u',trim($profile['auth_name']),-1,PREG_SPLIT_NO_EMPTY);$count=count($words);
            $parts=$count<2?[$words[0]??'','','','']:($count===2?[$words[0],'','',$words[1]]:($count===3?[$words[0],$words[1],'',$words[2]]:[$words[0],$words[1],$words[2],implode(' ',array_slice($words,3))]));
            $profile=array_merge($profile,array_combine($keys,$parts));
            $profile['auth_name']=implode(' ',array_filter($parts,fn($v)=>$v!==''));
        }
    }
    foreach($profile as $value)if(is_string($value)&&mb_strlen($value)>2000)throw new DomainException('invalid_request');
    return $profile;
}

function saveSharedProfile(string $account,string $audience,int $expected,mixed $changes,?array $schemas=null): array {
    global $db;
    if($expected<0)throw new DomainException('invalid_request');
    $patch=sharedProfilePatch($audience,$changes,$schemas);
    $db->exec('BEGIN IMMEDIATE');
    try{
        // A management audience change can race a queued client autosave.
        sharedProfileAudience($account,$audience);
        $old=execute('SELECT profile,revision,updated_at FROM client_shared_profiles WHERE user_id=? AND audience=?',[$account,$audience])->fetch();
        if((int)($old['revision']??0)!==$expected)throw new DomainException('shared_profile_conflict');
        $profile=$old?json_decode($old['profile'],true,512,JSON_THROW_ON_ERROR):[];
        foreach($patch as $id=>$value){if($value===null)unset($profile[$id]);else $profile[$id]=$value;}
        $profile=canonicalSharedProfile($audience,$profile,$patch);
        $row=['profile'=>json_encode((object)$profile,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'revision'=>$expected+1,'updated_at'=>gmdate('Y-m-d\TH:i:s\Z')];
        // Keep empty rows: their revision records that a client deliberately cleared data.
        execute('INSERT INTO client_shared_profiles(user_id,audience,profile,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,audience) DO UPDATE SET profile=excluded.profile,revision=excluded.revision,updated_at=excluded.updated_at',[$account,$audience,$row['profile'],$row['revision'],$row['updated_at']]);
        $result=sharedProfileView($row);$db->exec('COMMIT');return $result;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
