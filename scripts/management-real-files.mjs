import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
const out=process.env.QA_OUT||'tmp/management-real-files',base=process.env.QA_BASE||'http://127.0.0.1:4175';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage();
const rows=[];try{
 await page.goto(base+'/individuals/');await page.locator('.home').waitFor();
 // Adjacent flat-PDF captions must retain their own column and field kind.
 const fixture=await PDFDocument.create(),paper=fixture.addPage([595,842]);
 for(const [label,x,width] of [['Signature',50,150],['Client Name',240,150],['Date:',430,100]]){paper.drawText(label,{x,y:720,size:10});paper.drawLine({start:{x,y:680},end:{x:x+width,y:680},thickness:.8});}
 paper.drawText('Signature form name',{x:50,y:500,size:10});paper.drawLine({start:{x:50,y:480},end:{x:250,y:480},thickness:.8});
 const fixtureBytes=await fixture.save();await fs.writeFile(out+'/signature-name-date-fixture.pdf',fixtureBytes);
 const detected=await page.evaluate(async bytes=>{const {inspectPDF}=await import('/src/management/importer.js');return inspectPDF(new File([new Uint8Array(bytes)],'signature-name-date.pdf',{type:'application/pdf'}));},Array.from(fixtureBytes));
 assert.equal(detected.signatures.length,1);assert.equal(detected.signatures[0].label,'Signature');
 assert.equal(detected.fields.find(f=>f.label==='Client Name')?.type,'text');assert.equal(detected.fields.find(f=>f.label==='Date:')?.type,'date');
 assert.equal(detected.fields.find(f=>f.label==='Signature form name')?.type,'text');assert.equal(detected.detected,4);
 await fs.writeFile(out+'/signature-name-date-fixture.json',JSON.stringify(detected,null,2));
 for(const file of (await fs.readdir('public/pdfs')).filter(f=>f.endsWith('.pdf')).sort()){
  const result=await page.evaluate(async file=>{
   const {inspectPDF}=await import('/src/management/importer.js');
   const {generate,textImage}=await import('/src/pdf.js');
   const response=await fetch('/pdfs/'+file),bytes=await response.arrayBuffer();
   let imported;try{imported=await inspectPDF(new File([bytes],file,{type:'application/pdf'}));}catch(error){return {file,importError:error.message};}
   const fields=imported.fields.map(f=>({...f,minFontSize:5,padding:2}));
   const doc={...imported,id:'qa_'+file,pdfUrl:'/pdfs/'+file,custom:true,fields,signatureSlots:imported.signatures,sections:[],signing:[...new Set(imported.signatures.map(s=>s.page))]};
   const base64=bytes=>{let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(str);};
   const cases=[['english','Ahmad Ali'],['arabic','أحمد علي'],['long-english','United States of America'],['long-arabic','المملكة العربية السعودية'],['mixed','أحمد Ali 012345']];
   const canvas=document.createElement('canvas');canvas.width=280;canvas.height=90;const ctx=canvas.getContext('2d');ctx.strokeStyle='#1456a0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(15,65);ctx.bezierCurveTo(45,5,45,80,80,35);ctx.bezierCurveTo(100,5,85,80,150,30);ctx.bezierCurveTo(165,65,195,20,255,40);ctx.stroke();const signatures=Object.fromEntries(imported.signatures.map(s=>[s.id,canvas.toDataURL('image/png')]));const samples=[];let checked=0;
   for(const [name,value] of (fields.length||imported.signatures.length)?cases:[]){
    const values=Object.fromEntries(fields.map(f=>[f.id,f.type==='choice'?(f.multiple?f.options.map(o=>o.value):f.options[0].value):f.type==='select'?f.selectOptions[0]?.[0]||'':f.type==='email'?'firstname.lastname@example.com':f.type==='tel'?'+966551234567':f.type==='date'?'2026-09-17':value]));
    let bad=[];
    for(const f of fields){if(!f.rect)continue;const v=f.type==='date'?'17/09/2026':String(values[f.id]);const rendered=textImage(v,f.rect[2],f.rect[3],f);checked++;if(rendered.error)bad.push(f.id);}
    try{const filled=await generate(doc,values,signatures);if(bad.length)throw Error('Unexpected generation with non-fitting values');samples.push({name,values,pdf:base64(filled)});}catch(error){samples.push({name,blocked:!!error.fields,fields:error.fields,error:error.message,values});}
   }
   let oversizedBlocked=null;const first=fields.find(f=>f.type!=='choice');if(first){try{await generate(doc,{[first.id]:'X'.repeat(4000)});oversizedBlocked=false;}catch(error){oversizedBlocked=!!error.fields?.includes(first.id);}}
   const overlaps=[];const boxes=[...fields,...imported.signatures].flatMap(f=>f.type==='choice'?f.options.map((o,i)=>({id:f.id+':'+i,page:f.page,rect:o.rect})):[{id:f.id,page:f.page,rect:f.rect}]);
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.page!==b.page)continue;const w=Math.min(a.rect[0]+a.rect[2],b.rect[0]+b.rect[2])-Math.max(a.rect[0],b.rect[0]),h=Math.min(a.rect[1]+a.rect[3],b.rect[1]+b.rect[3])-Math.max(a.rect[1],b.rect[1]);if(w>.5&&h>.5)overlaps.push({a:a.id,b:b.id,page:a.page,area:w*h});}
   return {file,pages:imported.pages,detected:imported.detected,signatures:imported.signatures,suggested:imported.suggested,importedWidgets:imported.importedWidgets,fields,pageSizes:imported.pageSizes,overlaps,checked,oversizedBlocked,samples};
  },file);
  if(file==='terms-and-conditions.pdf'){
   assert.equal(result.signatures.filter(s=>s.page===11).length,2,'Printed signature column must prepare signature uploads');
   const names=result.fields.filter(f=>f.page===11&&f.rect[0]>300);assert.equal(names.length,2);assert.ok(names.every(f=>f.type==='text'&&f.ar.includes('اسم')),'Neighboring names must remain text');
   assert.equal(result.fields.find(f=>f.page===13&&f.rect[0]>300&&f.rect[1]<380)?.ar,'اسم العميل','A neighboring signature label must not replace the customer name');
   assert.ok(result.fields.some(f=>f.page===11&&f.type==='date'),'Keep the date suggestion');
  }
  if(file==='al-naeem-terms-consent.pdf'){assert.equal(result.signatures.length,1);assert.match(result.signatures[0].ar,/التوقيع/);assert.equal(result.fields[0].type,'date');}
  for(const sample of result.samples||[])if(sample.pdf){sample.output=file.replace('.pdf','')+'-'+sample.name+'.pdf';await fs.writeFile(out+'/'+sample.output,Buffer.from(sample.pdf,'base64'));delete sample.pdf;}
  rows.push(result);await fs.writeFile(out+'/results.json',JSON.stringify(rows,null,2));
  console.log(file,result.importError||`${result.pages} pages; ${result.detected} suggestions; ${result.samples.filter(s=>s.output).length}/5 PDFs; ${result.overlaps.length} overlapping boxes; oversized blocked: ${result.oversizedBlocked}`);
 }
}finally{await browser.close();}
assert.ok(rows.length>=8);assert.ok(rows.every(r=>r.oversizedBlocked!==false),'Oversized answer escaped the fit guard');
