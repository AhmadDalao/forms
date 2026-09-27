import assert from 'node:assert/strict';
import {chromium,firefox,webkit} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
const out=path.resolve(process.env.PREVIEW_OUT||'tmp/preview-direction-audit');await fs.mkdir(out,{recursive:true});
const server=await createServer({plugins:[{name:'preview-test-page',enforce:'pre',async load(id){if(id.endsWith('/src/subscription/calculations.js'))return(await fs.readFile(id,'utf8')).replace("import rules from '../../public/api/subscription/rules.json' with {type:'json'};",'const rules='+await fs.readFile('public/api/subscription/rules.json','utf8')+';');},configureServer(s){s.middlewares.use('/qa-preview',(_,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0;background:white"><canvas></canvas></body></html>');});}}],server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']}}});
await server.listen();const report={checks:[],errors:[]};
try{
 for(const engine of (process.env.PREVIEW_ENGINES||'chrome,firefox,webkit').split(',')){
  const browser=await({chrome:chromium,firefox,webkit}[engine]).launch({...(engine==='chrome'?{channel:'chrome'}:{}),headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1200,height:1700},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'qa-preview');
   for(const doc of docs.filter(d=>!process.env.ONLY_DOCS||process.env.ONLY_DOCS.split(',').includes(d.id))){
    const file=path.resolve('tmp/client-corrections-pdfs/'+doc.id+'-arabic-long.pdf'),original=await fs.readFile(file),bytes=Array.from(original);
    await page.evaluate(async bytes=>{const {loadPreview}=await import('/src/pdf.js');window.auditPdf=await loadPreview(new Uint8Array(bytes));},bytes);
    for(let number=1;number<=doc.pages;number++){
     const hashes=[];let comparison;
     for(const rtl of [false,true]){
      const result=await page.evaluate(async({bytes,number,rtl})=>{
       document.documentElement.dir=rtl?'rtl':'ltr';const canvas=document.querySelector('canvas');canvas.removeAttribute('dir');canvas.style.direction='';
       const {renderPage}=await import('/src/pdf.js');await renderPage(window.auditPdf,number,canvas,1200);
       const data=canvas.toDataURL('image/png'),direction=getComputedStyle(canvas).direction,pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
       let comparison=null;
       if(!rtl)window.referencePixels=pixels;
       else{let changed=0,total=0;for(let i=0;i<pixels.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(pixels[i+c]-window.referencePixels[i+c]);total+=d;delta=Math.max(delta,d);}if(delta>8)changed++;}comparison={changedFraction:changed/(pixels.length/4),meanDifference:total/(pixels.length/4*3)};}
       return {data,direction,comparison};
      },{bytes,number,rtl});
      assert.equal(result.direction,'ltr');const png=Buffer.from(result.data.split(',')[1],'base64');hashes.push(createHash('sha256').update(png).digest('hex'));
      if(rtl)comparison=result.comparison;
      if(number===1)await fs.writeFile(`${out}/${engine}-${doc.id}-${rtl?'rtl':'ltr'}.png`,png);
     }
     // Canvas antialiasing can vary along long table/band edges. The reproduced
     // RTL bug changed 4.7% of pixels (mean channel difference 4.88); these bounds
     // allow minor edge noise, not the displaced printed text in that failure.
     assert.ok(comparison.changedFraction<0.005&&comparison.meanDifference<0.15,`${engine} ${doc.id} p${number}: ${JSON.stringify(comparison)}`);
     report.checks.push({engine,document:doc.id,page:number,exactMatch:hashes[0]===hashes[1],...comparison});
    }
    await page.evaluate(async()=>{await window.auditPdf.loadingTask.destroy();delete window.auditPdf;});
    assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),createHash('sha256').update(original).digest('hex'),'PDF bytes unchanged');
    console.log('PASS '+engine+' '+doc.id+' '+doc.pages+' pages');
   }
  }finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await server.close();}
