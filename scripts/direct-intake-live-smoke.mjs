// Read-only hosted checks. Login/logout and the one-time application migration
// are the only writes; never creates or edits a production client submission.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
process.umask(0o077);
const manifest=JSON.parse(await fs.readFile('docs/deployment-manifest.json','utf8'));
assert.equal(manifest.completed,true);
const base=manifest.url,out='tmp/direct-intake-live',report={sourceCommit:manifest.source_commit,started:new Date().toISOString(),checks:[],errors:[],businessWrites:0};await fs.mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000}});let csrf;
const get=path=>ctx.request.get(base+path,{maxRedirects:0,timeout:60000});
const post=(action,data)=>{assert.ok(['login','logout'].includes(action));return ctx.request.post(base+'api/management.php?action='+action,{data,headers:{'X-CSRF-Token':csrf},timeout:60000});};
try{
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'login/?lang=en',{waitUntil:'networkidle'});
 for(const path of ['','individuals/','companies/']){const r=await get(path);assert.equal(r.status(),302);assert.match(r.headers().location,/login/);}
 for(const path of ['pdfs/signature-form.pdf','api/portal.php?action=admin_submissions','api/portal.php?action=submissions'])assert.equal((await get(path)).status(),401);
 for(const path of ['_private/portal/clients.sqlite','.env.local'])assert.ok([403,404].includes((await get(path)).status()));
 pass('Protected document pages, templates, client data and management endpoints deny anonymous access; private paths are inaccessible');
 for(const route of ['login','register'])for(const lang of ['en','ar']){
  await page.goto(base+route+'/?lang='+lang);await page.locator('#auth-form').waitFor();assert.equal(await page.locator('.auth-partners img').count(),4);assert.equal(await page.locator('.auth-story-bottom').count(),0);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForFunction(()=>[...document.querySelectorAll('.auth-partners img')].every(i=>i.complete&&i.naturalWidth));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${out}/${route}-${lang}-${width}.png`,fullPage:true});}
 }
 pass('Live login/signup display the supplied title and four partner logos in English/Arabic without desktop/mobile overflow');
 const assets=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(u=>new URL(u).pathname.startsWith('/assets/')));
 for(const url of [...new Set(assets)]){const path=new URL(url).pathname.slice(1),entry=manifest.files.find(f=>f.path===path);assert.ok(entry,path);const response=await ctx.request.get(url);assert.equal(response.status(),200);assert.equal(hash(await response.body()),entry.sha256);assert.ok(!path.endsWith('.js')||entry.bytes<200000,'Heavy PDF engine loaded on auth page');}
 pass('Served auth assets match release hashes; heavy PDF engines remain deferred');
 csrf=(await(await get('api/management.php?action=session')).json()).csrf;
 const credentials=JSON.parse(await fs.readFile('tmp/superadmin-production/credentials.json','utf8'));const login=await post('login',{username:credentials.username,password:credentials.password});assert.equal(login.status(),200);const auth=await login.json();assert.equal(auth.role,'superadmin');csrf=auth.csrf;
 const read=async(action,params={})=>{const r=await get('api/portal.php?'+new URLSearchParams({action,...params}));assert.equal(r.status(),200);return r.json();};
 const settings=await read('admin_workflow');assert.equal(settings.workflow.review_enabled,false);assert.ok(settings.history.some(e=>e.admin_username==='system:direct-intake'));
 const dashboard=await read('admin_dashboard'),queue=await read('admin_submissions');assert.ok(queue.submissions.every(s=>!s.archived_at));assert.ok(dashboard.recent.every(s=>!s.archived_at));
 assert.ok(queue.submissions.every(s=>['saved','received'].includes(s.presentation_status)));assert.equal((await read('admin_submissions',{q:'__no_matching_direct_intake_qa__'})).total,0);
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'management/?lang=en');await page.locator('.admin-stats').waitFor();assert.equal(await page.locator('[data-management-view="workflow"]').count(),0);await page.locator('[data-management-view="reviews"]').click();await page.locator('#review-filters').waitFor();assert.equal(await page.locator('.review-form,[data-review-status]').count(),0);
 pass('Superadmin login, direct-intake migration, current-submissions filters and management navigation work; previous records remain accessible');
 const {docs}=await import('../src/forms/index.js');
 for(const doc of docs){const name=(doc.pdfUrl||doc.id+'.pdf').split('?')[0].split('/').pop(),r=await get('pdfs/'+name);assert.equal(r.status(),200);assert.equal(hash(await r.body()),hash(await fs.readFile('public/pdfs/'+name)));}
 const consent=await get('pdfs/al-naeem-terms-consent.pdf');assert.equal(consent.status(),200);assert.equal(hash(await consent.body()),hash(await fs.readFile('public/pdfs/al-naeem-terms-consent.pdf')));
 pass('All eight editable templates and consent download match the verified local PDFs');
 const item=queue.submissions[0];if(item){const detail=(await read('admin_detail',{id:item.id})).submission;assert.ok(detail.answers&&detail.profile);const r=await get('api/portal.php?action=admin_pdf&id='+item.id);assert.equal(r.status(),200);assert.equal(hash(await r.body()),detail.sha256);pass('Existing production submission details and its PDF remain readable and hash-consistent');}
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;report.passed=false;throw error;}
finally{if(csrf)await post('logout',{}).catch(()=>{});report.finished=new Date().toISOString();await fs.writeFile('docs/next-update-live-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
