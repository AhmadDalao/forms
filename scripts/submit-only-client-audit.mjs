// Client review labels follow the global mode; persisted cases remain intact.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,firefox,webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const samples=JSON.parse(await fs.readFile((process.env.PDF_AUDIT_OUTPUT||'tmp/client-corrections-pdfs')+'/records.json','utf8')).filter(r=>r.sample==='english');
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[],passed:false};let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);},call=(c,a,o)=>f.call(c,'portal',a,o);
const mode=async(c,enabled)=>{let {workflow:w}=await call(c,'admin_workflow');if(w.review_enabled!==enabled)w=(await call(c,'admin_workflow_update',{data:{reviewEnabled:enabled,expectedRevision:w.revision,requestKey:randomUUID()}})).workflow;return w;};
const ready=p=>p.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
const stateClasses='.review-pending,.review-approved,.review-rejected,.review-correction_required,.review-signature_required';
try{
 for(const [engine,launcher]of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});const owner=await browser.newContext();await f.login(owner,'superadmin');
  for(const audience of ['individual','corporate']){
   const c=await browser.newContext(),user=await f.client(c,audience),folder=audience==='individual'?'individuals':'companies',docs=audience==='individual'?['subscription-form','kyc-individual','signature-form','al-naeem-terms-consent','fatca-crs-individual','terms-and-conditions']:['subscription-company','kyc-corporate','signature-form','al-naeem-terms-consent','fatca-crs-corporate','terms-and-conditions'];
   const rows=[];
   for(const [i,document]of docs.entries()){
    const w=await mode(owner,i>0),s=await f.submit(c,user,{document,workflowRevision:w.revision,values:samples.find(r=>r.doc===document).values,signatures:{},signatureModes:{}});rows.push(s);
    const status=[null,null,'correction_required','signature_required','approved','rejected'][i];
    if(status)await call(owner,'admin_review',{data:{id:s.id,status,reason_text:status+' QA decision note',expectedRevision:0,requestKey:randomUUID()}});
   }
   const snapshots=async()=>Promise.all(rows.map(async s=>{const {submission:d}=await call(owner,'admin_detail',{params:{id:s.id}});return {id:d.id,status:d.review_status,hash:d.sha256,answers:d.answers,history:d.review_history};}));const baseline=await snapshots();
   await mode(owner,false);page=await c.newPage();page.on('pageerror',err=>report.errors.push(err.message));
   for(const lang of ['en','ar'])for(const width of [1440,390]){
    await page.setViewportSize({width,height:950});await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.waitForFunction(()=>document.querySelectorAll('[data-filled]').length===6);
    assert.equal(await page.locator('.card-status .review-received').count(),6);assert.equal(await page.locator(stateClasses).count(),0);assert.equal(await page.locator('.card-status [data-signature-state]').count(),6);
    assert.equal(await page.locator('[data-card="'+docs[4]+'"] .review-reason,[data-card="'+docs[5]+'"] .review-reason').count(),0);
    assert.equal(await page.locator('[data-follow-up=edit]').count(),1);assert.equal(await page.locator('[data-follow-up=upload]').count(),1);
    await page.locator('[data-notification-bell]').click();await page.locator('[data-notification]').first().waitFor();assert.equal(await page.locator('.notification-reason').count(),0);assert.ok((await page.locator('.notification-item-head strong').allTextContents()).every(s=>s===(lang==='en'?'Form update':'تحديث النموذج')));
    await page.locator('[data-notification-preview="'+rows[2].id+'"]').click();await ready(page);assert.equal(await page.locator('.portal-preview '+stateClasses.split(',').join(',.portal-preview ')).count(),0);assert.equal(await page.locator('.portal-preview .review-received').count(),1);assert.equal(await page.locator('.portal-preview [data-follow-up=edit]').count(),1);await page.locator('.portal-preview [data-close]').click();await page.locator('.notification-dialog [data-close]').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(width===1440)await page.screenshot({path:f.out+`/submit-only-${engine}-${audience}-${lang}.png`,fullPage:true});
   }
   // An already-open tab must update when it learns of a new mode.
   await mode(owner,true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.card-status .review-rejected').waitFor();assert.equal(await page.locator('.card-status '+stateClasses.split(',').join(',.card-status ')).count(),5);
   await page.locator('[data-notification-bell]').click();await page.locator('.notification-reason').first().waitFor();await page.locator('[data-notification-preview="'+rows[2].id+'"]').click();await ready(page);await page.locator('.portal-preview .review-correction_required').waitFor();
   await mode(owner,false);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.portal-preview .review-received').waitFor();assert.equal(await page.locator('.portal-preview .review-correction_required').count(),0);assert.equal(await page.locator('.portal-preview [data-follow-up=edit]').count(),1);await page.locator('.portal-preview [data-close]').click();assert.equal(await page.locator('.notification-reason').count(),0);await page.locator('.notification-dialog [data-close]').click();
   if(engine==='chrome'&&audience==='individual'){
    await page.route('**/api/portal.php?action=signing_details*',r=>r.abort());await page.locator('[data-follow-up=sign]').click();await page.locator('.portal-signing [role=alert]').waitFor();assert.equal(await page.locator('.portal-signing a').count(),1);await page.locator('.portal-signing [data-close]').click();await page.unroute('**/api/portal.php?action=signing_details*');
    pass('Signing-details network failure displays an upload fallback without a JavaScript exception');
   }
   assert.deepEqual(await snapshots(),baseline);pass(engine+' / '+audience+': off shows receipt/signature status only across cards, notifications and preview; on restores decisions; live mode changes update open views; existing follow-ups and stored decisions/PDFs preserved');
   await c.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/client-mode-failure.png'}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/submit-only-client-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/submit-only-client-report.json');await browser?.close();await f.close();}
