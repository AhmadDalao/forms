// Review control stays usable across management navigation, including in-flight saves.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[],passed:false};let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const workflow=async c=>(await f.call(c,'portal','admin_workflow')).workflow;
const setMode=async(c,value)=>{const w=await workflow(c);if(w.review_enabled!==value)await f.call(c,'portal','admin_workflow_update',{data:{reviewEnabled:value,expectedRevision:w.revision,requestKey:randomUUID()}});};
const select=async(p,view)=>{await p.locator('[data-management-view='+view+']').click();await p.locator({overview:'.admin-stats',reviews:'#review-filters',users:'#client-search',documents:'#upload',admins:'[data-create-admin]'}[view]).waitFor();};
async function checkHeader(p,role){
 assert.equal(await p.locator('#review-new-submissions').count(),role==='superadmin'?1:0);
 assert.equal(await p.locator('main #review-new-submissions,.workflow-switch-card').count(),0);
 if(role==='superadmin'){
  assert.equal(await p.locator('.management-navigation #review-new-submissions').count(),1);
  const boxes=await p.locator('.management-navigation button,.management-review-control,.management-review-control input').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
  assert.ok(boxes.every(r=>r.width>0&&r.left>=0&&r.right<=p.viewportSize().width+1));
 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const overlap=await p.evaluate(()=>{const a=document.querySelector('.site-brand').getBoundingClientRect(),b=document.querySelector('.site-header-actions').getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;});assert.equal(overlap,false,'Brand and actions overlap');
}
try{
 for(const [engine,launcher]of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  const owner=await browser.newContext(),admin=await browser.newContext(),client=await browser.newContext();await f.login(owner,'superadmin');await f.login(admin,'admin');const user=await f.client(client,'individual');await setMode(owner,false);
  for(const [role,c]of [['superadmin',owner],['admin',admin]]){
   page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const lang of ['en','ar'])for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.goto(f.base+'/management/?lang='+lang);await page.locator('.admin-stats').waitFor();
    if(await page.locator('html').getAttribute('lang')!==lang){await page.locator('[data-admin-language]').click();await page.locator('html[lang='+lang+']').waitFor();await page.locator('.admin-stats').waitFor();}
    for(const view of role==='superadmin'?['overview','reviews','users','documents','admins']:['overview','reviews','users']){await select(page,view);await checkHeader(page,role);}
    await select(page,'users');await page.locator('[data-client="'+user.id+'"]').click();await page.locator('.admin-client-facts').waitFor();await checkHeader(page,role);
    if(width===1440||width===390){await select(page,'overview');await page.screenshot({path:f.out+`/nav-${engine}-${role}-${lang}-${width}.png`});}
   }
   await page.close();
  }
  pass(engine+': one navigation switch on every superadmin page/profile; absent for admin; AR/EN at 1440/768/390/320, no overflow or header overlap');
  page=await owner.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(f.base+'/management/?lang=en');await page.locator('.admin-stats').waitFor();if(await page.locator('html').getAttribute('lang')!=='en'){await page.locator('[data-admin-language]').click();await page.locator('html[lang=en]').waitFor();}
  for(const view of ['reviews','users','documents','admins']){
   await select(page,view);const before=await workflow(owner);await page.locator('#review-new-submissions').setChecked(!before.review_enabled);await page.waitForFunction(value=>document.querySelector('#review-new-submissions')?.checked===value&&!document.querySelector('#review-new-submissions').disabled,!before.review_enabled);
   assert.equal((await workflow(owner)).review_enabled,!before.review_enabled);assert.equal(await page.locator('[data-management-view='+view+'][aria-current=page]').count(),1);
  }
  await page.reload();await page.locator('#review-new-submissions').waitFor();assert.equal(await page.locator('#review-new-submissions').isChecked(),false);
  pass(engine+': toggle persists from applications, clients, documents and administrators without changing the selected page; reload reflects saved mode');
  await browser.close();browser=null;
 }
 browser=await chromium.launch({channel:'chrome',headless:true});const owner=await browser.newContext(),other=await browser.newContext();await f.login(owner,'superadmin');await f.login(other,'superadmin');await setMode(owner,false);page=await owner.newPage();await page.goto(f.base+'/management/?lang=en');await page.locator('#review-new-submissions').waitFor();
 // A response may arrive after the user navigates or changes language.
 let release,requested;const gate=new Promise(r=>release=r),started=new Promise(r=>requested=r);
 await page.route('**/api/portal.php?action=admin_workflow_update',async route=>{requested();await gate;await route.continue();});
 await page.locator('#review-new-submissions').check();await started;await select(page,'documents');assert.equal(await page.locator('#review-new-submissions').isDisabled(),true);await page.locator('[data-admin-language]').click();assert.equal(await page.locator('#review-new-submissions').isDisabled(),true);
 release();await page.waitForFunction(()=>document.querySelector('#review-new-submissions')?.checked&&!document.querySelector('#review-new-submissions').disabled);assert.equal(await page.locator('#upload').count(),1);await page.unroute('**/api/portal.php?action=admin_workflow_update');
 // Switching the setting must not save/discard a catalogue draft or dismiss a dialog.
 const state=await f.call(owner,'management','state');await page.locator('[data-edit]').first().click();const title=page.locator('#metadata [name=title]');await title.fill('Unsaved catalogue QA');await page.locator('#metadata button[value=save]').click();await page.locator('#review-new-submissions').uncheck();await page.waitForFunction(()=>!document.querySelector('#review-new-submissions')?.disabled);assert.equal((await f.call(owner,'management','state')).revision,state.revision);assert.match(await page.locator('#draft-status').innerText(),/Unsaved/);assert.ok(await page.getByText('Unsaved catalogue QA',{exact:true}).count());
 pass('In-flight switch survives navigation and language change; toggling preserves unsaved catalogue edits without saving them');
 await page.reload();await page.locator('#review-new-submissions').waitFor();await setMode(other,true);await setMode(other,false);
 await page.locator('#review-new-submissions').check();await page.waitForFunction(()=>document.querySelector('[data-workflow-status]')?.textContent.length>0&&!document.querySelector('#review-new-submissions').disabled);assert.equal(await page.locator('#review-new-submissions').isChecked(),false);await page.locator('#review-new-submissions').check();await page.waitForFunction(()=>document.querySelector('#review-new-submissions')?.checked&&!document.querySelector('#review-new-submissions').disabled);assert.equal((await workflow(owner)).review_enabled,true);
 pass('A stale setting revision refreshes to the current server mode and can be retried without leaving the page');
 await setMode(owner,false);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/nav-failure.png'}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/review-navigation-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/review-navigation-report.json');await browser?.close();await f.close();}
