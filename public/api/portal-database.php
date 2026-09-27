<?php
declare(strict_types=1);
require_once __DIR__.'/portal-versions.php';
require_once __DIR__.'/portal-account-types.php';
require_once __DIR__.'/portal-reviews.php';
require_once __DIR__.'/portal-shared.php';

function execute(string $sql,array $params=[]): PDOStatement {global $db;$s=$db->prepare($sql);$s->execute($params);return $s;}

function initializePortalDatabase(string $dataDir): PDO {
    global $db;
    umask(0077);
    if(!is_dir($dataDir)&&!mkdir($dataDir,0700,true))throw new RuntimeException('storage_unavailable');
    if(!is_dir($dataDir.'/pdfs'))mkdir($dataDir.'/pdfs',0700,true);
    $db=new PDO('sqlite:'.$dataDir.'/clients.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    $db->exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,email TEXT NOT NULL DEFAULT "",password TEXT NOT NULL,created_at TEXT NOT NULL,last_login TEXT,session_version INTEGER NOT NULL DEFAULT 1,reset_required INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),doc_id TEXT NOT NULL,title TEXT NOT NULL,ar TEXT NOT NULL,audience TEXT NOT NULL,created_at TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,answers TEXT NOT NULL,profile TEXT NOT NULL,request_key TEXT NOT NULL,UNIQUE(user_id,request_key));
      CREATE INDEX IF NOT EXISTS submissions_user ON submissions(user_id);
      CREATE TABLE IF NOT EXISTS rates(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,client_id TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL);');
    migrateVersions();
    migrateAccountTypes();
    migrateReviews();
    migrateWorkflow();
    migrateSharedProfiles();
    migrateDirectIntake();
    chmod($dataDir.'/clients.sqlite',0600);
    return $db;
}
