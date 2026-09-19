import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {docs} from '../src/forms/index.js';
import {fixture,digest} from './workflow-harness.mjs';

// Build first. This snapshots dist into isolated storage on a nonce-verified
// local server; it never accepts hosted URLs or writes client submissions.
const f=await fixture(),out=path.join(f.out,'country-defaults');await fs.mkdir(out,{recursive:true});
const report={base:f.base,baseline:f.baseline,checks:[],pdfs:[],errors:[],source:{}};
for(const file of ['src/countries.js','src/drafts.js','src/shared-fields.js','src/subscription/model.js','src/subscription/editor.js','src/main.js'])report.source[file]=digest(await fs.readFile(file));
const eligible={
 'subscription-form':['country'],'subscription-company':['country','inc_country'],
 'kyc-individual':['country','bank_country'],'kyc-corporate':['registration_country','inc_country','bank_country'],
 'fatca-crs-individual':['birth_country','sa_country','mail_country'],
 'fatca-crs-corporate':['inc_country','residence_country','head_country','tax_country_0'],
};
const excluded={
 'subscription-form':['nationality'],'subscription-company':[],
 'kyc-individual':['nationality','overseas_countries'],'kyc-corporate':['auth_nationality','overseas_countries'],
 'fatca-crs-individual':['outside_country','tax_country_0','tax_country_1','tax_country_2','permanent_details','citizenships'],
 'fatca-crs-corporate':['tax_country_1','tax_country_2',...Array.from({length:5},(_,i)=>[`person_${i}_country`,`person_${i}_nationality`,`person_${i}_birthplace`]).flat()],
};
const browser=await chromium.launch({channel:'chrome',headless:true});let page;
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');}
async function closeGuide(){if(await page.locator('.signing-guide[open]').count())await page.locator('.signing-guide [data-close]').click();}
async function input(doc,id){const step=doc.sections.findIndex(s=>s.fields.some(field=>field.id===id));assert.ok(step>=0,id);await page.locator(doc.workflow==='subscription'?`[data-sub-step="${step}"]`:`[data-step="${step}"]`).click();const control=page.locator(`[name="${id}"]`);await control.waitFor();return control;}
async function value(doc,id,expected){assert.equal(await(await input(doc,id)).inputValue(),expected,doc.id+'/'+id);}
async function reload(){await page.reload();await page.locator('.home,.workspace').waitFor();}
async function download(selector,name){const pending=page.waitForEvent('download',{timeout:30000});pending.catch(()=>{});await page.locator(selector).first().click();const file=await pending;assert.equal(await file.failure(),null);const target=path.join(out,name);await file.saveAs(target);await closeGuide();return target;}
async function home(doc){await closeGuide();await page.locator(doc.workflow==='subscription'?'#sub-home':'#back-home').click();await page.locator('.home').waitFor();}
try{
 for(const lang of ['en','ar'])for(const audience of ['individual','corporate']){
  const context=await browser.newContext({viewport:{width:lang==='ar'?390:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
  const folder=audience==='corporate'?'companies':'individuals',saudi=lang==='ar'?'المملكة العربية السعودية':'Saudi Arabia',replacement=lang==='ar'?'الإمارات العربية المتحدة':'United States of America',prefix='itqan.forms.v1.'+audience+'.';
  await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('.home').waitFor();await page.locator('#shared-fields-panel>summary').click();
  for(const id of audience==='corporate'?['country','inc_country']:['country']){
   assert.equal(await page.locator('#shared-'+id).inputValue(),saudi);await page.locator('#shared-'+id).fill(replacement);await reload();await page.locator('#shared-fields-panel>summary').click();assert.equal(await page.locator('#shared-'+id).inputValue(),replacement);
   await page.locator('#shared-'+id).fill('');await reload();await page.locator('#shared-fields-panel>summary').click();assert.equal(await page.locator('#shared-'+id).inputValue(),'');await page.locator('#shared-'+id).fill(saudi);
  }
  await noOverflow();await page.screenshot({path:path.join(out,lang+'-'+audience+'-shared.png'),fullPage:true});await page.locator('#shared-fields-panel>summary').click();pass(lang+' '+audience+' shared defaults, replacement and deliberate clear survive reload');
  for(const doc of docs.filter(doc=>doc.group===audience&&eligible[doc.id])){
   await page.locator('[data-doc="'+doc.id+'"]').click();
   for(const id of eligible[doc.id])await value(doc,id,saudi);
   for(const id of excluded[doc.id])await value(doc,id,'');
   if(doc.id==='fatca-crs-corporate'){
    for(const [country,trigger] of [['tax_country_1','tax_tin_1'],['person_0_country','person_0_name']]){
     await(await input(doc,trigger)).fill('QA');await value(doc,country,saudi);await(await input(doc,trigger)).fill('');await value(doc,country,'');
     await(await input(doc,trigger)).fill('QA');await value(doc,country,saudi);await(await input(doc,country)).fill(replacement);await(await input(doc,trigger)).fill('');await value(doc,country,replacement);await reload();await value(doc,country,replacement);
     await(await input(doc,country)).fill('');await(await input(doc,trigger)).fill('QA');await reload();await value(doc,country,'');await(await input(doc,trigger)).fill('');
    }
    // Use another untouched controller row to include its active default in the PDF.
    await(await input(doc,'person_1_name')).fill('QA');await value(doc,'person_1_country',saudi);
    pass(lang+' optional corporate tax/controller rows initialize and remove only automatic countries; edited/cleared countries persist');
   }
   const primary=doc.id==='fatca-crs-corporate'?'residence_country':eligible[doc.id][0];
   assert.equal(await(await input(doc,primary)).isEditable(),true,'Shared subscription country stays editable');
   await(await input(doc,primary)).fill(replacement);await reload();await value(doc,primary,replacement);
   await(await input(doc,primary)).fill('');await reload();await value(doc,primary,'');await(await input(doc,primary)).fill(replacement);
   await noOverflow();await page.screenshot({path:path.join(out,lang+'-'+doc.id+'-country.png'),fullPage:true});
   const blank=await download(doc.workflow==='subscription'?'.sub-top-actions a[download]':'[data-blank="'+doc.id+'"]',lang+'-'+doc.id+'-blank.pdf');
   const original=path.join(f.out,'site',doc.workflow==='subscription'?'pdfs/subscription-'+(audience==='corporate'?'company':'individual')+'.pdf':'pdfs/'+doc.id+'.pdf');assert.equal(digest(await fs.readFile(blank)),digest(await fs.readFile(original)),'Blank download remains byte-identical '+doc.id);
   const filled=await download(doc.workflow==='subscription'?'[data-download]':'#download-now',lang+'-'+doc.id+'.pdf');assert.notEqual(digest(await fs.readFile(filled)),digest(await fs.readFile(original)));
   assert.equal(await page.locator('.field.invalid').count(),0,'No PDF overflow errors');
   const record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+doc.id),countryIds=[...eligible[doc.id],...(doc.id==='fatca-crs-corporate'?['person_1_country']:[])];
   const fields=countryIds.filter(id=>record.values[id]).map(id=>({...doc.fields.find(field=>field.id===id),value:record.values[id]}));
   report.pdfs.push({doc:doc.id,lang,filled,blank,original,fields,values:record.values});await fs.writeFile(filled.replace(/\.pdf$/,'.json'),JSON.stringify(record.values,null,2));
   pass(lang+' '+doc.id+' defaults/exclusions, editable replacement/clear/reload, filled PDF and pristine blank');await home(doc);
  }
  await context.close();
 }
 // A previously opened fresh profile can contain only the automatic country.
 // Registration must still seed the account name and phone into shared details.
 const accountContext=await browser.newContext(),user=await f.client(accountContext,'individual');page=await accountContext.newPage();page.setDefaultTimeout(15000);
 await page.goto(f.base+'/individuals/?lang=en');await page.locator('.home').waitFor();
 await page.evaluate(({id})=>localStorage.setItem('itqan.forms.v1.account.'+id+'.individual.shared-fields',JSON.stringify({country:'Saudi Arabia'})),user);await reload();await page.locator('#shared-fields-panel>summary').click();
 assert.equal(await page.locator('#shared-en_first').inputValue(),'QA');assert.equal(await page.locator('#shared-en_second').inputValue(),'Workflow');assert.equal(await page.locator('#shared-en_last').inputValue(),'individual');assert.equal(await page.locator('#shared-mobile').inputValue(),user.phone);assert.equal(await page.locator('#shared-country').inputValue(),'Saudi Arabia');await accountContext.close();pass('A country-only fresh account profile still receives registered client name and phone');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+path.join(out,'report.json'));}
