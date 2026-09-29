// Submission settings have their own page; review counters follow the saved mode.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[],passed:false};let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const workflow=async c=>(await f.call(c,'portal','admin_workflow')).workflow;
const setMode=async(c,value)=>{const w=await workflow(c);if(w.review_enabled!==value)await f.call(c,'portal','admin_workflow_update',{data:{reviewEnabled:value,expectedRevision:w.revision,requestKey:randomUUID()}});};
const select=async(p,view)=>{const previous=await p.locator('main').elementHandle();await p.locator('[data-management-view='+view+']').click();await p.waitForFunction(node=>!node.isConnected,previous);await p.locator({overview:'.admin-stats',reviews:'#review-filters',users:'#client-search',documents:'#upload',admins:'[data-create-admin]',workflow:'#workflow-settings-form'}[view]).waitFor();};
const choose=async(p,value)=>{await p.locator('[name=review_enabled][value='+value+']').check();await p.locator('#workflow-settings-form [type=submit]').click();};
const saved=p=>p.waitForFunction(()=>document.querySelector('[data-workflow-status]')?.textContent.match(/Settings saved|تم حفظ/) && !document.querySelector('#workflow-settings-form fieldset').disabled);
async function checkLayout(p,role,view){
 assert.equal(await p.locator('.management-navigation [data-management-view=workflow]').count(),role==='superadmin'?1:0);
 assert.equal(await p.locator('.management-navigation input,#review-new-submissions,.workflow-switch-card').count(),0);
 assert.equal(await p.locator('#workflow-settings-form').count(),view==='workflow'?1:0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const boxes=await p.locator('.management-navigation button,.workflow-option,.workflow-settings [type=submit]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
 assert.ok(boxes.every(r=>r.width>0&&r.left>=0&&r.right<=p.viewportSize().width+1),JSON.stringify({view,width:p.viewportSize().width,boxes}));
 const overlap=await p.evaluate(()=>{const a=document.querySelector('.site-brand').getBoundingClientRect(),b=document.querySelector('.site-header-actions').getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;});assert.equal(overlap,false,'Brand and actions overlap');
}
try{
 for(const [engine,launcher]of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  const owner=await browser.newContext(),admin=await browser.newContext(),client=await browser.newContext();await f.login(owner,'superadmin');await f.login(admin,'admin');const user=await f.client(client,'individual');
  await setMode(owner,true);const pending=await f.submit(client,user,{workflowRevision:(await workflow(owner)).revision});await setMode(owner,false);
  for(const [role,c]of [['superadmin',owner],['admin',admin]]){
   page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const lang of ['en','ar'])for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.goto(f.base+'/management/?lang='+lang);await page.locator('.admin-stats').waitFor();
    if(await page.locator('html').getAttribute('lang')!==lang){await page.locator('[data-admin-language]').click();await page.locator('html[lang='+lang+']').waitFor();await page.locator('.admin-stats').waitFor();}
    for(const view of role==='superadmin'?['overview','reviews','users','documents','admins','workflow']:['overview','reviews','users']){
     await select(page,view);await checkLayout(page,role,view);
     if(view==='overview')assert.equal(await page.locator('.review-counts').count(),0);
     if(view==='reviews'){assert.equal(await page.locator('.review-status-tabs').count(),0);assert.equal(await page.locator('[data-preview="'+pending.id+'"]').count(),1);}
     if(view==='workflow'){
      assert.equal(await page.locator('[name=review_enabled][value=false]').isChecked(),true);assert.equal(await page.locator('#workflow-settings-form [type=submit]').isDisabled(),true);
      assert.match(await page.locator('.workflow-settings').innerText(),lang==='en'?/Submit only[\s\S]+Under review[\s\S]+Previously received/:/إرسال فقط[\s\S]+تحت المراجعة[\s\S]+سابقًا/);
      if(width===1440||width===390)await page.screenshot({path:f.out+`/settings-${engine}-${lang}-${width}.png`});
     }
    }
    await select(page,'users');await page.locator('[data-client="'+user.id+'"]').click();await page.locator('.admin-client-facts').waitFor();await checkLayout(page,role,'users');
   }
   await select(page,'reviews');await page.locator('[data-preview="'+pending.id+'"]').click();await page.locator('.review-form').waitFor();assert.equal(await page.locator('.review-form select').isDisabled(),false);await page.close();
  }
  pass(engine+': dedicated superadmin settings page, AR/EN at 1440/768/390/320; no switch in navigation/dashboard, no clipped controls; off hides counters for both roles while existing cases remain reviewable');
  page=await owner.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(f.base+'/management/?lang=en');await page.locator('.admin-stats').waitFor();await select(page,'workflow');
  await page.locator('[name=review_enabled][value=true]').check();assert.equal((await workflow(owner)).review_enabled,false,'Selecting a mode alone does not save it');await page.locator('#workflow-settings-form [type=submit]').click();await saved(page);assert.equal((await workflow(owner)).review_enabled,true);
  await select(page,'overview');assert.equal(await page.locator('.review-counts button').count(),6);await select(page,'reviews');assert.equal(await page.locator('[data-review-status]').count(),7);
  await page.locator('[data-review-status=pending]').click();await page.locator('[data-review-status=pending][aria-pressed=true]').waitFor();
  await select(page,'workflow');await choose(page,false);await saved(page);await select(page,'overview');assert.equal(await page.locator('.review-counts').count(),0);await select(page,'reviews');assert.equal(await page.locator('.review-status-tabs').count(),0);assert.match(await page.locator('.review-results-heading h2').innerText(),/All current forms|جميع النماذج/);
  await page.reload();await select(page,'workflow');assert.equal(await page.locator('[name=review_enabled][value=false]').isChecked(),true);
  pass(engine+': Save settings persists both modes; counters return on enable and disappear on disable; old status filter resets, reload retains mode');
  await browser.close();browser=null;
 }
 browser=await chromium.launch({channel:'chrome',headless:true});const owner=await browser.newContext(),other=await browser.newContext();await f.login(owner,'superadmin');await f.login(other,'superadmin');await setMode(owner,false);page=await owner.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(f.base+'/management/?lang=en');await select(page,'workflow');
 let release,requested;const gate=new Promise(r=>release=r),started=new Promise(r=>requested=r);
 await page.route('**/api/portal.php?action=admin_workflow_update',async route=>{requested();await gate;await route.continue();});
 await choose(page,true);await started;await page.locator('[data-admin-language]').click();assert.equal(await page.locator('[name=review_enabled][value=true]').isDisabled(),true);assert.equal(await page.locator('[name=review_enabled][value=true]').isChecked(),true);
 await select(page,'documents');release();await page.waitForResponse(r=>r.url().includes('action=admin_workflow_update'));await page.unroute('**/api/portal.php?action=admin_workflow_update');assert.equal(await page.locator('#upload').count(),1);await select(page,'workflow');await page.waitForFunction(()=>!document.querySelector('#workflow-settings-form fieldset')?.disabled);assert.equal(await page.locator('[name=review_enabled][value=true]').isChecked(),true);
 pass('In-flight save survives language changes and navigation without replacing the selected page');
 await setMode(other,false);await setMode(other,true);await choose(page,false);await page.waitForFunction(()=>document.querySelector('[data-workflow-status]')?.textContent.match(/changed|تغيّر/) && !document.querySelector('#workflow-settings-form fieldset').disabled);assert.equal(await page.locator('[name=review_enabled][value=true]').isChecked(),true);await choose(page,false);await saved(page);assert.equal((await workflow(owner)).review_enabled,false);
 pass('Concurrent setting changes show a conflict, refresh the saved mode and allow an explicit retry');
 // A late settings fetch must not replace a different management page.
 let releaseRead,readStarted;const readGate=new Promise(r=>releaseRead=r),readReady=new Promise(r=>readStarted=r);
 await page.route('**/api/portal.php?action=admin_workflow',async r=>{readStarted();await readGate;await r.continue();});await page.locator('[data-management-view=workflow]').click();await readReady;await select(page,'users');releaseRead();await page.waitForResponse(r=>r.url().endsWith('action=admin_workflow'));assert.equal(await page.locator('#client-search').count(),1);assert.equal(await page.locator('#workflow-settings-form').count(),0);
 pass('Delayed settings load cannot replace a newer page');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/settings-failure.png'}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/review-navigation-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/review-navigation-report.json');await browser?.close();await f.close();}
