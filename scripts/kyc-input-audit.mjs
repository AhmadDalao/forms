// KYC input regression against a copied build and synthetic, isolated accounts.
// Run after npm run build; no production storage or existing accounts are used.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {docs} from '../src/forms/index.js';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture(),out=path.join(f.out,'kyc-input');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base:f.base,checks:[],records:[],errors:[],passed:false};
const samples=['12.345678','١٢٫٣٤٥٦٧٨','Portfolio QA entry'];
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
let page;
async function newContext(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 ctx.on('page',p=>{p.setDefaultTimeout(20000);p.on('pageerror',error=>report.errors.push(error.message));});
 return ctx;
}
async function openDoc(p,doc){
 await p.locator('.home,.workspace').waitFor();
 if(await p.locator('.home').count())await p.locator(`[data-doc="${doc.id}"]`).click();
 await p.locator('.workspace').waitFor();
}
async function section(p,doc,id){
 const index=doc.sections.findIndex(s=>s.fields.some(field=>field.id===id));
 assert.notEqual(index,-1,doc.id+'/'+id+' section');
 await p.locator(`[data-step="${index}"]`).click();
}
async function draft(p,user,doc){
 const key=`itqan.forms.v1.account.${user.id}.${doc.group}.${doc.id}`;
 return p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
}
async function matchInputs(p,wanted){
 for(const [id,value] of Object.entries(wanted))assert.equal(await p.locator(`[name="${id}"]`).inputValue(),value,id+' input');
}
async function checkRisk(p,doc){
 const questions=['risk_experience','risk_age','risk_reaction','risk_duration','risk_capital'];
 const total=doc.fields.find(field=>field.id==='risk_total'),funds=doc.fields.find(field=>field.id==='desired_funds');
 assert.deepEqual(total.sum,questions);assert.equal(total.paperNotes.length,3);
 assert.ok(questions.every(id=>doc.sections.at(-1).fields.some(field=>field.id===id)),doc.id+' final section has all five risk questions');
 await section(p,doc,'risk_total');
 for(const lang of ['en','ar']){
  if(await p.locator('html').getAttribute('lang')!==lang)await p.locator('#language').click();
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});
   for(const id of questions){
    const field=doc.fields.find(field=>field.id===id),wrapper=p.locator(`[data-field="${id}"]`);
    assert.equal(await wrapper.locator('.field-label').innerText(),lang==='ar'?field.ar:field.label,id+' printed question');
    assert.equal(await wrapper.locator('input').count(),field.options.length,id+' all printed answers');
   }
   assert.deepEqual(await p.locator('[data-field="risk_total"] .field-help').allTextContents(),total.paperNotes.map(note=>note[lang==='ar'?1:0]));
   assert.equal(await p.locator('[data-field="desired_funds"] .field-help').innerText(),lang==='ar'?funds.arHelp:funds.help);
   const clipped=await p.locator('#fields .field-label,#fields .field-help,#fields .option').evaluateAll(nodes=>nodes.filter(node=>{
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    // Arabic glyphs can extend beyond their line box while overflow stays
    // visible; that is not clipping. Only treat hidden overflow as clipped.
    return rect.left<-.5||rect.right>innerWidth+.5||
     (['hidden','clip'].includes(style.overflowX)&&node.scrollWidth>node.clientWidth+1)||
     (['hidden','clip'].includes(style.overflowY)&&node.scrollHeight>node.clientHeight+1);
   }).map(node=>node.textContent));
   assert.deepEqual(clipped,[],`${doc.id} ${lang} ${width}: risk text clipping`);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');
   await p.screenshot({path:path.join(out,`${doc.id}-risk-${lang}-${width}.png`),fullPage:true});
   await p.locator('[data-field="risk_total"]').screenshot({path:path.join(out,`${doc.id}-risk-notes-${lang}-${width}.png`)});
  }
 }
 await p.setViewportSize({width:1440,height:1000});
 pass(`${doc.id}: final risk section has all five questions and every answer choice; three printed risk bands and desired-fund qualification appear in EN/AR at desktop/mobile widths without clipping`);
}

