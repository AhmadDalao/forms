import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='tmp/pdfs/current-audit-20260920';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']}}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]);
 const report=await page.evaluate(async()=>{
  const {docs}=await import('/src/forms/index.js'),{textImage}=await import('/src/pdf.js');await document.fonts.load('10px "Noto Sans Arabic"','العربية English');await document.fonts.ready;
  const fields=docs.find(d=>d.id==='fatca-crs-individual').fields.filter(f=>['sa_street','outside_street','mail_street'].includes(f.id)),results=[];
  for(const field of fields)for(const value of ['King Fahd Road','Prince Sultan','شارع الملك فهد','Road '.repeat(100)]){
   const result=textImage(value,field.rect[2],field.rect[3],field),item={field:field.id,value,rect:field.rect,error:!!result.error};
   if(result.data){const im=new Image();im.src=result.data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let left=c.width,top=c.height,right=-1,bottom=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}Object.assign(item,{data:result.data,bounds:[left,top,right,bottom],imageSize:[c.width,c.height]});}
   results.push(item);
  }
  return results;
 });
 for(const item of report){const huge=item.value.length>100;assert.equal(item.error,huge,item.field+' '+item.value.slice(0,30));if(!huge){const [left,top,right,bottom]=item.bounds,[w,h]=item.imageSize;assert.ok(left>0&&top>0&&right<w-1&&bottom<h-1);await fs.writeFile(out+'/'+item.field+'-'+(item.value==='King Fahd Road'?'english':item.value==='Prince Sultan'?'english2':'arabic')+'.png',Buffer.from(item.data.split(',')[1],'base64'));delete item.data;}}
 await fs.writeFile(out+'/street-regression.json',JSON.stringify({passed:true,results:report},null,2));console.log('PASS three street boxes: ordinary English + Arabic fit unclipped; unbounded value rejects safely.');
}finally{await browser.close();await server.close();}
