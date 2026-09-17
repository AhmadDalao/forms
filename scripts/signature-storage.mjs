import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.SITE_URL||'http://127.0.0.1:4173';
const profile=await fs.mkdtemp('tmp/signature-profile-');
const launch=()=>chromium.launchPersistentContext(profile,{headless:true,channel:'chrome'});
let context=await launch(),page=context.pages()[0];
const upload=async()=>{
 await page.locator('#signature-panel').evaluate(el=>{el.open=true;});
 await page.locator('#signature-file').setInputFiles(`${process.env.SIGNATURE_OUT||'tmp/pdfs/signatures'}/synthetic-1.jpg`);
 await page.locator('[data-signature-preview="specimen"]').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#signature-choose').disabled);
};
try{
 await page.goto(base);await page.locator('[data-doc="signature-form"]').click();await upload();
 await context.close();context=await launch();page=context.pages()[0];await page.goto(base);
 await page.locator('[data-signature-preview="specimen"]').waitFor();
 assert.equal(await page.locator('.signature-item img').count(),1);
 await page.locator('#reset').click();await page.locator('#reset-confirm').click();
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
 await upload();assert.match(await page.locator('[data-save-status]').innerText(),/Not saved/);
 const pending=page.waitForEvent('download');await page.locator('#download-now').click();await(await pending).saveAs('tmp/pdfs/signatures/storage-full-signature.pdf');
 await page.locator('[data-signature-remove="specimen"]').click();
 assert.equal(await page.locator('.signature-item').count(),0);
 console.log('PASS: signature survives browser shutdown/relaunch; storage failure warns, keeps image downloadable and supports removal.');
}finally{await context.close();await fs.rm(profile,{recursive:true,force:true});}
