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
const preview=async(p,selector,pages)=>{await p.locator(selector).first().click();await p.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');assert.equal(await p.locator('.portal-preview canvas').count(),pages);assert.ok((await p.locator('.portal-preview canvas').evaluateAll(items=>items.map(c=>({w:c.width,h:c.height,d:getComputedStyle(c).direction})))).every(c=>c.w>0&&c.h>0&&c.d==='ltr'));await p.locator('.portal-preview [data-close]').click();};
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
  assert.equal(await p.locator('.category-stats article').count(),dashboard.categories.length);
  for(const [i,doc] of dashboard.categories.entries()){
   const card=p.locator('.category-stats article').nth(i),expected=dashboard.counts.filter(c=>c.doc_id===doc.id).reduce((sum,c)=>sum+c.active_count,0);
   assert.equal(await card.locator('.category-count').innerText(),String(expected));assert.equal(await card.locator('b').innerText(),lang==='ar'?doc.ar:doc.title);
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const shot=f.out+'/dashboard-'+lang+'-'+width+'.png';await p.screenshot({path:shot,fullPage:true});report.screenshots.push(shot);
  await p.locator('[data-management-view=reviews]').click();await p.locator('#review-filters').waitFor();
  for(const person of people){
   const audience=person.user.account_type;await p.locator('[data-review-audience]').selectOption(audience);
   await p.waitForFunction(({type,n})=>{const b=[...document.querySelectorAll('.admin-review-results [data-account-type]')];return b.length===n&&b.every(x=>x.dataset.accountType===type);},{type:audience,n:person.submissions.length});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  pass(lang+' '+width+': category titles/counts, audience filters and dashboard layout');
  for(const person of people){
   await p.locator('[data-users]').click();await p.locator('#client-search').waitFor();await p.locator('[data-client="'+person.user.id+'"]').click();await p.locator('.admin-client-facts').waitFor();
   assert.equal(await p.locator('[data-client-account-type] [data-account-type]').getAttribute('data-account-type'),person.user.account_type);
   for(const s of person.submissions){
    await p.locator('#submitted-version').selectOption(s.id);await p.locator('[data-profile-details-body][aria-busy=false] [data-submitted-version="'+s.id+'"]').waitFor();
    const model=submissionDetailsModel(s,lang),body=p.locator('[data-profile-details-body]');
    assert.deepEqual(await body.locator('[data-submission-section]>summary').allTextContents(),model.groups.map(g=>g.label));
    assert.equal(await body.locator('[data-submission-section][open]').count(),0);
    assert.equal(await body.locator('[data-answer-field]').count(),model.groups.reduce((n,g)=>n+g.fields.length,0));
    for(const group of model.groups){
     const section=body.locator('[data-submission-section="'+group.id+'"]');await section.locator(':scope>summary').click();
     for(const field of group.fields){const row=section.locator('[data-answer-field="'+field.id+'"]');assert.equal(await row.count(),1);assert.equal(await row.locator('dt').innerText(),field.label);assert.equal((await row.locator('dd').innerText()).trim(),field.value.trim());}
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const cols=await body.locator('.submitted-fields').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,width===390?1:2);
    if(s.doc_id.startsWith('subscription-')){await p.locator('#client-submitted-details').scrollIntoViewIfNeeded();const path=f.out+'/details-'+person.user.account_type+'-'+lang+'-'+width+'.png';await p.screenshot({path});report.screenshots.push(path);}
    const doc=docs.find(d=>d.id===s.doc_id);await preview(p,'[data-details-preview]',doc.pages);
    report.forms.push({document:s.doc_id,audience:s.audience,lang,width,groups:model.groups.length,fields:model.groups.reduce((n,g)=>n+g.fields.length,0),previewPages:doc.pages});
   }
   await preview(p,'[data-preview="'+person.submissions[0].id+'"]',docs.find(d=>d.id===person.submissions[0].doc_id).pages);
  }
  pass(lang+' '+width+': all nine saved forms have categorized, collapsible, complete fields and full previews; both management preview buttons work');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{await fs.writeFile(f.out+'/admin-presentation-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/admin-presentation-report.json');await browser.close();await f.close();}
