// End-to-end direct intake and automatic sharing against an isolated installation.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,digest} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
const f=await fixture({protectedRoutes:true}),out=path.join(f.out,'direct-intake');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),contexts=[],report={checks:[],errors:[],base:f.base};let page;
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
async function context(cookies){const c=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(c);if(cookies)await c.addCookies(cookies);c.on('page',p=>{p.setDefaultTimeout(20000);p.on('pageerror',e=>report.errors.push(e.message));});return c;}
async function shot(p,name){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
const shared=async(c,u)=>(await f.call(c,'portal','shared_profile',{params:{account:u.id,audience:u.account_type}})).shared;
async function waitShared(c,u,wanted){for(let i=0;i<160;i++){const s=await shared(c,u);if(Object.entries(wanted).every(([k,v])=>s.profile[k]===v))return s;await new Promise(r=>setTimeout(r,100));}assert.fail('Shared data not received: '+JSON.stringify(wanted));}
async function home(p){if(await p.locator('#sub-home').count())await p.locator('#sub-home').click();else if(await p.locator('#back-home').count())await p.locator('#back-home').click();await p.locator('.home').waitFor();}
async function doc(p,id){await home(p);await p.locator(`[data-doc="${id}"]`).click();await p.locator('.workspace').waitFor();await p.locator('[data-sub-step="0"],[data-step="0"]').click();assert.equal(await p.locator('#shared-fields-panel,#shared-fields-form,#edit-shared-details').count(),0);}
const fill=async(p,v)=>{for(const [id,value] of Object.entries(v)){const el=p.locator(`[name="${id}"]`);if(await el.evaluate(n=>n.tagName)==='SELECT')await el.selectOption(value);else await el.fill(value);}};
const val=(p,id)=>p.locator(`[name="${id}"]`).inputValue();
try{
 const anon=await context();page=await anon.newPage();const requests=[];page.on('request',r=>requests.push(r.url()));
 for(const route of ['login','register'])for(const lang of ['en','ar']){
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${f.base}/${route}/?lang=${lang}`);await page.locator('#auth-form').waitFor();
  assert.equal(await page.locator('.auth-partners img').count(),4);assert.equal(await page.locator('.auth-story-bottom').count(),0);
  assert.match(await page.locator('.auth-story h1').innerText(),lang==='ar'?/^صندوق النعيم العقاري$/:/^Al Naeem Real Estate Fund$/);
  await page.waitForFunction(()=>[...document.querySelectorAll('.auth-partners img')].every(i=>i.complete&&i.naturalWidth>0));await shot(page,route+'-'+lang+'-desktop');
  await page.setViewportSize({width:390,height:844});await shot(page,route+'-'+lang+'-mobile');
 }
 assert.equal(requests.some(url=>/\/pdfs\/|pdf\.worker/.test(url)),false);for(const url of requests.filter(url=>/\/assets\/.*\.js$/.test(url)))assert.ok((await fs.stat(f.out+'/site'+new URL(url).pathname)).size<200000,'Heavy PDF engine loaded at sign-in');pass('Login/signup: EN and AR, desktop/mobile, source logos and role labels, no PDF engine or PDF loaded');
 for(const route of ['/','/individuals/','/companies/']){const r=await anon.request.get(f.base+route,{maxRedirects:0});assert.equal(r.status(),302);assert.match(r.headers().location,/login/);}pass('Logged-out document routes redirect to sign-in');
 const owner=await context(),user=await f.client(owner,'individual'),company=await context(),corporate=await f.client(company,'corporate'),other=await context(),otherUser=await f.client(other,'individual');
 const workflow=(await f.call(owner,'portal','session')).workflow;assert.equal(workflow.review_enabled,false);assert.ok(workflow.revision>=1);
 page=await owner.newPage();await page.goto(f.base+'/individuals/?lang=en');await doc(page,'subscription-form');
 await fill(page,{first_name:'أحمد',second_name:'محمد',third_name:'',family_name:'الغامدي',en_first:'Ahmad',en_second:'Mohammed',en_third:'',en_last:'Al Ghamdi',id_type:'national',id_number:'0012345',nationality:'سعودي'});
 await shot(page,'bilingual-subscription');await page.locator('[data-sub-step="1"]').click();await fill(page,{email:'first.last+qa@example.test',city:'Riyadh',district:'Al Nakheel',country:'Saudi Arabia'});
 await waitShared(owner,user,{ar_first:'أحمد',en_first:'Ahmad',en_second:'Mohammed',ar_third:'',email:'first.last+qa@example.test',city:'Riyadh'});
 await doc(page,'kyc-individual');assert.equal(await val(page,'address_city'),'Riyadh');assert.equal(await val(page,'address_district'),'Al Nakheel');assert.equal(await val(page,'name_first'),'أحمد');assert.equal(await val(page,'email'),'first.last+qa@example.test');
 await fill(page,{address_city:'Jeddah'});await waitShared(owner,user,{mail_city:'Jeddah',city:'Jeddah'});await doc(page,'fatca-crs-individual');assert.equal(await val(page,'en_first'),'Ahmad');assert.equal(await val(page,'ar_first'),'أحمد');pass('Real form edits propagate separate Arabic/English names and joined city/district to account and other forms');
 await doc(page,'kyc-individual');await owner.setOffline(true);await fill(page,{email:'offline.retry@example.test'});await page.waitForTimeout(1000);await owner.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await waitShared(owner,user,{email:'offline.retry@example.test'});
 await fill(page,{email:''});await waitShared(owner,user,{email:''});await page.reload();await page.locator('.home,.workspace').waitFor();await doc(page,'kyc-individual');assert.equal(await val(page,'email'),'');pass('Offline edits retry to account; intentional clear persists after reload');
 const second=await owner.newPage();await second.goto(f.base+'/individuals/?lang=ar');await doc(second,'subscription-form');await fill(second,{en_second:'Khalid'});await waitShared(owner,user,{en_second:'Khalid'});await doc(page,'fatca-crs-individual');await page.waitForFunction(()=>document.querySelector('[name=en_second]')?.value==='Khalid');assert.equal(await val(page,'en_second'),'Khalid');
 const fresh=await context(await owner.cookies()),freshPage=await fresh.newPage();await freshPage.goto(f.base+'/individuals/?lang=ar');await doc(freshPage,'subscription-form');assert.equal(await val(freshPage,'en_second'),'Khalid');assert.equal(await val(freshPage,'first_name'),'أحمد');assert.ok(!(await shared(other,otherUser)).profile.ar_first);assert.ok(!(await shared(company,corporate)).profile.ar_first);pass('Multiple tabs, fresh browser and individual/company/account isolation');
 const cp=await company.newPage();await cp.goto(f.base+'/companies/?lang=en');await doc(cp,'subscription-company');await fill(cp,{company_name:'شركة النور',english_name:'Al Noor Company'});await waitShared(company,corporate,{company_name_ar:'شركة النور',company_name_en:'Al Noor Company'});await doc(cp,'fatca-crs-corporate');assert.equal(await val(cp,'legal_name'),'Al Noor Company');await fill(cp,{legal_name:'Al Noor Investment'});await waitShared(company,corporate,{company_name_en:'Al Noor Investment'});await doc(cp,'subscription-company');assert.equal(await val(cp,'company_name'),'شركة النور');assert.equal(await val(cp,'english_name'),'Al Noor Investment');pass('Company English sharing is bidirectional and separate from Arabic identity');
 await doc(page,'signature-form');await page.locator('#review-tab').click();await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});
 let loseOnce=true,submitPosts=0;await page.route('**/api/portal.php?action=submit',async route=>{submitPosts++;if(loseOnce){loseOnce=false;await route.fetch();await route.abort('connectionfailed');}else await route.continue();});
 await page.locator('#submit-form').evaluate(button=>{button.click();button.click();});await page.locator('[data-retry]:not([hidden])').waitFor();assert.equal((await f.call(owner,'portal','submissions')).submissions.length,1,'First attempt committed despite lost response');await page.locator('[data-retry]').click();await page.locator('.submission-reference').waitFor();assert.equal(submitPosts,2);assert.equal((await f.call(owner,'portal','submissions')).submissions.length,1,'Retry never duplicates');assert.equal(await page.locator('[data-confirm]').count(),0);await shot(page,'direct-receipt');
 const submitted=(await f.call(owner,'portal','submissions')).submissions[0];assert.equal(submitted.presentation_status,'received');assert.equal(submitted.signature_state,'unsigned');assert.equal(submitted.submission_mode,'direct');pass('One-click unsigned submission, lost-response retry, single immutable version and receipt reference');
 const original=(await f.call(owner,'portal','detail',{params:{id:submitted.id}})).submission;
 const signed=await f.submit(owner,user,{document:'signature-form',values:{client_name:'Updated Customer'},expectedCurrent:submitted.id,editedFrom:submitted.id,workflowRevision:workflow.revision});assert.equal(signed.version,2);
 const after=(await f.call(owner,'portal','detail',{params:{id:submitted.id}})).submission;
 for(const key of ['answers','profile','signatures','sha256','created_at'])assert.deepEqual(after[key],original[key],key+' immutable');assert.ok(after.archived_at);
 const conflict=await f.submit(owner,user,{expectedCurrent:submitted.id,workflowRevision:workflow.revision,status:409});assert.equal(conflict.error,'version_conflict');pass('Signed replacement archives the earlier PDF and all captured answers; stale replacement is rejected');
 const uploaded=await f.submit(owner,user,{document:'al-naeem-terms-consent',source:'upload',signedConfirmed:false,workflowRevision:workflow.revision});const uploadDetails=(await f.call(owner,'portal','detail',{params:{id:uploaded.id}})).submission;assert.equal(uploadDetails.source,'upload');assert.equal(uploadDetails.signature_state,'unknown');assert.deepEqual(uploadDetails.answers,[]);pass('Consent PDF upload works without inventing structured answers or signature verification');
 const manager=await context();await f.login(manager,'admin');const queue=await f.call(manager,'portal','admin_submissions');assert.equal(queue.total,2);assert.equal(queue.submissions.some(s=>s.id===submitted.id),false);
 assert.equal((await f.call(manager,'portal','admin_review',{data:{},status:409})).error,'workflow_disabled');assert.equal((await f.call(manager,'portal','admin_workflow_update',{data:{},status:409})).error,'workflow_disabled');
 const adminPage=await manager.newPage();page=adminPage;await page.goto(f.base+'/management/?lang=en');await page.locator('[data-management-view="reviews"]').click();await page.locator('#review-filters').waitFor();assert.equal(await page.locator('[data-workflow],[data-review-status],.review-form').count(),0);await shot(page,'management-submissions');await page.locator('[data-client="'+user.id+'"]').first().click();await page.locator('[data-preview="'+signed.id+'"]').click();await page.locator('.portal-preview').waitFor();await shot(page,'management-details');
 const detail=(await f.call(manager,'portal','admin_detail',{params:{id:signed.id}})).submission;assert.equal(detail.answers.client_name,'Updated Customer');
 for(const [action,params]of [['admin_pdf',{id:signed.id}],['admin_zip',{id:user.id}]]){const response=await manager.request.get(f.base+'/api/portal.php?'+new URLSearchParams({action,...params}));assert.equal(response.status(),200);assert.ok((await response.body()).length>1000);}
 const denied=await f.call(other,'portal','detail',{params:{id:signed.id},status:404});assert.ok(denied.error);pass('Management receives current versions, exact answers and signature status; preview/PDF/ZIP work; review controls disabled and cross-account access blocked');
 const pdfDirectory=process.env.PDF_AUDIT_OUTPUT||'tmp/next-update-pdfs',records=JSON.parse(await fs.readFile(pdfDirectory+'/records.json','utf8'));
 const fillClient=await context(),fillUser=await f.client(fillClient,'individual'),fillCompany=await context(),fillCompanyUser=await f.client(fillCompany,'corporate');
 let answerCount=0;
 for(const sample of records.filter(r=>r.sample==='english')){
  const definition=docs.find(d=>d.id===sample.doc),corporate=definition.group==='corporate',ctx=corporate?fillCompany:fillClient,account=corporate?fillCompanyUser:fillUser;
  const bytes=await fs.readFile(pdfDirectory+'/'+sample.file),metadata={account:account.id,document:definition.id,pdfVersion:definition.pdfVersion,audience:account.account_type,values:sample.values,profile:{},source:'online',signatures:{},signatureModes:{},expectedCurrent:null,workflowRevision:workflow.revision,requestKey:randomUUID(),submissionMode:'direct'};
  const result=await f.call(ctx,'portal','submit',{multipart:{metadata:JSON.stringify(metadata),pdf:{name:sample.file,mimeType:'application/pdf',buffer:bytes}},status:201});
  const stored=(await f.call(manager,'portal','admin_detail',{params:{id:result.submission.id}})).submission;assert.equal(stored.presentation_status,'received');assert.equal(stored.sha256,digest(bytes));
  for(const field of definition.fields){if(!(field.id in sample.values)||field.joinAudience&&field.joinAudience!==account.account_type)continue;assert.deepEqual(stored.answers[field.id],sample.values[field.id],definition.id+'/'+field.id);answerCount++;}
  const pdf=await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+stored.id);assert.equal(digest(await pdf.body()),digest(bytes));
 }
 report.allFormAnswers=answerCount;pass(`All nine filled forms submitted: ${answerCount} field values matched management records, and downloaded PDFs matched byte for byte`);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+out+'/report.json');}
