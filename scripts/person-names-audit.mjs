import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {docs} from '../src/forms/index.js';
import {personNameGroups,joinPersonName} from '../src/person-names.js';
import {fixture,digest} from './workflow-harness.mjs';
const f=await fixture(),out=path.join(f.out,'person-names');await fs.mkdir(out,{recursive:true});
const report={base:f.base,baseline:f.baseline,checks:[],pdfs:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});let page;
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
async function guide(){if(await page.locator('.signing-guide[open]').count())await page.locator('.signing-guide [data-close]').click();}
async function download(selector,name){const pending=page.waitForEvent('download',{timeout:40000});pending.catch(()=>{});await page.locator(selector).first().click();const item=await pending;assert.equal(await item.failure(),null);const target=path.join(out,name);await item.saveAs(target);await guide();return target;}
const samples={en:['Ahmad','Ali','Omar','Dalao'],ar:['أحمد','علي','عمر','دلاو']};
try{
 for(const lang of ['en','ar'])for(const audience of ['individual','corporate']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
  const folder=audience==='individual'?'individuals':'companies',prefix='itqan.forms.v1.'+audience+'.';
  await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('.home').waitFor();
  for(const doc of docs.filter(doc=>(doc.group===audience||doc.group==='shared')&&personNameGroups(doc,audience).length)){
   await page.locator('[data-doc="'+doc.id+'"]').click();
   for(const [index,section]of doc.sections.entries()){
    const groups=personNameGroups(doc,audience).filter(group=>section.fields.some(field=>group.partIds.includes(field.id)));if(!groups.length)continue;
    await page.locator(doc.workflow==='subscription'?`[data-sub-step="${index}"]`:`[data-step="${index}"]`).click();
    for(const group of groups){
     const row=page.locator('[data-person-name-group="'+group.id+'"]');assert.equal(await row.count(),1);
     const tops=[];
     for(const [part,id]of group.partIds.entries()){
      const input=page.locator('[name="'+id+'"]');await input.fill(samples[group.language==='auto'?lang:group.language][part]);if(part===2)assert.equal(await input.getAttribute('required'),null);
     }
     tops.push(...await page.evaluate(ids=>ids.map(id=>document.querySelector('[name="'+id+'"]').getBoundingClientRect().y),group.partIds));
     assert.ok(Math.max(...tops)-Math.min(...tops)<2,doc.id+'/'+group.id+' four fields aligned on one desktop row');
     for(const target of group.targets)assert.equal(await page.locator('[name="'+target.id+'"]').count(),0,'Old full target hidden '+target.id);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No desktop overflow');
    await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No mobile overflow');await page.setViewportSize({width:1440,height:1000});
    if(index===0)await page.screenshot({path:path.join(out,lang+'-'+audience+'-'+doc.id+'-ui.png'),fullPage:true});
   }
   if(doc.workflow==='subscription'){
    await page.locator('[data-sub-step="0"]').click();if(audience==='individual')for(const [i,id]of ['first_name','second_name','third_name','family_name'].entries())await page.locator('[name="'+id+'"]').fill(samples[lang][i]);else await page.locator('[name="company_name"]').fill(lang==='ar'?'شركة الاختبار':'Example Company');
   }
   const base=lang+'-'+audience+'-'+doc.id;
   const blank=await download(doc.workflow==='subscription'?'.sub-top-actions a[download]':'[data-blank="'+doc.id+'"]',base+'-blank.pdf');
   const filled=await download(doc.workflow==='subscription'?'[data-download]':'#download-now',base+'.pdf');assert.notEqual(digest(await fs.readFile(blank)),digest(await fs.readFile(filled)));
   const record=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+doc.id),fields=[];
   for(const group of personNameGroups(doc,audience))for(const target of group.targets){const expected=joinPersonName(target.join.map(id=>record.values[id]));assert.equal(record.values[target.id],expected,doc.id+'/'+target.id);fields.push({...doc.fields.find(field=>field.id===target.id),value:expected});}
   report.pdfs.push({doc:audience+'-'+doc.id,lang,filled,original:blank,blank,fields,values:record.values});
   await page.reload();await page.locator('.workspace').waitFor();const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+doc.id);for(const field of fields)assert.equal(after.values[field.id],field.value,'Name reload '+field.id);
   pass(lang+' '+audience+' '+doc.id+': four-part rows, optional third, mobile fit, PDF download, joined targets and reload');
   await page.locator(doc.workflow==='subscription'?'#sub-home':'#back-home').click();await page.locator('.home').waitFor();
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+path.join(out,'report.json'));}
