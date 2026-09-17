import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.SITE_URL||'http://127.0.0.1:4173';
for(const [name,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let offline=true;
  await page.route('**/pdfs/signature-form.pdf',route=>offline?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base);await page.locator('[data-doc="signature-form"]').click();
  await page.locator('[name="client_name"]').fill('Retry Test');await page.locator('#download-now').click();
  await page.locator('#retry-download').waitFor();
  assert.equal(await page.locator('#save-prepared-pdf').count(),0);
  assert.match(await page.locator('#download-result').innerText(),/could not be prepared/);
  assert.equal(await page.locator('[name="client_name"]').inputValue(),'Retry Test');
  offline=false;const pending=page.waitForEvent('download');await page.locator('#retry-download').click();await pending;
  assert.equal(await page.locator('#save-prepared-pdf').isVisible(),true);
  await page.locator('[name="client_name"]').fill('Long name '.repeat(100));await page.locator('#download-now').click();
  await page.locator('[data-field="client_name"].invalid').waitFor();
  assert.equal(await page.locator('#save-prepared-pdf').count(),0);
  assert.match(await page.locator('#download-result').innerText(),/highlighted field/);
  await page.locator('[name="client_name"]').fill('Corrected Test');
  assert.equal(await page.locator('#download-result').isVisible(),false);
  const retry=page.waitForEvent('download');await page.locator('#download-now').click();await retry;
  console.log('PASS',name,'visible network/overflow errors; retry downloads successfully without losing answers');
 }finally{await browser.close();}
}
