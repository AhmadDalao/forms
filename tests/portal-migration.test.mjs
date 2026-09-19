import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('legacy submissions migrate into audience-specific histories without changing snapshots',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'portal-migration-'));
 try{
  const result=spawnSync('php',['-r',`
   require $argv[1];
   $db=new PDO('sqlite:'.$argv[2],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
   function execute($sql,$args=[]){global $db;$s=$db->prepare($sql);$s->execute($args);return $s;}
   $db->exec('CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT,doc_id TEXT,audience TEXT,created_at TEXT,answers TEXT,profile TEXT,sha256 TEXT)');
   foreach([['old','a','individual'],['other-folder','a','corporate'],['latest','a','individual'],['other-client','b','individual']] as $row)
    execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?)',[$row[0],$row[1],'signature-form',$row[2],'2026-09-19T12:00:00Z','{"client_name":"Saved data"}','{"submission_source":"upload"}','unaltered-pdf-hash']);
   migrateVersions();migrateVersions();
   $rows=execute('SELECT * FROM submissions ORDER BY rowid')->fetchAll();
   $duplicateBlocked=false;try{execute('INSERT INTO submissions(id,user_id,doc_id,audience,version) VALUES(?,?,?,?,?)',['illegal','a','signature-form','individual',3]);}catch(PDOException){$duplicateBlocked=true;}
   echo json_encode(['rows'=>$rows,'duplicateBlocked'=>$duplicateBlocked,'schema'=>$db->query('PRAGMA user_version')->fetchColumn()]);
  `,path.resolve('public/api/portal-versions.php'),dir+'/clients.sqlite'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const {rows,duplicateBlocked,schema}=JSON.parse(result.stdout);
  assert.equal(schema,1);assert.equal(rows.length,4);assert.equal(duplicateBlocked,true);
  assert.equal(rows[0].archived_at,'2026-09-19T12:00:00Z');assert.equal(rows[0].version,1);
  assert.equal(rows[2].replaces_id,'old');assert.equal(rows[2].version,2);assert.equal(rows[2].archived_at,null);
  for(const i of [1,3]){assert.equal(rows[i].version,1);assert.equal(rows[i].archived_at,null);}
  for(const s of rows){assert.equal(s.answers,'{"client_name":"Saved data"}');assert.equal(s.sha256,'unaltered-pdf-hash');assert.equal(s.signatures,null);assert.equal(s.source,'upload');}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
