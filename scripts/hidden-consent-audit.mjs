// Synthetic accounts and isolated storage only; never contacts production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium,firefox,webkit} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';

const reportPath=path.resolve(process.env.QA_REPORT||'docs/hidden-consent-2026-10-15/browser-verification.json');
const report={created_at:new Date().toISOString(),scope:'Customer-only consent visibility and preserved historical follow-ups on isolated built application',checks:[],catalogue:[],errors:[],passed:false};
const consent='al-naeem-terms-consent';let f,browser,page;
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
const call=(ctx,action,options)=>f.call(ctx,'portal',action,options);
const decision=(ctx,s,status,note='')=>call(ctx,'admin_review',{data:{id:s.id,status,reason_text:note,expectedRevision:s.review_revision||0,requestKey:randomUUID()}});
const detail=async(ctx,id)=>(await call(ctx,'detail',{params:{id}})).submission;
const current=async ctx=>(await call(ctx,'submissions')).submissions.find(s=>s.doc_id===consent&&!s.archived_at);
const previewReady=()=>page.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
async function notificationPreview(){
 await page.locator('[data-notification-bell]').click();await page.locator('[data-notification-preview]').first().click();await previewReady();
 const content=await page.locator('.portal-pdf-pages canvas').evaluateAll(canvases=>canvases.map(c=>{const s=document.createElement('canvas');s.width=s.height=64;const x=s.getContext('2d');x.drawImage(c,0,0,64,64);const d=x.getImageData(0,0,64,60).data;let ink=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&Math.min(d[i],d[i+1],d[i+2])<235)ink++;return ink;}));
 assert.equal(content.length,1);assert.ok(content[0]>20,'Saved consent preview contains visible body content');
}
try{
 f=await fixture({protectedRoutes:true});report.build=f.baseline;
 const files=await fs.readdir(f.out+'/site/assets');let uploadModule;
 for(const name of files.filter(n=>/^upload-.*\.js$/.test(n)))if(/as uploadCompleted/.test(await fs.readFile(f.out+'/site/assets/'+name,'utf8')))uploadModule='/assets/'+name;
 assert.ok(uploadModule,'Built upload module export must be present');
 report.template_sha256=digest(await fs.readFile(f.out+'/site/pdfs/'+consent+'.pdf'));
 for(const engine of (process.env.QA_ENGINES||'chrome,firefox,webkit').split(',')){
  browser=await ({chrome:chromium,firefox,webkit}[engine]).launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  const owner=await browser.newContext();await f.login(owner,'superadmin');
  let workflow=(await call(owner,'admin_workflow')).workflow;
  if(!workflow.review_enabled)workflow=(await call(owner,'admin_workflow_update',{data:{reviewEnabled:true,expectedRevision:workflow.revision,requestKey:randomUUID()}})).workflow;
  for(const audience of ['individual','corporate']){
   const ctx=await browser.newContext(),user=await f.client(ctx,audience),folder=audience==='individual'?'individuals':'companies';
   page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(engine+'/'+audience+': '+e.message));
   const expected=[audience==='individual'?'subscription-form':'subscription-company','kyc-'+audience,'signature-form','fatca-crs-'+audience,'terms-and-conditions'];
   for(const lang of ['en','ar']){
    await page.setViewportSize({width:lang==='en'?1366:390,height:900});await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('[data-card]').first().waitFor();
    const cards=await page.locator('[data-card]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.card,number:Number(n.dataset.number)})));
    assert.deepEqual(cards.map(c=>c.id),expected);assert.deepEqual(cards.map(c=>c.number),[1,2,3,4,5]);assert.equal(await page.locator('[data-card="'+consent+'"]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const columns=await page.locator('[data-card]').evaluateAll(nodes=>new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().x))).size);assert.equal(columns,lang==='en'?2:1);
    // No generic-upload trigger is shown; exercise its actual built module.
    await page.evaluate(async({url,lang})=>(await import(url)).uploadCompleted({lang}),{url:uploadModule,lang});
    assert.deepEqual(await page.locator('.portal-upload [name=document] option').evaluateAll(nodes=>nodes.map(n=>n.value)),expected);
    await page.locator('.portal-upload [data-close]').click();
    report.catalogue.push({engine,audience,language:lang,width:lang==='en'?1366:390,cards,columns});
   }
   // A stale explicit link must not create a fresh hidden-form upload.
   await page.goto(f.base+'/'+folder+'/?lang=en&upload='+consent);await page.waitForFunction(()=>document.querySelector('#home-status')?.textContent.length>0);assert.equal(await page.locator('.portal-upload').count(),0);
   pass(engine+'/'+audience+': five cards numbered 1–5, responsive AR/EN, hidden generic upload and fresh explicit upload unavailable');
   // Seed a historical record through the retained API, then use ordinary notification actions.
   const saved=await f.submit(ctx,user,{document:consent,source:'upload',signedConfirmed:false,workflowRevision:workflow.revision});
   const original=await detail(ctx,saved.id),pdfBefore=digest(await (await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+saved.id)).body());
   await decision(owner,saved,'signature_required','Please sign the saved consent');
   await page.goto(f.base+'/'+folder+'/?lang=en');await page.locator('[data-card]').first().waitFor();assert.equal(await page.locator('[data-card]').count(),5);
   await page.evaluate(async url=>(await import(url)).uploadCompleted({lang:'en'}),uploadModule);assert.equal(await page.locator('.portal-upload option[value="'+consent+'"]').count(),0);await page.locator('.portal-upload [data-close]').click();
   await notificationPreview();assert.equal(await page.locator('.portal-preview [data-follow-up=sign]').count(),1);assert.equal(await page.locator('.portal-preview [data-follow-up=upload]').count(),1);
   await page.locator('.portal-preview [data-follow-up=sign]').click();await page.locator('[data-sign-file=investor]:enabled').waitFor();await page.locator('[data-sign-file=investor]').setInputFiles('tests/fixtures/signature.png');
   await page.locator('[data-sign-preview]:enabled').click();await page.waitForFunction(()=>document.querySelector('.portal-signing .portal-pdf-pages canvas')?.width>300&&!document.querySelector('[data-sign-preview]')?.disabled);
   await page.locator('.portal-signing [name=reviewed]').check();await page.locator('[data-sign-submit]:enabled').click();await page.locator('.portal-signing').waitFor({state:'detached'});
   const signed=await current(ctx);assert.equal(signed.version,2);assert.equal(signed.signature_state,'electronic');assert.equal(signed.presentation_status,'pending');
   await decision(owner,signed,'signature_required','Upload the signed replacement');
   await page.goto(f.base+'/'+folder+'/?lang=ar');await page.locator('[data-card]').first().waitFor();await notificationPreview();await page.locator('.portal-preview [data-follow-up=upload]').click();await page.locator('.portal-upload').waitFor();
   assert.equal(await page.locator('.portal-upload [name=document]').inputValue(),consent);assert.equal(await page.locator('.portal-upload [name=document]').isDisabled(),true);assert.equal(await page.locator('.portal-upload [name=signedConfirmed]').getAttribute('required'),'');
   await page.locator('.portal-upload [name=pdf]').setInputFiles(f.out+'/site/pdfs/'+consent+'.pdf');await page.locator('.portal-upload [name=signedConfirmed]').check();await page.locator('.portal-upload button.primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});
   const replaced=await current(ctx);assert.equal(replaced.version,3);assert.equal(replaced.source,'upload');assert.equal(replaced.signature_state,'uploaded');assert.equal(replaced.presentation_status,'pending');
   const historical=await detail(ctx,saved.id);for(const key of ['answers','profile','signatures','sha256','created_at'])assert.deepEqual(historical[key],original[key],key+' preserved');assert.equal(historical.current_id,replaced.id);
   assert.equal(digest(await (await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+saved.id)).body()),pdfBefore);
   const managed=await call(owner,'admin_client',{params:{id:user.id}});assert.ok(managed.documents.some(d=>d.id===consent));assert.equal(managed.submissions.filter(s=>s.doc_id===consent).length,3);
   await page.goto(f.base+'/'+folder+'/?lang=en');await page.locator('[data-card]').first().waitFor();assert.equal(await page.locator('[data-card]').count(),5);
   pass(engine+'/'+audience+': saved consent notification preview, electronic signature and signed replacement work; three versions, original PDF and management access preserved');
   await ctx.close();
  }
  await owner.close();await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.stack;await page?.screenshot({path:f.out+'/hidden-consent-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log('REPORT '+reportPath);await browser?.close();await f?.close();}
