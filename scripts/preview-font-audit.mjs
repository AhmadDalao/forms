import {chromium,firefox,webkit} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.PREVIEW_OUT||'tmp/preview-font-audit');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']}},plugins:[{name:'preview-audit-page',configureServer(s){s.middlewares.use('/qa-preview',(_,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0;background:white"><canvas></canvas></body></html>');});}}]});
await server.listen();const report=[];
try{
 for(const engine of (process.env.PREVIEW_ENGINES||'chrome').split(',')){
  const browser=await({chrome:chromium,firefox,webkit}[engine]).launch({...(engine==='chrome'?{channel:'chrome'}:{}),headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1200,height:1700},deviceScaleFactor:1});await page.goto(server.resolvedUrls.local[0]+'qa-preview');
   const pdfBytes=Array.from(await fs.readFile(process.env.PREVIEW_PDF||'tmp/client-corrections-pdfs/subscription-form-arabic-long.pdf'));
   for(const rtl of [false,true])for(const paths of [false,true]){
    const result=await page.evaluate(async({pdfBytes,paths,rtl})=>{
     document.documentElement.dir=rtl?'rtl':'ltr';
     const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
     const start=performance.now(),pdf=await pdfjs.getDocument({data:new Uint8Array(pdfBytes),isEvalSupported:false,disableFontFace:paths,useSystemFonts:false}).promise;
     const p=await pdf.getPage(1),viewport=p.getViewport({scale:1200/p.getViewport({scale:1}).width}),canvas=document.querySelector('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
     const data=canvas.toDataURL('image/png');await pdf.loadingTask.destroy();return {data,ms:Math.round(performance.now()-start)};
    },{pdfBytes,paths,rtl});
    await fs.writeFile(`${out}/${engine}-${rtl?'rtl':'ltr'}-${paths?'paths':'fonts'}.png`,Buffer.from(result.data.split(',')[1],'base64'));report.push({engine,paths,rtl,ms:result.ms});
   }
  }finally{await browser.close();}
 }
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await server.close();}
