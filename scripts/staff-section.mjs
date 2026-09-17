import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';

const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/pdfs/staff-section';
const doc=docs.find(d=>d.id==='fatca-crs-individual');
const staff=doc.sections.find(s=>s.id==='staff'),step=doc.sections.indexOf(staff);
const cases=[
 ['english','Omar Ali Hassan','0000123','000012345678901'],
 ['arabic','أحمد محمد العتيبي','٠٠١٢٣٤٥','٠٠٠١٢٣٤٥٦٧٨٩٠١٢'],
 ['english-long','Abdulrahman Mohammed Abdullah Alotaibi','HR-0000123456789','000987654321012'],
 ['arabic-long','عبدالرحمن محمد عبدالله عبدالرحيم العتيبي','٠٠٠١٢٣٤٥٦٧٨٩','٠٠٩٨٧٦٥٤٣٢١٠١٢٣'],
 ['mixed','Ahmad أحمد Alotaibi 2026','HR-00123','00A123B456C7890'],
];
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/schema.json`,JSON.stringify({doc,slots:signatureSlots(doc)},null,2));
const report=[];
for(const [name,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const download=async filename=>{const pending=page.waitForEvent('download',{timeout:60000});await page.locator('#download-now').click();await (await pending).saveAs(`${out}/${name}-${filename}.pdf`);};
 try{
  await page.goto(new URL('individuals/',base).href);await page.locator('[data-doc="fatca-crs-individual"]').click();
  await download('blank');
  assert.deepEqual(await fs.readFile(`${out}/${name}-blank.pdf`),await fs.readFile('reference/pdfs/fatca-crs-individual.pdf'));
  await page.locator('[name="en_first"]').fill('Customer only');await download('customer-only');
  await page.locator('#reset').click();await page.locator('#reset-confirm').click();
  for(const [i,[sample,holder,employee,cif]]of cases.entries()){
   await page.locator(`[data-step="${step}"]`).click();
   const lang=i%2?'ar':'en';if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language').click();
   assert.equal(await page.locator('.section-heading h2').textContent(),lang==='ar'?staff.ar:staff.title);
   for(const [id,value]of [['staff_account_holder',holder],['staff_employee_id',employee],['staff_cif',cif]]){
    await page.locator(`[name="${id}"]`).fill(value);assert.equal(await page.locator(`[name="${id}"]`).inputValue(),value);
   }
   const image=await page.evaluate(white=>{
    const c=document.createElement('canvas');c.width=800;c.height=180;const x=c.getContext('2d');
    if(white){x.fillStyle='white';x.fillRect(0,0,c.width,c.height);}
    x.strokeStyle='#184c96';x.lineWidth=4;x.lineCap='round';x.beginPath();x.moveTo(60,140);x.bezierCurveTo(350,90,180,20,310,45);x.bezierCurveTo(510,130,290,160,660,80);x.bezierCurveTo(480,170,590,130,745,145);x.stroke();return c.toDataURL(white?'image/jpeg':'image/png',.97);
   },Boolean(i%2));
   await page.locator('[data-section-signature]').click();assert.equal(await page.locator('#signature-target').inputValue(),'relationship_manager');
   await page.locator('#signature-file').setInputFiles({name:i%2?'test.jpg':'test.png',mimeType:i%2?'image/jpeg':'image/png',buffer:Buffer.from(image.split(',')[1],'base64')});
   await page.locator('[data-signature-preview="relationship_manager"]').waitFor();
   await page.waitForFunction(()=>!document.querySelector('#signature-choose').disabled);
   if(i===0){
    await page.reload();await page.locator('[name="staff_cif"]').waitFor();assert.equal(await page.locator('[name="staff_cif"]').inputValue(),cif);assert.ok(await page.locator('[data-signature-preview="relationship_manager"]').isVisible());
   }
   await page.locator('[data-signature-preview="relationship_manager"]').click();
   await page.locator('#download:not([disabled])').waitFor().catch(async error=>{console.log('PREVIEW ERROR',name,sample,await page.locator('#status').innerText(),await page.locator('.invalid').evaluateAll(ns=>ns.map(n=>n.dataset.field)));await page.screenshot({path:`${out}/${name}-failure.png`,fullPage:true});throw error;});
   await page.locator('#loading').waitFor({state:'hidden'});
   assert.equal(await page.locator('#page-label').innerText(),'3 / 4');
   assert.equal((await page.locator('.sign-note').innerText()).includes('Company-use sections remain blank'),false);
   await download(sample+'-signed');
   await page.locator('[data-signature-remove="relationship_manager"]').click();await download(sample+'-unsigned');
   await page.locator(`[data-step="${step}"]`).click();
   if(i===1){
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});
   }
   if(name==='chrome'&&i===0)await page.locator('.form-panel').screenshot({path:`${out}/section-ui.png`});
   const holderWidth=await page.evaluate(value=>{const c=document.createElement('canvas').getContext('2d');c.font='400 10px "Noto Sans Arabic", Arial';return c.measureText(value).width;},holder);
   report.push({browser:name,sample,holder,employee,cif,holderWidth});console.log('PASS',name,sample);
  }
  await page.locator('#reset').click();await page.locator('#reset-confirm').click();await download('cleared');
  assert.deepEqual(await fs.readFile(`${out}/${name}-cleared.pdf`),await fs.readFile('reference/pdfs/fatca-crs-individual.pdf'));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,results:report},null,2));
console.log('PASS',report.length,'staff-section fills with signed/unsigned downloads');
