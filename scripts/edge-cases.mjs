import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.SITE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/pdfs/signature-form.pdf',async route=>{await gate;await route.continue();});
 await page.goto(base);await page.locator('[data-doc="signature-form"]').click();
 const download=page.waitForEvent('download');await page.locator('#download-now').click();release();
 await(await download).saveAs('tmp/pdfs/download-before-preview.pdf');await page.locator('#loading').waitFor({state:'hidden'});
 await page.close();
 const blocked=await browser.newPage();
 await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','SecurityError');};});
 await blocked.goto(base);await blocked.locator('[data-doc="signature-form"]').click();
 await blocked.locator('[name="client_name"]').fill('Unsaved example');
 assert.match(await blocked.locator('footer').innerText(),/saving is unavailable/);
 assert.equal(await blocked.locator('[name="client_name"]').inputValue(),'Unsaved example');
 const fallback=blocked.waitForEvent('download');await blocked.locator('#download-now').click();await(await fallback).saveAs('tmp/pdfs/storage-blocked-download.pdf');
 console.log('PASS: download before preview load; blocked-storage warning with working PDF download.');
}finally{await browser.close();}
