// Focused, anonymous form-navigation audit. SITE_URL checks a hosted build.
// Every non-GET/HEAD request is blocked; no accounts or submissions are changed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium,firefox,webkit} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {docs} from '../src/forms/index.js';
import {sectionSignatureSlots} from '../src/signatures.js';
import {personNameFieldVisible} from '../src/person-names.js';

const out=path.resolve(process.env.QA_OUT||'tmp/navigation-audit');
await fs.mkdir(out,{recursive:true});
const server=process.env.SITE_URL?null:await createServer({server:{host:'127.0.0.1',port:8197,strictPort:true,watch:{ignored:['**/*']}},logLevel:'error'});
if(server)await server.listen();
const base=(process.env.SITE_URL||'http://127.0.0.1:8197/').replace(/\/?$/,'/');
const selected=(process.env.BROWSERS||'chrome').split(',');
const engines={chrome:chromium,firefox,webkit};
const report={site:base,started:new Date().toISOString(),documents:[],responsive:[],checks:[],unexpectedMutations:[],errors:[]};
const generic=docs.filter(d=>d.workflow!=='subscription'&&!d.downloadOnly);
let page;
const folder=audience=>audience==='corporate'?'companies':'individuals';
const progress=index=>page.locator(`[data-step-progress="${index}"]`);
async function contextFor(browser,lang='en',width=1440){
 const context=await browser.newContext({viewport:{width,height:1000},locale:lang==='ar'?'ar-SA':'en-US',serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',async route=>{
  if(!['GET','HEAD'].includes(route.request().method())){report.unexpectedMutations.push({method:route.request().method(),url:route.request().url()});await route.abort();return;}
  await route.continue();
 });
 const p=await context.newPage();p.on('pageerror',error=>report.errors.push(error.message));
 return {context,p};
}
async function open(doc,lang,audience=doc.group==='corporate'?'corporate':'individual'){
 await page.goto(new URL(folder(audience)+'/',base).href);
 await page.locator('.home,.workspace').waitFor();
 if(await page.locator('#back-home').count())await page.locator('#back-home').click();
 if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language').click();
 await page.locator(`[data-doc="${doc.id}"]`).click();
 await page.locator('[data-step="0"]').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.sections [data-step]').count(),doc.sections.length,`${doc.id}: all original sections present`);
 const labels=await page.locator('.sections [data-step] .section-label').allTextContents();
 assert.deepEqual(labels,doc.sections.map(s=>lang==='ar'?s.ar:s.title),`${doc.id}: titles unchanged`);
}
async function currentStep(index){
 const selector=index==='review'?'#review-tab':`[data-step="${index}"]`;
 assert.equal(await page.locator(selector).getAttribute('aria-current'),'step','active step is announced');
 assert.equal(await page.locator('.sections [aria-current="step"]').count(),1,'exactly one active step');
 assert.equal(await page.locator('.sections .active').count(),1,'exactly one visually active step');
}
async function go(index){
 await page.locator(`[data-step="${index}"]`).click();
 await currentStep(index);
}
async function review(){
 await page.locator('#review-tab').click();
 await page.waitForFunction(()=>document.querySelector('#review-tab')?.getAttribute('aria-current')==='step'&&!document.querySelector('#review-tab')?.disabled,null,{timeout:90000});
 await currentStep('review');
 assert.equal(await page.locator('#download').isEnabled(),true,'review generated PDF ready');
 if(await page.locator('.signing-guide').count())await page.locator('.signing-guide [data-close]').click();
}
async function layout(label){
 const issues=await page.locator('.sections').evaluate(nav=>{
  const issues=[];
  const bounds=nav.getBoundingClientRect();
  const buttons=[...nav.querySelectorAll('.section-tab')];
  if(nav.scrollWidth>nav.clientWidth+1)issues.push('navigation scrolls horizontally');
  if(document.documentElement.scrollWidth>innerWidth+1)issues.push('page scrolls horizontally');
  for(const [i,button]of buttons.entries()){
   const r=button.getBoundingClientRect(),css=getComputedStyle(button);
   if(r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1)issues.push(`step ${i} outside nav`);
   if(r.height<44)issues.push(`step ${i} touch target below 44px`);
   for(const el of [button.querySelector('.section-label'),button.querySelector('[data-step-progress]')].filter(Boolean)){
    const c=getComputedStyle(el),range=document.createRange();range.selectNodeContents(el);
    if(c.textOverflow==='ellipsis'||!['none','', '0'].includes(c.webkitLineClamp))issues.push(`step ${i} title clipped by CSS`);
    if(el.scrollWidth>el.clientWidth+1||['hidden','clip'].includes(c.overflowY)&&el.scrollHeight>el.clientHeight+1)issues.push(`step ${i} content clipped by element`);
    for(const text of range.getClientRects())if(text.left<r.left-1||text.right>r.right+1||text.top<r.top-1||text.bottom>r.bottom+1)issues.push(`step ${i} text outside button`);
   }
   if(css.display==='none'||css.visibility==='hidden')issues.push(`step ${i} hidden`);
   for(const other of buttons.slice(i+1)){const b=other.getBoundingClientRect();if(Math.min(r.right,b.right)-Math.max(r.left,b.left)>1&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>1)issues.push(`step ${i} overlaps another step`);}
  }
  return issues;
 });
 assert.deepEqual(issues,[],label);
}
async function readProgress(index){
 const text=await progress(index).textContent();const match=text.match(/(\d+)\s*\/\s*(\d+)/);assert.ok(match,`completion fraction in ${text}`);return match.slice(1).map(Number);
}
async function keyboard(browser){
 // macOS Safari follows the system keyboard preference: Option+Tab includes buttons.
 await page.locator('[data-step="0"]').focus();await page.keyboard.press(browser==='webkit'?'Alt+Tab':'Tab');
 assert.equal(await page.locator('[data-step="1"]').evaluate(el=>el===document.activeElement),true,'steps follow normal keyboard tab order');
 assert.equal(await page.locator('[data-step="1"]').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true,'keyboard focus visible');
 await page.keyboard.press('Enter');await currentStep(1);
 await page.locator('[data-step="0"]').focus();await page.keyboard.press('Space');await currentStep(0);
}
async function allDocuments(browser,name){
 for(const lang of ['en','ar']){
  const {context,p}=await contextFor(browser,lang);page=p;
  try{
   for(const doc of generic){
    await open(doc,lang);
    for(const [i,s]of doc.sections.entries()){
     await go(i);assert.equal(await page.locator('.section-title-row h2').textContent(),lang==='ar'?s.ar:s.title);
     await layout(`${name}/${lang}/${doc.id}/${i}`);
     const [done,total]=await readProgress(i);
     assert.ok(done<=total,'completed count never exceeds total');
     assert.equal(total,s.fields.filter(f=>!f.sum&&personNameFieldVisible(f,doc.group==='corporate'?'corporate':'individual')).length,`${doc.id}/${s.id}: each visible answer counted once`);
    }
    if(doc.id==='fatca-crs-individual'&&lang==='en')await page.locator('.sections').screenshot({path:path.join(out,`${name}-en-fatca-navigation.png`)});
    await review();await layout(`${name}/${lang}/${doc.id}/review`);await go(0);
    report.documents.push({browser:name,lang,doc:doc.id,sections:doc.sections.length,reviewReachable:true});
    console.log('PASS',name,lang,doc.id,'all sections and review');
   }
  }finally{await context.close();}
 }
}
async function responsive(browser,name){
 const doc=docs.find(d=>d.id==='kyc-individual');
 for(const lang of ['en','ar'])for(const width of [1440,768,390,320]){
  const {context,p}=await contextFor(browser,lang,width);page=p;
  try{
   await open(doc,lang);
   assert.equal(await page.locator('#toggle-preview,#document-preview').count(),0);
   for(let i=0;i<doc.sections.length;i++){await go(i);await layout(`${name}/${lang}/${width}/step-${i}`);}
   await keyboard(name);
   if(lang==='en'&&width===1440||lang==='ar'&&[390,320].includes(width)){
    await go(doc.sections.length-1);await page.locator('.sections').screenshot({path:path.join(out,`${name}-${lang}-${width}-navigation.png`)});
    await page.screenshot({path:path.join(out,`${name}-${lang}-${width}-page.png`)});
   }
   report.responsive.push({browser:name,lang,width,steps:doc.sections.length,noClipping:true});
   await review();await layout(`${name}/${lang}/${width}/review`);await go(doc.sections.length-1);
   console.log('PASS',name,lang,width,'final-step preview, keyboard');
  }finally{await context.close();}
 }
}
async function counts(browser,name){
 for(const lang of ['en','ar']){
  const {context,p}=await contextFor(browser,lang);page=p;
  try{
   const doc=docs.find(d=>d.id==='kyc-individual');await open(doc,lang);await go(0);
   const before=await readProgress(0);await page.locator('[name="name_first"]').fill(lang==='en'?'Navigation QA':'تجربة التنقل');
   assert.deepEqual(await readProgress(0),[before[0]+1,before[1]],'text input updates count immediately');
   await page.locator('input[name="gender"][value="male"]').check();assert.deepEqual(await readProgress(0),[before[0]+2,before[1]],'choice updates count immediately');
   await page.locator('[data-clear="gender"]').click();assert.deepEqual(await readProgress(0),[before[0]+1,before[1]],'clear choice updates count');
   await page.locator('[name="name_first"]').fill('');assert.deepEqual(await readProgress(0),before,'clearing text updates count');
   await page.locator('input[name="income_sources"][value="employment"]').check();await page.locator('input[name="income_sources"][value="business"]').check();
   assert.deepEqual(await readProgress(0),[before[0]+1,before[1]],'multiple selected choices count as one answer');
   await page.locator('[data-clear="income_sources"]').click();assert.deepEqual(await readProgress(0),before,'clearing multiple choice removes one answer');
   await page.locator('#edit-shared-details').click();await page.locator('#shared-email').fill('navigation@example.test');
   await page.locator(`[data-doc="${doc.id}"]`).click();await go(0);
   assert.equal(await page.locator('#f-email').inputValue(),'navigation@example.test');
   assert.deepEqual(await readProgress(0),[before[0]+1,before[1]],'shared value updates section count');
   const signing=doc.sections.findIndex(s=>sectionSignatureSlots(doc,s).length);await go(signing);
   const slot=sectionSignatureSlots(doc,doc.sections[signing])[0],signBefore=await readProgress(signing);
   await page.locator(`[data-signature-mode="${slot.id}"][value="electronic"]`).check();
   assert.deepEqual(await readProgress(signing),signBefore,'signature choice does not change document-answer count');
   const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=80;const x=c.getContext('2d');x.strokeStyle='#164f9b';x.lineWidth=3;x.beginPath();x.moveTo(20,55);x.bezierCurveTo(120,5,60,70,265,20);x.stroke();return c.toDataURL();});
   await page.locator(`[data-signature-file="${slot.id}"]`).setInputFiles({name:'navigation-signature.png',mimeType:'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
   await page.locator(`[data-signature-slot="${slot.id}"] img`).waitFor();
   assert.deepEqual(await readProgress(signing),signBefore,'uploaded signature is not double-counted as document answers');
   await page.locator(`[data-signature-mode="${slot.id}"][value="manual"]`).check();assert.deepEqual(await readProgress(signing),signBefore,'manual signature does not change document-answer count');
   report.checks.push({browser:name,lang,liveTextCount:true,choiceClearCount:true,sharedCount:true,signatureCountOnce:true});
   console.log('PASS',name,lang,'live completion counts, shared fields, signature transitions');
  }finally{await context.close();}
 }
}
async function signatureOnly(browser){
 const custom={id:'upload_navigation_audit',title:'Synthetic signature-only document',ar:'مستند توقيع تجريبي',group:'shared',pages:1,pdfVersion:'audit',fields:[],signatures:[{id:'sign',label:'Signature',ar:'التوقيع',page:1,rect:[70,130,180,60]}]};
 const pdf=await PDFDocument.create();pdf.addPage([400,300]);const bytes=Buffer.from(await pdf.save());
 const {context,p}=await contextFor(browser,'ar',390);page=p;
 await context.route('**/api/management.php*',async route=>{
  const u=new URL(route.request().url());
  if(u.searchParams.get('action')==='catalogue'){
   const documents=[...docs.map(d=>({...d,builtin:true})),custom],orders=Object.fromEntries(['individual','corporate'].map(a=>[a,documents.filter(d=>d.group===a||d.group==='shared').map(d=>d.id)]));
   await route.fulfill({json:{documents,orders}});
  }else if(u.searchParams.get('id')===custom.id)await route.fulfill({contentType:'application/pdf',body:bytes});else await route.fallback();
 });
 try{
  await open({...custom,sections:[{id:'page_1',page:1,title:'Page 1',ar:'الصفحة 1'}]},'ar');
  assert.equal(await progress(0).textContent(),'توقيع يدوي','signature-only page describes manual signing');
  await layout('managed signature-only navigation');await review();await go(0);
  report.checks.push({syntheticManagedSignatureOnlyPage:true,signatureOnlyStatus:'manual',reviewReachable:true});console.log('PASS synthetic managed signature-only navigation');
 }finally{await context.close();}
}
try{
 for(const [index,name]of selected.entries()){
  assert.ok(engines[name],`Unknown browser ${name}`);const browser=await engines[name].launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
  try{if(index===0&&process.env.QA_RESPONSIVE_ONLY!=='1'){await allDocuments(browser,name);await counts(browser,name);await signatureOnly(browser);}await responsive(browser,name);}finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[],'browser errors');assert.deepEqual(report.unexpectedMutations,[],'unexpected write requests');
 report.result='pass';report.completed=new Date().toISOString();console.log('PASS navigation audit',report.documents.length,'document/language cases;',report.responsive.length,'responsive cases');
}catch(error){report.result='fail';report.error=error.stack;try{await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));if(server)await server.close();}
