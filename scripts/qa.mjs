import {chromium, firefox, webkit} from 'playwright';
import fs from 'node:fs/promises';
await fs.mkdir('tmp/pdfs',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.setDefaultTimeout(20000);
const failures=[];
page.on('pageerror',e=>failures.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.locator('[data-doc="signature-form"]').waitFor();
await page.screenshot({path:'tmp/pdfs/home-desktop.png',fullPage:true});
const schemas=await page.evaluate(()=>window.__forms.docs);
await fs.writeFile('tmp/pdfs/schema.json',JSON.stringify(schemas,null,2));
const ids=schemas.map(d=>d.id);
for(const id of ids){
 const result=await page.evaluate(async id=>{
  const{docs,generate}=window.__forms,d=docs.find(d=>d.id===id),v={};
  for(const f of d.fields){
   if(f.sum)continue;
   if(f.type==='choice')v[f.id]=f.multiple?f.options.map(o=>o.value):f.options[0].value;
   else if(f.type==='select')v[f.id]=f.selectOptions.some(o=>o[0]==='B')?'B':f.selectOptions[0][0];
   else if(f.type==='date')v[f.id]='2026-09-16';
   else if(f.cells)v[f.id]='01234567890123456789'.slice(0,f.cells);
   else if(f.numeric)v[f.id]='10';
   else if(f.rect[2]<50)v[f.id]='12';
   else if(f.rect[2]<100)v[f.id]=f.direction==='ltr'?'Ahmad':'أحمد';
   else v[f.id]=f.direction==='ltr'?'Ahmad Ali':'أحمد علي';
  }
  if(id==='fatca-crs-corporate'){v.fatca_class='2';v.crs_class='13';}
  if(id==='fatca-crs-individual'){v.us_person='no';v.outside_tax='no';v.permanent_residence='no';for(let i=0;i<3;i++)v['tax_reason_'+i]='A';}
  if(id.startsWith('kyc-'))v.currencies=['sar'];
  if(id==='kyc-individual'){v.beneficial_owner='yes';v.listed_association='no';v.title='mr';v.id_type='national';v.special_case=[];}
  try {const data=await generate(d,v);return {base64:btoa(Array.from(data,c=>String.fromCharCode(c)).join('')),values:v};}
  catch(e){return {error:e.message,fields:e.fields,stack:e.stack};}
 },id);
 if(result.error){console.log('FAIL',id,result.error,result.fields,result.stack);failures.push(id);continue;}
 await fs.writeFile(`tmp/pdfs/filled-${id}.pdf`,Buffer.from(result.base64,'base64'));
 await fs.writeFile(`tmp/pdfs/filled-${id}.json`,JSON.stringify(result.values,null,2));
 console.log('EXPORTED',id);
}
await page.locator('[data-doc="signature-form"]').click();
await page.locator('[name="client_name"]').fill('أحمد عبدالله — Ahmad Abdullah');
await page.locator('[name="client_number"]').fill('001234567890');
await page.locator('[name="date"]').fill('2026-09-16');
await page.locator('#next').click();
await page.locator('[name="signer_name"]').fill('عبدالرحمن محمد الأحمد');
await page.locator('[name="signer_role"][value="client"]').check();
await page.locator('#next').click();
try{
 await page.locator('#download:not([disabled])').waitFor();
 await page.locator('#loading').waitFor({state:'hidden'});
 const download=page.waitForEvent('download');await page.locator('#download').click();
 await(await download).saveAs('tmp/pdfs/signature-ui-download.pdf');
 await page.screenshot({path:'tmp/pdfs/review-desktop.png',fullPage:true});
 console.log('UI_DOWNLOAD_OK');
}catch(e){console.log('UI_FAIL',await page.locator('#status').innerText());failures.push('UI download');}
await page.setViewportSize({width:390,height:844});
await page.locator('#back-home').click();
await page.locator('#language').click();
await page.screenshot({path:'tmp/pdfs/home-mobile-ar.png',fullPage:true});
console.log('MOBILE_OVERFLOW',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
await browser.close();
if(failures.length)throw Error(JSON.stringify(failures));
