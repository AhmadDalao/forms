// Isolated API regression; run after npm run build. No production accounts/data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture(),contexts=[],report={date:new Date().toISOString().slice(0,10),scope:'Isolated synthetic accounts and private storage; no production changes',checks:[],passed:false,build_sha256:{}};
const context=async()=>{const value={request:await request.newContext()};contexts.push(value);return value;};
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
const php=(code,...args)=>JSON.parse(execFileSync('php',['-r',code,...args],{encoding:'utf8'}));
const databaseSummary=file=>php(`
 $db=new PDO('sqlite:'.$argv[1],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $schema=$db->query("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name")->fetchAll();$rows=[];$counts=[];
 foreach($db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN) as $name){
  $quoted='"'.str_replace('"','""',$name).'"';$items=$db->query('SELECT * FROM '.$quoted)->fetchAll();
  usort($items,fn($a,$b)=>strcmp(json_encode($a),json_encode($b)));$rows[$name]=$items;$counts[$name]=count($items);
 }
 echo json_encode(['schema_version'=>(int)$db->query('PRAGMA user_version')->fetchColumn(),'integrity'=>$db->query('PRAGMA integrity_check')->fetchColumn(),
  'foreign_keys'=>$db->query('PRAGMA foreign_key_check')->fetchAll(),'counts'=>$counts,'logical_sha256'=>hash('sha256',json_encode([$schema,$rows])),
  'archived_versions'=>(int)$db->query('SELECT COUNT(*) FROM submissions WHERE archived_at IS NOT NULL')->fetchColumn()]);`,file);
