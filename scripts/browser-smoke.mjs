import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.SITE_URL||'http://127.0.0.1:5173';
const hash=b=>createHash('sha256').update(b).digest('hex');
const ids=['signature-form','fatca-crs-individual','fatca-crs-corporate','kyc-individual','kyc-corporate','terms-and-conditions'];
const originalHashes=Object.fromEntries(await Promise.all(ids.map(async id=>[id,hash(await fs.readFile(`reference/pdfs/${id}.pdf`))])));
await fs.mkdir('tmp/browser-profiles',{recursive:true});
for (const [name, engine, options] of [['chrome',chromium,process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'}],['firefox',firefox,{}],['webkit',webkit,{}]]) {
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const profile=await fs.mkdtemp(`tmp/browser-profiles/${name}-`);
 const errors=[],sent=[],hostingChecks=[];let stage='opening',context,page;
 const launch=async()=>{
  stage='opening';context=await engine.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844},acceptDownloads:true,downloadsPath:path.resolve(profile,'downloads'),...options});
  page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',r=>{
   const payload=r.url()+' '+(r.postData()||'');
   if(['001234567890','Ahmad Abdullah','أحمد عبدالله','Long name'].some(value=>payload.includes(value)||payload.includes(encodeURIComponent(value))))sent.push('Form answer transmitted');
   if(!['GET','HEAD'].includes(r.method())){
    if(new URL(r.url()).pathname==='/hcdn-cgi/jschallenge-validate'&&stage==='opening')hostingChecks.push('Hostinger startup browser challenge');
    else sent.push(r.url());
   }
  });
  await page.goto(catalogueUrl(base));
 };
 const download=async(selector,file)=>{
  const pending=page.waitForEvent('download');await page.locator(selector).click();const item=await pending;
  const path=`tmp/pdfs/${name}-${file}.pdf`;await item.saveAs(path);return hash(await fs.readFile(path));
 };
 await launch();
 for(const id of ids){await openCatalogue(page,base,id);assert.equal(await download(`[data-blank="${id}"]`,id+'-blank'),originalHashes[id]);assert.equal(await page.locator('.catalogue').count(),1);}
 await openDocument(page,base,'signature-form');await page.locator('#loading').waitFor({state:'hidden'});stage='editing';
 assert.equal(await download('#download-now','untouched'),originalHashes['signature-form']);
 await page.locator('[name="client_name"]').fill('أحمد عبدالله — Ahmad Abdullah');
 await page.locator('[name="client_number"]').fill('001234567890');await page.locator('[name="date"]').fill('2026-09-16');
 assert.notEqual(await download('#download-now','first-section'),originalHashes['signature-form']);
 assert.equal(await page.locator('#fields').count(),1);
 await page.locator('#next').click();await page.locator('[name="signer_name"]').fill('أحمد عبدالله');
 assert.notEqual(await download('#download-section','second-section'),originalHashes['signature-form']);
 await page.locator('#language').click();
 console.log(name+': restarting browser to check saved draft');await context.close();await launch(); // Real browser shutdown and profile reopening.
 await page.locator('[name="signer_name"]').waitFor();stage='editing';
 assert.equal(await page.locator('[name="signer_name"]').inputValue(),'أحمد عبدالله');
 assert.equal(await page.locator('html').getAttribute('lang'),'ar');
 await page.locator('[data-step="0"]').click();assert.equal(await page.locator('[name="client_number"]').inputValue(),'001234567890');
 await page.reload();await page.locator('[name="client_number"]').waitFor();assert.equal(await page.locator('[name="client_number"]').inputValue(),'001234567890');
 await page.locator('[name="client_name"]').fill('Long name '.repeat(100));await page.locator('#download-now').click();await page.locator('[data-field="client_name"].invalid').waitFor();
 await page.locator('[name="client_name"]').fill('أحمد عبدالله');await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();
 await download('#download','review');await page.locator('#loading').waitFor({state:'hidden'});
 await page.screenshot({path:`tmp/pdfs/${name}-mobile-review-ar.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log(name+': restart recovery and early downloads passed');await page.locator('#back-home').click();await page.locator('[data-doc="kyc-individual"]').click();
 await page.locator('[name="name_1"]').fill('Separate draft');
 await page.locator('[data-step="4"]').click();await page.locator('[name="ideal_deposits"]').fill('١٠٠');await page.locator('[name="current_deposits"]').fill('۱۰۰');
 await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();assert.equal(await page.locator('.warning').count(),0);
 await page.locator('#back-home').click();await openDocument(page,base,'signature-form');
 await page.locator('#reset').click();await page.locator('#reset-confirm').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');
 await page.reload();await page.locator('[data-doc="signature-form"]').waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('itqan.forms.v1.individual.kyc-individual')));assert.equal(saved.values.name_1,'Separate draft');
 await page.locator('#clear-all').click();await page.locator('#clear-all-confirm').click();
 console.log(name+': testing downloads from each document section');
 for(const id of ids){
  await openDocument(page,base,id);await page.locator('#loading').waitFor({state:'hidden'});
  const steps=await page.locator('[data-step]').count();
  // Exercise every section in Chrome, and the first/last in the other engines.
  const selected=name==='chrome'?Array.from({length:steps},(_,i)=>i):[...new Set([0,steps-1])];
  for(const step of selected){await page.locator(`[data-step="${step}"]`).click();assert.equal(await download('#download-now',`${id}-section-${step}`),originalHashes[id]);}
  await page.locator('#review-tab').click();await page.locator('#download:not([disabled])').waitFor();await page.locator('#loading').waitFor({state:'hidden'});
  await page.locator('#back-home').click();
 }
 await page.evaluate(()=>localStorage.setItem('another-app-test','keep'));
 await openDocument(page,base,'signature-form');await page.locator('[name="client_name"]').fill('Clear me everywhere');
 const second=await context.newPage();await second.goto(catalogueUrl(base));await second.locator('[name="client_name"]').waitFor();
 await page.locator('#back-home').click();await page.locator('#clear-all').click();await page.locator('#clear-all-confirm').click();
 await second.waitForFunction(()=>document.querySelector('[name="client_name"]')?.value==='');await second.close();
 assert.equal(await page.evaluate(()=>localStorage.getItem('another-app-test')),'keep');
 await context.close();await launch();await page.locator('[data-doc="signature-form"]').waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('itqan.forms.v1.individual.')&&!k.endsWith('preferences')).some(k=>{const r=JSON.parse(localStorage[k]);return Object.values(r.values||{}).some(v=>v!==''&&v!=null&&(!Array.isArray(v)||v.length))||Object.keys(r.signatures||{}).length;})),false);
 assert.equal(sent.length,0,JSON.stringify(sent));assert.equal(errors.length,0,JSON.stringify(errors));
 if(hostingChecks.length)console.log(`${name}: Hostinger startup browser challenge completed before entry`);
 console.log(`${name}: blank downloads, downloads from sections, restart recovery, Arabic totals, clear-one/all/tabs, PDF review and no answer transmission passed`);
 await context.close();
}
