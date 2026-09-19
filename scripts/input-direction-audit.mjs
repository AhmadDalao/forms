// Real keystrokes catch caret loss that locator.fill() cannot detect.
import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
const site=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/email-direction';
await fs.mkdir(out,{recursive:true});
const results=[];let typed=0;
async function typeStable(input,value){
 await input.fill('');const original=await input.elementHandle();
 await input.pressSequentially(value);
 assert.equal(await input.inputValue(),value,'Keystrokes must stay in their original order');
 assert.equal(await original.evaluate(el=>el.isConnected&&el===document.activeElement),true,'Keep the active input mounted and focused');
 await original.dispose();typed++;
}
async function emailEditing(input){
 await typeStable(input,'ahmad+qa@example.com');
 assert.equal(await input.evaluate(el=>getComputedStyle(el).direction),'ltr');
 for(let i=0;i<4;i++)await input.press('ArrowLeft');
 await input.pressSequentially('.test');assert.equal(await input.inputValue(),'ahmad+qa@example.test.com');
 for(let i=0;i<5;i++)await input.press('Backspace');
 assert.equal(await input.inputValue(),'ahmad+qa@example.com');
 await input.fill('pasted.name+tag@example.org');assert.equal(await input.inputValue(),'pasted.name+tag@example.org');
}
for(const [browserName,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(browserName))continue;
 const browser=await engine.launch({headless:true,...(browserName==='chrome'?{channel:'chrome'}:{})});
 try{for(const lang of ['en','ar']){
  if(process.env.LANGS&&!process.env.LANGS.split(',').includes(lang))continue;
  const context=await browser.newContext({viewport:{width:1360,height:1000},locale:lang==='ar'?'ar-SA':'en-US'}),page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const shared=async()=>{if(!await page.locator('#shared-fields-panel').evaluate(el=>el.open))await page.locator('#shared-fields-panel>summary').click();};
  const closeShared=async()=>{if(await page.locator('#shared-fields-panel').evaluate(el=>el.open))await page.locator('#shared-fields-panel>summary').click();};
  for(const [folder,audience]of [['individuals','individual'],['companies','corporate']]){
   await page.goto(new URL(folder+'/',site).href);await page.locator('.home').waitFor();
   assert.equal(await page.locator('html').getAttribute('lang'),lang);await shared();
   await emailEditing(page.locator('#shared-email'));
   await typeStable(page.locator('#shared-phone'),'+966 55 123 4567');
   assert.equal(await page.locator('#shared-phone').evaluate(el=>getComputedStyle(el).direction),'ltr');
   const sharedName=audience==='individual'?(lang==='ar'?'ar_first':'en_first'):'company_name';
   await typeStable(page.locator('#shared-'+sharedName),lang==='ar'?'أحمد علي':'Ahmad Ali');
   if(audience==='individual'){
    await page.locator('#shared-name_language').selectOption(lang);
    const date=await page.locator('#shared-dob').elementHandle();
    await page.locator('#shared-dob').fill('1990-01-30');
    assert.equal(await date.evaluate(el=>el.isConnected&&el.value==='1990-01-30'),true);await date.dispose();
   }
   await closeShared();
   for(const doc of docs.filter(d=>d.workflow!=='subscription'&&(d.group===audience||d.group==='shared')&&(!process.env.DOCS||process.env.DOCS.split(',').includes(d.id)))){
    await page.locator(`[data-doc="${doc.id}"]`).click();
    assert.equal(await page.locator('#shared-fields-panel').count(),0);
    const expected={};
    for(const [step,section]of doc.sections.entries()){
     await page.locator(`[data-step="${step}"]`).click();
     for(const f of section.fields.filter(f=>['email','tel'].includes(f.type)||f.type==='text'&&!f.sum&&(/^(iban|bank_account|client_number|account_number|ssn|itin|atin|id_number|auth_id|rep_id|staff_cif)$/.test(f.id)))){
      const input=page.locator(`[name="${f.id}"]`);
      const value=f.type==='email'?'ahmad+qa@example.com':f.type==='tel'?'+966 55 123 4567':f.id==='iban'?'SA0380000000608010167519':'001234567'.slice(0,f.maxLength||9);
      await typeStable(input,value);expected[f.id]=value;
      if(['email','tel'].includes(f.type))assert.equal(await input.evaluate(el=>getComputedStyle(el).direction),'ltr');
     }
    }
    // Check regular Arabic/English name entry too, independent of the shared profile.
    await page.locator('[data-step="0"]').click();
    const nameField=doc.id==='fatca-crs-individual'?doc.fields.find(f=>f.id===`${lang}_first`):doc.sections[0].fields.find(f=>f.type==='text'&&!f.sum&&!f.hidden&&!f.cells&&f.rect?.[2]>100);
    const nameValue=lang==='ar'?'أحمد علي':'Ahmad Ali';
    await typeStable(page.locator(`[name="${nameField.id}"]`),nameValue);expected[nameField.id]=nameValue;
    // Editing shared fields from review must invalidate the old download without losing focus.
    if(doc.id.startsWith('kyc-')){
     await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();
     if(await page.locator('.signing-guide[open] [data-close]').count())await page.locator('.signing-guide[open] [data-close]').click();
     await page.locator('#edit-again').click();await page.locator('#edit-shared-details').click();
     await emailEditing(page.locator('#shared-email'));await closeShared();
     await page.locator(`[data-doc="${doc.id}"]`).click();
     assert.equal(await page.locator('#review-tab').evaluate(el=>el.classList.contains('active')),false);
     assert.equal(await page.locator('#document-preview').isHidden(),true);
     assert.equal(await page.locator('#fields').count(),1);
     assert.equal(await page.locator('#download-section').count(),1);
    }
    await page.reload();await page.locator('.workspace').waitFor();
    for(const [id,value]of Object.entries(expected)){
     const step=doc.sections.findIndex(s=>s.fields.some(f=>f.id===id));
     await page.locator(`[data-step="${step}"]`).click();assert.equal(await page.locator(`[name="${id}"]`).inputValue(),value,'Draft must preserve typed values');
    }
    if(doc.id.startsWith('kyc-')&&browserName==='chrome'){
     const step=doc.sections.findIndex(s=>s.fields.some(f=>f.id==='email'));await page.locator(`[data-step="${step}"]`).click();
     await page.locator('[data-field="email"]').screenshot({path:`${out}/${folder}-${lang}-email.png`});
    }
    const pending=page.waitForEvent('download').catch(()=>null);await page.locator('#download-section').click();const download=await pending;
    if(!download){await page.screenshot({path:`${out}/failure-${browserName}-${doc.id}-${lang}.png`});throw new Error(`${browserName}/${lang}/${doc.id}: ${await page.locator('#status').innerText()}; invalid: ${await page.locator('.invalid .field-label').allTextContents()}; errors: ${errors}`);}
    const file=`${browserName}-${folder}-${doc.id}-${lang}.pdf`;await download.saveAs(`${out}/${file}`);
    const values=await page.evaluate(({audience,id})=>JSON.parse(localStorage.getItem(`itqan.forms.v1.${audience}.${id}`)).values,{audience,id:doc.id});
    for(const [id,value]of Object.entries(expected))assert.equal(values[id],value);
    await fs.writeFile(`${out}/${file.replace('.pdf','.json')}`,JSON.stringify(values,null,2));
    const bytes=await fs.readFile(`${out}/${file}`);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    results.push({browser:browserName,folder,doc:doc.id,lang,file,sha256:createHash('sha256').update(bytes).digest('hex')});
    if(await page.locator('.signing-guide[open] [data-close]').count())await page.locator('.signing-guide[open] [data-close]').click();
    await page.locator('#back-home').click();console.log('PASS',browserName,lang,folder,doc.id);
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site,typedInputs:typed,results},null,2));
console.log('PASS',typed,'real typed input checks;',results.length,'English/Arabic downloads');