try{
 for(const name of ['management.php','portal.php','website-settings.php','national-address.json']){
  const built=await fs.readFile(f.out+'/site/api/'+name);assert.equal(digest(built),digest(await fs.readFile('public/api/'+name)),'Audit build matches current backend '+name);
  report.build_sha256['api/'+name]=digest(built);
 }
 const guest=await context(),owner=await context(),otherOwner=await context(),admin=await context(),client=await context();
 const publicSession=await f.call(guest,'management','session'),initialAddress=publicSession.website.national_address;
 assert.deepEqual(Object.keys(publicSession.website),['national_address']);assert.equal(initialAddress.split('\n').length,3);
 assert.deepEqual((await f.call(guest,'portal','session')).website,{national_address:initialAddress});
 await f.login(owner,'superadmin');await f.login(otherOwner,'superadmin');await f.login(admin,'admin');const user=await f.client(client,'individual');
 await f.call(guest,'management','website_settings',{status:401});
 await f.call(client,'management','website_settings',{status:401});
 for(const ctx of [admin]){
  assert.equal((await f.call(ctx,'management','website_settings',{status:403})).error,'website_settings_forbidden');
  assert.equal((await f.call(ctx,'management','website_settings_save',{data:{national_address:'Forbidden',revision:0},status:403})).error,'website_settings_forbidden');
 }
 await f.call(owner,'management','website_settings_save',{status:405});
 await f.call(owner,'management','website_settings',{data:{},status:405});
 await f.call(owner,'management','website_settings_save',{data:{national_address:'CSRF forbidden',revision:0},headers:{'X-CSRF-Token':'wrong'},status:403});
 pass('Guest/client/admin cannot edit; only server-authenticated superadmin can read private settings; writes enforce POST and CSRF');

 const initial=(await f.call(owner,'management','website_settings')).website;
 assert.deepEqual(initial,{national_address:initialAddress,revision:0,updated_at:null,updated_by:null});
 const catalogue=await f.call(owner,'management','state'),workflow=(await f.call(owner,'portal','admin_workflow')).workflow;
 const template=await fs.readFile(f.out+'/site/pdfs/kyc-individual.pdf'),hash=digest(template);
 const saved=(await f.call(owner,'management','website_settings_save',{data:{national_address:'  شارع الاختبار  \r\n\r\n  Jeddah QA  ',revision:0}})).website;
 assert.equal(saved.national_address,'شارع الاختبار\nJeddah QA');assert.equal(saved.revision,1);assert.equal(saved.updated_by,'superadmin');assert.ok(saved.updated_at);
 const state=JSON.parse(await fs.readFile(f.out+'/management/state.json','utf8'));
 assert.deepEqual(state,{...catalogue,website:saved});
 for(const area of ['management','portal'])assert.deepEqual((await f.call(guest,area,'session')).website,{national_address:saved.national_address});
 assert.deepEqual((await f.call(client,'portal','session')).website,{national_address:saved.national_address});
 assert.deepEqual((await f.call(owner,'portal','admin_workflow')).workflow,workflow);
 assert.equal(digest(await fs.readFile(f.out+'/site/pdfs/kyc-individual.pdf')),hash);
 pass('First save persists normalized address + revision metadata without changing catalogue, workflow or PDF; public sessions expose address only');

 const stateBytes=await fs.readFile(f.out+'/management/state.json');
 assert.deepEqual((await f.call(owner,'management','website_settings_save',{data:{national_address:saved.national_address,revision:0}})).website,saved);
 assert.deepEqual(await fs.readFile(f.out+'/management/state.json'),stateBytes);
 assert.equal((await f.call(otherOwner,'management','website_settings_save',{data:{national_address:'Stale address',revision:0},status:409})).error,'website_settings_conflict');
 for(const data of [{national_address:' ',revision:1},{national_address:'x'.repeat(1001),revision:1},{national_address:Array(9).fill('Line').join('\n'),revision:1},{national_address:'Valid address',revision:'1'}])assert.equal((await f.call(owner,'management','website_settings_save',{data,status:400})).error,'website_address_invalid');
 assert.deepEqual(await fs.readFile(f.out+'/management/state.json'),stateBytes);
 pass('Lost-response retry is a byte-preserving no-op; stale competing save and malformed input cannot overwrite settings');

 // A separate catalogue save must retain website metadata and its own revision.
 const changed=await f.call(owner,'management','save',{data:{revision:catalogue.revision,draft:catalogue.draft}});
 assert.equal(changed.revision,catalogue.revision+1);assert.deepEqual(changed.website,saved);
 const next=(await f.call(owner,'management','website_settings_save',{data:{national_address:'Second address',revision:1}})).website;
 assert.equal(next.revision,2);assert.equal((await f.call(owner,'management','state')).revision,changed.revision);
 await f.stop();await f.start();
 assert.deepEqual((await f.call(owner,'management','website_settings')).website,next);
 assert.deepEqual((await f.call(guest,'portal','session')).website,{national_address:'Second address'});
 pass('Website and catalogue revisions remain independent across both save paths and server restart');

 // Exercise the real private migration tools with live and archived records.
 await f.call(client,'portal','shared_profile_save',{data:{account:user.id,audience:'individual',expectedRevision:0,changes:{city:'Synthetic QA city'}}});
 const first=await f.submit(client,user,{workflowRevision:workflow.revision});
 await f.submit(client,user,{workflowRevision:workflow.revision,expectedCurrent:first.id});
 const beforeBackup=await fs.readFile(f.out+'/management/state.json'),beforeDatabase=databaseSummary(f.out+'/portal/clients.sqlite');
 assert.equal(beforeDatabase.counts.users,1);assert.equal(beforeDatabase.counts.submissions,2);assert.equal(beforeDatabase.counts.client_shared_profiles,1);assert.equal(beforeDatabase.archived_versions,1);
 const archive=f.out+'/private-migration.zip',restored=f.out+'/restored-private';
 execFileSync('php',['scripts/backup-installation.php',f.out+'/management',f.out+'/portal',archive],{encoding:'utf8'});
 execFileSync('php',['scripts/restore-installation.php',archive,restored],{encoding:'utf8'});
 const restoredState=await fs.readFile(restored+'/management/state.json');
 assert.deepEqual(restoredState,beforeBackup,'Restored state.json must be byte-identical');
 const restoredWebsite=php('require $argv[1];echo json_encode(websiteSettings($argv[2]));',f.out+'/site/api/website-settings.php',restored+'/management');
 assert.deepEqual(restoredWebsite,next,'Restored helper must return identical website metadata');
 const restoredDatabase=databaseSummary(restored+'/portal/clients.sqlite');
 assert.deepEqual(restoredDatabase,beforeDatabase,'Every database table and schema must survive backup/restore');
 assert.equal(restoredDatabase.integrity,'ok');assert.deepEqual(restoredDatabase.foreign_keys,[]);
 const restoredWorkflow=php('require $argv[1];$db=new PDO("sqlite:".$argv[2],null,null,[PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);function execute($sql,$params=[]){global $db;$statement=$db->prepare($sql);$statement->execute($params);return $statement;}echo json_encode(workflowDetails());',f.out+'/site/api/portal-workflow.php',restored+'/portal/clients.sqlite');
 assert.deepEqual(restoredWorkflow.workflow,workflow);
 for(const name of await fs.readdir(f.out+'/portal/pdfs'))assert.deepEqual(await fs.readFile(restored+'/portal/pdfs/'+name),await fs.readFile(f.out+'/portal/pdfs/'+name));
 assert.deepEqual(await fs.readFile(f.out+'/management/state.json'),beforeBackup,'Backup leaves source state intact');
 assert.deepEqual(databaseSummary(f.out+'/portal/clients.sqlite'),beforeDatabase,'Backup leaves source database logically intact');
 report.backup_restore={passed:true,backup_command:'php scripts/backup-installation.php MANAGEMENT_DIRECTORY PORTAL_DIRECTORY DESTINATION.zip',restore_command:'php scripts/restore-installation.php PRIVATE-MIGRATION.zip NEW_PRIVATE_DIRECTORY',state_sha256:digest(beforeBackup),restored_state_sha256:digest(restoredState),state_byte_equal:true,website_metadata_equal:true,website_revision:next.revision,database:restoredDatabase,workflow_settings_equal:true,submission_pdf_files_equal:2,source_state_unchanged:true,source_database_unchanged:true,private_paths_and_records_omitted:true};
 for(const name of ['scripts/backup-installation.php','scripts/restore-installation.php','public/api/installation-backup.php'])report.build_sha256[name]=digest(await fs.readFile(name));
 pass('Real private backup and restore preserve state bytes, website metadata, all database tables, workflow, shared profile, current/archived submissions and both PDF files');
 report.passed=true;
}finally{
 await fs.writeFile(f.out+'/website-settings-api-report.json',JSON.stringify(report,null,2)+'\n');
 if(report.passed&&process.argv[2]){await fs.mkdir(path.dirname(process.argv[2]),{recursive:true});await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');}
 for(const ctx of contexts)await ctx.request.dispose();await f.close();
 console.log('REPORT '+f.out+'/website-settings-api-report.json');
}
