// Verify categorized dashboard answers and preview presentation with synthetic data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {fixture} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
import {submissionDetailsModel} from '../src/portal/submitted-details.js';
const pdfDirectory=process.env.PDF_AUDIT_OUTPUT||'tmp/client-corrections-pdfs';
const samples=JSON.parse(await fs.readFile(pdfDirectory+'/records.json','utf8'));
const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true});
const report={checks:[],errors:[],forms:[],screenshots:[]};
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const preview=async(p,selector,pages,submission,lang)=>{
 await p.locator(selector).first().click();await p.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
 const modal=p.locator('.portal-preview');
 assert.equal(await modal.locator('canvas').count(),pages);
 assert.ok((await modal.locator('canvas').evaluateAll(items=>items.map(c=>({w:c.width,h:c.height,d:getComputedStyle(c).direction})))).every(c=>c.w>0&&c.h>0&&c.d==='ltr'));
 assert.equal(await modal.locator('details[open], [data-shared-snapshot], [data-shared-field]').count(),0);
 await modal.locator('.portal-answer-details>summary').click();
 assert.equal(await modal.locator('.submitted-details details[open]').count(),0);
 const section=modal.locator('[data-submission-section]').first();
 await section.locator('summary').focus();await p.keyboard.press('Enter');
 assert.equal(await section.getAttribute('open'),'');
 assert.equal(await section.locator('summary').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(72, 35, 95)');
 assert.equal(await section.locator('[data-answer-field]').first().isVisible(),true);
 assert.equal(await modal.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await section.locator('summary').focus();await p.keyboard.press('Enter');
 assert.equal(await section.locator('[data-answer-field]').first().isVisible(),false);
 if(submission){
  const model=submissionDetailsModel(submission,lang),body=modal.locator('.submitted-details');
  assert.deepEqual(await body.locator('[data-submission-section]>summary').allTextContents(),model.groups.map(g=>g.label));
  assert.equal(await body.locator('[data-answer-field]').count(),model.groups.reduce((n,g)=>n+g.fields.length,0));
  for(const group of model.groups){
   const section=body.locator('[data-submission-section="'+group.id+'"]');await section.locator(':scope>summary').click();
   for(const field of group.fields){const row=section.locator('[data-answer-field="'+field.id+'"]');assert.equal(await row.count(),1);assert.equal(await row.locator('dt').innerText(),field.label);assert.equal((await row.locator('dd').innerText()).trim(),field.value.trim());assert.equal(await row.locator('dd').getAttribute('dir'),field.direction);assert.equal(await row.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}
  }
  const cols=await body.locator('.submitted-fields').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,p.viewportSize().width===390?1:2);
  if(submission.doc_id.startsWith('subscription-')){const path=f.out+'/preview-details-'+submission.audience+'-'+lang+'-'+p.viewportSize().width+'.png';await modal.locator('.portal-answer-details').scrollIntoViewIfNeeded();await p.screenshot({path});report.screenshots.push(path);}
 }
 await modal.locator('[data-close]').click();
};
try{
 const owner=await browser.newContext();await f.login(owner,'superadmin');
 const people=[];
 for(const audience of ['individual','corporate']){const context=await browser.newContext(),user=await f.client(context,audience);people.push({context,user,submissions:[]});}
 for(const doc of docs){
  const person=people.find(p=>p.user.account_type===(doc.group==='corporate'?'corporate':'individual'));
  const sample=samples.find(s=>s.doc===doc.id&&s.sample==='english');assert.ok(sample);
  const workflow=(await f.call(person.context,'portal','session')).workflow;
  const metadata={account:person.user.id,document:doc.id,pdfVersion:doc.pdfVersion,audience:person.user.account_type,values:sample.values,profile:{},source:'online',signatures:{},signatureModes:{},expectedCurrent:null,workflowRevision:workflow.revision,requestKey:randomUUID(),submissionMode:'direct'};
  const result=await f.call(person.context,'portal','submit',{multipart:{metadata:JSON.stringify(metadata),pdf:{name:sample.file,mimeType:'application/pdf',buffer:await fs.readFile(pdfDirectory+'/'+sample.file)}},status:201});
  person.submissions.push((await f.call(owner,'portal','admin_detail',{params:{id:result.submission.id}})).submission);
 }
 const p=await owner.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 for(const lang of ['en','ar'])for(const width of [1440,390]){
  await p.setViewportSize({width,height:1000});await p.goto(f.base+'/management/?lang='+lang);await p.locator('.admin-stats').waitFor();
  if(await p.locator('html').getAttribute('lang')!==lang){await p.locator('[data-admin-language]').click();await p.locator('html[lang='+lang+']').waitFor();}
  const dashboard=await f.call(owner,'portal','admin_dashboard');
  for(const audience of ['individual','corporate']){
   const docs=dashboard.categories.filter(d=>[audience,'shared'].includes(d.group)),column=p.locator('[data-category-audience='+audience+']');
   assert.equal(await column.locator('article').count(),docs.length);
   for(const doc of docs){const card=column.locator('[data-category-document="'+doc.id+'"]'),expected=dashboard.counts.filter(c=>c.doc_id===doc.id&&c.audience===audience).reduce((sum,c)=>sum+Number(c.active_count),0);assert.equal(await card.locator('.category-count').innerText(),String(expected));assert.equal(await card.locator('b').innerText(),lang==='ar'?doc.ar:doc.title);}
  }
  await p.locator('[data-review-open=all]').click();await p.locator('[data-review-audience]').waitFor();
  for(const person of people){
   const audience=person.user.account_type;await p.locator('[data-review-audience]').selectOption(audience);
   await p.waitForFunction(({type,n})=>{const b=[...document.querySelectorAll('.admin-review-results [data-account-type]')];return b.length===n&&b.every(x=>x.dataset.accountType===type);},{type:audience,n:person.submissions.length});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  pass(lang+' '+width+': category titles/counts, audience filters and dashboard layout');
  for(const person of people){
   await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();await p.locator('[data-client="'+person.user.id+'"]').click();await p.locator('.admin-client-facts').waitFor();
   assert.equal(await p.locator('[data-client-account-type] [data-account-type]').getAttribute('data-account-type'),person.user.account_type);
   assert.equal(await p.locator('[data-account-shared-profiles],.admin-shared-details').count(),0);
   assert.equal(await p.locator('.admin-profile-overview').count(),1);assert.equal(await p.locator('#client-submitted-details,#submitted-version,[data-profile-details-body]').count(),0);
   const profileShot=f.out+'/profile-'+person.user.account_type+'-'+lang+'-'+width+'.png';await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:profileShot});report.screenshots.push(profileShot);
   for(const s of person.submissions){
    const doc=docs.find(d=>d.id===s.doc_id),model=submissionDetailsModel(s,lang);
    await preview(p,'.admin-profile-documents [data-preview="'+s.id+'"]',doc.pages,s,lang);
    report.forms.push({document:s.doc_id,audience:s.audience,lang,width,groups:model.groups.length,fields:model.groups.reduce((n,g)=>n+g.fields.length,0),previewPages:doc.pages});
   }
   await preview(p,'[data-preview="'+person.submissions[0].id+'"]',docs.find(d=>d.id===person.submissions[0].doc_id).pages);
  }
  pass(lang+' '+width+': all nine saved forms retain every answer and full PDF; all sections start closed, no duplicate shared data, keyboard toggles work through Current documents; duplicate details card absent');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{await fs.writeFile(f.out+'/admin-presentation-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/admin-presentation-report.json');await browser.close();await f.close();}
