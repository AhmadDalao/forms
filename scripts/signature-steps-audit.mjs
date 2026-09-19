// Guest-only UI and PDF regression. SITE_URL targets a hosted build; by default
// an isolated Vite server is started. No account, submission or admin mutations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {createServer} from 'vite';
import {chromium,firefox,webkit} from 'playwright';
import {PDFDocument,PDFName,PDFArray,PDFDict,PDFRawStream} from 'pdf-lib';
import {docs} from '../src/forms/index.js';
import {signatureSlots,signaturePlacement} from '../src/signatures.js';
import {storagePrefixFor} from '../src/routes.js';

const out=path.resolve(process.env.QA_OUT||'tmp/signature-steps');
await fs.mkdir(out,{recursive:true});
const server=process.env.SITE_URL?null:await createServer({server:{host:'127.0.0.1',port:8196,strictPort:true},logLevel:'error'});
if(server)await server.listen();
const base=(process.env.SITE_URL||'http://127.0.0.1:8196/').replace(/\/?$/,'/');
const storagePrefix=storagePrefixFor(new URL(base).pathname,'itqan.forms.v1.');
const mapping={
 'signature-form':{specimen:'signatory'},
 'terms-and-conditions':Object.fromEntries(['terms','authorization'].flatMap(s=>[0,1,2].map(i=>[`${s}_${i}`,s]))),
 'fatca-crs-individual':{signatory:'signatory',relationship_manager:'staff'},
 'fatca-crs-corporate':{signatory_0:'signatories',signatory_1:'signatories'},
 'kyc-individual':{representative:'disclosures',client:'suitability'},
 'kyc-corporate':{client:'suitability'},
};
const engines={chrome:chromium,firefox,webkit};
const selected=(process.env.BROWSERS||'chrome,firefox,webkit').split(',');
const onlyDocs=process.env.ONLY_DOCS?.split(','),skipPDFs=process.env.QA_SKIP_PDFS==='1';
const report={site:base,started:new Date().toISOString(),ui:[],pdf:[],checks:[],unexpectedMutations:[]};
const errors=[];
let page,fixture;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const folder=a=>a==='corporate'?'companies':'individuals';
const key=(a,id)=>storagePrefix+a+'.'+id;
const stepFor=(doc,slot)=>doc.sections.findIndex(s=>s.id===mapping[doc.id]?.[slot.id]||(doc.custom&&s.page===slot.page));
const state=slot=>page.locator(`[data-signature-slot="${slot.id}"]`);
const mode=(slot,value)=>state(slot).locator(`[data-signature-mode="${slot.id}"][value="${value}"]`);
const saved=(a,id)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}'),key(a,id));

