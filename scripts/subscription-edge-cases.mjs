import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
const base=process.env.FORMS_BASE_URL||'http://127.0.0.1:8184';
try{
 await page.goto(base+'/individuals/');await page.locator('[data-doc="subscription-form"]').click();
 await page.locator('[data-review]').click();assert.ok((await page.locator('#sub-status').innerText()).includes('required'));
 // Required names do not prevent a partial download from any step.
 for(let i=0;i<4;i++){
  await page.locator(`[data-sub-step="${i}"]`).click();const event=page.waitForEvent('download');await page.locator('[data-download]').click();assert.equal(await(await event).failure(),null);
 }
 await page.locator('[data-sub-step="2"]').click();await page.locator('[name="units"]').fill('1.5');await page.locator('[data-download]').click();await page.waitForFunction(()=>document.querySelector('#sub-status').textContent.includes('whole'));
 await page.locator('[name="units"]').fill('10');
 await page.route('**/api/subscription/calculate.php',route=>route.abort());await page.locator('[data-download]').click();await page.waitForFunction(()=>document.querySelector('#sub-status').textContent.includes('connection'));
 assert.equal(await page.locator('[name="units"]').inputValue(),'10');await page.unroute('**/api/subscription/calculate.php');
 const requests=[];page.on('request',r=>{if(r.url().includes('subscription/calculate.php'))requests.push(JSON.parse(r.postData()));});
 const event=page.waitForEvent('download');await page.locator('[data-download]').click();assert.equal(await(await event).failure(),null);assert.deepEqual(requests,[{units:'10'}]);
 await page.locator('#sub-home').click();await page.locator('#shared-fields-panel summary').click();
 for(const [key,value] of Object.entries({en_first:'Alice',en_second:'Jane',en_last:'Smith',email:'alice.smith@example.com'}))await page.locator(`[data-shared-key="${key}"]`).fill(value);
 await page.locator('[data-doc="subscription-form"]').click();await page.locator('[data-sub-step="0"]').click();assert.equal(await page.locator('#sub-first_name').innerText(),'Alice');
 await page.locator('#sub-reset').click();await page.locator('#sub-confirm-reset').click();assert.equal(await page.locator('#sub-first_name').innerText(),'Alice');
 await page.locator('[data-sub-step="3"]').click();assert.equal(await page.locator('[name="applicant_name"]').inputValue(),'Alice Jane Smith');
 await page.locator('[name="applicant_name"]').fill('Alice J. Smith');await page.locator('#sub-edit-shared').count();await page.locator('#sub-home').click();
 await page.locator('[data-shared-key="en_second"]').fill('Mary');await page.locator('[data-doc="subscription-form"]').click();assert.equal(await page.locator('[name="applicant_name"]').inputValue(),'Alice J. Smith');
 await page.locator('[data-sub-step="0"]').click();assert.equal(await page.locator('#sub-second_name').innerText(),'Mary');
 await page.locator('#sub-home').click();
 // Shared/renderer changes must not disrupt the remaining unchanged documents.
 for(const folder of ['individuals','companies']){
  await page.goto(base+'/'+folder+'/');
  const ids=await page.locator('[data-doc]').evaluateAll(ns=>ns.map(n=>n.dataset.doc).filter(id=>!id.startsWith('subscription')));
  for(const id of ids){await page.locator(`[data-doc="${id}"]`).click();await page.locator('#download-now').waitFor();const d=page.waitForEvent('download');await page.locator('#download-now').click();assert.equal(await(await d).failure(),null);assert.equal(await page.locator('#signature-panel').count(),1);if(folder==='individuals')assert.equal(await page.locator('[data-section-signature]').count(),0);await page.locator('#back-home').click();}
 }
 console.log('PASS required names, partial downloads at all four steps, invalid units, offline/retry, customer-data privacy, shared edits/reset, applicant override, and all 8 other catalogue entries.');
}finally{await browser.close();}
