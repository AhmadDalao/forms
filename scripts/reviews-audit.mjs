import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const out=path.resolve(process.env.QA_OUT||'tmp/reviews/audit'),base=process.env.QA_BASE||'http://127.0.0.1:8196',remote=!!process.env.QA_BASE;
const credentials=remote?JSON.parse(await fs.readFile(process.env.QA_CREDENTIALS,'utf8')):{username:'qa.manager',password:randomBytes(24).toString('base64url')+'aA7!'};
if(!remote){assert.ok(out.startsWith(path.resolve('tmp')+path.sep));await fs.rm(out,{recursive:true,force:true});}
await fs.mkdir(out,{recursive:true});
let server,browser;const checks=[],errors=[],accounts=[],clients=[],tokens=new Map(),password=randomBytes(24).toString('base64url')+'aA7!';
if(!remote){
 assert.equal(spawnSync('php',['scripts/management-init.php',out+'/management',credentials.username],{input:credentials.password}).status,0);
 const log=await fs.open(out+'/server.log','w');
 server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8196','-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:out+'/management',FORMS_PORTAL_DATA_DIR:out+'/data'},stdio:['ignore',log.fd,log.fd]});
}
async function call(ctx,action,data,status=200,options={}){
 const r=await ctx.request[options.multipart||data?'post':'get'](base+'/api/portal.php?'+new URLSearchParams({action,...options.params}),{...(data?{data}:{}),...(options.multipart?{multipart:options.multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)||'',...options.headers}});
 const text=await r.text();assert.equal(r.status(),status,action+': '+text);const json=JSON.parse(text);if(json.csrf)tokens.set(ctx,json.csrf);return json;
}
async function owner(ctx){const s=await(await ctx.request.get(base+'/api/management.php?action=session')).json();assert.equal((await ctx.request.post(base+'/api/management.php?action=login',{data:credentials,headers:{'X-CSRF-Token':s.csrf}})).status(),200);tokens.set(ctx,(await(await ctx.request.get(base+'/api/management.php?action=session')).json()).csrf);}
const track=p=>p.on('pageerror',err=>errors.push(err.message));
try{
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/portal.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const manager=await browser.newContext({viewport:{width:1440,height:1000}}),otherManager=await browser.newContext(),anon=await browser.newContext();await owner(manager);await owner(otherManager);
 const baseline=(await call(manager,'admin_dashboard')).stats;await fs.writeFile(out+'/baseline.json',JSON.stringify(baseline),{mode:0o600});
 await call(anon,'session');await call(anon,'notifications',null,401);await call(anon,'admin_review',{},401);
 const pdf=await fs.readFile('public/pdfs/signature-form.pdf'),digest=b=>createHash('sha256').update(b).digest('hex');
 for(const type of ['individual','corporate']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await call(ctx,'session');
  const user=(await call(ctx,'register',{first_name:'QA',last_name:type==='individual'?'Individual':'Company',account_type:type,phone:'59'+String(Math.floor(Math.random()*1e7)).padStart(7,'0'),password,confirm:password},201)).user;
  accounts.push({id:user.id,name:user.name,phone:user.phone});await fs.writeFile(out+'/test-accounts.json',JSON.stringify(accounts),{mode:0o600});
  const meta={account:user.id,document:'signature-form',audience:type,values:{client_name:user.name},source:'online',expectedCurrent:null,requestKey:randomUUID()};
  const submit=async(m,status=201)=>(await call(ctx,'submit',null,status,{multipart:{metadata:JSON.stringify(m),pdf:{name:'qa.pdf',mimeType:'application/pdf',buffer:pdf}}})).submission;
  const first=await submit(meta);clients.push({ctx,user,meta,submit,first});
 }
 const page=await manager.newPage();track(page);
 for(const [index,c] of clients.entries()){
  const {ctx,user,meta,submit,first}=c,lang=index?'ar':'en';
  const detail=(await call(ctx,'detail',null,200,{params:{id:first.id}})).submission;
  assert.equal(detail.review_status,'pending');assert.equal(detail.review_revision,0);assert.equal(detail.review_history.length,0);
  const payload={id:first.id,status:'rejected',reason_code:'missing_details',reason_text:'Please complete the address. يرجى إكمال العنوان.',expectedReview:0,requestKey:randomUUID(),admin_username:'spoofed.admin',created_at:'1900-01-01'};
  await call(ctx,'admin_review',payload,401);await call(manager,'admin_review',payload,403,{headers:{'X-CSRF-Token':'invalid'}});
  for(const invalid of [{status:'pending'},{reason_code:'invented'},{reason_code:'other',reason_text:' '},{expectedReview:'0'}])await call(manager,'admin_review',{...payload,...invalid},400);
  await page.goto(base+'/management/');await page.locator('[data-reviews]').click();await page.locator(`[data-preview="${first.id}"]`).click();await page.locator('.review-form').waitFor();
  await page.locator('.review-form [name=status]').selectOption('rejected');await page.locator('.review-form [name=reason_code]').selectOption('missing_details');await page.locator('.review-form textarea').fill(payload.reason_text);await page.locator('.review-form [type=submit]').click();await page.locator('.review-success').waitFor();
  const rejected=(await call(manager,'admin_detail',null,200,{params:{id:first.id}})).submission;
  assert.equal(rejected.review_status,'rejected');assert.equal(rejected.reviewed_by,credentials.username);assert.equal(rejected.reason_code,'missing_details');assert.match(rejected.reviewed_at,/^20\d\d-\d\d-\d\dT/);
  await page.screenshot({path:out+'/'+c.user.account_type+'-manager-rejected.png'});await page.locator('.portal-preview [data-close]').click();
  await call(otherManager,'admin_review',{...payload,status:'approved',reason_code:'',reason_text:''},409);
  const clientPage=await ctx.newPage();track(clientPage);c.page=clientPage;await clientPage.goto(base+'/my-applications/?lang='+lang);await clientPage.locator('.notification-count').waitFor();
  assert.equal(await clientPage.locator(`[data-review-id="${first.id}"] .review-rejected`).count(),1);assert.ok((await clientPage.locator('.account-notifications').textContent()).includes(payload.reason_text));
  const notifications=await call(ctx,'notifications'),event=notifications.notifications[0];assert.equal(notifications.unread,1);assert.equal(event.admin_username,undefined);
  const other=clients[1-index].ctx;await call(other,'notification_read',{id:event.id},404);await call(anon,'notification_read',{id:event.id},401);await call(ctx,'notification_read',{id:event.id},403,{headers:{'X-CSRF-Token':'wrong'}});
  await clientPage.locator(`[data-notification-read="${event.id}"]`).click();await clientPage.locator(`[data-notification-read="${event.id}"]`).waitFor({state:'detached'});assert.equal((await call(ctx,'notifications')).unread,0);await clientPage.reload();await clientPage.locator('.account-notifications').waitFor();assert.equal(await clientPage.locator('.notification-count').count(),0);
  // A corrected decision appends history, ignores supplied actor/time, and retries once only.
  const approvedPayload={...payload,status:'approved',reason_code:'',reason_text:'',expectedReview:rejected.review_revision,requestKey:randomUUID()};
  const approved=await call(manager,'admin_review',approvedPayload);assert.equal(approved.review.reviewed_by,credentials.username);assert.equal(approved.review.review_history.length,2);
  assert.equal((await call(manager,'admin_review',approvedPayload)).duplicate,true);assert.equal((await call(ctx,'notifications')).notifications.length,2);
  await call(manager,'admin_review',{...approvedPayload,requestKey:randomUUID(),expectedReview:approved.review.review_revision},409);
  await clientPage.evaluate(()=>window.dispatchEvent(new Event('focus')));await clientPage.locator(`[data-review-id="${first.id}"] .review-approved`).waitFor();await clientPage.locator('.notification-count').waitFor();
  assert.equal((await call(ctx,'detail',null,200,{params:{id:first.id}})).submission.review_history[0].admin_username,undefined);
  const next=await submit({...meta,values:{client_name:'Updated name'},expectedCurrent:first.id,editedFrom:first.id,requestKey:randomUUID()});c.current=next;
  const newer=(await call(ctx,'detail',null,200,{params:{id:next.id}})).submission;assert.equal(newer.review_status,'pending');assert.equal(newer.review_history.length,0);
  const archived=(await call(ctx,'detail',null,200,{params:{id:first.id}})).submission;assert.equal(archived.review_status,'approved');assert.equal(archived.answers.client_name,user.name);assert.equal(archived.review_history.length,2);assert.ok(archived.archived_at);
  await call(manager,'admin_review',{...payload,expectedReview:approved.review.review_revision,requestKey:randomUUID()},409);
  for(const id of [first.id,next.id])assert.equal(digest(await(await ctx.request.get(base+'/api/portal.php?action=pdf&id='+id)).body()),digest(pdf));
  const restore=(await call(manager,'admin_restore',{id:first.id,expectedCurrent:next.id,requestKey:randomUUID()},201)).submission;c.current=restore;
  assert.equal((await call(ctx,'detail',null,200,{params:{id:restore.id}})).submission.review_status,'pending');
  await call(manager,'admin_review',{id:restore.id,status:'rejected',reason_code:'other',reason_text:'Missing signature. التوقيع غير موجود. <script>alert("unsafe")</script>',expectedReview:0,requestKey:randomUUID()});
  await clientPage.reload();await clientPage.locator('.notification-count').waitFor();assert.equal(await clientPage.evaluate(()=>document.querySelector('[data-account-notifications] script')!==null),false);
  await clientPage.screenshot({path:out+'/'+typeName(c)+'-client-'+lang+'.png',fullPage:true});
  // The approval UI hides rejection fields and does not require their old values.
  await page.goto(base+'/management/');await page.locator('[data-reviews]').click();await page.locator('[data-review-filter]').selectOption('rejected');await page.locator(`[data-preview="${restore.id}"]`).click();await page.locator('.review-form').waitFor();
  await page.locator('.review-form [name=status]').selectOption('rejected');await page.locator('.review-form [name=reason_code]').selectOption('other');
  assert.equal(await page.locator('.review-form').evaluate(f=>f.checkValidity()),false);
  await page.locator('.review-form [name=status]').selectOption('approved');assert.equal(await page.locator('.review-form [data-rejection]').isVisible(),false);await page.locator('.review-form [type=submit]').click();await page.locator('.review-success').waitFor();
  const uiApproved=(await call(manager,'admin_detail',null,200,{params:{id:restore.id}})).submission;assert.equal(uiApproved.review_status,'approved');assert.equal(uiApproved.reason_text,'');assert.equal(uiApproved.review_history.length,2);
  await page.locator('.portal-preview [data-close]').click();
  await call(manager,'admin_review',{id:restore.id,status:'rejected',reason_code:'incorrect_data',reason_text:'Please correct the name. يرجى تصحيح الاسم.',expectedReview:uiApproved.review_revision,requestKey:randomUUID()});
  const profile=await call(manager,'admin_client',null,200,{params:{id:user.id}});assert.equal(profile.submissions.find(s=>s.id===restore.id).reviewed_by,credentials.username);
  checks.push(typeName(c)+': pending, UI rejection, reasons, authenticated actor/time, CSRF/authorization, stale admin conflict, approval notification/read persistence, idempotent decisions, resubmit/restore pending, archived history and unchanged PDFs');
 }
 // Reuse the two synthetic accounts; never create real-client decisions or touch their data.
 for(const [engine,name,opts] of [[chromium,'chrome',{channel:'chrome'}],[firefox,'firefox',{}],[webkit,'webkit',{}]]){
  const engineBrowser=await engine.launch({headless:true,...opts});
  try{
   for(const lang of ['en','ar'])for(const width of [1440,390]){
    const c=clients[0],ctx=await engineBrowser.newContext({viewport:{width,height:1000}});await call(ctx,'session');await call(ctx,'login',{phone:c.user.phone,password});const p=await ctx.newPage();track(p);
    await p.goto(base+'/my-applications/?lang='+lang);await p.locator('.account-notifications').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await p.locator(`[data-preview="${c.current.id}"]`).click();await p.locator('.portal-pdf-pages canvas').waitFor();await p.locator('.review-rejected').first().waitFor();await p.locator('.portal-preview [data-close]').click();
    await owner(ctx);await p.goto(base+'/management/');await p.locator('[data-reviews]').click();if((await p.locator('.client-management').getAttribute('dir'))!==(lang==='ar'?'rtl':'ltr'))await p.locator('[data-admin-language]').click();
    await p.locator('[data-review-filter]').selectOption('rejected');await p.locator(`[data-preview="${c.current.id}"]`).click();await p.locator('.review-form').waitFor();assert.equal(await p.locator('.portal-preview').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await p.screenshot({path:out+'/review-'+name+'-'+lang+'-'+width+'.png'});await p.locator('.portal-preview [data-close]').click();
    if(!remote&&name==='chrome'&&lang==='en'&&width===1440){
     let release,seen,finished;const hold=new Promise(r=>release=r),started=new Promise(r=>seen=r),completed=new Promise(r=>finished=r);
     const pattern='**/api/portal.php?**';
     const handler=async route=>{const url=new URL(route.request().url());if(url.searchParams.get('action')==='admin_review_queue'&&url.searchParams.get('status')==='pending'){const response=await route.fetch();seen();await hold;await route.fulfill({response});finished();}else await route.continue();};
     await p.route(pattern,handler);await p.locator('[data-review-filter]').selectOption('pending');await started;
     const latest=p.waitForResponse(r=>{const u=new URL(r.url());return u.searchParams.get('action')==='admin_review_queue'&&u.searchParams.get('status')==='rejected';});
     await p.locator('[data-review-filter]').selectOption('rejected');await latest;await p.locator(`[data-preview="${c.current.id}"]`).waitFor();
     release();await completed;await p.waitForTimeout(250);assert.equal(await p.locator(`[data-preview="${c.current.id}"]`).count(),1);assert.equal(await p.locator('[data-review-filter]').inputValue(),'rejected');await p.unroute(pattern,handler);
     checks.push('Delayed older review responses cannot overwrite the newest filter/language selection');
    }
    await ctx.close();
   }
   checks.push(name+': EN/AR desktop/mobile client notifications, PDF preview, review controls and layout');
  }finally{await engineBrowser.close();}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({base,checks,errors,passed:true},null,2));console.log(JSON.stringify({passed:true,checks,errors},null,2));
}finally{await browser?.close();server?.kill();}
function typeName(c){return c.user.account_type;}
