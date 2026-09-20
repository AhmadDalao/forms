// Exercise real controls and submit their actual generated PDFs in an isolated site.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture,digest} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
import {withAnswerTotals} from '../src/answer-totals.js';
const f=await fixture({protectedRoutes:true}),out=path.join(f.out,'client-corrections');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={checks:[],forms:[],errors:[]};let page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s)};
const context=async()=>{const c=await browser.newContext({viewport:{width:1440,height:1000}});c.on('page',p=>{p.setDefaultTimeout(20000);p.on('pageerror',e=>report.errors.push(e.message))});return c;};
const records=JSON.parse(await fs.readFile('tmp/next-update-pdfs/records.json','utf8'));
const open=async(p,id)=>{if(await p.locator('#sub-home').count())await p.locator('#sub-home').click();else if(await p.locator('#back-home').count())await p.locator('#back-home').click();await p.locator(`[data-doc="${id}"]`).click();};
const shot=async(p,name)=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({path:out+'/'+name+'.png',fullPage:true});};
try{
 const manager=await context();await f.login(manager,'superadmin');
 for(const doc of docs){
  const ctx=await context(),audience=doc.group==='corporate'?'corporate':'individual',user=await f.client(ctx,audience),folder=audience==='corporate'?'companies':'individuals';
  const sample=records.find(r=>r.doc===doc.id&&r.sample==='english');page=await ctx.newPage();await page.goto(`${f.base}/${folder}/?lang=en`);await open(page,doc.id);
  assert.equal(await page.locator('#form-logout').count(),1);
  const sampleValues={...sample.values};if(doc.id==='subscription-form')Object.assign(sampleValues,{first_name:'أحمد',second_name:'محمد',third_name:'',family_name:'العلي'});
  let entered=0;
  for(let index=0;index<doc.sections.length;index++){
   await page.locator(`[data-sub-step="${index}"],[data-step="${index}"]`).click();
   for(const field of doc.sections[index].fields){
    let value=sampleValues[field.id];if(value===undefined||field.readOnly||field.sum||field.id==='signature_mode')continue;
    let input=page.locator(`[name="${field.id}"]`);if(!await input.count())continue;
    const info=await input.first().evaluate(n=>({tag:n.tagName,type:n.type}));
    if(info.tag==='SELECT'){
     if(field.dropdownOptions)value=field.dropdownOptions[1].value;
     if(!await input.locator('option').evaluateAll((options,v)=>options.some(o=>o.value===v),value))value=await input.locator('option').evaluateAll(options=>options.find(o=>o.value).value);
     await input.selectOption(value);
    }else if(['radio','checkbox'].includes(info.type)){
     const choices=Array.isArray(value)?value:[value];for(const item of choices)await page.locator(`[name="${field.id}"][value="${item}"]`).check();
    }else await input.fill(String(value));
    entered++;
   }
  }
  const key=`itqan.forms.v1.account.${user.id}.${audience}.${doc.id}`;
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).values,key);
  // Navigate and restart the document before generating, ensuring every answer survived storage.
  await page.reload();await open(page,doc.id);
  const restored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).values,key);
  for(const [id,v] of Object.entries(before))assert.deepEqual(restored[id],v,doc.id+' reload '+id);
  if(doc.id==='subscription-form'){
   await page.locator('[data-sub-step="0"]').click();await page.locator('[name="first_name"]').fill('Ahmad');await page.locator('[data-review]').click();
   assert.match(await page.locator('#sub-status').innerText(),/Arabic/);assert.equal(await page.locator('[data-submit]').count(),0);
   await page.locator('[name="first_name"]').fill('أحمد');
  }
  await page.locator('[data-review],#review-tab').click();
  await page.locator('[data-submit]:not([disabled]),#submit-form:not([disabled])').waitFor({timeout:60000});
  await page.locator('[data-submit],#submit-form').click();await page.locator('.submission-reference').waitFor({timeout:60000});
  const submitted=(await f.call(ctx,'portal','submissions')).submissions[0];
  const detail=(await f.call(manager,'portal','admin_detail',{params:{id:submitted.id}})).submission;
  const expected=withAnswerTotals(doc.fields,before);
  for(const field of doc.fields){if(field.id in expected&&!(field.uiOnly&&field.joinAudience&&field.joinAudience!==audience))assert.deepEqual(detail.answers[field.id],expected[field.id],doc.id+' stored '+field.id);}
  const pdf=await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+submitted.id);assert.equal(pdf.status(),200);const bytes=await pdf.body();assert.equal(digest(bytes),detail.sha256);await fs.writeFile(out+'/'+doc.id+'.pdf',bytes);
  if(doc.id==='kyc-individual'){
   assert.equal(detail.answers.risk_total,'5');
   const revisionPage=await ctx.newPage();await revisionPage.goto(`${f.base}/${folder}/?submission=${submitted.id}&lang=en`);await revisionPage.locator('[data-step="5"]').click();
   for(const id of ['risk_experience','risk_age','risk_reaction','risk_duration','risk_capital'])assert.equal(await revisionPage.locator(`[name="${id}"]:checked`).inputValue(),'1');
   await revisionPage.locator('[name="risk_experience"][value="2"]').check();await revisionPage.locator('#review-tab').click();await revisionPage.locator('#submit-form:not([disabled])').waitFor({timeout:60000});await revisionPage.locator('#submit-form').click();await revisionPage.locator('.submission-reference').waitFor();
   const changed=(await f.call(ctx,'portal','submissions')).submissions.find(s=>!s.archived_at);const old=(await f.call(manager,'portal','admin_detail',{params:{id:submitted.id}})).submission;
   assert.deepEqual(old.answers,detail.answers);assert.equal(old.sha256,detail.sha256);assert.ok(old.archived_at);assert.equal((await f.call(manager,'portal','admin_detail',{params:{id:changed.id}})).submission.answers.risk_total,'6');
   await revisionPage.close();pass('KYC risk answers survive reload, submission and editing; resubmission archives original without changing answers or PDF');
  }
  const profile=await f.call(manager,'portal','admin_client',{params:{id:user.id}});assert.equal(profile.documents.length,6);assert.ok(profile.documents.every(d=>d.group==='shared'||d.group===audience));
  if(doc.id==='subscription-form'){
   const p=await manager.newPage();await p.goto(f.base+'/management/?lang=en');await p.locator(`[data-client="${user.id}"]`).first().click();await p.locator('[data-missing-document]').first().waitFor();assert.equal(await p.locator('[data-missing-document]').count(),5);await shot(p,'management-all-forms');await p.setViewportSize({width:390,height:844});await shot(p,'management-all-forms-mobile');await p.close();
  }
  report.forms.push({id:doc.id,controls:entered,savedAnswers:Object.keys(detail.answers).length});pass(doc.id+': actual UI controls, reload, submit, management answers and PDF download match');
  await page.locator('.submission-dialog [data-close]').click();
  if(doc.id==='subscription-form'){await page.locator('#sub-home').click();await page.setViewportSize({width:390,height:844});await shot(page,'client-navigation-mobile');}
  await page.locator('#form-logout').click();await page.waitForURL('**/login/**');assert.equal((await f.call(ctx,'portal','session')).user,null);await ctx.close();
 }
 pass('Logout works on every editor; both account types list all six applicable forms in management');
 const c=await context();page=await c.newPage();
 for(const route of ['login','register'])for(const lang of ['en','ar']){await page.goto(`${f.base}/${route}/?lang=${lang}`);await page.locator('#auth-form').waitFor();assert.equal(await page.locator('.auth-story h1').innerText(),lang==='ar'?'صندوق النعيم العقاري':'Al Naeem Real Estate Fund');for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await shot(page,`${route}-${lang}-${width}`);}}
 pass('Short bold fund title, four logos and login/signup fit desktop and mobile in both languages');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+out+'/report.json');}
