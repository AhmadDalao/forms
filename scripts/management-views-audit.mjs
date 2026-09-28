// Isolated regression: every management view, role and recovery path.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
const shortPages=docs.find(d=>d.id==='signature-form').pages,longPages=docs.find(d=>d.id==='terms-and-conditions').pages;
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[]};let browser,archivedId;
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const ready=p=>p.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
const lang=async(p,value)=>{if(await p.locator('html').getAttribute('lang')!==value){await p.locator('[data-admin-language]').click();await p.locator('html[lang='+value+']').waitFor();}};
const profile=async(p,id)=>{await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();await p.locator('[data-client="'+id+'"]').click();await p.locator('.admin-client-facts').waitFor();};
const preview=async(p,selector)=>{await p.locator(selector).first().click();await ready(p);assert.equal(await p.locator('.portal-preview').count(),1);assert.equal(await p.locator('.portal-preview canvas').count(),shortPages);assert.equal(await p.locator('.portal-preview .version-badge,.portal-preview .preview-document-actions a').count(),2);if(selector.includes(archivedId)){assert.match(await p.locator('.portal-preview .version-badge').innerText(),/Archived|مؤرشفة/);assert.equal(new URL(await p.locator('.preview-document-actions a').getAttribute('href'),f.base).searchParams.get('id'),archivedId);assert.equal(await p.locator('[data-current-version]').count(),1);}await p.locator('.portal-preview [data-close]').click();};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const owner=await browser.newContext(),client=await browser.newContext(),company=await browser.newContext();await f.login(owner,'superadmin');
 await f.call(owner,'management','admin_create',{data:{username:'qa.views',password:'Views123!',confirm:'Views123!'},status:201});
 const u=await f.client(client,'individual'),co=await f.client(company,'corporate'),revision=(await f.call(client,'portal','session')).workflow.revision;
 const archived=await f.submit(client,u,{workflowRevision:revision}),current=await f.submit(client,u,{workflowRevision:revision,expectedCurrent:archived.id}),corporate=await f.submit(company,co,{workflowRevision:revision});
 archivedId=archived.id;
 const longDocument=await f.submit(client,u,{document:'terms-and-conditions',source:'upload',values:{},workflowRevision:revision});
 await browser.close();browser=null;
 for(const [engine,launcher] of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({...(engine==='chrome'?{channel:'chrome'}:{}),headless:true});
  for(const role of ['admin','superadmin','new-admin']){
   const c=await browser.newContext(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
   if(role==='new-admin'){await f.call(c,'management','session');await f.call(c,'management','login',{data:{username:'qa.views',password:'Views123!'}});}else await f.login(c,role);
   await p.goto(f.base+'/management/');await p.locator('.admin-stats').waitFor();
   for(const language of ['en','ar']){
    await lang(p,language);await p.setViewportSize({width:language==='en'?1440:390,height:900});
    await profile(p,u.id);assert.equal(await p.locator('[data-account-shared-profiles]').count(),0);assert.equal(await p.locator('#account-type-form').count(),role==='superadmin'?1:0);await preview(p,'[data-preview="'+current.id+'"]');
    await p.locator('#submitted-version').selectOption(current.id);await p.locator('[data-profile-details-body][aria-busy=false]').waitFor();await preview(p,'[data-details-preview]');await p.locator('.admin-history>summary').click();await preview(p,'[data-preview="'+archived.id+'"]');
    await profile(p,co.id);await preview(p,'[data-preview="'+corporate.id+'"]');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   pass(engine+' '+role+': individual/company profiles, current/archived PDFs, details-card preview, English/Arabic desktop/mobile');await c.close();
  }
  {
   const mc=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),mp=await mc.newPage();mp.on('pageerror',e=>report.errors.push(e.message));
   await f.login(mc,'admin');await mp.goto(f.base+'/management/');await profile(mp,u.id);
   await mp.locator('[data-preview="'+longDocument.id+'"]').click();await ready(mp);
   const dimensions=await mp.locator('.portal-preview canvas').evaluateAll(nodes=>nodes.map(c=>({width:c.width,parent:c.parentElement.clientWidth,direction:getComputedStyle(c).direction})));
   assert.equal(dimensions.length,longPages);assert.ok(dimensions.every(c=>c.width<=c.parent*2+1&&c.direction==='ltr'));
   if(engine==='chrome')await mp.screenshot({path:f.out+'/mobile-long-preview.png'});
   await mp.locator('.portal-preview [data-close]').click();await mc.close();
  }
  pass(engine+': all '+longPages+' PDF pages render in management on a high-density phone at the actual available width');
  await browser.close();browser=null;
 }
 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await f.login(c,'admin');await p.goto(f.base+'/management/');await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();
 let release,started,finished;const blocked=new Promise(r=>started=r),gate=new Promise(r=>release=r),handled=new Promise(r=>finished=r);
 await p.route('**/api/portal.php?action=admin_client*',async route=>{started();await gate;await route.continue();finished();});
 await p.locator('[data-client="'+u.id+'"]').click();await blocked;await p.locator('.admin-profile-status[aria-busy=true]').waitFor();
 await p.locator('[data-management-view=reviews]').click();await p.locator('#review-filters').waitFor();const response=p.waitForResponse(r=>r.url().includes('action=admin_client'));release();await handled;await(await response).finished();await p.unroute('**/api/portal.php?action=admin_client*');
 await p.waitForFunction(()=>document.querySelector('[data-management-view=reviews][aria-current=page]'));
 assert.equal(await p.locator('.admin-client-facts').count(),0);pass('Slow profile shows feedback; switching sections cannot be overwritten by its delayed response');
 await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();await p.route('**/api/portal.php?action=admin_client*',r=>r.abort());await p.locator('[data-client="'+u.id+'"]').click();await p.locator('[data-client-retry]').waitFor();await p.unroute('**/api/portal.php?action=admin_client*');await p.locator('[data-client-retry]').click();await p.locator('.admin-client-facts').waitFor();pass('Interrupted profile request recovers through Try again');
 await p.route('**/api/portal.php?action=admin_pdf*',r=>r.abort());await p.locator('[data-preview="'+current.id+'"]').click();await p.locator('[data-preview-retry]').waitFor();await p.unroute('**/api/portal.php?action=admin_pdf*');await p.locator('[data-preview-retry]').click();await ready(p);await p.locator('.portal-preview [data-close]').click();pass('Interrupted PDF download recovers in the same preview without losing details');
 await p.locator('[data-preview="'+current.id+'"]').evaluate(button=>{button.click();button.click();button.click();});await ready(p);assert.equal(await p.locator('.portal-preview').count(),1);await p.locator('.portal-preview [data-close]').click();pass('Repeated preview clicks keep a single dialog');
 let resume,requested,responded;const pdfGate=new Promise(r=>resume=r),pdfStarted=new Promise(r=>requested=r),pdfHandled=new Promise(r=>responded=r);
 await p.route('**/api/portal.php?action=admin_pdf*',async route=>{requested();await pdfGate;await route.fulfill({path:f.out+'/site/pdfs/signature-form.pdf',contentType:'application/pdf'});responded();});
 await p.locator('[data-preview="'+current.id+'"]').click();await pdfStarted;await p.locator('.portal-preview [data-close]').click();assert.equal(await p.locator('.portal-preview').count(),0);resume();await pdfHandled;await p.unroute('**/api/portal.php?action=admin_pdf*');await preview(p,'[data-preview="'+current.id+'"]');pass('Closing a pending PDF cancels its load and a new preview opens normally');
 await f.call(c,'management','logout',{data:{}});await p.locator('[data-preview="'+current.id+'"]').click();await p.locator('#login').waitFor();assert.equal(await p.locator('.portal-preview').count(),0);pass('Expired admin preview session closes the dialog and returns to management sign-in');
 await f.login(c,'admin');await p.reload();await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();await f.call(c,'management','logout',{data:{}});await p.locator('[data-client="'+u.id+'"]').click();await p.locator('#login').waitFor();pass('Expired client-profile request returns to management sign-in');
 // Client previews now live in form review; customer-workflow-audit covers that flow.
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(f.out+'/management-views-report.json',JSON.stringify(report,null,2));console.log('REPORT '+f.out+'/management-views-report.json');await browser?.close();await f.close();}
