import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/pdfs/shared-storage';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=220;canvas.height=80;const c=canvas.getContext('2d');c.strokeStyle='#232323';c.lineWidth=3;c.beginPath();c.moveTo(10,50);c.bezierCurveTo(40,0,120,80,205,20);c.stroke();
  localStorage.setItem('itqan.forms.v1.signature-form',JSON.stringify({values:{client_name:'Legacy shared client'},signatures:{specimen:canvas.toDataURL('image/png')},step:0}));
  localStorage.setItem('itqan.forms.v1.kyc-individual',JSON.stringify({values:{name_1:'Existing individual'},step:0}));
  localStorage.setItem('itqan.forms.v1.kyc-corporate',JSON.stringify({values:{company:'Existing company'},step:0}));
 });
 await page.goto(new URL('individuals/',base).href);await page.locator('[data-restore-legacy="signature-form"]').waitFor();
 await page.locator('[data-doc="signature-form"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');assert.equal(await page.locator('.signature-item').count(),0);await page.locator('#back-home').click();
 await page.locator('[data-restore-legacy="signature-form"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Legacy shared client');assert.equal(await page.locator('.signature-item').count(),1);
 await page.locator('#edit-shared-details').click();await page.locator('#shared-en_first').fill('Shared Person');await page.locator('[data-doc="signature-form"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Legacy shared client');assert.equal(await page.locator('.signature-item').count(),1);
 const pending=page.waitForEvent('download');await page.locator('#download-now').click();await(await pending).saveAs(`${out}/restored-signature.pdf`);
 await page.goto(new URL('companies/',base).href);await page.locator('[data-doc="signature-form"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');assert.equal(await page.locator('.signature-item').count(),0);assert.equal(await page.locator('[data-restore-legacy]').count(),0);
 await page.locator('#back-home').click();await page.locator('[data-doc="kyc-corporate"]').click();assert.equal(await page.locator('[name="company"]').inputValue(),'Existing company');
 await page.goto(new URL('individuals/',base).href);await page.locator('#back-home').click();await page.locator('[data-doc="kyc-individual"]').click();assert.equal(await page.locator('[name="name_1"]').inputValue(),'Existing individual');
 await page.locator('#back-home').click();await page.locator('#clear-all').click();await page.locator('#clear-all-confirm').click();
 await page.goto(new URL('companies/',base).href);assert.equal(await page.locator('[name="company"]').inputValue(),'Existing company');
 await page.locator('#edit-shared-details').click();
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
 await page.locator('#shared-phone').fill('9200112233');assert.match(await page.locator('[data-save-status]').first().innerText(),/Not saved/);
 await page.locator('[data-doc="kyc-corporate"]').click();await page.locator('[data-step="1"]').click();assert.equal(await page.locator('[name="business_phone"]').inputValue(),'9200112233');
 const failedSave=page.waitForEvent('download');await page.locator('#download-now').click();await(await failedSave).saveAs(`${out}/storage-unavailable.pdf`);
 assert.equal(errors.length,0,JSON.stringify(errors));
 await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,legacy_specific_migration:true,legacy_shared_explicit_restore:true,signature_preserved_and_isolated:true,manual_answers_preserved:true,clear_all_scoped:true,failed_storage_warns_and_downloads:true,console_errors:errors},null,2));
 console.log('PASS: legacy drafts, explicit shared-draft restore, signature isolation, folder-scoped clear and storage failure recovery');
}finally{await context.close();await browser.close();}
