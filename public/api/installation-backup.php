<?php
declare(strict_types=1);

// Called only by the superadmin endpoint or the local CLI. Temporary files stay
// in private storage. SQLite snapshots use VACUUM INTO, never a raw live-file copy.
function installationBackup(string $management,string $portal,string $destination): array {
    umask(0077);
    if(file_exists($destination))throw new RuntimeException('Backup destination already exists.');
    if(!is_file($portal.'/clients.sqlite'))throw new RuntimeException('Client database is missing.');
    $temp=$portal.'/backup-'.bin2hex(random_bytes(16));
    if(!mkdir($temp,0700))throw new RuntimeException('Could not create backup workspace.');
    $lock=null;$zip=null;$finished=false;
    try{
        $lock=fopen($management.'/state.lock','c+');
        if(!$lock||!flock($lock,LOCK_SH))throw new RuntimeException('Catalogue is busy. Try again.');
        $zip=new ZipArchive();
        if($zip->open($destination,ZipArchive::CREATE|ZipArchive::EXCL)!==true)throw new RuntimeException('Could not create backup archive.');
        $manifest=['format'=>1,'created_at'=>gmdate('Y-m-d\TH:i:s\Z'),'files'=>[],'counts'=>[]];
        $add=function(string $source,string $name)use($zip,&$manifest):void{
            if(!is_file($source)||is_link($source))throw new RuntimeException('A required backup file is missing or unsafe.');
            if(!$zip->addFile($source,$name))throw new RuntimeException('Could not add backup file.');
            $manifest['files'][]=['path'=>$name,'size'=>filesize($source),'sha256'=>hash_file('sha256',$source)];
        };
        $snapshot=function(string $source,string $name)use($temp):PDO{
            $live=new PDO('sqlite:'.$source,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $live->exec('PRAGMA busy_timeout=5000');$live->exec('VACUUM INTO '.$live->quote($temp.'/'.$name));
            $copy=new PDO('sqlite:'.$temp.'/'.$name,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
            if($copy->query('PRAGMA integrity_check')->fetchColumn()!=='ok'||$copy->query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Database integrity check failed.');
            return $copy;
        };
        $db=$snapshot($portal.'/clients.sqlite','clients.sqlite');
        foreach(['users','submissions','client_shared_profiles'] as $table)$manifest['counts'][$table]=(int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn();
        $manifest['counts']['archived_versions']=(int)$db->query('SELECT COUNT(*) FROM submissions WHERE archived_at IS NOT NULL')->fetchColumn();
        $manifest['schema_version']=(int)$db->query('PRAGMA user_version')->fetchColumn();
        $add($temp.'/clients.sqlite','private/portal/clients.sqlite');
        foreach($db->query('SELECT id,sha256,size FROM submissions') as $row){
            if(!preg_match('/^[a-f0-9]{32}$/D',$row['id']))throw new RuntimeException('Invalid stored submission ID.');
            $path=$portal.'/pdfs/'.$row['id'].'.pdf';
            if(!is_file($path)||filesize($path)!==(int)$row['size']||!hash_equals($row['sha256'],hash_file('sha256',$path)))throw new RuntimeException('A submission PDF did not match its saved hash.');
            $add($path,'private/portal/pdfs/'.$row['id'].'.pdf');
        }
        if(is_file($management.'/state.json')){
            $raw=file_get_contents($management.'/state.json');json_decode($raw,true,512,JSON_THROW_ON_ERROR);
            file_put_contents($temp.'/state.json',$raw);$add($temp.'/state.json','private/management/state.json');
        }
        foreach(glob($management.'/uploads/*.pdf')?:[] as $path){
            if(!preg_match('/^upload_[a-f0-9]{24}\.pdf$/D',basename($path)))throw new RuntimeException('Unexpected template filename.');
            $add($path,'private/management/uploads/'.basename($path));
        }
        foreach(['username.php','password.php','superadmin-username.php','superadmin-password.php'] as $name)if(is_file($management.'/'.$name)){
            copy($management.'/'.$name,$temp.'/'.$name);$add($temp.'/'.$name,'private/management/'.$name);
        }
        if(is_file($management.'/administrators.sqlite')){
            $snapshot($management.'/administrators.sqlite','administrators.sqlite');$add($temp.'/administrators.sqlite','private/management/administrators.sqlite');
        }
        $zip->addEmptyDir('private/portal/pdfs');$zip->addEmptyDir('private/management/uploads');
        $zip->addFromString('manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        if(!$zip->close())throw new RuntimeException('Could not finish backup archive.');$zip=null;
        chmod($destination,0600);$finished=true;return $manifest;
    }finally{
        if($zip)$zip->close();
        if($lock){flock($lock,LOCK_UN);fclose($lock);}
        foreach(glob($temp.'/*')?:[] as $file)unlink($file);rmdir($temp);
        if(!$finished&&is_file($destination))unlink($destination);
    }
}
