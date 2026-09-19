import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
// Five complete fills per original, through the same inputs/download used by visitors.
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';

const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/pdfs/audit';
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/schema.json`,JSON.stringify(docs,null,2));
const cases=[
 {id:'english',name:'Omar Ali',short:'Omar',city:'Jeddah',ar:false},
 {id:'arabic',name:'أحمد علي',short:'أحمد',city:'جدة',ar:true},
 {id:'english-long',name:'Abdulrahman Mohammed Alotaibi',short:'Mohammed',city:'Riyadh',ar:false,long:true},
 {id:'arabic-long',name:'عبدالرحمن محمد عبدالله العتيبي',short:'عبدالله',city:'الرياض',ar:true,long:true},
 {id:'mixed',name:'أحمد Ali 12',short:'Ali علي',city:'جدة Jeddah',ar:true,mixed:true},
];
const arabicDigits=s=>s.replace(/[0-9]/g,n=>'٠١٢٣٤٥٦٧٨٩'[n]);
function answer(f,c,i){
 const id=f.id,w=f.rect?.[2]||200;
 if(f.type==='choice')return f.multiple?f.options.filter((_,j)=>(j+i)%2===0).map(o=>o.value):f.options[i%f.options.length].value;
 if(f.type==='select')return f.selectOptions[i%f.selectOptions.length][0];
 if(f.type==='date')return ['1987-02-09','1995-12-31','2001-01-01','2030-11-27','2026-09-16'][i];
 const digits=c.ar&&!c.mixed?arabicDigits:s=>s;
 if(f.cells){if(f.stripDots)return ['123ABC','456DEF','789GHI','ABC123','DEF456'][i]+'01234'+'LE'+'682';return digits(('000123456789'.repeat(2)).slice(i,i+f.cells));}
 if(f.numeric||/^(ideal_|current_)/.test(id))return digits(String(/^(ideal_|current_)/.test(id)?[10,15,20,25,30][i]:i+2));
 if(id==='fund_name')return c.ar?'صندوق النعيم العقاري':'Al Naeem Real Estate Fund';
 if(id==='total_words')return c.ar?'مائة ألف ريال سعودي':'One hundred thousand Saudi riyals';
 if(/email/.test(id))return c.long?'m.alotaibi@example.com':'omar@example.com';
 if(/website/.test(id))return 'https://example.com';
 if(/iban/.test(id))return 'SA0380000000608010167519';
 if(/giin/.test(id))return '123ABC01234LE682';
 if(/phone|mobile|fax/.test(id))return digits(i%2?'0550123456':'00966123456789');
 if(/postal|additional|unit|dependents|^cr$|unified|_id$|id_number|bank_account/.test(id))return digits(w<40?'02':w<120?'001234':'0001234567');
 if(/(^years|_ratio|_transactions|^employees$|^capital$|^turnover$)/.test(id))return digits(w<80?'12':'12000');
 if(/title_other/.test(id))return c.ar?'د.':'Dr';
 if(/id_other|rep_type|id_type/.test(id))return c.ar?'هوية':'ID';
 if(/currency/.test(id))return c.ar?'ريال':'SAR';
 if(f.direction==='ltr')return c.long&&w>=150?'Abdulrahman Mohammed Alotaibi':w<100?'Omar':'Omar Ali';
 if(f.direction==='rtl')return c.long&&w>=150?'عبدالرحمن محمد عبدالله العتيبي':w<100?'أحمد':'أحمد علي';
 if(/name/.test(id)&&(w>110||f.multiline))return c.name;
 if(/capacity|relationship/.test(id))return c.ar?'مدير':'Director';
 if(/building/.test(id))return digits('128');
 if(/country/.test(id))return ['Saudi Arabia','المملكة العربية السعودية','United States of America','الولايات المتحدة الأمريكية','United Arab Emirates'][i];
 if(/nationality/.test(id))return c.ar?(w<55?'سعودي':'السعودية'):'Saudi';
 if(/(?:^|_)(city|district|birthplace|branch|place)$/.test(id))return w<50?(c.ar?'جدة':'Jeddah'):c.city;
 if(/street/.test(id))return c.ar?'شارع النور':'King Rd';
 if(/address/.test(id))return c.long&&w>=150?(c.ar?'١٢٨ شارع الملك فهد، حي النور، الرياض':'128 King Fahd Road, Al Noor, Riyadh'):(c.ar?'١٢٨ شارع النور':'128 King Rd');
 if(/ownership/.test(id))return digits('25');
 if(/tin/.test(id))return digits(w<60?'001234':'0012345678');
 if(/sector_other/.test(id))return c.ar?'تعليم':'IT';
 if(f.multiline&&w>100&&c.long)return c.ar?'عبدالرحمن العتيبي\nشركة النور، الرياض':'Abdulrahman Alotaibi\nAl Noor Company, Riyadh';
 return w<40?(c.ar?'علي':'Ali'):w<70?(c.ar?'جدة':'Omar'):w<150?c.short:c.name;
}
const engine=process.env.BROWSER||'chrome';
const browser=await ({chrome:chromium,firefox,webkit}[engine]).launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
const page=await browser.newPage({viewport:{width:1400,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(30000);
const previous=process.env.ONLY_DOCS?JSON.parse(await fs.readFile(`${out}/downloads.json`,'utf8').catch(err=>{if(err.code==='ENOENT')return '[]';throw err;})):[];
const selected=process.env.ONLY_DOCS?.split(',');
const report=previous.filter(r=>!selected.includes(r.doc));
try{
 await openCatalogue(page,base);
 for(const doc of docs.filter(d=>d.workflow!=='subscription'&&(!selected||selected.includes(d.id))))for(const [i,c]of cases.entries()){
  await openDocument(page,base,doc.id);
  const values={};
  for(const [step,s] of doc.sections.entries()){
   await page.locator(`[data-step="${step}"]`).click();
   for(const f of s.fields){
    if(f.sum)continue;
    const value=answer(f,c,i);values[f.id]=value;
    const input=page.locator(`[name="${f.id}"]`);
    if(f.type==='choice'){
     await page.locator(`[data-clear="${f.id}"]`).click();
     for(const v of Array.isArray(value)?value:[value])await page.locator(`[name="${f.id}"][value="${v}"]`).check();
    }else if(f.type==='select')await input.selectOption(value);
    else {await input.fill(value);assert.equal(await input.inputValue(),value,`${doc.id}/${f.id}: input truncated`);}
   }
  }
  const name=`${doc.id}-${c.id}`;
  await fs.writeFile(`${out}/${name}.json`,JSON.stringify(values,null,2));
  const download=page.waitForEvent('download',{timeout:20000}).then(d=>({d}),e=>({error:e.message}));
  await page.locator('#download-now').click();
  const result=await download;
  if(result.error){
   const invalid=await page.locator('[data-field].invalid').evaluateAll(nodes=>nodes.map(n=>n.dataset.field));
   report.push({doc:doc.id,sample:c.id,error:await page.locator('#status').innerText(),invalid});
   console.log('FAIL',name,JSON.stringify(report.at(-1)));
  }else{
   await result.d.saveAs(`${out}/${name}.pdf`);
   report.push({doc:doc.id,sample:c.id,file:`${name}.pdf`,answers:Object.keys(values).length});
   console.log('PASS',name);
  }
  await page.locator('#back-home').click();
 }
 await fs.writeFile(`${out}/downloads.json`,JSON.stringify(report,null,2));
 assert.equal(report.filter(r=>r.error).length,0,'Some test answers did not fit; inspect downloads.json');
 assert.deepEqual(errors,[]);
 console.log('PASS:',report.length,'complete fills downloaded through the website.');
}finally{await browser.close();}
