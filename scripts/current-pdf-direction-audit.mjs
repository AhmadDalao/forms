import {createServer} from 'vite';
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='tmp/pdfs/current-audit-20260920/direction';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']}}});await server.listen();const report=[];
try{for(const [engine,type] of Object.entries({chrome:chromium,firefox,webkit})){
 const browser=await type.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
 try{const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]);
 const result=await page.evaluate(async()=>{
  const {docs}=await import('/src/forms/index.js'),{textImage,generate}=await import('/src/pdf.js'),{normalizePersonNames}=await import('/src/person-names.js');await document.fonts.load('10px "Noto Sans Arabic"','العربية English');await document.fonts.ready;
  const tests=[],pdfs=[];
  for(const type of ['tel','email','url'])for(const value of ['+٩٦٦٥٥١٢٣٤٥٦٧','first.last+١٢@example.com']){
   const f={type,fontSize:10},natural=textImage(value,220,20,f),forced=textImage(value,220,20,{...f,direction:'ltr'}),rtl=textImage(value,220,20,{fontSize:10,direction:'rtl'});tests.push({type,value,sameLTR:natural.data===forced.data,differentRTL:natural.data!==rtl.data});
  }
  const d=docs.find(d=>d.id==='kyc-individual');
  const scenarios=[{id:'arabic',parts:['عبدالرحمن','محمد','عبدالله','العتيبي'],rtl:true},{id:'english',parts:['Abdulrahman','Mohammed','Abdullah','Alotaibi'],rtl:false},{id:'arabic-first-mixed',parts:['عبدالرحمن','محمد','Abdullah','Alotaibi'],rtl:true},{id:'english-first-mixed',parts:['Abdulrahman','Mohammed','عبدالله','العتيبي'],rtl:false}];
  for(const scenario of scenarios){const values=normalizePersonNames(d,Object.fromEntries(['name_first','name_second','name_third','name_last'].map((id,i)=>[id,scenario.parts[i]])));values.phone='+٩٦٦٥٥١٢٣٤٥٦٧';values.mobile='+966551234567';values.email='first.last+qa@example.com';
   const fields=['name_1','name_2','phone','mobile','email'].map(id=>{const f=d.fields.find(f=>f.id===id);return {...f,value:values[id],rect:scenario.rtl&&f.rtlRect?f.rtlRect:f.rect,rtlRect:undefined};});
   pdfs.push({id:scenario.id,doc:d.id,fields,bytes:Array.from(await generate(d,values))});
  }
  const corp=docs.find(d=>d.id==='kyc-corporate'),address='1122 King Faisal Street Al Nakheel Company City 03456 0078 United Arab Emirates';
  const values={contact_address:address,business_phone:'+٩٦٦٥٥١٢٣٤٥٦٧',mobile:'+٩٦٦٥٥١٢٣٤٥٦٧'};pdfs.push({id:'corporate-full-shared-address',doc:corp.id,fields:Object.keys(values).map(id=>({...corp.fields.find(f=>f.id===id),value:values[id]})),bytes:Array.from(await generate(corp,values))});return {tests,pdfs};
 });
 for(const item of result.tests)assert.ok(item.sameLTR&&item.differentRTL,engine+' '+JSON.stringify(item));
 for(const item of result.pdfs){item.file=engine+'-'+item.id+'.pdf';await fs.writeFile(out+'/'+item.file,Buffer.from(item.bytes));delete item.bytes;}
 report.push({engine,...result});console.log('PASS '+engine+': Arabic-digit machine text LTR, 4 name directions, full shared address.');
 }finally{await browser.close();}
}
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}finally{await server.close();}