try{
 const manager=await newContext();await f.login(manager,'admin');
 const adminPage=await manager.newPage();
 for(const doc of docs.filter(doc=>['kyc-individual','kyc-corporate'].includes(doc.id))){
  const ctx=await newContext(),user=await f.client(ctx,doc.group);
  page=await ctx.newPage();
  await page.goto(`${f.base}/${doc.group==='individual'?'individuals':'companies'}/?lang=${doc.group==='individual'?'en':'ar'}`);
  await openDoc(page,doc);
  const fields=doc.fields.filter(field=>/^(ideal|current)_/.test(field.id));
  assert.equal(fields.length,14,doc.id+' portfolio fields');
  const identity=doc.fields.find(field=>/id_type$/.test(field.id)&&field.options?.some(option=>option.value==='family'));
  assert.ok(identity,doc.id+' printed family identity option');
  await section(page,doc,identity.id);
  const select=page.locator(`select[name="${identity.id}"]`);
  assert.deepEqual(await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean)),identity.options.map(option=>option.value),doc.id+' must show all of its own printed ID choices');
  await select.selectOption('family');
  await section(page,doc,fields[0].id);
  for(const field of fields)assert.equal(await page.locator(`[name="${field.id}"]`).getAttribute('maxlength'),null,field.id+' arbitrary character cap');
  const typed=page.locator(`[name="${fields[0].id}"]`);
  await typed.fill('');await typed.pressSequentially(samples[0]);
  assert.equal(await typed.inputValue(),samples[0],doc.id+' real keystrokes accept more than six characters');

  let expected;
  // Rotate values so every cell exercises all three cases and the final PDF
  // contains Latin decimals, Arabic decimals and fitting long text together.
  for(let round=0;round<samples.length;round++){
   expected=Object.fromEntries(fields.map((field,index)=>[field.id,samples[(index+round)%samples.length]]));
   for(const [id,value] of Object.entries(expected))await page.locator(`[name="${id}"]`).fill(value);
   await matchInputs(page,expected);
   const saved=await draft(page,user,doc);
   for(const [id,value] of Object.entries(expected))assert.equal(saved.values[id],value,id+' saved draft');
   assert.equal(saved.values[identity.id],'family');
   await page.reload();await openDoc(page,doc);await section(page,doc,fields[0].id);await matchInputs(page,expected);
  }
  await section(page,doc,identity.id);await matchInputs(page,{[identity.id]:'family'});
  await checkRisk(page,doc);
  await section(page,doc,fields[0].id);
  await page.screenshot({path:path.join(out,doc.id+'-inputs.png'),fullPage:true});
  pass(`${doc.id}: real keystrokes exceed six characters; all 14 portfolio cells preserve all three long-input cases through draft storage and reload; printed family ID remains selectable`);

  await page.locator('#review-tab').click();
  await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});
  assert.equal(await page.locator('[data-field].invalid').count(),0,'Fitting text should generate successfully');
  const warnings=await page.locator('#fields-content .warning').allTextContents();
  assert.equal(warnings.length,2,'Letter samples must retain percentage guidance for both columns');
  for(const warning of warnings)assert.match(warning,/Enter percentages between 0 and 100|أدخل نسبًا من ٠ إلى ١٠٠/);
  const canvas=page.locator(`[data-full-page="${fields[0].page}"]`);
  await canvas.evaluate(node=>node.scrollIntoView());
  await page.waitForFunction(number=>document.querySelector(`[data-full-page="${number}"]`)?.width>300,fields[0].page);
  await canvas.screenshot({path:path.join(out,doc.id+'-portfolio-pdf.png')});
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();
  const downloaded=await downloadPromise,pdfPath=path.join(out,doc.id+'.pdf');await downloaded.saveAs(pdfPath);
  const bytes=await fs.readFile(pdfPath),pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),7);assert.ok(bytes.length>10000);

  await page.locator('#submit-form').click();await page.locator('.submission-reference').waitFor();
  const submissions=(await f.call(ctx,'portal','submissions')).submissions;
  assert.equal(submissions.length,1);const submitted=submissions[0];
  const wanted={...expected,[identity.id]:'family'};
  for(const [reader,action] of [[ctx,'detail'],[manager,'admin_detail']]){
   const stored=(await f.call(reader,'portal',action,{params:{id:submitted.id}})).submission;
   for(const [id,value] of Object.entries(wanted))assert.equal(stored.answers[id],value,action+'/'+doc.id+'/'+id);
   assert.equal(stored.sha256,digest(bytes));
  }
  for(const [reader,action] of [[ctx,'pdf'],[manager,'admin_pdf']]){
   const response=await reader.request.get(`${f.base}/api/portal.php?${new URLSearchParams({action,id:submitted.id})}`);
   assert.equal(response.status(),200);assert.equal(digest(await response.body()),digest(bytes),action+' exact generated PDF');
  }
  await adminPage.goto(f.base+'/management/?lang=en');
  await adminPage.locator('[data-management-view="users"]').click();
  await adminPage.locator(`[data-client="${user.id}"]`).click();
  await adminPage.locator(`[data-preview="${submitted.id}"]`).click();
  await adminPage.locator('.portal-answer-details>summary').click();
  const portfolio=adminPage.locator(`[data-submission-section="${doc.sections.find(s=>s.fields.some(field=>field.id===fields[0].id)).id}"]`);
  await portfolio.locator('summary').click();
  for(const [id,value] of Object.entries(expected))assert.equal(await portfolio.locator(`[data-answer-field="${id}"] dd`).innerText(),value,'Management visible '+id);
  await portfolio.screenshot({path:path.join(out,doc.id+'-management.png')});
  report.records.push({document:doc.id,account:user.id,submission:submitted.id,samples,values:wanted,expectedPercentageWarnings:warnings,pdf:path.basename(pdfPath),sha256:digest(bytes)});
  pass(`${doc.id}: fitting values produce a seven-page PDF; customer/admin answers and displayed management values are exact; both downloads match the generated PDF byte for byte`);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+path.join(out,'report.json'));}
