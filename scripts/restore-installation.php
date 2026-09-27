<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(count($argv)!==3){fwrite(STDERR,"Usage: php scripts/restore-installation.php PRIVATE-MIGRATION.zip NEW_PRIVATE_DIRECTORY\nDestination must not exist. Never run this over a live database.\n");exit(1);}
umask(0077);$zip=new ZipArchive();$destination=$argv[2];$created=false;$opened=false;
try{
    if(file_exists($destination))throw new RuntimeException('Destination already exists. Use a new private directory.');
    if($zip->open($argv[1])!==true)throw new RuntimeException('Cannot open migration archive.');
    $opened=true;
    $manifest=json_decode($zip->getFromName('manifest.json')?:'',true,512,JSON_THROW_ON_ERROR);
    if(($manifest['format']??null)!==1||!is_array($manifest['files']??null))throw new RuntimeException('Unsupported backup format.');
    $entries=[];
    foreach($manifest['files'] as $file){
        $name=$file['path']??'';
        if(!preg_match('~^private/(portal/(clients\.sqlite|pdfs/[a-f0-9]{32}\.pdf)|management/(state\.json|administrators\.sqlite|(?:superadmin-)?(?:username|password)\.php|uploads/upload_[a-f0-9]{24}\.pdf))$~D',$name)||isset($entries[$name]))throw new RuntimeException('Invalid backup entry.');
        $entries[$name]=$file;
    }
    if(!isset($entries['private/portal/clients.sqlite']))throw new RuntimeException('Backup database missing.');
    // Validate each byte before making the destination usable; do not extract paths supplied by ZIP.
    if(!mkdir($destination,0700,true))throw new RuntimeException('Cannot create destination.');$created=true;
    foreach($entries as $name=>$file){
        $stream=$zip->getStream($name);if(!$stream)throw new RuntimeException('Missing archive entry.');
        $path=$destination.'/'.substr($name,8);if(!is_dir(dirname($path)))mkdir(dirname($path),0700,true);
        $out=fopen($path,'xb');if(!$out)throw new RuntimeException('Cannot write restored file.');stream_copy_to_stream($stream,$out);fclose($out);fclose($stream);
        if(filesize($path)!==$file['size']||!hash_equals($file['sha256'],hash_file('sha256',$path)))throw new RuntimeException('Backup checksum failed.');
        chmod($path,0600);
    }
    foreach(['portal/pdfs','management/uploads'] as $folder)if(!is_dir($destination.'/'.$folder))mkdir($destination.'/'.$folder,0700,true);
    $db=new PDO('sqlite:'.$destination.'/portal/clients.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    if($db->query('PRAGMA integrity_check')->fetchColumn()!=='ok'||$db->query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Restored database integrity check failed.');
    foreach(['users','submissions','client_shared_profiles'] as $table)if((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn()!==($manifest['counts'][$table]??-1))throw new RuntimeException('Restored row counts do not match.');
    if((int)$db->query('SELECT COUNT(*) FROM submissions WHERE archived_at IS NOT NULL')->fetchColumn()!==($manifest['counts']['archived_versions']??-1))throw new RuntimeException('Restored archive count does not match.');
    if((int)$db->query('PRAGMA user_version')->fetchColumn()!==($manifest['schema_version']??-1))throw new RuntimeException('Restored schema version does not match.');
    if(is_file($destination.'/management/administrators.sqlite')){
        $admins=new PDO('sqlite:'.$destination.'/management/administrators.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        if($admins->query('PRAGMA integrity_check')->fetchColumn()!=='ok'||$admins->query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Restored admin database integrity check failed.');
    }
    foreach($db->query('SELECT id,sha256,size FROM submissions') as $row){
        if(!preg_match('/^[a-f0-9]{32}$/D',$row['id']))throw new RuntimeException('Invalid submission ID.');
        $path=$destination.'/portal/pdfs/'.$row['id'].'.pdf';
        if(!is_file($path)||filesize($path)!==(int)$row['size']||!hash_equals($row['sha256'],hash_file('sha256',$path)))throw new RuntimeException('A restored PDF failed verification.');
    }
    echo "Restore verified. Configure the web server to use the new private directory. Existing accounts and all versions are preserved.\n";
}catch(Throwable $error){
    if($created){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($destination,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $entry){$entry->isDir()?rmdir($entry->getPathname()):unlink($entry->getPathname());}rmdir($destination);}
    fwrite(STDERR,$error->getMessage()."\n");exit(1);
}finally{if($opened)$zip->close();}
