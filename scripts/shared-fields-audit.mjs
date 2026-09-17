import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const out=process.env.QA_OUT||'tmp/pdfs/shared-fields';await fs.mkdir(out,{recursive:true});
const results=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const profiles={individuals:{en_first:'Ahmad',en_middle:'Ali',en_last:'Dalao',ar_first:'أحمد',ar_middle:'علي',ar_last:'دلاو',dob:'1990-01-30',phone:'001234567',mobile:'0551234567',email:'ahmad@example.com',id_number:'0012345678',client_number:'0000123',account_number:'0000405',building:'12',street:'King Road',district:'Noor',city:'Riyadh',postal:'00123',country:'Saudi Arabia'},companies:{company_name:'Example Trading',inc_country:'Saudi Arabia',phone:'920000001',mobile:'0557654321',email:'company@example.com',auth_name:'Company Signer',auth_id:'0012345678',building:'24',street:'Market Road',district:'Centre',city:'Jeddah',postal:'00234',country:'Saudi Arabia'}};
for(const [name,engine]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;
 const profile=await fs.mkdtemp('tmp/shared-browser-');
 const launch=()=>engine.launchPersistentContext(profile,{headless:true,...(name==='chrome'?{channel:'chrome'}:{}),viewport:{width:1360,height:1000}});
 let context=await launch(),page=context.pages()[0];const errors=[];const observe=p=>p.on('pageerror',e=>errors.push(e.message));observe(page);
 const goto=async folder=>{await page.goto(new URL(folder+'/',base).href);await page.locator('.home,.workspace').waitFor();};
 const home=async()=>{if(await page.locator('#back-home').count())await page.locator('#back-home').click();};
 const shared=async()=>{if(!await page.locator('#shared-fields-panel').evaluate(el=>el.open))await page.locator('#shared-fields-panel>summary').click();};
 const closeShared=async()=>{if(await page.locator('#shared-fields-panel').evaluate(el=>el.open))await page.locator('#shared-fields-panel>summary').click();};
 const answer=async(doc,id)=>{const section=doc.sections.findIndex(s=>s.fields.some(f=>f.id===id));await page.locator(`[data-step="${section}"]`).click();return page.locator(`[name="${id}"]`);};
 try{
  for(const folder of ['individuals','companies']){
   await goto(folder);await home();await shared();
   for(const [id,value]of Object.entries(profiles[folder])){const input=page.locator('#shared-'+id);if(id==='email'){await input.fill('');await input.pressSequentially(value);assert.equal(await input.inputValue(),value);}else await input.fill(value);}
   // Shared edits must preserve the active input and native caret behavior.
   if(folder==='individuals'){
    await page.locator('#shared-en_last').fill('');await page.locator('#shared-en_last').pressSequentially('Dalao');assert.equal(await page.locator('#shared-en_last').inputValue(),'Dalao');
    await page.locator('#shared-id_type').selectOption('national');
   }else await page.locator('#shared-auth_id_type').selectOption('national');
   await page.locator('#shared-also_residence').check();
   if(folder==='companies'){await page.locator('#shared-also_head').check();await page.locator('#shared-also_mail').check();}
   await closeShared();
   const ids=folder==='individuals'?['signature-form','terms-and-conditions','fatca-crs-individual','kyc-individual']:['signature-form','terms-and-conditions','fatca-crs-corporate','kyc-corporate'];
   for(const id of ids){
    const doc=docs.find(d=>d.id===id);await page.locator(`[data-doc="${id}"]`).click();
    const expectedName=folder==='individuals'?'Ahmad Ali Dalao':'Example Trading';
    const key=id==='signature-form'?'client_name':id==='terms-and-conditions'?'terms_name_0':id==='kyc-individual'?'name_1':id==='kyc-corporate'?'company':id==='fatca-crs-corporate'?'legal_name':'en_first';
    assert.equal(await(await answer(doc,key)).inputValue(),id==='fatca-crs-individual'?'Ahmad':expectedName);
    if(id==='signature-form'){
     await page.locator('[data-step="1"]').click();assert.equal(await page.locator('[name="signer_name"]').inputValue(),'');
     await page.locator(`[name="signer_role"][value="${folder==='individuals'?'client':'authorized'}"]`).check();
     assert.equal(await page.locator('[name="signer_name"]').inputValue(),folder==='individuals'?expectedName:'Company Signer');
    }
    if(id==='terms-and-conditions'){assert.equal(await page.locator('[name="terms_name_1"]').inputValue(),'');assert.equal(await(await answer(doc,'authorization_name_0')).inputValue(),expectedName);}
    if(id==='fatca-crs-individual'){
     assert.equal(await(await answer(doc,'ar_first')).inputValue(),'أحمد');assert.equal(await page.locator('[name="mail_city"]').inputValue(),'Riyadh');assert.equal(await page.locator('[name="sa_city"]').inputValue(),'Riyadh');assert.equal(await page.locator('[name="outside_city"]').inputValue(),'');
     await page.locator('[data-step="3"]').click();await page.locator('[name="capacity"][value="holder"]').check();assert.equal(await page.locator('[name="signer_ar"]').inputValue(),'أحمد علي دلاو');
    }
    if(id==='fatca-crs-corporate'){assert.equal(await(await answer(doc,'head_city')).inputValue(),'Jeddah');assert.equal(await(await answer(doc,'person_0_name')).inputValue(),'');assert.equal(await(await answer(doc,'signer_0_name')).inputValue(),'Company Signer');assert.equal(await page.locator('[name="signer_1_name"]').inputValue(),'');}
    if(id==='kyc-individual'){assert.equal(await(await answer(doc,'phone')).inputValue(),'001234567');assert.equal(await(await answer(doc,'rep_phone')).inputValue(),'');assert.equal(await(await answer(doc,'risk_client_name')).inputValue(),expectedName);}
    if(id==='kyc-corporate'){assert.equal(await(await answer(doc,'business_phone')).inputValue(),'920000001');assert.equal(await(await answer(doc,'auth_name')).inputValue(),'Company Signer');assert.equal(await(await answer(doc,'risk_client_name')).inputValue(),expectedName);}
    const pending=page.waitForEvent('download');await page.locator('#download-now').click();const download=await pending;
    const file=`${name}-${folder}-${id}.pdf`;await download.saveAs(`${out}/${file}`);const bytes=await fs.readFile(`${out}/${file}`);assert.notEqual(hash(bytes),hash(await fs.readFile(`reference/pdfs/${id}.pdf`)));
    const values=await page.evaluate(({folder,id})=>JSON.parse(localStorage.getItem('itqan.forms.v1.'+(folder==='individuals'?'individual':'corporate')+'.'+id)).values,{folder,id});
    await fs.writeFile(`${out}/${file.replace('.pdf','.json')}`,JSON.stringify(values,null,2));
    results.push({browser:name,folder,doc:id,file,sha256:hash(bytes)});await home();console.log('PASS',name,folder,id);
   }
  }
  // Closing the entire browser and reopening the same test profile restores each audience independently.
  await context.close();context=await launch();page=context.pages()[0];observe(page);
  await goto('individuals');await home();await shared();assert.equal(await page.locator('#shared-en_first').inputValue(),'Ahmad');
  await closeShared();await page.locator('[data-doc="signature-form"]').click();await page.locator('[data-step="0"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Ahmad Ali Dalao');
  await page.locator('[name="client_name"]').fill('Manual Client');await shared();await page.locator('#shared-en_first').fill('Omar');assert.equal(await page.locator('[name="client_name"]').inputValue(),'Manual Client');
  await page.reload();await page.locator('[name="client_name"]').waitFor();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Manual Client');
  await page.locator('[data-shared-use="client_name"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Omar Ali Dalao');
  const second=await context.newPage();observe(second);await second.goto(new URL('individuals/',base).href);await second.locator('[name="client_name"]').waitFor();
  await shared();await page.locator('#shared-en_first').fill('Ahmad');await second.waitForFunction(()=>document.querySelector('[name="client_name"]')?.value==='Ahmad Ali Dalao');
  const corporate=await context.newPage();observe(corporate);await corporate.goto(new URL('companies/',base).href);await corporate.locator('[data-doc="signature-form"]').click();await corporate.locator('[data-step="0"]').click();assert.equal(await corporate.locator('[name="client_name"]').inputValue(),'Example Trading');
  await page.locator('#shared-en_first').fill('Omar');await second.waitForFunction(()=>document.querySelector('[name="client_name"]')?.value==='Omar Ali Dalao');assert.equal(await corporate.locator('[name="client_name"]').inputValue(),'Example Trading');
  await second.close();await corporate.close();
  // A clear form stays blank across reload, and can explicitly reuse shared details later.
  await closeShared();await page.locator('#reset').click();await page.locator('#reset-confirm').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');
  await page.reload();await page.locator('[data-doc="signature-form"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');
  await shared();await page.locator('#fill-shared-blanks').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Omar Ali Dalao');
  await page.locator('#language').click();await page.setViewportSize({width:390,height:844});
  assert.ok(!(await page.locator('#shared-fields-panel').innerText()).includes('Shared document fields'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#shared-fields-panel').screenshot({path:`${out}/${name}-mobile-ar.png`});
  await page.locator('#clear-shared').click();await page.locator('#confirm-clear-shared').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'');
  await goto('companies');await home();await page.locator('[data-doc="signature-form"]').click();await page.locator('[data-step="0"]').click();assert.equal(await page.locator('[name="client_name"]').inputValue(),'Example Trading');
  await home();await page.locator('#clear-all').click();await page.locator('#clear-all-confirm').click();
  await shared();assert.equal(await page.locator('#shared-company_name').inputValue(),'');
  assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS',name,'restart, overrides, same-folder sync, cross-folder isolation, clear/reuse, language and mobile');
 }finally{await context.close();await fs.rm(profile,{recursive:true,force:true});}
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({site:base,results},null,2));
