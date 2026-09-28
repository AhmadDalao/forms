import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
// Exercise blocked automatic downloads with a genuine second click on Save PDF.
import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4173';
const out=process.env.QA_OUT||'tmp/pdfs/download-regression';
await fs.mkdir(out,{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex');
const results=[];
for(const [name,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download'))return;return original.call(this);};
 });
 const save=async(selector,file)=>{
  const pending=page.waitForEvent('download');await page.locator(selector).click();const item=await pending;
  const target=`${out}/${name}-${file}.pdf`;await item.saveAs(target);return fs.readFile(target);
 };
 try{
  await openCatalogue(page,base);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://forms.ahmaddalao.com/individuals/');
  for(const doc of docs.filter(d=>d.workflow!=='subscription')){
   await openDocument(page,base,doc.id);
   const field=doc.sections[0].fields.find(f=>!f.cells&&f.type==='text'&&!f.sum&&f.rect[2]>100);
   assert.ok(field,doc.id);await page.locator(`[name="${field.id}"]`).fill('اختبار Test');
   let downloads=0;const onDownload=()=>downloads++;page.on('download',onDownload);
   await page.locator('#download-now').click();await page.locator('#save-prepared-pdf').waitFor();
   assert.equal(downloads,0,'Automatic download simulation failed');
   assert.match(await page.locator('#download-result').innerText(),/Your PDF is ready/);
   const original=await fs.readFile(`reference/pdfs/${doc.id}.pdf`);
   const filled=await save('#save-prepared-pdf',doc.id+'-filled');
   assert.notEqual(hash(filled),hash(original));assert.equal(downloads,1);
   const href=await page.locator('#save-prepared-pdf').getAttribute('href');
   await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300));
   assert.equal(await page.locator('#save-prepared-pdf').getAttribute('href'),href);
   assert.equal(hash(await save('#save-prepared-pdf',doc.id+'-retry')),hash(filled));
   assert.equal(hash(await save(`[data-blank="${doc.id}"]`,doc.id+'-blank')),hash(original));
   await page.locator('#edit-again').click();await page.locator(`[name="${field.id}"]`).fill('Changed Test');
   assert.equal(await page.locator('#download-result').isVisible(),false,'Stale PDF link survived changed answers');
   await page.locator('#download-section').click();await page.locator('#save-prepared-pdf').waitFor();
   const updated=await save('#save-prepared-pdf',doc.id+'-updated');assert.notEqual(hash(updated),hash(filled));
   await page.locator('#reset').click();await page.locator('#reset-confirm').click();
   assert.equal(await page.locator('#download-result').isVisible(),false);
   page.off('download',onDownload);await page.locator('#back-home').click();
   results.push({browser:name,document:doc.id,result:'pass'});console.log('PASS',name,doc.id);
  }
  await openDocument(page,base,'signature-form');
  await page.locator('[name="client_name"]').fill('Long name '.repeat(100));
  await page.locator('#download-now').click();await page.locator('[data-field="client_name"].invalid').waitFor();
  assert.equal(await page.locator('#save-prepared-pdf').count(),0,'Error incorrectly reported a ready file');
  assert.match(await page.locator('#download-result').innerText(),/could not be prepared/);
  await page.locator('[name="client_name"]').fill('أحمد علي');await page.locator('#language').click();
  await page.locator('#download-now').click();await page.locator('#save-prepared-pdf').waitFor();
  assert.match(await page.locator('#download-result').innerText(),/ملفك جاهز/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${out}/${name}-ready-mobile-ar.png`,fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,results},null,2));
console.log(`PASS: ${results.length} form/browser combinations; direct save, identical retry, inline preview, blank originals, changed answers, reset, overflow and mobile Arabic`);
