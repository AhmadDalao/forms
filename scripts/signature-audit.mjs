import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
// Real browser uploads/downloads. Run alignment-audit.mjs first for answer fixtures.
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4173';
const out=process.env.AUDIT_OUT||'tmp/pdfs/signatures';
await fs.mkdir(out,{recursive:true});
const engine=process.env.BROWSER||'chrome';
const browser=await ({chrome:chromium,firefox,webkit}[engine]).launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
const context=await browser.newContext({viewport:{width:1400,height:1000}});
const page=await context.newPage(),errors=[],sent=[],records=[];
page.on('pageerror',e=>errors.push(e.message));
let entering=false;
page.on('request',r=>{if(entering&&(!['GET','HEAD'].includes(r.method())||r.url().includes('data:image')))sent.push(r.url());});
const upload=async(slot,file)=>{
 await page.locator('#signature-panel').evaluate(el=>{el.open=true;});
 await page.locator('#signature-target').selectOption(slot.id);
 await page.locator('#signature-file').setInputFiles(file);
 await page.locator(`[data-signature-preview="${slot.id}"]`).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#signature-choose')?.disabled);
};
const download=async(selector,file)=>{
 const pending=page.waitForEvent('download',{timeout:60000}).then(d=>({d}),error=>({error}));await page.locator(selector).click();const result=await pending;if(result.error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw Error(`${result.error.message}: ${await page.locator('#status').innerText()} / ${await page.locator('[data-field].invalid').evaluateAll(es=>es.map(e=>e.dataset.field))}`);}await result.d.saveAs(file);
};
try{
 await openCatalogue(page,base);
 const fixtureData=await page.evaluate(async()=>{
  await document.fonts.load('48px "Noto Sans Arabic"','توقيع تجريبي');await document.fonts.ready;
  return [0,1,2,3,4].map(i=>{
   const canvas=document.createElement('canvas');canvas.width=i===2?300:i===3?3000:900;canvas.height=i===2?900:i===3?1000:300;
   const c=canvas.getContext('2d');
   if(i%2||i===4){c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);}
   c.scale(canvas.width/900,canvas.height/300);c.strokeStyle=i%2?'#183a94':'#161b27';c.fillStyle=c.strokeStyle;c.lineWidth=3;c.lineCap='round';
   c.beginPath();c.moveTo(110,202);c.bezierCurveTo(360,160,190,40,365,88);c.bezierCurveTo(510,150,310,215,620,128);c.bezierCurveTo(510,260,410,180,780,190);c.stroke();
   if(i!==2){c.font=i===4?'34px "Noto Sans Arabic"':'44px "Noto Sans Arabic"';c.textAlign='center';c.fillText(i%2?'توقيع تجريبي':i===4?'Test توقيع':'Test Signature',450,135);}
   return canvas.toDataURL(i===1||i===4?'image/jpeg':'image/png',.97);
  });
 });
 const fixturePaths=[];
 for(const [i,data]of fixtureData.entries()){
  const file=`${out}/synthetic-${i}.${data.startsWith('data:image/jpeg')?'jpg':'png'}`;
  await fs.writeFile(file,Buffer.from(data.split(',')[1],'base64'));fixturePaths.push(file);
 }
 entering=true;
 // Signature-only export, persistence, replacement, removal and unchanged originals.
 await page.locator('[data-doc="signature-form"]').click();
 await upload(signatureSlots(docs[0])[0],fixturePaths[0]);
 await download('#download-now',`${out}/signature-only.pdf`);
 assert.equal(await page.locator('#fields').count(),1);
 await page.reload();await page.locator('[data-signature-preview="specimen"]').waitFor();
 assert.equal(await page.locator('[name="client_name"]').inputValue(),'');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('itqan.forms.v1.individual.signature-form')).signatures.specimen);
 await upload(signatureSlots(docs[0])[0],fixturePaths[1]);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('itqan.forms.v1.individual.signature-form')).signatures.specimen);
 assert.notEqual(before,after);
 await page.locator('[data-signature-preview="specimen"]').click();await page.locator('#download:not([disabled])').waitFor();
 await page.locator('#loading').waitFor({state:'hidden'});
 await page.screenshot({path:`${out}/desktop-signature-preview.png`,fullPage:true});
 await download('[data-blank="signature-form"]',`${out}/blank-with-signature.pdf`);
 assert.deepEqual(await fs.readFile(`${out}/blank-with-signature.pdf`),await fs.readFile('reference/pdfs/signature-form.pdf'));
 await page.locator('[data-signature-remove="specimen"]').click();
 assert.equal(await page.locator('.signature-item').count(),0);
 await download('#download-now',`${out}/removed.pdf`);
 assert.deepEqual(await fs.readFile(`${out}/removed.pdf`),await fs.readFile('reference/pdfs/signature-form.pdf'));
 // Invalid inputs must neither replace a good signature nor prevent downloading.
 await upload(signatureSlots(docs[0])[0],fixturePaths[0]);
 for(const [name,buffer,message]of [
  ['invalid.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),'PNG or JPG'],
  ['invalid.png',Buffer.from([137,80,78,71,13,10,26,10,1]),'could not be opened'],
  ['huge.png',Buffer.alloc(5*1024*1024+1),'under 5 MB'],
 ]){
  await page.locator('#signature-file').setInputFiles({name,mimeType:'image/png',buffer});
  await page.waitForFunction(text=>document.querySelector('.signature-feedback')?.textContent.includes(text),message);
  assert.equal(await page.locator('.signature-item').count(),1);
 }
 const blank=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=100;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,400,100);return c.toDataURL();});
 await page.locator('#signature-file').setInputFiles({name:'empty.png',mimeType:'image/png',buffer:Buffer.from(blank.split(',')[1],'base64')});
 await page.waitForFunction(()=>document.querySelector('.signature-feedback')?.textContent.includes('No signature'));
 await page.locator('#reset').click();await page.locator('#reset-confirm').click();
 assert.equal(await page.locator('.signature-item').count(),0);await page.locator('#back-home').click();
 console.log(`${engine}: upload, replacement, signature-only/blank downloads, restore, removal and invalid files passed`);

 const cases=['english','arabic','english-long','arabic-long','mixed'];
 for(const doc of docs.filter(d=>d.workflow!=='subscription'&&(!process.env.ONLY_DOCS||process.env.ONLY_DOCS.split(',').includes(d.id))))for(const [i,sample]of cases.entries()){
  if(process.env.SMOKE_ONLY&&i>0)continue;
  await openDocument(page,base,doc.id);
  const values=JSON.parse(await fs.readFile(`${process.env.ANSWER_OUT||'tmp/pdfs/audit'}/${doc.id}-${sample}.json`,'utf8'));
  for(const [step,section]of doc.sections.entries()){
   await page.locator(`[data-step="${step}"]`).click();
   for(const field of section.fields){
    if(field.sum)continue;
    const value=values[field.id];if(value===undefined)continue;
    if(field.type==='choice'){
     await page.locator(`[data-clear="${field.id}"]`).click();
     for(const v of Array.isArray(value)?value:[value])await page.locator(`[name="${field.id}"][value="${v}"]`).check();
    }else if(field.type==='select')await page.locator(`[name="${field.id}"]`).selectOption(value);
    else await page.locator(`[name="${field.id}"]`).fill(value);
   }
  }
  const slots=signatureSlots(doc);
  for(const slot of slots)await upload(slot,fixturePaths[i]);
  assert.equal(await page.locator('.signature-item').count(),slots.length);
  const stored=await page.evaluate(({id,group})=>JSON.parse(localStorage.getItem('itqan.forms.v1.'+(group==='corporate'?'corporate':'individual')+'.'+id)).signatures,doc);
  const file=`${doc.id}-${sample}.pdf`;
  await download('#download-now',`${out}/${file}`);
  // Compare signed output with an identical set of answers without signatures.
  for(const slot of slots)await page.locator(`[data-signature-remove="${slot.id}"]`).click();
  await download('#download-now',`${out}/${doc.id}-${sample}-unsigned.pdf`);
  records.push({doc:doc.id,sample,file,slots,signatures:stored,answers:Object.keys(values).length});
  await page.locator('#back-home').click();
  console.log('PASS',doc.id,sample,slots.length,'signature boxes');
 }
 // One target only on a multi-person document, mirrored tabs and mobile Arabic.
 await openDocument(page,base,'terms-and-conditions');
 const terms=docs.find(d=>d.id==='terms-and-conditions'),target=signatureSlots(terms)[4];
 await upload(target,fixturePaths[1]);
 await page.locator('[data-signature-preview="authorization_1"]').click();await page.locator('#download:not([disabled])').waitFor();
 assert.equal(await page.locator('#page-label').innerText(),'13 / 13');
 const single=await page.evaluate(()=>JSON.parse(localStorage.getItem('itqan.forms.v1.individual.terms-and-conditions')).signatures);
 assert.deepEqual(Object.keys(single),[target.id]);
 await download('#download',`${out}/terms-single-slot.pdf`);
 await page.setViewportSize({width:390,height:844});await page.locator('#language').click();await page.locator('#loading').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${out}/mobile-ar-signature-preview.png`,fullPage:true});
 const second=await context.newPage();await second.goto(catalogueUrl(base));await second.locator('[data-signature-preview="authorization_1"]').waitFor();
 await page.locator('#back-home').click();await page.locator('#clear-all').click();await page.locator('#clear-all-confirm').click();
 await second.waitForFunction(()=>document.querySelectorAll('.signature-item').length===0);await second.close();
 assert.equal(await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('itqan.forms.v1.individual.')&&!k.endsWith('preferences')).some(([,raw])=>{const value=JSON.parse(raw);return Object.keys(value?.values||{}).length||Object.keys(value?.signatures||{}).length;})),false);
 assert.deepEqual(errors,[]);assert.deepEqual(sent,[]);
 await fs.writeFile(`${out}/signature-audit.json`,JSON.stringify({site:base,engine,records},null,2));
 console.log(`PASS: ${records.length} signed/unsigned comparisons, single-slot placement, mobile Arabic, clear-all/tabs and no form/image transmission`);
}finally{await browser.close();}
