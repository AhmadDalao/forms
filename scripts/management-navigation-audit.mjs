// Delayed tab responses must never replace the page the administrator selected.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[]};let browser;
try{
 for(const [engine,launcher] of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({...(engine==='chrome'?{channel:'chrome'}:{}),headless:true});
  const c=await browser.newContext();await f.login(c,'superadmin');
  for(const language of ['en','ar'])for(const tab of ['admins','documents']){
   const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
   await p.goto(f.base+'/management/?lang='+language);await p.locator('.admin-stats').waitFor();
   if(await p.locator('html').getAttribute('lang')!==language){await p.locator('[data-admin-language]').click();await p.locator('html[lang='+language+']').waitFor();}
   const action=tab==='admins'?'admins':'state',pattern='**/api/management.php?action='+action;
   let release,requested;const gate=new Promise(r=>release=r),started=new Promise(r=>requested=r);
   await p.route(pattern,async route=>{requested();await gate;await route.continue();});
   await p.locator('[data-management-view='+tab+']').click();await started;
   await p.locator('[data-management-view=reviews]').click();await p.locator('#review-filters').waitFor();
   const response=p.waitForResponse(r=>r.url().includes('action='+action));release();await(await response).finished();await p.unroute(pattern);
   // Let the delayed JSON promise and its DOM work run before checking the result.
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await p.locator('[data-management-view=reviews][aria-current=page]').count(),1,engine+' '+language+' delayed '+tab+' replaced selected submissions');
   assert.equal(await p.locator('#review-filters').count(),1);
   await p.locator('[data-management-view='+tab+']').click();await p.locator(tab==='admins'?'[data-create-admin]':'#upload').waitFor();
   report.checks.push(engine+' '+language+': delayed '+tab+' cannot replace submissions; reopening works');await p.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{await fs.writeFile(f.out+'/management-navigation-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/management-navigation-report.json');await browser?.close();await f.close();}
