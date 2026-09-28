import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true}),report={checks:[],errors:[]};
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
let page;
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),user=await f.client(ctx,'individual');
 const other=await browser.newContext(),otherUser=await f.client(other,'corporate');
 const workflowRevision=(await f.call(ctx,'portal','session')).workflow.revision;
 const submission=await f.submit(ctx,user,{workflowRevision}),privateSubmission=await f.submit(other,otherUser,{workflowRevision});
 page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(f.base+'/individuals/?lang=en');await page.locator('[data-filled]').waitFor();
 await page.locator('[data-notification-bell]').click();await page.locator('[data-notification-empty]').waitFor();
 assert.equal(await page.locator('.notification-dialog details').count(),0);assert.equal(await page.locator('.notification-dialog h2').count(),1);assert.equal(await page.locator('.notification-dialog [data-panel-unread]').isVisible(),false);
 await page.screenshot({path:f.out+'/notifications-empty.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('.notification-dialog').count(),0);assert.equal(await page.locator('[data-notification-bell]').evaluate(n=>n===document.activeElement),true);
 pass('Empty state has a single heading; Escape closes and restores keyboard focus');
 await page.route('**/api/portal.php?action=notifications*',r=>r.abort());
 await page.locator('[data-notification-bell]').click();await page.locator('[data-notification-retry]').waitFor();await page.unroute('**/api/portal.php?action=notifications*');await page.locator('[data-notification-retry]').click();await page.locator('[data-notification-empty]').waitFor();await page.locator('.notification-dialog [data-close]').click();
 pass('Failed notification request offers a working retry without reloading the page');
 const seed=spawnSync('php',['-r',`$v=json_decode(stream_get_contents(STDIN),true);$db=new PDO('sqlite:'.$v['db']);$q=$db->prepare('INSERT INTO submission_reviews(submission_id,status,reason_code,reason_text,admin_username,created_at,request_key) VALUES(?,?,?,?,?,?,?)');for($i=0;$i<26;$i++){$status=['approved','rejected','signature_required'][$i%3];$q->execute([$v['id'],$status,$status==='rejected'?'missing_details':'',$status==='rejected'?'Please complete the missing address. الرجاء استكمال العنوان.':($status==='signature_required'?'Please sign the document. الرجاء توقيع المستند.':''),'test.admin',sprintf('2026-09-28T10:%02d:00Z',$i),'notification-'.$i]);}$q->execute([$v['other'],'approved','','','test.admin','2026-09-28T11:00:00Z','private-notification']);`],{input:JSON.stringify({db:f.out+'/portal/clients.sqlite',id:submission.id,other:privateSubmission.id}),encoding:'utf8'});
 assert.equal(seed.status,0,seed.stderr);
 const data=await f.call(ctx,'portal','notifications');assert.equal(data.user_id,user.id);assert.equal(data.unread,26);assert.ok(data.notifications.every(n=>n.submission_id===submission.id));
 const event=data.notifications[0];await f.call(other,'portal','notification_read',{data:{id:event.id},status:404});
 for(const lang of ['en','ar']){
  await page.goto(f.base+'/account/?lang='+lang);await page.locator('#profile-form').waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.locator('[data-notification-bell]').click();await page.locator('[data-notification]').first().waitFor();
   assert.equal(await page.locator('[data-notification]').count(),20);assert.equal(await page.locator('[data-notification-read]').count(),0);assert.equal(await page.locator('.notification-dialog summary').count(),0);
   assert.ok((await page.locator('.notification-dialog').innerText()).includes(lang==='ar'?'مرفوض':'Rejected'));
   assert.equal(await page.locator('.notification-dialog').evaluate(n=>n.scrollWidth>n.clientWidth+1),false);
   await page.screenshot({path:f.out+'/notifications-'+lang+'-'+width+'.png'});
   await page.locator('[data-notification-more]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-notification]').length===26);assert.equal(await page.locator('[data-notification-more]').count(),0);
   await page.locator('.notification-dialog [data-close]').click();
  }
 }
 pass('Arabic/English desktop/mobile list, reasons, read indicators and pagination; notifications stay scoped to their owner');
 await page.goto(f.base+'/individuals/?lang=en');await page.locator('[data-filled]').waitFor();const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.locator('[data-notification-bell]').evaluate(b=>{b.click();b.click();b.click();});await page.locator('[data-notification]').first().waitFor();assert.equal(await page.locator('.notification-dialog').count(),1);
 assert.equal(requests.some(url=>/action=submissions|\/pdfs\/|pdf\.worker/.test(url)),false);
 await page.locator(`[data-event="${event.id}"]`).click();await page.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
 assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.locator('.notification-dialog').isVisible(),false);
 assert.equal(await page.locator('.portal-preview .portal-answer-details,.portal-preview .submission-review,.portal-preview [data-answer-field]').count(),0);
 assert.equal(await page.locator('.portal-preview .portal-pdf-pages canvas').count(),1);
 assert.equal(await page.locator('.portal-preview .version-badge,.portal-preview .preview-document-actions,.notification-previous').count(),0);
 assert.equal((await f.call(ctx,'portal','notifications')).unread,25);assert.ok((await f.call(ctx,'portal','notifications')).notifications[0].read_at);
 await page.locator('.portal-preview [data-close]').click();assert.equal(await page.locator('.notification-dialog').isVisible(),true);assert.equal(await page.locator(`[data-event="${event.id}"]`).evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator(`[data-notification="${event.id}"].is-unread`).count(),0);assert.match(await page.locator('[data-panel-unread]').innerText(),/^25 /);
 await page.locator('.notification-dialog [data-close]').click();await page.reload();await page.locator('[data-notification-bell]').click();await page.locator('[data-notification]').first().waitFor();assert.equal(await page.locator(`[data-notification="${event.id}"].is-unread`).count(),0);
 pass('One View form action opens the PDF and persists read state; badge updates; repeated clicks create one dialog; list avoids PDF/submission fetches');
 const nextId=data.notifications[1].id;await page.route('**/api/portal.php?action=notification_read',r=>r.abort());await page.locator(`[data-event="${nextId}"]`).click();await page.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');await page.locator('.portal-preview [data-close]').click();assert.equal(await page.locator(`[data-notification="${nextId}"].is-unread`).count(),1);assert.ok(await page.locator('[data-notification-message]').innerText());await page.unroute('**/api/portal.php?action=notification_read');await page.locator(`[data-event="${nextId}"]`).click();await page.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');await page.locator('.portal-preview [data-close]').click();assert.equal((await f.call(ctx,'portal','notifications')).unread,24);await page.locator('.notification-dialog [data-close]').click();
 pass('A failed read receipt leaves the notification unread and can be retried without blocking the document');
 let release,started,finished;const gate=new Promise(r=>release=r),request=new Promise(r=>started=r),handled=new Promise(r=>finished=r);await page.route('**/api/portal.php?action=notifications*',async route=>{started();await gate;await route.continue();finished();});await page.locator('[data-notification-bell]').click();await request;await page.locator('.notification-dialog [data-close]').click();release();await handled;await page.unroute('**/api/portal.php?action=notifications*');assert.equal(await page.locator('.notification-dialog').count(),0);
 await ctx.clearCookies();await page.locator('[data-notification-bell]').click();await page.waitForURL('**/login/?lang=en');await page.locator('#auth-form').waitFor();
 pass('Closing during loading cannot reopen the panel; expired sessions return to sign-in');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(err){report.failure=err.stack;await page?.screenshot({path:f.out+'/notifications-failure.png'}).catch(()=>{});throw err;}
finally{await fs.writeFile(f.out+'/notifications-report.json',JSON.stringify(report,null,2));console.log('REPORT '+f.out+'/notifications-report.json');await browser.close();await f.close();}
