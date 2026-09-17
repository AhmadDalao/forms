import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
import {catalogueFor} from '../src/catalogue.js';
import {signatureSlots} from '../src/signatures.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4173/',out=process.env.QA_OUT||'tmp/pdfs/catalogue-update/audit';
await fs.mkdir(out,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex'),results=[];
for(const [name,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const browser=await engine.launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'en-US'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shared=async()=>{if(!await page.locator('#shared-fields-panel').evaluate(el=>el.open))await page.locator('#shared-fields-panel>summary').click();};
 const save=async(selector,file)=>{const pending=page.waitForEvent('download');await page.locator(selector).click();const d=await pending;await d.saveAs(out+'/'+file);return hash(await fs.readFile(out+'/'+file));};
 try{
  for(const [folder,audience]of [['individuals','individual'],['companies','corporate']]){
   await page.goto(new URL(folder+'/',base).href);await page.locator('.home').waitFor();
   const expected=catalogueFor(docs,audience);
   for(const lang of ['en','ar']){
    if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language').click();
    for(const width of [1440,820,390]){
     await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
     assert.deepEqual(await page.locator('[data-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.card)),expected.map(d=>d.id));
     assert.deepEqual(await page.locator('.card-number').allTextContents(),['1','2','3','4','5','6']);
     assert.equal(await page.locator('.doc-group,.folder-links').count(),0);
     assert.equal(await page.locator('.shared-badge').count(),4);
     for(const doc of expected){const card=page.locator(`[data-card="${doc.id}"]`);assert.equal(await card.locator('.card-body>b').innerText(),lang==='ar'?doc.ar:doc.title);assert.equal(await card.locator('.shared-badge').count(),doc.group==='shared'?1:0);}
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     if(width>760){const boxes=await page.locator('.card-actions').evaluateAll(nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));for(let i=0;i<6;i+=2){assert.ok(Math.abs(boxes[i].top-boxes[i+1].top)<1);assert.ok(Math.abs(boxes[i].bottom-boxes[i+1].bottom)<1);}}
     if(name==='chrome'&&width!==820)await page.screenshot({path:`${out}/${folder}-${lang}-${width}.png`,fullPage:true});
     results.push({browser:name,folder,lang,width});
    }
    const sha=await save('[data-download-doc="al-naeem-terms-consent"]',`${name}-${folder}-${lang}-consent.pdf`);
    assert.equal(sha,hash(await fs.readFile('public/pdfs/al-naeem-terms-consent.pdf')));assert.equal(await page.locator('.workspace').count(),0);
   }
   await page.setViewportSize({width:1440,height:1000});await shared();
   if(audience==='individual'){
    await page.locator('#shared-en_first').fill('Ahmad');await page.locator('#shared-en_last').fill('Ali');await page.locator('#shared-ar_first').fill('أحمد');await page.locator('#shared-ar_last').fill('علي');await page.locator('#shared-id_number').fill('001234');
   }else{await page.locator('#shared-company_name').fill('شركة النور');await page.locator('#shared-auth_name').fill('فهد');}
   await page.locator('#shared-phone').pressSequentially(audience==='individual'?'+966551234567':'920001111');
   await page.locator('[data-doc="subscription-form"]').click();
   assert.equal(await page.locator('[name="ar_name"]').inputValue(),audience==='individual'?'أحمد علي':'شركة النور');
   assert.equal(await page.locator('[name="en_name"]').inputValue(),audience==='individual'?'Ahmad Ali':'');
   assert.equal(await page.locator('[name="company_id_number"]').inputValue(),'');
   assert.equal(await page.locator('[name="id_number"]').inputValue(),audience==='individual'?'001234':'');
   await page.locator('[data-step="1"]').click();assert.equal(await page.locator('[name="phone"]').inputValue(),audience==='individual'?'+966551234567':'920001111');
   await page.reload();await page.locator('[name="phone"]').waitFor();assert.equal(await page.locator('[name="phone"]').inputValue(),audience==='individual'?'+966551234567':'920001111');
   const unsigned=await save('#download-now',`${name}-${folder}-subscription-unsigned.pdf`);
   await page.locator('#signature-panel>summary').click();
   const signature=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,300,80);ctx.strokeStyle='#131313';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(15,55);ctx.bezierCurveTo(90,5,190,77,280,20);ctx.stroke();return c.toDataURL('image/png').split(',')[1];});
   const slots=signatureSlots(docs.find(d=>d.id==='subscription-form'));
   for(const slot of slots){await page.locator('#signature-target').selectOption(slot.id);await page.locator('#signature-file').setInputFiles({name:'signature.png',mimeType:'image/png',buffer:Buffer.from(signature,'base64')});await page.locator(`[data-signature-remove="${slot.id}"]`).waitFor();}
   const signed=await save('#download-now',`${name}-${folder}-subscription-signed.pdf`);assert.notEqual(signed,unsigned);
   await page.reload();await page.locator('.signature-item').first().waitFor();assert.equal(await page.locator('.signature-item').count(),4);
   await page.locator('#back-home').click();console.log('PASS',name,folder,'catalogue, direct consent download, subscription shared fields, signatures and reload');
  }
  await page.goto(base);await page.locator('.home').waitFor();assert.equal(await page.locator('[data-card],.workspace').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
await fs.writeFile(out+'/report.json',JSON.stringify({site:base,results},null,2));console.log('PASS',results.length,'catalogue layouts');
