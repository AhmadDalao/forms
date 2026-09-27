import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true});
const report={at:new Date().toISOString(),checks:[],errors:[]};
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const context=async()=>{const c=await browser.newContext();c.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));return c;};
try{
 const owner=await context(),admin=await context(),visitor=await context();await f.login(owner,'superadmin');await f.login(admin,'admin');
 assert.equal((await f.call(owner,'management','session')).permissions.manage_admins,true);
 for(const action of ['admins','admin_create','admin_password','export_backup']){
  await f.call(admin,'management',action,{...(action==='admins'?{}:{data:{}}),status:403});
  await f.call(visitor,'management',action,{status:401});
 }
 await f.call(owner,'management','admin_create',{data:{username:'qa.second',password:'Test123!',confirm:'Test123!'},headers:{'X-CSRF-Token':'invalid'},status:403});
 await f.call(owner,'management','admin_create',{data:{username:'qa.second',password:'short',confirm:'short'},status:400});
 await f.call(owner,'management','admin_create',{data:{username:'qa.second',password:'Test123!',confirm:'different'},status:400});
 for(const username of [' QA.ADMIN ','SUPERADMIN'])await f.call(owner,'management','admin_create',{data:{username,password:'Test123!',confirm:'Test123!'},status:409});
 pass('Account creation/export are superadmin-only; CSRF, minimum length, confirmation and legacy username collisions enforced');

 const page=await owner.newPage();await page.goto(f.base+'/management/?lang=en');await page.locator('[data-admins]').click();await page.locator('[data-create-admin]').click();
 await page.locator('.staff-password-dialog [name=username]').fill('QA.Second');await page.locator('.staff-password-dialog [name=password]').fill('Test123!');await page.locator('.staff-password-dialog [name=confirm]').fill('Test123!');
 await page.locator('.staff-password-dialog [data-eye=password]').click();assert.equal(await page.locator('.staff-password-dialog [name=password]').getAttribute('type'),'text');
 assert.ok(Number(await page.locator('.staff-password-dialog [role=meter]').getAttribute('aria-valuenow'))>0);
 await page.locator('.staff-password-dialog button[type=submit]').click();await page.locator('[data-reset-admin="qa.second"]').waitFor();
 await f.call(owner,'management','admin_create',{data:{username:'qa.second',password:'Test123!',confirm:'Test123!',role:'superadmin'},status:409});
 const created=await context();await f.call(created,'management','session');const login=await f.call(created,'management','login',{data:{username:'QA.SECOND',password:'Test123!'}});
 assert.equal(login.role,'admin');assert.equal(login.permissions.manage_documents,false);assert.equal(login.permissions.manage_admins,false);
 f.tokens.set(created,{...f.tokens.get(created),portal:login.csrf});await f.call(created,'portal','admin_dashboard');await f.call(created,'management','state',{status:403});
 const adminPage=await created.newPage();await adminPage.goto(f.base+'/management/?lang=en');await adminPage.locator('[data-users]').waitFor();assert.equal(await adminPage.locator('[data-admins],[data-documents]').count(),0);
 const listed=await f.call(owner,'management','admins');assert.equal(listed.accounts.length,3);assert.ok(!JSON.stringify(listed).includes('password'));assert.equal(listed.accounts.find(a=>a.username==='qa.second').created_by,'superadmin');
 pass('Superadmin creates an admin through the UI; separate login works without document/account-management privileges or exposed hashes');

 await page.locator('[data-reset-admin="qa.second"]').click();await page.locator('.staff-password-dialog [name=password]').fill('Next123!');await page.locator('.staff-password-dialog [name=confirm]').fill('Next123!');await page.locator('.staff-password-dialog button[type=submit]').click();await page.locator('.staff-password-dialog').waitFor({state:'detached'});
 await f.call(created,'portal','admin_dashboard',{status:401});await f.call(created,'management','session');await f.call(created,'management','login',{data:{username:'qa.second',password:'Test123!'},status:401});await f.call(created,'management','login',{data:{username:'qa.second',password:'Next123!'}});
 await f.call(owner,'management','admin_password',{data:{username:'superadmin',password:'Next123!',confirm:'Next123!'},status:400});
 await f.call(owner,'management','admin_password',{data:{username:'qa.admin',password:'Legacy8!',confirm:'Legacy8!'}});await f.call(admin,'portal','admin_dashboard',{status:401});
 await f.call(admin,'management','session');await f.call(admin,'management','login',{data:{username:'qa.admin',password:'Legacy8!'}});
 pass('Chosen eight-character admin passwords reset both new and legacy accounts and invalidate earlier sessions');

 const client=await context(),user=await f.client(client,'individual');const workflowRevision=(await f.call(client,'portal','session')).workflow.revision;const first=await f.submit(client,user,{workflowRevision});const second=await f.submit(client,user,{workflowRevision,expectedCurrent:first.id,values:{client_name:'New saved version'}});
 await page.locator('[data-users]').click();await page.locator(`[data-client="${user.id}"]`).click();await page.locator('[data-reset]').click();
 await page.locator('.staff-password-dialog [name=password]').fill('Client8!');await page.locator('.staff-password-dialog [name=confirm]').fill('Client8!');await page.locator('.staff-password-dialog button[type=submit]').click();await page.locator('.staff-password-dialog').waitFor({state:'detached'});
 await f.call(client,'portal','submissions',{status:401});await f.call(client,'portal','session');await f.call(client,'portal','login',{data:{phone:user.phone,password:f.credentials.admin.password},status:401});
 await f.call(client,'portal','login',{data:{phone:user.phone,password:'Client8!'}});await f.call(client,'portal','submissions',{status:403});
 await f.call(client,'portal','password',{data:{current:'Client8!',password:'Private8!',confirm:'Private8!'}});
 const saved=await f.call(client,'portal','submissions');assert.equal(saved.submissions.length,2);assert.ok(saved.submissions.find(s=>s.id===first.id).archived_at);assert.equal(saved.submissions.find(s=>s.id===second.id).archived_at,null);
 await f.call(owner,'portal','admin_reset',{data:{id:user.id,password:'short',confirm:'short'},status:400});
 await f.call(owner,'portal','admin_reset',{data:{id:user.id,password:'Valid888',confirm:'notmatch'},status:400});
 pass('Client reset UI accepts a chosen password, revokes sessions, requires a private client change and preserves all submissions');

 for(const lang of ['en','ar']){
  await page.goto(f.base+'/management/');await page.locator('[data-admins]').waitFor();
  if(await page.locator('html').getAttribute('lang')!==lang){await page.locator('[data-admin-language]').click();await page.locator('html[lang='+lang+']').waitFor();}
  await page.locator('[data-admins]').click();await page.setViewportSize({width:390,height:844});
  await page.locator('[data-create-admin]').click();await page.locator('.staff-password-dialog').waitFor();
  assert.equal(await page.locator('.staff-password-dialog').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
  assert.equal(await page.locator('.staff-password-dialog h2').innerText(),lang==='ar'?'إنشاء حساب مسؤول':'Create admin');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const rect=await page.locator('.staff-password-dialog').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=390);
  await page.screenshot({path:f.out+'/admin-password-'+lang+'.png',fullPage:true});await page.locator('[data-cancel]').click();
 }
 pass('English/Arabic admin navigation and password dialogs fit mobile screens');

 const backup=await owner.request.post(f.base+'/api/management.php?action=export_backup',{headers:{'X-CSRF-Token':f.tokens.get(owner).management},data:{}});
 assert.equal(backup.status(),200,await backup.text());const bytes=await backup.body();const archive=f.out+'/migration.zip';await fs.writeFile(archive,bytes);
 const restore=spawnSync('php',['scripts/restore-installation.php',archive,f.out+'/restored'],{encoding:'utf8'});assert.equal(restore.status,0,restore.stderr);
 assert.equal(spawnSync('php',['scripts/restore-installation.php',archive,f.out+'/restored'],{encoding:'utf8'}).status,1,'Never overwrite existing private storage');
 const sql=(file,query)=>JSON.parse(spawnSync('php',['-r',`$db=new PDO('sqlite:'.$argv[1]);echo json_encode($db->query($argv[2])->fetchAll(PDO::FETCH_ASSOC));`,file,query],{encoding:'utf8'}).stdout);
 for(const table of ['users','submissions','client_shared_profiles','audit'])assert.deepEqual(sql(f.out+'/restored/portal/clients.sqlite','SELECT * FROM '+table),sql(f.out+'/portal/clients.sqlite','SELECT * FROM '+table));
 for(const id of [first.id,second.id])assert.equal(digest(await fs.readFile(f.out+'/restored/portal/pdfs/'+id+'.pdf')),digest(await fs.readFile(f.out+'/portal/pdfs/'+id+'.pdf')));
 const events=sql(f.out+'/restored/management/administrators.sqlite','SELECT * FROM administrator_events');assert.equal(events.length,3);assert.ok(events.every(e=>e.actor==='superadmin'));
 assert.ok(!JSON.stringify(events).includes('Next123!'));
 const php=spawnSync('php',['-r',`require $argv[1];$a=managementAccounts($argv[2]);foreach($a as $row)if($row['username']==='qa.second')echo password_verify('Next123!',$row['password_hash'])?'ok':'bad';`,path.resolve('public/api/management-auth.php'),f.out+'/restored/management'],{encoding:'utf8'});assert.equal(php.stdout,'ok');
 pass('Private snapshot restores exact accounts, structured answers, archives, PDF hashes and administrator credentials; replacement of existing data refused');
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(f.out+'/admin-handoff-report.json',JSON.stringify(report,null,2));console.log('OUTPUT '+f.out);await browser.close();await f.close();}
