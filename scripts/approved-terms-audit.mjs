// Exercise the approved fund terms using disposable storage and synthetic clients.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture({protectedRoutes:true}),out=path.resolve(process.env.QA_OUT||'tmp/approved-terms-browser');
await fs.mkdir(out,{recursive:true});
const report={createdAt:new Date().toISOString(),scope:'Isolated build; synthetic clients only',build:f.baseline.build,checks:[],errors:[],passed:false};
const id='terms-and-conditions',card='[data-card="'+id+'"]';
const check=text=>{report.checks.push(text);console.log('PASS '+text);};
let browser,page;
async function pages(){
 assert.equal(await page.locator('[data-full-page]').count(),38);
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300&&c.height>300),null,{timeout:90000});
}
async function fit(label){
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);
  await page.screenshot({path:path.join(out,label+'-'+width+'.png')});
 }
 await page.setViewportSize({width:1440,height:900});
}
async function submit(){
 await page.locator('#submit-form').click();await page.locator('.submission-reference').waitFor({timeout:30000});
 await page.locator('.submission-dialog [data-close]').click();
}
try{
 for(const engine of (process.env.QA_ENGINES||'chrome,firefox,webkit').split(',')){
  browser=await ({chrome:chromium,firefox,webkit}[engine]).launch({...engine==='chrome'?{channel:'chrome'}:{},headless:true});
  for(const audience of ['individual','corporate']){
   const ctx=await browser.newContext({viewport:{width:1440,height:900}}),user=await f.client(ctx,audience);
   page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(engine+': '+e.message));
   const folder=audience==='individual'?'individuals':'companies';
   for(const lang of ['en','ar']){
    await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator(card).waitFor();
    assert.doesNotMatch(await page.locator(card).innerText(),/telephone|fax|الهاتف والفاكس/i);
    await page.locator('[data-doc="'+id+'"]').click();await page.locator('[data-step="0"]').click();await pages();
    assert.equal(await page.locator('.section-tab').count(),3);
    await fit(engine+'-'+audience+'-'+lang+'-document');
    await page.locator('[data-step="1"]').click();
    assert.equal(await page.locator('[name^=terms_],[name^=authorization_]').count(),0);
    assert.equal(await page.locator('[data-signature-mode]:checked').count(),0);
    assert.equal(await page.locator('[name=date]').count(),1);
    assert.equal(await page.locator('[name=investor_name]').count(),audience==='individual'?0:1);
    await fit(engine+'-'+audience+'-'+lang+'-declaration');
    if(lang==='en')await page.locator('#back-home').click();
   }
   const expected=audience==='individual'?'أحمد محمد علي الاختبار':'شركة الاختبار للاستثمار العقاري';
   const values=audience==='individual'?{investor_name_first:'أحمد',investor_name_second:'محمد',investor_name_third:'علي',investor_name_last:'الاختبار',date:'2026-10-15'}:{investor_name:expected,date:'2026-10-15'};
   for(const [name,value]of Object.entries(values))await page.locator('[name="'+name+'"]').fill(value);
   await page.locator('#review-tab').click();await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});await pages();
   await page.locator('[data-full-page="38"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,engine+'-'+audience+'-filled-page38.png')});
   await submit();
   let all=(await f.call(ctx,'portal','submissions')).submissions,current=all.find(s=>s.doc_id===id&&!s.archived_at);
   assert.equal(current.signature_state,'unsigned');assert.equal(current.review_required,false);
   const original=current,detail=(await f.call(ctx,'portal','detail',{params:{id:current.id}})).submission;
   assert.equal(detail.answers.investor_name,expected);assert.equal(detail.answers.date,'2026-10-15');
   assert.deepEqual(Object.keys(detail.signatures),[]);
   assert.equal(detail.profile.pdf_layout.pages,38);assert.equal(detail.profile.pdf_layout.pdfVersion,'20261015-approved-terms');
   const first=await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+current.id);assert.equal(first.status(),200);
   const firstBytes=await first.body();assert.equal((await PDFDocument.load(firstBytes)).getPageCount(),38);
   if(engine==='chrome'){
    await page.locator('#edit-again').click();await page.locator('[data-signature-mode][value=electronic]').check();
    await page.locator('[data-signature-file]').setInputFiles('tests/fixtures/signature.png');await page.locator('.sub-upload img').waitFor();
    await page.locator('#review-tab').click();await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});await pages();await submit();
    current=(await f.call(ctx,'portal','submissions')).submissions.find(s=>s.doc_id===id&&!s.archived_at);
    assert.notEqual(current.id,original.id);assert.equal(current.signature_state,'electronic');
    const signed=(await f.call(ctx,'portal','detail',{params:{id:current.id}})).submission;assert.deepEqual(Object.keys(signed.signatures),['investor']);assert.equal(signed.answers.investor_name,expected);
    await page.locator('#back-home').click();await page.locator(card+' [data-filled]').waitFor();
    const pdf=await ctx.request.get(new URL(await page.locator(card+' [data-filled]').getAttribute('href'),f.base).href);assert.equal(pdf.status(),200);
    const bytes=await pdf.body();assert.equal((await PDFDocument.load(bytes)).getPageCount(),38);
    await page.locator('[data-upload="'+id+'"]').click();await page.locator('.portal-upload [name=pdf]').setInputFiles({name:'signed-fund-terms.pdf',mimeType:'application/pdf',buffer:bytes});
    await page.locator('.portal-upload [name=signedConfirmed]').check();await page.locator('.portal-upload button.primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});
    all=(await f.call(ctx,'portal','submissions')).submissions;current=all.find(s=>s.doc_id===id&&!s.archived_at);assert.equal(current.source,'upload');assert.equal(current.signature_state,'uploaded');assert.equal(all.filter(s=>s.doc_id===id).length,3);
    const prior=await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+original.id);assert.equal(digest(await prior.body()),digest(firstBytes));
    const admin=await browser.newContext();await f.login(admin,'admin');
    const managed=(await f.call(admin,'portal','admin_detail',{params:{id:signed.id}})).submission;assert.equal(managed.answers.investor_name,expected);
    await admin.close();check(engine+'/'+audience+': unsigned → electronic signature → confirmed PDF replacement; old bytes and management answers preserved');
   }
   check(engine+'/'+audience+': complete 38-page preview, EN/AR desktop/mobile, declaration fields and unsigned submission');
   await ctx.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{await browser?.close();await f.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+out+'/report.json');}
