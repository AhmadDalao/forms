// Synthetic clients only: responsive catalogue layout and unchanged card actions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, firefox, webkit} from 'playwright';
import {fixture} from './workflow-harness.mjs';

const f=await fixture({protectedRoutes:true});
const report={checks:[],layouts:[],errors:[]};
let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
async function measure(label,{desktop=false}={}){
 await page.evaluate(()=>document.fonts.ready);
 if(await page.locator('.home').count())await page.waitForFunction(()=>document.querySelector('[data-shared-save-status]')?.textContent===''&&!document.querySelector('.card-status')?.textContent.includes('…'));
 const m=await page.evaluate(()=>{
  const title=document.querySelector('.brand-fund-name'),range=document.createRange();range.selectNodeContents(title);
  const boxes=[...document.querySelectorAll('[data-card]')].map(el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,bottom:b.bottom};});
  return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
   titleLines:range.getClientRects().length,titleRight:range.getBoundingClientRect().right,titleLeft:range.getBoundingClientRect().left,
   cards:boxes,columns:new Set(boxes.map(b=>Math.round(b.x))).size,rows:new Set(boxes.map(b=>Math.round(b.y))).size};
 });
 report.layouts.push({label,...m});
 assert.ok(m.scrollWidth<=m.width+1,label+' horizontal overflow');
 assert.equal(m.titleLines,1,label+' fund name stays on one line');
 assert.ok(m.titleLeft>=0&&m.titleRight<=m.width,label+' fund name fully visible');
 if(desktop){assert.equal(m.cards.length,6);assert.equal(m.columns,3);assert.equal(m.rows,2);assert.ok(m.scrollHeight<=m.height+1,label+' entire home fits: '+m.scrollHeight+' > '+m.height);}
}
try{
 for(const [engine,type,launch] of [['chrome',chromium,{channel:'chrome'}],['firefox',firefox,{}],['webkit',webkit,{}]]){
  browser=await type.launch({headless:true,...launch});
  for(const audience of ['individual','corporate']){
   const ctx=await browser.newContext(),user=await f.client(ctx,audience),folder=audience==='corporate'?'companies':'individuals';
   page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(20000);
   await page.goto(f.base+'/'+folder+'/?lang=en');await page.locator('[data-card]').first().waitFor();
   const ids=await page.locator('[data-card]').evaluateAll(xs=>xs.map(x=>x.dataset.card));assert.equal(ids.length,6);
   await page.setViewportSize({width:1280,height:720});await measure(engine+' '+audience+' fresh',{desktop:true});
   const workflowRevision=(await f.call(ctx,'portal','session')).workflow.revision;
   for(const document of ids){
    const electronic=document==='signature-form',source=electronic||document==='terms-and-conditions'?'online':'upload';
    await f.submit(ctx,user,{document,workflowRevision,signatures:electronic?undefined:{},signatureModes:electronic?undefined:{},source,metadata:{submissionMode:'direct'}});
   }
   for(const lang of ['en','ar']){
    await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('[data-download-all]').waitFor();
    assert.equal(await page.locator('[data-filled]').count(),6);assert.equal(await page.locator('[data-upload]').count(),6);assert.equal(await page.locator('.card-status .review-badge').count(),6);
    for(const state of ['electronic','unsigned','uploaded'])assert.ok(await page.locator('.card-status [data-signature-state="'+state+'"]').count(),state+' status fixture');
    for(const [width,height] of [[1100,900],[1280,720],[1366,768],[1440,900]]){
     await page.setViewportSize({width,height});await measure(engine+' '+audience+' '+lang+' desktop',{desktop:true});
     if(engine==='chrome'&&width===1366)await page.screenshot({path:f.out+'/'+audience+'-'+lang+'-desktop.png'});
    }
    for(const width of [320,390,600,820,1024]){
     await page.setViewportSize({width,height:844});await measure(engine+' '+audience+' '+lang+' responsive');
     for(const button of await page.locator('[data-upload]').all()){await button.scrollIntoViewIfNeeded();assert.ok(await button.isVisible());}
     if(engine==='chrome'&&width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:f.out+'/'+audience+'-'+lang+'-mobile.png'});}
    }
    await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>scrollTo(0,0));
    await page.locator('[data-upload]').first().click();await page.locator('.portal-upload').waitFor();await page.locator('.portal-upload [data-close]').click();
    const blank=await ctx.request.get(new URL(await page.locator('[data-blank]').first().getAttribute('href'),f.base).href);assert.equal(blank.status(),200);
    const filled=await ctx.request.get(new URL(await page.locator('[data-filled]').first().getAttribute('href'),f.base).href);assert.equal(filled.status(),200);
    const zip=await ctx.request.get(new URL(await page.locator('[data-download-all]').getAttribute('href'),f.base).href);assert.equal(zip.status(),200);
    // Uploaded forms open the editor without a submitted-online revision redirect.
    await page.locator('[data-doc="'+ids[1]+'"]').click();await page.locator('#back-home').waitFor();await page.locator('#back-home').click();await page.locator('[data-card]').first().waitFor();
    pass(engine+' '+audience+' '+lang+': six cards fit laptop viewports, single-line fund name, responsive layout and card actions');
   }
   await ctx.close();
  }
  const publicCtx=await browser.newContext();page=await publicCtx.newPage();
  for(const lang of ['en','ar'])for(const width of [320,390,820,1366])for(const route of ['login','register','management']){
   await page.setViewportSize({width,height:768});await page.goto(f.base+'/'+route+'/?lang='+lang);await page.locator('.brand-fund-name').waitFor();await measure(engine+' '+route+' '+lang);
  }
  await publicCtx.close();pass(engine+': shared header on login, signup and management sign-in');await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/catalogue-failure.png'}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/catalogue-layout-report.json',JSON.stringify(report,null,2)+'\n');console.log('REPORT '+f.out+'/catalogue-layout-report.json');await browser?.close();await f.close();}
