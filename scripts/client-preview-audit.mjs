// Isolated client notification previews: PDF-first, one dialog and immutable versions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[]};let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const ready=()=>page.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
async function checkPreview(width,pages){
 await ready();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.locator('.notification-dialog').isVisible(),false);
 assert.equal(await page.locator('.portal-preview .portal-answer-details,.portal-preview .submission-review,.portal-preview [data-answer-field],.portal-preview details').count(),0);
 assert.equal(await page.locator('.portal-preview canvas').count(),pages);
 const box=await page.locator('.portal-preview').boundingBox();assert.ok(box.width>=(width>600?800:width-24));assert.ok(box.x>=0&&box.x+box.width<=width+1);
 assert.equal(await page.locator('.portal-preview-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 assert.ok((await page.locator('.portal-preview canvas').evaluateAll(xs=>xs.map(x=>({w:x.width,dir:getComputedStyle(x).direction})))).every(x=>x.w>0&&x.dir==='ltr'));
 assert.ok(await page.locator('.portal-preview [data-close]').isVisible());
}
try{
 for(const [engine,type,options] of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}],['webkit',webkit,{}]]){
  browser=await type.launch({headless:true,...options});
  for(const audience of ['individual','corporate']){
   const ctx=await browser.newContext(),user=await f.client(ctx,audience),revision=(await f.call(ctx,'portal','session')).workflow.revision;
   const old=await f.submit(ctx,user,{workflowRevision:revision}),current=await f.submit(ctx,user,{workflowRevision:revision,expectedCurrent:old.id});
   const long=await f.submit(ctx,user,{document:'terms-and-conditions',source:'upload',workflowRevision:revision});
   const seed=spawnSync('php',['-r',`$v=json_decode(stream_get_contents(STDIN),true);$db=new PDO('sqlite:'.$v['db']);$q=$db->prepare('INSERT INTO submission_reviews(submission_id,status,reason_code,reason_text,admin_username,created_at,request_key) VALUES(?,?,?,?,?,?,?)');foreach($v['ids'] as $i=>$id)$q->execute([$id,'approved','','','test.admin','2026-09-28T10:00:00Z','preview-'.$id]);`],{input:JSON.stringify({db:f.out+'/portal/clients.sqlite',ids:[old.id,current.id,long.id]}),encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
   page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(20000);
   const original=(await f.call(ctx,'portal','detail',{params:{id:old.id}})).submission;
   for(const lang of ['en','ar'])for(const width of [1366,390]){
    await page.setViewportSize({width,height:900});await page.goto(f.base+'/'+(audience==='individual'?'individuals':'companies')+'/?lang='+lang);await page.locator('[data-notification-bell]').click();
    const trigger=page.locator('[data-notification-preview="'+old.id+'"]');await trigger.click();await checkPreview(width,1);
    assert.match(await page.locator('.portal-preview .version-badge').innerText(),/Archived|مؤرشفة/);
    const download=await ctx.request.get(new URL(await page.locator('.preview-document-actions a').getAttribute('href'),f.base).href);assert.equal(download.status(),200);
    if(engine==='webkit')await page.screenshot({path:f.out+'/'+audience+'-'+lang+'-'+width+'.png'});
    await page.locator('[data-current-version]').click();await checkPreview(width,1);assert.equal(await page.locator('[data-current-version]').count(),0);assert.match(await page.locator('.portal-preview .version-badge').innerText(),/Current|الحالية/);
    await page.keyboard.press('Escape');assert.equal(await page.locator('.notification-dialog[open]').count(),1);assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
    await page.locator('[data-notification-preview="'+long.id+'"]').click();await checkPreview(width,13);await page.locator('.portal-preview [data-close]').click();await page.locator('.notification-dialog [data-close]').click();
    pass(engine+' '+audience+' '+lang+' '+width+': full-size PDF-only preview, archived/current switch, all 13 pages, download and return to notifications');
   }
   assert.deepEqual((await f.call(ctx,'portal','detail',{params:{id:old.id}})).submission,original);
   if(engine==='chrome'&&audience==='individual'){
    await page.goto(f.base+'/account/?lang=en');await page.locator('[data-notification-bell]').click();await page.locator('[data-notification-preview="'+current.id+'"]').click();await checkPreview(390,1);await page.locator('.portal-preview [data-close]').click();
    await page.route('**/api/portal.php?action=pdf*',r=>r.abort());await page.locator('[data-notification-preview="'+current.id+'"]').click();await page.locator('[data-preview-retry]').waitFor();assert.equal(await page.locator('dialog[open]').count(),1);await page.unroute('**/api/portal.php?action=pdf*');await page.locator('[data-preview-retry]').click();await ready();await page.locator('.portal-preview [data-close]').click();
    let release,started,finished;const gate=new Promise(r=>release=r),requested=new Promise(r=>started=r),handled=new Promise(r=>finished=r);
    await page.route('**/api/portal.php?action=pdf*',async r=>{started();await gate;await r.fulfill({path:'public/pdfs/signature-form.pdf',contentType:'application/pdf'});finished();});
    await page.locator('[data-notification-preview="'+current.id+'"]').click();await requested;await page.locator('.portal-preview [data-close]').click();assert.equal(await page.locator('.notification-dialog[open]').count(),1);assert.equal(await page.locator('[data-notification-preview="'+current.id+'"]').evaluate(n=>n===document.activeElement),true);release();await handled;await page.unroute('**/api/portal.php?action=pdf*');
    await page.locator('[data-notification-preview="'+current.id+'"]').click();await ready();await page.locator('.portal-preview [data-close]').click();await page.locator('.notification-dialog [data-close]').click();pass('Profile-page entry point, failed-download retry and close-during-load preserve a usable notification list');
   }
   await ctx.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/client-preview-failure.png'}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/client-preview-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/client-preview-report.json');await browser?.close();await f.close();}
