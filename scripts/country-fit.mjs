import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
// Realistic country names must fit without abbreviating the visitor's answer.
import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
const base=process.env.SITE_URL||'http://127.0.0.1:5173';
const out=process.env.QA_OUT||'tmp/pdfs/country-fit';
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/schema.json`,JSON.stringify(docs,null,2));
const names=['Saudi Arabia','United States of America','United Arab Emirates','المملكة العربية السعودية','الولايات المتحدة الأمريكية'];
const country=f=>f.type==='text'&&/country|citizenship/.test(f.id);
const results=[];
for(const [browserName,engine] of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(browserName))continue;
 const browser=await engine.launch({headless:true,...(browserName==='chrome'?{channel:'chrome'}:{})});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await openCatalogue(page,base);
  for(const doc of docs.filter(d=>d.fields.some(country))){
   for(const [i,name]of names.entries()){
    const values={};await openDocument(page,base,doc.id);
    for(const [step,section]of doc.sections.entries()){
     const fields=section.fields.filter(f=>country(f)||['branch','bank_currency'].includes(f.id));
     if(!fields.length)continue;
     await page.locator(`[data-step="${step}"]`).click();
     for(const f of fields){
      const ar=/[\u0600-\u06ff]/.test(name);
      const value=f.id==='branch'?(ar?'فرع المدينة المنورة':'New York Main Branch'):f.id==='bank_currency'?(ar?'الدولار الأمريكي':'United States Dollar'):name;
      values[f.id]=value;const input=page.locator(`[name="${f.id}"]`);await input.fill(value);
      assert.equal(await input.inputValue(),value,'Input must preserve full text');
     }
    }
    const pending=page.waitForEvent('download',{timeout:20000});
    await page.locator('#download-now').click();
    const download=await pending;
    const file=`${browserName}-${doc.id}-${i}.pdf`;await download.saveAs(`${out}/${file}`);
    assert.equal(await page.locator('[data-field].invalid').count(),0);
    assert.match(await page.locator('#download-result').innerText(),/Your PDF is ready/);
    await fs.writeFile(`${out}/${file.replace('.pdf','.json')}`,JSON.stringify(values,null,2));
    results.push({browser:browserName,doc:doc.id,name,file,fields:Object.keys(values).length});
    await page.locator('#back-home').click();
   }
   console.log('PASS',browserName,doc.id,'five full-country-name downloads');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,results},null,2));
console.log('PASS',results.length,'actual PDF downloads');
