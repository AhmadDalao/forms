// Disposable client accounts; no production writes. Slow sync must not gate the UI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true}),report={checks:[],errors:[]};
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
try{
 const c=await browser.newContext(),u=await f.client(c,'individual');
 await f.call(c,'portal','shared_profile_save',{data:{account:u.id,audience:'individual',expectedRevision:0,changes:{ar_first:'أحمد',ar_second:'محمد',ar_last:'العتيبي',en_first:'Ahmad',en_second:'Mohammed',en_last:'Alotaibi',city:'Riyadh'}}});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 let release,requested,handled;const gate=new Promise(r=>release=r),started=new Promise(r=>requested=r),finished=new Promise(r=>handled=r);
 await p.route('**/api/portal.php?action=shared_profile&*',async route=>{requested();await gate;await route.continue();handled();});
 await p.goto(f.base+'/individuals/');await started;
 await p.locator('[data-card=subscription-form]').waitFor({timeout:2000});
 await p.locator('[data-doc=subscription-form]').click();
 await p.locator('[name=first_name]').waitFor({timeout:2000});
 await p.locator('[name=first_name]').fill('خالد');
 assert.equal(await p.locator('[name=first_name]').inputValue(),'خالد');
 pass('Document centre and editor work while the shared-profile response is still pending');
 const response=p.waitForResponse(r=>r.url().includes('action=shared_profile&'));release();await finished;await(await response).finished();await p.unroute('**/api/portal.php?action=shared_profile&*');
 await p.waitForFunction(()=>document.querySelector('[name=second_name]')?.value==='محمد');
 assert.equal(await p.locator('[name=first_name]').inputValue(),'خالد');
 await p.locator('[data-shared-resolve=local]').click();
 await p.waitForFunction(()=>document.querySelector('[data-shared-save-status]')?.textContent==='');
 const saved=(await f.call(c,'portal','shared_profile',{params:{account:u.id,audience:'individual'}})).shared;
 assert.equal(saved.profile.ar_first,'خالد');assert.equal(saved.profile.ar_second,'محمد');
 pass('Late account data fills untouched fields; an edit made while loading is preserved and conflict resolution saves it');
 const resources=await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
 assert.ok(!resources.some(url=>/\.pdf(?:\?|$)|pdf\.worker|\/es-/.test(url)));
 pass('Opening the document centre and editing fields fetches no PDF or PDF engine');
 await p.reload();await p.locator('[data-doc=subscription-form]').click();await p.waitForFunction(()=>document.querySelector('[name=first_name]')?.value==='خالد');
 pass('Reload restores the confirmed account values');
 const admin=await browser.newContext();await f.login(admin,'superadmin');const ap=await admin.newPage();ap.on('pageerror',e=>report.errors.push(e.message));
 await ap.goto(f.base+'/management/');await ap.locator('.admin-stats').waitFor();
 assert.ok(!(await ap.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name))).some(url=>/\/forms-|pdf\.worker|\.pdf(?:\?|$)/.test(url)));
 pass('Management overview defers form definitions and PDF downloads until they are needed');
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(f.out+'/loading-report.json',JSON.stringify(report,null,2));console.log('REPORT '+f.out+'/loading-report.json');await browser.close();await f.close();}
