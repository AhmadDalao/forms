// Isolated local regression: never accepts a hosted URL or real credentials.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';

const root=process.cwd(),out=path.resolve(process.env.QA_OUT||'tmp/management-roles-audit'),port=Number(process.env.QA_PORT||8201),base=`http://127.0.0.1:${port}`;
assert.ok(out.startsWith(path.resolve('tmp')+path.sep),'Audit output must stay inside tmp');
assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
await fs.mkdir(out,{recursive:true});
const run=path.join(out,'run-'+Date.now()),management=path.join(run,'management'),sessions=path.join(run,'sessions');
await fs.mkdir(sessions,{recursive:true,mode:0o700});
const credentials={admin:{username:'qa.admin',password:randomBytes(24).toString('base64url')+'aA7!'},superadmin:{username:'superadmin',password:randomBytes(24).toString('base64url')+'aA7!'}};
for(const [role,script] of [['admin','management-init.php'],['superadmin','management-superadmin-init.php']]){
 const result=spawnSync('php',[`scripts/${script}`,management,credentials[role].username],{input:credentials[role].password,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
}
const log=await fs.open(path.join(run,'php.log'),'w');
const server=spawn('php',['-d',`session.save_path=${sessions}`,'-d','upload_max_filesize=20M','-d','post_max_size=24M','-S',`127.0.0.1:${port}`,'-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:management,FORMS_PORTAL_DATA_DIR:path.join(run,'portal')},stdio:['ignore',log.fd,log.fd]});
const checks=[],errors=[],tokens=new WeakMap(),screenshots=[];let browser;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
async function call(ctx,area,action,{data,multipart,status=200,params={},headers={}}={}){
 const response=await ctx.request[data||multipart?'post':'get'](`${base}/api/${area}.php?${new URLSearchParams({action,...params})}`,{...(data?{data}:{}),...(multipart?{multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)?.[area]||'',...headers}});
 const text=await response.text();assert.equal(response.status(),status,`${area}/${action}: ${text}`);
 const result=JSON.parse(text);if(result.csrf)tokens.set(ctx,{...tokens.get(ctx),[area]:result.csrf});return result;
}
const mg=(ctx,action,options)=>call(ctx,'management',action,options),portal=(ctx,action,options)=>call(ctx,'portal',action,options);
async function login(ctx,role){await mg(ctx,'session');const result=await mg(ctx,'login',{data:credentials[role]});assert.equal(result.role,role);tokens.set(ctx,{...tokens.get(ctx),portal:result.csrf});return result;}
async function screenshot(page,name,fullPage=false){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage});screenshots.push(file);}
async function checkNav(page,role,view){
 await page.locator(`.management-navigation [data-management-view="${view}"][aria-current=page]`).waitFor();
 assert.equal(await page.locator('.management-header').count(),1);
 assert.equal(await page.locator('.management-navigation').count(),1);
 assert.equal(await page.locator('.client-management-nav').count(),0);
 assert.equal(await page.locator('[data-admin-language]').count(),1);
 assert.equal(await page.locator('#logout').count(),1);
 assert.equal(await page.locator('.management-navigation [aria-current=page]').count(),1);
 assert.equal(await page.locator('[data-management-view=documents]').count(),role==='superadmin'?1:0);
 if(role==='admin')assert.equal(await page.locator('#upload,#publish,#restore,[data-move],[data-documents]').count(),0);
 const result=await page.locator('.management-header').evaluate(header=>{
  const issues=[],controls=[...header.querySelectorAll('button,a')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height);
  if(document.documentElement.scrollWidth>innerWidth+1)issues.push('page overflow');
  for(const el of controls){
   const r=el.getBoundingClientRect(),label=el.textContent.trim();
   if(r.left<-.5||r.right>innerWidth+.5)issues.push('offscreen: '+label);
   if(r.height<43.5)issues.push('short target: '+label);
   if(el.scrollWidth>el.clientWidth+1)issues.push('clipped: '+label);
  }
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   if(controls[i].contains(controls[j])||controls[j].contains(controls[i]))continue;
   const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)issues.push('overlap: '+controls[i].textContent+' / '+controls[j].textContent);
  }
  return issues;
 });
 assert.deepEqual(result,[],`${role}/${view}/${await page.locator('html').getAttribute('lang')}/${page.viewportSize().width}`);
}
try{
 let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/management.php?action=session')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'PHP server did not start');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const admin=await browser.newContext(),superadmin=await browser.newContext(),anonymous=await browser.newContext(),client=await browser.newContext();
 await login(admin,'admin');await login(superadmin,'superadmin');await mg(anonymous,'session');
 for(const [role,ctx] of [['admin',admin],['superadmin',superadmin]]){
  const session=await mg(ctx,'session');assert.equal(session.authenticated,true);assert.equal(session.username,credentials[role].username);assert.equal(session.role,role);assert.equal(session.permissions.manage_documents,role==='superadmin');
 }
 await mg(admin,'state',{status:403});await mg(anonymous,'state',{status:401});
 const initial=await mg(superadmin,'state'),published=await mg(anonymous,'catalogue');
 for(const action of ['save','publish','restore','remove','review']){
  await mg(admin,action,{data:{revision:initial.revision,draft:initial.draft,id:'upload_'+'a'.repeat(24),role:'superadmin',permissions:{manage_documents:true}},status:403});
  await mg(anonymous,action,{data:{},status:401});
 }
 const fixture=await PDFDocument.create();fixture.addPage([595,842]).drawText('Local role audit fixture',{x:40,y:790});const bytes=Buffer.from(await fixture.save());
 const metadata={title:'Private role audit document',ar:'مستند فحص الصلاحيات',description:'',arDescription:'',group:'shared',pageSizes:[[595,842]],fields:[],signatures:[],downloadOnly:true};
 const multipart={revision:String(initial.revision),metadata:JSON.stringify(metadata),pdf:{name:'role-audit.pdf',mimeType:'application/pdf',buffer:bytes}};
 await mg(admin,'upload',{multipart,status:403});await mg(anonymous,'upload',{multipart,status:401});
 let state=await mg(superadmin,'upload',{multipart});const upload=state.draft.documents.at(-1);
 for(const ctx of [admin,anonymous])assert.equal((await ctx.request.get(`${base}/api/management.php?action=document&id=${upload.id}`)).status(),404);
 assert.equal(digest(await(await superadmin.request.get(`${base}/api/management.php?action=document&id=${upload.id}`)).body()),digest(bytes));
 state=await mg(superadmin,'review',{data:{revision:state.revision,id:upload.id}});assert.equal(state.draft.documents.at(-1).reviewed,true);
 state=await mg(superadmin,'remove',{data:{revision:state.revision,id:upload.id}});assert.deepEqual(state.draft,initial.draft);assert.deepEqual(await mg(anonymous,'catalogue'),published);
 pass('Both roles share login; admin cannot read draft state, upload, edit, reorder, review, publish, restore or remove; unpublished PDFs stay private');

 // Body/query/header/cookie claims cannot elevate a valid administrator session.
 await mg(admin,'state',{params:{role:'superadmin',username:'superadmin'},headers:{'X-Management-Role':'superadmin'},status:403});
 const cookie=(await admin.cookies()).find(c=>c.name.startsWith('itqan_management'));assert.ok(cookie);
 function tamper(values){const code='$d=json_decode($argv[2],true);session_id($argv[1]);session_start();foreach($d as $k=>$v)$_SESSION[$k]=$v;session_write_close();';const r=spawnSync('php',['-d',`session.save_path=${sessions}`,'-r',code,cookie.value,JSON.stringify(values)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 tamper({owner_role:'superadmin',role:'superadmin',permissions:{manage_documents:true}});await mg(admin,'state',{status:403});
 tamper({owner_username:'superadmin'});await mg(admin,'state',{status:401});assert.equal((await mg(admin,'session')).authenticated,false);await login(admin,'admin');
 await mg(client,'session');await mg(client,'state',{status:401});
 pass('Role claims are ignored; spoofing the session identity fails credential binding');

 await portal(client,'session');const clientPassword=randomBytes(20).toString('base64url')+'aA7!';
 const user=(await portal(client,'register',{data:{first_name:'Role',last_name:'Audit',phone:'59'+String(Math.floor(Math.random()*1e7)).padStart(7,'0'),account_type:'individual',password:clientPassword,confirm:clientPassword},status:201})).user;
 const source=await fs.readFile('public/pdfs/signature-form.pdf'),meta={account:user.id,document:'signature-form',audience:'individual',values:{client_name:user.name},source:'online',expectedCurrent:null,requestKey:randomUUID()};
 const submit=async m=>(await portal(client,'submit',{multipart:{metadata:JSON.stringify(m),pdf:{name:'role-client.pdf',mimeType:'application/pdf',buffer:source}},status:201})).submission;
 const first=await submit(meta);
 await portal(client,'admin_dashboard',{status:401});await mg(client,'state',{status:401});
 for(const ctx of [admin,superadmin]){
  assert.equal((await portal(ctx,'admin_dashboard')).stats.users,1);
  assert.equal((await portal(ctx,'admin_users')).users[0].id,user.id);
  assert.equal((await portal(ctx,'admin_client',{params:{id:user.id}})).user.id,user.id);
  assert.equal((await portal(ctx,'admin_review_queue')).submissions[0].id,first.id);
  assert.equal(digest(await(await ctx.request.get(`${base}/api/portal.php?action=admin_pdf&id=${first.id}`)).body()),digest(source));
  assert.equal((await ctx.request.get(`${base}/api/portal.php?action=admin_zip&id=${user.id}`)).status(),200);
 }
 let review=(await portal(admin,'admin_review',{data:{id:first.id,status:'rejected',reason_code:'missing_details',reason_text:'Audit: missing address',expectedReview:0,requestKey:randomUUID(),admin_username:'spoofed'}})).review;assert.equal(review.reviewed_by,'qa.admin');
 review=(await portal(superadmin,'admin_review',{data:{id:first.id,status:'approved',reason_code:'',reason_text:'',expectedReview:review.review_revision,requestKey:randomUUID()}})).review;assert.equal(review.reviewed_by,'superadmin');
 assert.equal((await portal(client,'notifications')).notifications.length,2);
 const next=await submit({...meta,values:{client_name:'Edited Role Audit'},expectedCurrent:first.id,editedFrom:first.id,requestKey:randomUUID()});
 const restored=(await portal(admin,'admin_restore',{data:{id:first.id,expectedCurrent:next.id,requestKey:randomUUID()},status:201})).submission;
 assert.equal((await portal(superadmin,'admin_detail',{params:{id:first.id}})).submission.review_history.length,2);
 assert.equal((await portal(superadmin,'admin_detail',{params:{id:restored.id}})).submission.answers.client_name,user.name);
 await portal(admin,'admin_account_type',{data:{id:user.id,expected_type:'individual',account_type:'corporate'}});
 await portal(superadmin,'admin_account_type',{data:{id:user.id,expected_type:'corporate',account_type:'individual'}});
 const reset=await portal(admin,'admin_reset',{data:{id:user.id}});assert.ok(reset.temporary_password.length>=20);
 await portal(client,'detail',{params:{id:first.id},status:401});
 pass('Admin and superadmin retain client statistics, profiles, PDF/ZIP downloads, reviews with correct actor, archived version recovery, account changes and password reset');

 // Exercise catalogue editing through the actual superadmin interface.
 const editor=await superadmin.newPage();editor.on('pageerror',e=>errors.push(e.message));editor.on('dialog',d=>d.accept());
 await editor.goto(base+'/management/');await editor.locator('[data-documents]').click();await editor.locator('#upload').waitFor();await checkNav(editor,'superadmin','documents');
 const id=initial.draft.orders.individual[0];await editor.locator(`[data-document="${id}"] [data-edit]`).first().click();
 await editor.locator('#metadata [name=title]').fill('Role audit temporary title');await editor.locator('#metadata [name=ar]').fill('عنوان مؤقت لفحص الصلاحيات');await editor.locator('#metadata button[value=save]').click();
 await editor.locator(`[data-move="${id}"][data-group=individual][data-delta="1"]`).click();await editor.locator('#save').click();await editor.locator('#notice').filter({hasText:'Draft saved'}).waitFor();
 state=await mg(superadmin,'state');assert.equal(state.draft.documents.find(d=>d.id===id).title,'Role audit temporary title');assert.equal(state.draft.orders.individual[1],id);assert.deepEqual(await mg(anonymous,'catalogue'),published);
 await editor.locator('#publish').click();await editor.locator('#notice').filter({hasText:'Catalogue published'}).waitFor();assert.equal((await mg(anonymous,'catalogue')).documents.find(d=>d.id===id).title,'Role audit temporary title');
 await editor.locator('#restore').click();await editor.locator('#notice').filter({hasText:'Previous catalogue restored'}).waitFor();await editor.locator('#publish').click();await editor.locator('#notice').filter({hasText:'Catalogue published'}).waitFor();assert.deepEqual(await mg(anonymous,'catalogue'),published);
 await editor.close();pass('Superadmin UI edits bilingual title, reorders, saves private draft, publishes and restores catalogue without client data changes');

 // Same sign-in page, one header navigation in every area and both languages.
 for(const [engine,name,options] of [[chromium,'chrome',{channel:'chrome'}],[firefox,'firefox',{}],[webkit,'webkit',{}]]){
  if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
  const localBrowser=await engine.launch({headless:true,...options});
  try{for(const role of ['admin','superadmin']){
   const ctx=await localBrowser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   const stateRequests=[];page.on('request',request=>{if(new URL(request.url()).searchParams.get('action')==='state')stateRequests.push(request.url());});
   await page.goto(base+'/management/');await page.locator('#username').fill(credentials[role].username);await page.locator('#password').fill(credentials[role].password);await page.locator('#login button').click();await page.locator('.admin-stats').waitFor();
   assert.equal(stateRequests.length,0,'Login should not fetch document draft state');
   for(const lang of ['en','ar']){
    if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('[data-admin-language]').click();
    for(const width of (name==='chrome'?[1440,768,390,320]:[1440,390])){
     await page.setViewportSize({width,height:1000});
     for(const view of role==='superadmin'?['overview','reviews','users','documents']:['overview','reviews','users']){
      await page.locator(`[data-management-view=${view}]`).click();await checkNav(page,role,view);
      if(name==='chrome'&&view==='overview')await screenshot(page,`${role}-${lang}-${width}`);
     }
     await page.locator('[data-management-view=users]').click();await page.locator(`[data-client="${user.id}"]`).click();await page.locator('#account-type-form').waitFor();await checkNav(page,role,'users');
     if(width===390&&name==='chrome')await screenshot(page,`${role}-${lang}-profile`);
    }
   }
   // macOS Safari uses Option+Tab to include buttons when full keyboard access is off.
   await page.setViewportSize({width:1440,height:1000});await page.locator('[data-management-view=overview]').focus();await page.keyboard.press(name==='webkit'?'Alt+Tab':'Tab');assert.equal(await page.locator('[data-management-view=reviews]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');await checkNav(page,role,'reviews');
   const focusOutline=await page.locator('[data-management-view=reviews]').evaluate(el=>{el.focus();return getComputedStyle(el).outlineStyle;});assert.notEqual(focusOutline,'none');
   if(role==='admin')assert.equal(stateRequests.length,0,'Admin must never request document draft state');
   await page.locator('#logout').click();await page.locator('#login').waitFor();assert.equal((await(await ctx.request.get(base+'/api/management.php?action=session')).json()).authenticated,false);
   if(role==='superadmin'){
    stateRequests.length=0;await page.locator('#username').fill(credentials.admin.username);await page.locator('#password').fill(credentials.admin.password);await page.locator('#login button').click();await page.locator('.admin-stats').waitFor();await checkNav(page,'admin','overview');
    assert.equal(stateRequests.length,0,'Switching from superadmin must not reuse or request its draft');
    assert.equal((await ctx.request.get(base+'/api/management.php?action=state')).status(),403);
   }
   await ctx.close();pass(`${name} ${role}: shared login, unified nav active state, EN/AR responsive layouts, client profile, keyboard navigation, logout`);
  }}finally{await localBrowser.close();}
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,date:new Date().toISOString(),base,checks,errors,screenshots},null,2));
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,errors},null,2));throw error;}
finally{await browser?.close();server.kill();await log.close();}