async function open(doc,a){
 await page.goto(new URL(folder(a)+'/',base).href);
 await page.locator('.home,.workspace').waitFor();
 if(await page.locator('#back-home').count())await page.locator('#back-home').click();
 await page.locator(`[data-doc="${doc.id}"]`).click();
 await page.locator('[data-step="0"]').waitFor();
 assert.equal(await page.locator('#signature-panel').count(),0,'obsolete global panel');
}
async function go(doc,slot){
 const index=stepFor(doc,slot);assert.notEqual(index,-1,`${doc.id}/${slot.id} section`);
 await page.locator(`[data-step="${index}"]`).click();
 await state(slot).waitFor();
}
async function assertManual(slot){
 assert.equal(await mode(slot,'manual').isChecked(),true,`${slot.id} manual selection`);
 const input=state(slot).locator(`[data-signature-file="${slot.id}"]`);
 assert.equal(await input.count(),0,`${slot.id} manual must not render upload input`);
 assert.equal(await state(slot).locator('img').count(),0,`${slot.id} manual must not keep image`);
}
async function chooseElectronic(slot){
 await mode(slot,'electronic').check();
 assert.equal(await mode(slot,'electronic').isChecked(),true);
 await state(slot).locator(`[data-signature-file="${slot.id}"]`).waitFor({state:'attached'});
}
async function upload(slot,bytes=fixture){
 await chooseElectronic(slot);
 await state(slot).locator(`[data-signature-file="${slot.id}"]`).setInputFiles({name:'synthetic-signature.png',mimeType:'image/png',buffer:bytes});
 await state(slot).locator('img').waitFor();
 await page.waitForFunction(id=>!document.querySelector(`[data-signature-mode="${id}"]`)?.disabled,slot.id);
}
async function getDownload(selector,filename){
 const waiting=page.waitForEvent('download',{timeout:90000});
 await page.locator(selector).click();
 const download=await waiting;assert.equal(await download.failure(),null);
 await download.saveAs(path.join(out,filename));
 if(await page.locator('.signing-guide').count())await page.locator('.signing-guide [data-close]').click();
 return fs.readFile(path.join(out,filename));
}
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal page overflow');}
function contents(pdf,page){
 const raw=page.node.Contents();if(!raw)return [];
 const entries=raw instanceof PDFArray?raw.asArray():[raw];
 return entries.map(entry=>pdf.context.lookup(entry)).map(stream=>{assert.ok(stream instanceof PDFRawStream);return sha(stream.getContents());});
}
function imageCount(pdf,page){
 const resources=page.node.Resources(),ref=resources?.get(PDFName.of('XObject')),objects=ref?pdf.context.lookup(ref,PDFDict):null;
 if(!objects)return 0;
 return objects.values().filter(ref=>pdf.context.lookup(ref)?.dict?.get(PDFName.of('Subtype'))?.toString()==='/Image').length;
}
async function verifyPDF(doc,originalBytes,signedBytes,slots){
 const original=await PDFDocument.load(originalBytes),signed=await PDFDocument.load(signedBytes);
 assert.equal(signed.getPageCount(),original.getPageCount());
 for(let i=0;i<original.getPageCount();i++){
  const before=original.getPage(i),after=signed.getPage(i),src=contents(original,before),dst=contents(signed,after);
  assert.deepEqual(after.getSize(),before.getSize());
  let cursor=0;for(const hash of src){cursor=dst.indexOf(hash,cursor);assert.ok(cursor>=0,`${doc.id} p${i+1}: original content stream was changed`);cursor++;}
  assert.equal(imageCount(signed,after)-imageCount(original,before),slots.filter(s=>s.page===i+1).length,`${doc.id} p${i+1} independent image count`);
  const raw=after.node.Contents(),entries=raw instanceof PDFArray?raw.asArray():raw?[raw]:[];
  const extra=entries.map(r=>signed.context.lookup(r)).filter(s=>!src.includes(sha(s.getContents()))).map(s=>s.dict.get(PDFName.of('Filter'))?.toString()==='/FlateDecode'?inflateSync(s.getContents()).toString():s.getContentsString()).join('\n');
  const draws=[...extra.matchAll(/q\s+([\s\S]*?)\/(\S+)\s+Do\s+Q/g)];
  const expected=slots.filter(s=>s.page===i+1);assert.equal(draws.length,expected.length,'only expected additional image drawing commands');
  for(const [j,draw]of draws.entries()){
   const matrices=[...draw[1].matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g)].map(m=>m.slice(1).map(Number));
   let matrix=[1,0,0,1,0,0];for(const n of matrices){const m=matrix;matrix=[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];}
   const image=after.node.Resources().lookup(PDFName.of('XObject'),PDFDict).lookup(PDFName.of(draw[2]));
   const place=signaturePlacement(expected[j],image.dict.lookup(PDFName.of('Width')).asNumber(),image.dict.lookup(PDFName.of('Height')).asNumber());
   const target=[place.width,0,0,place.height,place.x,after.getHeight()-place.y-place.height];
   matrix.forEach((value,n)=>assert.ok(Math.abs(value-target[n])<.001,`${doc.id}/${expected[j].id}: exact placement transform`));
   assert.ok(image.dict.has(PDFName.of('SMask')),'signature includes transparent alpha mask');
  }
 }
 report.pdf.push({doc:doc.id,pages:original.getPageCount(),slots:slots.map(s=>s.id),originalContentStreamsPreserved:true,expectedImageCounts:true,exactPlacementTransforms:true,transparentAlphaMasks:true});
}
async function rasterCompare(doc,bytes,slots){
 if(!server)return;
 const outcome=await page.evaluate(async({id,bytes,slots})=>{
  const {original}=await import('/src/pdf.js');
  const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
  // Outline rendering avoids nondeterministic browser font hinting across two
  // separately loaded documents while checking identical original artwork.
  const load=data=>pdfjs.getDocument({data,isEvalSupported:false,disableFontFace:true,useSystemFonts:false}).promise;
  const doc=window.__forms.docs.find(d=>d.id===id),before=await load(await original(doc)),after=await load(new Uint8Array(bytes));
  const results=[];
  const render=async(pdf,n)=>{const p=await pdf.getPage(n),v=p.getViewport({scale:1.25}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const context=c.getContext('2d',{willReadFrequently:true});await p.render({canvasContext:context,viewport:v}).promise;return {w:c.width,h:c.height,pixels:context.getImageData(0,0,c.width,c.height).data,image:c.toDataURL()};};
  for(let n=1;n<=before.numPages;n++){
   if(!slots.some(s=>s.page===n))continue;
   const a=await render(before,n),b=await render(after,n),selected=slots.filter(s=>s.page===n),counts=Object.fromEntries(selected.map(s=>[s.id,0]));let outside=0,whiteout=0;
   for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){
    // Canvas edge antialiasing can vary a few of 255 levels even when the
    // source drawing streams are byte-identical (also asserted above).
    const i=(y*a.w+x)*4,diff=Math.max(...[0,1,2].map(c=>Math.abs(a.pixels[i+c]-b.pixels[i+c])));if(diff<=12)continue;
    const within=selected.filter(s=>x>=s.rect[0]*1.25-2&&x<=(s.rect[0]+s.rect[2])*1.25+2&&y>=s.rect[1]*1.25-2&&y<=(s.rect[1]+s.rect[3])*1.25+2);
    if(!within.length)outside++;for(const s of within)counts[s.id]++;
    if(Math.min(...a.pixels.slice(i,i+3))<190&&Math.min(...b.pixels.slice(i,i+3))>245)whiteout++;
   }
   results.push({page:n,outside,whiteout,counts,after:b.image});
  }
  await before.loadingTask.destroy();await after.loadingTask.destroy();return results;
 },{id:doc.id,bytes:Array.from(bytes),slots});
 for(const row of outcome){await fs.writeFile(path.join(out,`review-${doc.id}-p${row.page}.png`),Buffer.from(row.after.split(',')[1],'base64'));for(const [slot,count]of Object.entries(row.counts))assert.ok(count>10,`${doc.id}/${slot}: missing visible ink`);delete row.after;}
 report.checks.push({raster:doc.id,pages:outcome,antialiasTolerance:12,note:'Browser raster comparison is informational because canvas antialiasing can vary. Original stream hashes, image count, alpha mask and exact placement transforms are strict assertions.'});
}
async function contextFor(browser){
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const request=route.request();
  if(!['GET','HEAD'].includes(request.method())){report.unexpectedMutations.push({method:request.method(),url:request.url()});await route.abort();return;}
  await route.continue();
 });
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return {context,p};
}
async function createFixture(){
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=750;canvas.height=200;
  const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,750,200);c.strokeStyle='#1456a0';c.lineWidth=4;c.lineCap='round';
  c.beginPath();c.moveTo(40,155);c.bezierCurveTo(310,115,150,20,280,43);c.bezierCurveTo(520,160,260,170,605,80);c.bezierCurveTo(460,180,585,142,705,157);c.stroke();return canvas.toDataURL();
 });
 return Buffer.from(data.split(',')[1],'base64');
}
async function matrix(name,browser){
 for(const lang of ['en','ar'])for(const width of [1440,390]){
  const {context,p}=await contextFor(browser);page=p;
  try{
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.goto(new URL('individuals/',base).href);await page.locator('.home,.workspace').waitFor();
   if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language').click();
   fixture||=await createFixture();
   for(const audience of ['individual','corporate'])for(const doc of docs.filter(d=>d.workflow!=='subscription'&&(d.group===audience||d.group==='shared')&&(!onlyDocs||onlyDocs.includes(d.id)))){
    await open(doc,audience);if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language').click();
    const slots=signatureSlots(doc);
    for(const [i,section]of doc.sections.entries()){
     await page.locator(`[data-step="${i}"]`).click();
     const expected=slots.filter(s=>mapping[doc.id][s.id]===section.id).map(s=>s.id).sort();
     assert.deepEqual(await page.locator('[data-signature-slot]').evaluateAll(ns=>ns.map(n=>n.dataset.signatureSlot).sort()),expected,`${doc.id}/${section.id}: correct section only`);
     for(const id of expected){const slot=slots.find(s=>s.id===id);await assertManual(slot);await chooseElectronic(slot);await mode(slot,'manual').check();await assertManual(slot);}
     await noOverflow();
    }
    const comprehensive=name===selected[0]&&lang==='en'&&width===1440;
    if(comprehensive){
     // Date defaults are ordinary answer ink, not signature ink. Clear them
     // through the form before comparing signature-only downloads to originals.
     for(const [index,section]of doc.sections.entries()){
      await page.locator(`[data-step="${index}"]`).click();
      for(const field of section.fields.filter(f=>f.type==='date'&&!f.hidden))await page.locator(`[name="${field.id}"]`).fill('');
     }
     for(const [index,slot]of slots.entries()){
      await go(doc,slot);await upload(slot);
      assert.deepEqual(Object.keys((await saved(audience,doc.id)).signatures).sort(),slots.slice(0,index+1).map(s=>s.id).sort(),`${doc.id}: upload affects only the selected signer`);
     }
     const record=await saved(audience,doc.id);assert.deepEqual(Object.keys(record.signatures).sort(),slots.map(s=>s.id).sort());
     for(const slot of slots)assert.equal(record.signatureModes[slot.id],'electronic');
     await page.reload();await state(slots.at(-1)).waitFor();
     assert.equal(await mode(slots.at(-1),'electronic').isChecked(),true);assert.equal(await state(slots.at(-1)).locator('img').count(),1);
     await page.locator('#language').click();assert.equal(await state(slots.at(-1)).locator('img').count(),1);await page.locator('#language').click();
     let blank;
     if(!skipPDFs){
      const signed=await getDownload('#download-now',`${audience}-${doc.id}-signed.pdf`);
      blank=await getDownload(`[data-blank="${doc.id}"]`,`${audience}-${doc.id}-blank.pdf`);
      const source=await fs.readFile(`public/pdfs/${doc.id}.pdf`);assert.deepEqual(blank,source,`${doc.id} blank bytes unchanged`);
      await verifyPDF(doc,blank,signed,slots);
      if(audience===doc.group||doc.group==='shared'&&audience==='individual')await rasterCompare(doc,signed,slots);
     }
     await go(doc,slots[0]);await mode(slots[0],'manual').check();await assertManual(slots[0]);
     const after=await saved(audience,doc.id);assert.equal(after.signatures[slots[0].id],undefined);
     for(const slot of slots.slice(1))assert.equal(after.signatures[slot.id],record.signatures[slot.id],`${doc.id} manual affects only own slot`);
     for(const slot of slots.slice(1)){await go(doc,slot);await mode(slot,'manual').check();await assertManual(slot);}
     if(!skipPDFs){const cleared=await getDownload('#download-now',`${audience}-${doc.id}-manual.pdf`);assert.deepEqual(cleared,blank,`${doc.id} all manual restores exact original`);}
    }
    report.ui.push({browser:name,lang,width,audience,doc:doc.id,sections:doc.sections.length,slots:slots.length});
    console.log('PASS',name,lang,width,audience,doc.id);
   }
   if(lang==='ar'||width===1440){const doc=docs.find(d=>d.id==='signature-form');await open(doc,'individual');await go(doc,signatureSlots(doc)[0]);await chooseElectronic(signatureSlots(doc)[0]);await page.locator('#fields-content').screenshot({path:path.join(out,`${name}-${lang}-${width}.png`)});}
  }finally{await context.close();}
 }
}
async function persistence(browser){
 const {context,p}=await contextFor(browser);page=p;
 try{
  const doc=docs.find(d=>d.id==='signature-form'),slot=signatureSlots(doc)[0];await open(doc,'individual');await go(doc,slot);await upload(slot);
  const before=(await saved('individual',doc.id)).signatures.specimen;
  await open(doc,'corporate');await go(doc,slot);await assertManual(slot);await upload(slot);
  await mode(slot,'manual').check();assert.equal((await saved('individual',doc.id)).signatures.specimen,before,'company manual does not clear individual');
  await open(doc,'individual');await go(doc,slot);assert.equal(await state(slot).locator('img').count(),1);
  await state(slot).locator('[data-signature-remove="specimen"]').click();assert.equal((await saved('individual',doc.id)).signatures.specimen,undefined);
  let unexpectedDownload=false;const downloaded=()=>{unexpectedDownload=true;};page.on('download',downloaded);
  await page.locator('#download-now').click();await page.waitForFunction(()=>document.querySelector('[data-signature-feedback="specimen"]')?.textContent.includes('Upload a signature image or choose manual signature.'));
  assert.equal(unexpectedDownload,false,'selected electronic signing without image must block generation');page.off('download',downloaded);
  await page.reload();await page.locator('.home,.workspace').waitFor();if(await page.locator('[data-doc="signature-form"]').count())await page.locator('[data-doc="signature-form"]').click();await go(doc,slot);
  assert.equal(await mode(slot,'electronic').isChecked(),true,'electronic without image remains selected');
  await page.evaluate(({key,data})=>{const r=JSON.parse(localStorage.getItem(key));r.signatures={specimen:data};delete r.signatureModes;localStorage.setItem(key,JSON.stringify(r));},{key:key('individual',doc.id),data:before});
  await page.reload();await state(slot).waitFor();assert.equal(await mode(slot,'electronic').isChecked(),true);assert.equal(await state(slot).locator('img').count(),1,'legacy signature preserved');
  // White-matted uploads are normalized to transparent ink before embedding.
  const image=await state(slot).locator('img').getAttribute('src');
  const normalized=await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaqueWhite=0;for(let i=0;i<p.length;i+=4){if(!p[i+3])transparent++;if(Math.min(p[i],p[i+1],p[i+2])>=235&&p[i+3])opaqueWhite++;}return {transparent,opaqueWhite,width:img.width,height:img.height};},image);
  assert.ok(normalized.transparent>0);assert.equal(normalized.opaqueWhite,0);assert.ok(signaturePlacement(slot,normalized.width,normalized.height).width<=slot.rect[2]);
  report.checks.push({legacySignaturePreserved:true,emptyElectronicModeRestored:true,missingElectronicImageBlocksGeneration:true,audienceIsolation:true,transparentInk:true});
 }finally{await context.close();}
}
async function customSignatureOnly(browser){
 const custom={id:'upload_signature_audit',title:'Synthetic signature-only document',ar:'مستند توقيع تجريبي',group:'shared',pages:1,pdfVersion:'audit',fields:[],signatures:[{id:'sign',label:'Signature',ar:'التوقيع',page:1,rect:[70,130,180,60]}]};
 const pdf=await PDFDocument.create();pdf.addPage([400,300]).drawText('Synthetic document - signature below',{x:45,y:235,size:12});const bytes=Buffer.from(await pdf.save());
 const {context,p}=await contextFor(browser);page=p;
 await context.route('**/api/management.php*',async route=>{
  const u=new URL(route.request().url());
  if(u.searchParams.get('action')==='catalogue'){const documents=[...docs.map(d=>({...d,builtin:true})),custom],orders=Object.fromEntries(['individual','corporate'].map(a=>[a,documents.filter(d=>d.group===a||d.group==='shared').map(d=>d.id)]));await route.fulfill({json:{documents,orders}});}
  else if(u.searchParams.get('id')===custom.id)await route.fulfill({contentType:'application/pdf',body:bytes});else await route.fallback();
 });
 try{
  const doc={...custom,custom:true,signatureSlots:custom.signatures,sections:[{id:'page_1',page:1}]},slot=custom.signatures[0];
  await open(doc,'individual');await go(doc,slot);await assertManual(slot);await upload(slot);
  const signed=await getDownload('#download-now','custom-signature-only-signed.pdf');await verifyPDF(doc,bytes,signed,[slot]);
  await mode(slot,'manual').check();const manual=await getDownload('#download-now','custom-signature-only-manual.pdf');assert.deepEqual(manual,bytes);
  report.checks.push({signatureOnlyManagedPage:true,customOriginalBytesPreserved:true});console.log('PASS synthetic signature-only managed document');
 }finally{await context.close();}
}

try{
 for(const [index,name]of selected.entries()){
  assert.ok(engines[name],`Unknown browser ${name}`);const browser=await engines[name].launch({headless:true,...(name==='chrome'?{channel:'chrome',args:['--disable-gpu','--disable-accelerated-2d-canvas']}:{})});
  try{await matrix(name,browser);await persistence(browser);if(index===0)await customSignatureOnly(browser);}finally{await browser.close();}
 }
 assert.deepEqual(errors,[],'browser errors');assert.deepEqual(report.unexpectedMutations,[],'unexpected write requests');
 report.completed=new Date().toISOString();report.result='pass';console.log(`PASS ${report.ui.length} UI combinations, ${report.pdf.length} signed PDFs, persistence, isolation and managed signature-only pages`);
}catch(error){
 report.result='fail';report.error=error.stack;
 try{await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}
 throw error;
}finally{
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));if(server)await server.close();
}
