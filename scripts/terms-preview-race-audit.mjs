// Exercise real rendered pixels and delayed shared-profile replies in isolated storage.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,firefox,webkit} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';

const out=path.resolve(process.env.QA_OUT||'tmp/terms-preview-race-audit');
const reportPath=path.resolve(process.env.QA_REPORT||'docs/terms-preview-fix-2026-10-15/browser-verification.json');
const report={created_at:new Date().toISOString(),scope:'Synthetic clients on isolated current build; delayed profile/PDF responses and actual canvas pixels',cases:[],checks:[],errors:[],passed:false};
let f,browser,page;
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
async function pixels(){
 await page.waitForFunction(()=>{const c=[...document.querySelectorAll('[data-full-page]')];return c.length===38&&c.every(n=>n.width>300&&n.height>300);},null,{timeout:90000});
 const result=await page.evaluate(async()=>{
  const hash=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const count=data=>{let opaque=0,ink=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>200){opaque++;if(data[i]<235||data[i+1]<235||data[i+2]<235)ink++;}}return {opaque,ink};};
  const rows=[];
  for(const c of document.querySelectorAll('[data-full-page]')){
   const small=document.createElement('canvas');small.width=72;small.height=96;const ctx=small.getContext('2d');ctx.drawImage(c,0,0,72,96);
   // Exclude the address/footer band: footer-only output must not count as a page.
   const thumbnail=ctx.getImageData(0,0,72,90).data,row={page:Number(c.dataset.fullPage),width:c.width,height:c.height,thumbnail:count(thumbnail)};
   if([1,38].includes(row.page)){const full=c.getContext('2d').getImageData(0,0,c.width,c.height).data;row.full=count(full);row.sha256=await hash(full);}
   rows.push(row);
  }
  return rows;
 });
 assert.equal(result.length,38);
 for(const r of result){assert.ok(r.thumbnail.opaque>6000,'Page '+r.page+' must contain rendered opaque content');assert.ok(r.thumbnail.ink>10,'Page '+r.page+' must contain body ink');}
 for(const r of [result[0],result[37]])assert.ok(r.full.ink>1000,'Full-resolution page '+r.page+' must contain real ink');
 assert.equal(await page.locator('#status.error').count(),0);return result;
}
async function image(pageNumber,name){const data=await page.locator('[data-full-page="'+pageNumber+'"]').evaluate(c=>c.toDataURL('image/png'));await fs.writeFile(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));return path.relative(process.cwd(),path.join(out,name+'.png'));}
try{
 await fs.mkdir(out,{recursive:true});await fs.mkdir(path.dirname(reportPath),{recursive:true});f=await fixture({protectedRoutes:true});report.build=f.baseline;report.template_sha256=digest(await fs.readFile(f.out+'/site/pdfs/terms-and-conditions.pdf'));
 for(const engine of (process.env.QA_ENGINES||'chrome,firefox,webkit').split(',')){
  browser=await ({chrome:chromium,firefox,webkit}[engine]).launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  for(const audience of ['individual','corporate']){
   const lang=audience==='individual'?'en':'ar',width=audience==='individual'?1440:390,folder=audience==='individual'?'individuals':'companies';
   const ctx=await browser.newContext({viewport:{width,height:1000}}),user=await f.client(ctx,audience);
   const getShared=async()=>(await f.call(ctx,'portal','shared_profile',{params:{account:user.id,audience}})).shared;
   const saveShared=async changes=>f.call(ctx,'portal','shared_profile_save',{data:{account:user.id,audience,expectedRevision:(await getShared()).revision,changes}});
   await saveShared(audience==='individual'?{name_language:'en',en_first:'Baseline',en_second:'Shared',en_last:'Investor'}:{company_name:'Baseline Shared Company',company_name_en:'Baseline Shared Company'});
   for(const delayed of [true,false]){
    const row={engine,browser_version:browser.version(),audience,language:lang,width,case:delayed?'delayed-shared-profile-and-pdf':'settled-control',warnings:[]};report.cases.push(row);
    page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(engine+'/'+audience+': '+e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))row.warnings.push(m.text());});
    let releaseShared,releasePdf,seenShared,seenPdf;
    const sharedGate=new Promise(r=>releaseShared=r),pdfGate=new Promise(r=>releasePdf=r),sharedSeen=new Promise(r=>seenShared=r),pdfSeen=new Promise(r=>seenPdf=r);
    if(delayed){
     await page.route('**/api/portal.php?**',async route=>{if(new URL(route.request().url()).searchParams.get('action')==='shared_profile'){seenShared();await sharedGate;}await route.continue();});
     await page.route('**/pdfs/terms-and-conditions.pdf?**',async route=>{seenPdf();await pdfGate;await route.continue();});
    }
    const sharedResponse=page.waitForResponse(r=>new URL(r.url()).searchParams.get('action')==='shared_profile');
    await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('[data-doc="terms-and-conditions"]').waitFor();
    if(!delayed){await sharedResponse;await page.waitForTimeout(250);}
    await page.locator('[data-doc="terms-and-conditions"]').click();
    if(delayed){await Promise.all([sharedSeen,pdfSeen]);releaseShared();await sharedResponse;await page.waitForTimeout(250);releasePdf();}
    row.pages=await pixels();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(delayed)row.images=[await image(1,engine+'-'+audience+'-delayed-page1'),await image(38,engine+'-'+audience+'-delayed-page38')];
    pass(engine+'/'+audience+'/'+row.case+': all 38 pages have body ink; first/last full-resolution pixels verified');
    if(engine==='chrome'&&!delayed){
     await page.locator('[data-step="1"]').click();
     const field=audience==='individual'?'investor_name_first':'investor_name';
     assert.equal(await page.locator('[name="'+field+'"]').inputValue(),audience==='individual'?'Baseline':'Baseline Shared Company');
     await page.locator('#review-tab').click();await page.locator('#submit-form:enabled').waitFor({timeout:90000});const oldReview=await pixels();
     await saveShared(audience==='individual'?{en_first:'Updated',en_second:'Account',en_last:'Investor'}:{company_name:'Updated Account Company',company_name_en:'Updated Account Company'});
     const refreshed=page.waitForResponse(r=>new URL(r.url()).searchParams.get('action')==='shared_profile');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
     await page.locator('[name="'+field+'"]').waitFor();assert.equal(await page.locator('[name="'+field+'"]').inputValue(),audience==='individual'?'Updated':'Updated Account Company');
     assert.equal(await page.locator('#submit-form').count(),0);assert.equal(await page.locator('[data-full-page]').count(),0,'Stale filled review must be removed');
     await page.locator('#review-tab').click();await page.locator('#submit-form:enabled').waitFor({timeout:90000});const newReview=await pixels();
     assert.notEqual(oldReview[37].sha256,newReview[37].sha256,'Refreshed shared name must change the filled PDF page');assert.equal(oldReview[0].sha256,newReview[0].sha256,'Cover stays identical after changing the shared name');
     row.filled_review={old_page38_sha256:oldReview[37].sha256,new_page38_sha256:newReview[37].sha256,old_review_removed:true,shared_answer_refreshed:true,regenerated_pages_with_ink:38};
     pass(engine+'/'+audience+': shared-profile change still invalidates filled review, updates answers, and regenerates the last page');
    }
    await page.close();page=null;
   }
   await ctx.close();
  }
  await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;report.coverage={original_preview_cases:report.cases.length,original_pages_with_ink:report.cases.length*38,filled_review_regressions:report.cases.filter(c=>c.filled_review).length,filled_review_pages_with_ink:report.cases.filter(c=>c.filled_review).length*76};
}catch(error){report.failure=String(error.stack||error).replaceAll(process.cwd()+'/','');if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;console.error(error);}
finally{await browser?.close();await f?.close();await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log('REPORT '+path.relative(process.cwd(),reportPath));}
