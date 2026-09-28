import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {docs} from '../src/forms/index.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/pdfs/folder-ui';
await fs.mkdir(out,{recursive:true});
const results=[];
async function checkFieldWording(page,doc,section,lang){
 const translated=(en,ar)=>lang==='ar'?(ar||en):(en||ar);
 for(const f of section.fields){
  const element=page.locator(`[data-field="${f.id}"]`);
  assert.equal(await element.count(),1,`${doc.id}/${f.id} duplicate`);
  assert.equal(await element.isVisible(),true,`${doc.id}/${f.id} hidden`);
  assert.equal(await element.locator('.field-label').first().textContent(),translated(f.label,f.ar),`${doc.id}/${f.id} ${lang} label`);
  if(f.context)assert.equal(await element.locator('.field-context').first().textContent(),translated(...f.context));
  if(f.help)assert.equal(await element.locator(':scope > .field-help').textContent(),translated(f.help,f.arHelp));
  if(f.type==='choice')for(const o of f.options){
   const label=await page.locator(`input[name="${f.id}"][value="${o.value}"]`).locator('..').innerText();
   assert.ok(label.includes(o.label));if(o.ar)assert.ok(label.includes(o.ar));
  }
 }
 assert.deepEqual(await page.locator('.paper-note').allTextContents(),(section.paperNotes||[]).map(([en,ar])=>translated(en,ar)));
}
for(const [name,engine] of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const [folder,group]of [['individuals','individual'],['companies','corporate']]){
   await page.goto(new URL(folder+'/',base).href);
   await page.locator('.home,.workspace').waitFor();
   if(await page.locator('#back-home').count())await page.locator('#back-home').click();
   const expected=docs.filter(d=>d.group===group||d.group==='shared');
   assert.deepEqual((await page.locator('[data-doc]').evaluateAll(ns=>ns.map(n=>n.dataset.doc))).sort(),expected.map(d=>d.id).sort());
   for(const doc of expected){
    await page.locator(`[data-doc="${doc.id}"]`).click();
    assert.equal(await page.locator('.preview-panel').isHidden(),true);
    const title=await page.locator('h1').innerText();assert.equal(title,doc.title);
    let checked=0;
    for(const [step,section]of doc.sections.entries()){
     await page.locator(`[data-step="${step}"]`).click();
     await checkFieldWording(page,doc,section,'en');checked+=section.fields.length;
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${doc.id}/${section.id} desktop overflow`);
    }
    // A real early download from a folder URL, before visiting review.
    await page.locator('[data-step="0"]').click();
    const field=doc.sections[0].fields.find(f=>f.type==='text'&&!f.sum&&!f.cells&&f.rect[2]>100);
    await page.locator(`[name="${field.id}"]`).fill('اختبار Test');
    assert.equal(await page.locator(`[name="${field.id}"]`).evaluate(e=>getComputedStyle(e).color),'rgb(20, 86, 160)');
    const pending=page.waitForEvent('download');await page.locator('#download-now').click();const download=await pending;await download.saveAs(`${out}/${name}-${folder}-${doc.id}.pdf`);
    assert.equal(await page.locator('#toggle-preview,#document-preview,#preview-prepared-pdf').count(),0);
    await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();
    assert.equal(await page.locator('[data-full-page]').count(),doc.pages);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300));
    await page.locator('#edit-again').click();assert.equal(await page.locator('[data-full-page]').count(),0);
    await page.reload();await page.locator(`[name="${field.id}"]`).waitFor();assert.equal(await page.locator(`[name="${field.id}"]`).inputValue(),'اختبار Test');
    await page.setViewportSize({width:390,height:844});await page.locator('#language').click();
    assert.equal(await page.locator('h1').innerText(),doc.ar||doc.title);
    for(const [step,section]of doc.sections.entries()){
     await page.locator(`[data-step="${step}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${doc.id}/${section.id} mobile RTL overflow`);
     await checkFieldWording(page,doc,section,'ar');
    }
    if(doc.id==='kyc-individual'&&name==='chrome'){await page.locator('[data-step="0"]').click();await page.screenshot({path:`${out}/mobile-ar.png`});}
    await page.locator('#language').click();await page.setViewportSize({width:1440,height:1000});
    if(doc.id==='kyc-corporate'){
     await page.locator('[data-step="1"]').click();
     for(const [id,value]of [['branch','New York Main Branch'],['bank_country','United States of America'],['bank_currency','United States Dollar']])await page.locator(`[name="${id}"]`).fill(value);
     const boxes=await Promise.all(['branch','bank_country','bank_currency'].map(id=>page.locator(`[name="${id}"]`).boundingBox()));
     assert.equal(new Set(boxes.map(b=>Math.round(b.y))).size,1,'Banking trio must share a row');
     if(name==='chrome')await page.screenshot({path:`${out}/desktop-banking.png`,fullPage:true});
    }
    await page.locator('#reset').click();await page.locator('#reset-confirm').click();await page.locator('#back-home').click();
    results.push({browser:name,folder,doc:doc.id,fields:checked});console.log('PASS',name,folder,doc.id);
   }
  }
  // A saved individual form must not replace the companies catalogue on arrival.
  await page.goto(new URL('individuals/',base).href);await page.locator('[data-doc="kyc-individual"]').click();await page.locator('[name="name_1"]').fill('Folder draft');
  await page.goto(new URL('companies/',base).href);await page.locator('[data-doc="kyc-corporate"]').waitFor();assert.equal(await page.locator('[data-doc="kyc-individual"]').count(),0);
  await page.goto(new URL('individuals/',base).href);await page.locator('[name="name_1"]').waitFor();assert.equal(await page.locator('[name="name_1"]').inputValue(),'Folder draft');
  await page.goto(base);await page.locator('.home').waitFor();
  assert.equal(await page.locator('[data-doc],[data-blank],.folder-links,.workspace').count(),0);
  assert.equal(await page.locator('h1').innerText(),'Client forms');
  await page.locator('#language').click();assert.equal(await page.locator('h1').innerText(),'نماذج العملاء');
  await page.reload();await page.locator('.home').waitFor();assert.equal(await page.locator('[data-doc],[data-blank],.folder-links,.workspace').count(),0);
  await page.goto(new URL('individuals/',base).href);await page.locator('[name="name_1"]').waitFor();assert.equal(await page.locator('[name="name_1"]').inputValue(),'Folder draft');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,results},null,2));
console.log('PASS',results.length,'folder/form/browser combinations');
