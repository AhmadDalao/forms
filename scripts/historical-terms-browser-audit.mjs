// Real Chrome UI, disposable fixture only. Run after npm run build.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {signaturePlacement} from '../src/signatures.js';
import {fixture,digest} from './workflow-harness.mjs';

const out=path.resolve(process.env.QA_OUT||'tmp/historical-terms-browser');
const reportPath=path.resolve(process.env.QA_REPORT||'docs/approved-terms-2026-10-15/historical-browser-verification.json');
const report={created_at:new Date().toISOString(),scope:'Actual Chrome; synthetic isolated 13-page partial-signature fixture; no production writes',checks:[],screenshots:[],errors:[],passed:false};
const check=text=>{report.checks.push(text);console.log('PASS '+text);};
const sourcePath='reference/pdfs/archived/terms-13-page-riyadh-20261014.pdf';
let f,browser,page;
async function screenshot(locator,name){await locator.screenshot({path:path.join(out,name+'.png')});report.screenshots.push(path.relative(process.cwd(),path.join(out,name+'.png')));}
async function ready(){await page.locator('.portal-signing [data-sign-file=authorization_0]:enabled').waitFor({timeout:90000});assert.equal(await page.locator('.portal-signing canvas').count(),13);}
const core=s=>Object.fromEntries(['answers','profile','signatures','sha256'].map(k=>[k,s[k]]));
try{
 await fs.mkdir(out,{recursive:true});await fs.mkdir(path.dirname(reportPath),{recursive:true});
 for(const name of ['portal.php','portal-versions.php'])assert.equal(digest(await fs.readFile('dist/api/'+name)),digest(await fs.readFile('public/api/'+name)),'Build must include current '+name);
 const signingAsset=(await fs.readdir('dist/assets')).find(name=>/^sign-submission-.*\.js$/.test(name));assert.ok(signingAsset);
 assert.match(await fs.readFile('dist/assets/'+signingAsset,'utf8'),/existingSignatureIds/,'Build must include existing-signature UI');
 f=await fixture({protectedRoutes:true});report.build=f.baseline;
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 const client=await browser.newContext({viewport:{width:1440,height:1000}}),owner=await browser.newContext(),admin=await browser.newContext();
 await f.login(owner,'superadmin');await f.login(admin,'admin');const user=await f.client(client,'individual');
 const call=(ctx,action,options)=>f.call(ctx,'portal',action,options);
 let workflow=(await call(owner,'admin_workflow')).workflow;
 if(!workflow.review_enabled)workflow=(await call(owner,'admin_workflow_update',{data:{reviewEnabled:true,expectedRevision:workflow.revision,requestKey:randomUUID()}})).workflow;
 const old=JSON.parse(await fs.readFile('reference/documents/archived/terms-13-page-schema.json','utf8'));
 const defaultsPath=f.out+'/site/api/portal-defaults.json',currentRaw=await fs.readFile(defaultsPath),defaults=JSON.parse(currentRaw);
 assert.equal(defaults[old.id].pages,38);assert.equal(defaults[old.id].pdfVersion,'20261015-approved-terms');
 const original=await fs.readFile(sourcePath),image='data:image/png;base64,'+(await fs.readFile('tests/fixtures/signature.png')).toString('base64');
 const doc=await PDFDocument.load(original,{updateMetadata:false}),png=await doc.embedPng(image),slot=old.signatureSlots.find(s=>s.id==='terms_0'),p=signaturePlacement(slot,png.width,png.height),pdfPage=doc.getPage(slot.page-1);
 pdfPage.drawImage(png,{...p,y:pdfPage.getHeight()-p.y-p.height});const partialBytes=await doc.save();
 await fs.writeFile(out+'/partial-13-page.pdf',partialBytes);
 const values={terms_name_0:'Synthetic Historical Investor',authorization_name_0:'Synthetic Historical Investor',terms_date:'2026-10-15'};
 let saved;
 try{
  await fs.writeFile(defaultsPath,JSON.stringify({...defaults,[old.id]:old}));
  saved=(await call(client,'submit',{multipart:{metadata:JSON.stringify({account:user.id,document:old.id,audience:'individual',source:'online',pdfVersion:old.pdfVersion,workflowRevision:workflow.revision,expectedCurrent:null,requestKey:randomUUID(),values,signatures:{terms_0:image},signatureModes:{terms_0:'electronic',authorization_0:'manual'}}),pdf:{name:'partial-13-page.pdf',mimeType:'application/pdf',buffer:Buffer.from(partialBytes)}},status:201})).submission;
 }finally{await fs.writeFile(defaultsPath,currentRaw);}
 await call(admin,'admin_review',{data:{id:saved.id,status:'signature_required',reason_text:'Complete the missing authorization signature.',expectedRevision:0,requestKey:randomUUID()}});
 const before=(await call(client,'detail',{params:{id:saved.id}})).submission;
 assert.equal(before.signature_state,'unsigned');assert.equal(before.profile.pdf_layout.pages,13);
 const info=(await call(client,'signing_details',{params:{id:saved.id}})).signing;
 assert.equal(info.use_saved_pdf,true);assert.deepEqual(info.existingSignatureIds,['terms_0']);assert.deepEqual(info.requiredSignatureIds,['terms_0','authorization_0']);
 check('Current 38-page application resolves saved online 13-page layout and its existing terms_0 image');
 page=await client.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>report.errors.push(error.message));
 for(const [lang,width] of [['en',1440],['ar',390]]){
  await page.setViewportSize({width,height:1000});await page.goto(f.base+'/individuals/?lang='+lang);
  await page.locator('[data-follow-up=sign][data-submission="'+saved.id+'"]').click();await ready();
  assert.equal(new URL(page.url()).searchParams.has('submission'),false,'Historical signing must not redirect into current 38-page editor');
  assert.equal(await page.locator('[data-sign-file=terms_0]').count(),0);assert.equal(await page.locator('[data-slot=terms_0] input').count(),0);
  assert.match(await page.locator('[data-slot=terms_0]').innerText(),lang==='en'?/Already included/:/موجود بالفعل/);
  assert.equal(await page.locator('[data-sign-file=authorization_0]').count(),1);assert.equal(await page.locator('[data-sign-file=investor]').count(),0);
  assert.equal(await page.locator('[data-sign-preview]').isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.locator('.portal-signing .portal-preview-body').evaluate(body=>body.scrollWidth>body.clientWidth+1),false,'Signing dialog must fit all content without horizontal clipping');
  assert.equal(await page.locator('.portal-signing canvas').first().evaluate(canvas=>{const c=canvas.getBoundingClientRect(),body=canvas.closest('.portal-preview-body'),b=body.getBoundingClientRect(),style=getComputedStyle(body);return c.left<b.left+parseFloat(style.paddingLeft)-1||c.right>b.right-parseFloat(style.paddingRight)+1;}),false,'PDF canvas must fit the visible dialog');
  await screenshot(page.locator('.submitted-signature-fields'),'existing-readonly-'+lang+'-'+width);
  if(lang==='en')await page.locator('.portal-signing [data-close]').click();
 }
 check('English desktop and Arabic mobile fit the dialog/canvas, show existing signature read-only and missing slot editable, with no page-38 controls or editor redirect');
 const beforeRaster=await page.evaluate(async()=>{
  const canvases=[...document.querySelectorAll('.portal-signing canvas')];
  globalThis.__historicalLastPage=canvases.at(-1).getContext('2d').getImageData(0,0,canvases.at(-1).width,canvases.at(-1).height);
  return Promise.all(canvases.map(async c=>({width:c.width,height:c.height,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))].map(b=>b.toString(16).padStart(2,'0')).join('')})));
 });
 await screenshot(page.locator('.portal-signing canvas').nth(10),'existing-signature-page11');
 await page.locator('[data-sign-file=authorization_0]').setInputFiles('tests/fixtures/signature.png');
 await page.locator('[data-slot=authorization_0] [data-sign-image] img').waitFor();await page.locator('[data-sign-preview]:enabled').waitFor();
 await page.locator('[data-sign-preview]').click();await ready();
 const afterRaster=await page.evaluate(async()=>{
  const canvases=[...document.querySelectorAll('.portal-signing canvas')],c=canvases.at(-1),after=c.getContext('2d').getImageData(0,0,c.width,c.height),before=globalThis.__historicalLastPage;
  let count=0,x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let i=0;i<after.data.length;i+=4)if(after.data[i]!==before.data[i]||after.data[i+1]!==before.data[i+1]||after.data[i+2]!==before.data[i+2]||after.data[i+3]!==before.data[i+3]){const x=i/4%c.width,y=Math.floor(i/4/c.width);count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const pages=await Promise.all(canvases.map(async c=>({width:c.width,height:c.height,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))].map(b=>b.toString(16).padStart(2,'0')).join('')})));
  delete globalThis.__historicalLastPage;return {pages,changed_pixels:count,bounds:[x0,y0,x1+1,y1+1]};
 });
 assert.deepEqual(afterRaster.pages.slice(0,12),beforeRaster.slice(0,12),'Pages 1–12, including the existing page-11 signature, must render identically');
 assert.ok(afterRaster.changed_pixels>0);
 const target=old.signatureSlots.find(s=>s.id==='authorization_0'),last=doc.getPage(12),sx=afterRaster.pages[12].width/last.getWidth(),sy=afterRaster.pages[12].height/last.getHeight(),[x,y,w,h]=target.rect,[x0,y0,x1,y1]=afterRaster.bounds;
 assert.ok(x0>=Math.floor(x*sx)-1&&y0>=Math.floor(y*sy)-1&&x1<=Math.ceil((x+w)*sx)+1&&y1<=Math.ceil((y+h)*sy)+1,'All changed pixels must lie inside the missing authorization signature slot');
 report.rendering={before:beforeRaster,after:afterRaster.pages,changed_page:13,changed_pixels:afterRaster.changed_pixels,changed_bounds_pixels:afterRaster.bounds,slot:target.rect};
 await screenshot(page.locator('.portal-signing canvas').nth(12),'new-signature-page13');
 check('All 13 saved pages preview correctly; pages 1–12 remain pixel-identical and page-13 changes stay inside authorization_0');
 await page.locator('.portal-signing [name=reviewed]').check();
 // Chrome omits multipart file bodies from Playwright's postDataBuffer. Observe
 // the actual FormData before forwarding it unchanged to the native fetch.
 await page.evaluate(()=>{const nativeFetch=window.fetch;window.fetch=async function(input,options){
  if(String(input).includes('action=sign_submission')&&options?.body instanceof FormData){
   globalThis.__historicalSent={metadata:JSON.parse(options.body.get('metadata')),pdfSha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await options.body.get('pdf').arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('')};window.fetch=nativeFetch;
  }
  return nativeFetch.call(this,input,options);
 };});
 const response=page.waitForResponse(r=>r.url().includes('action=sign_submission')&&r.request().method()==='POST');
 await page.locator('[data-sign-submit]').click();const received=await response;assert.equal(received.status(),201);const result=(await received.json()).submission;
 const sent=await page.evaluate(()=>globalThis.__historicalSent),metadata=sent.metadata;
 assert.deepEqual(Object.keys(metadata.signatures),['authorization_0'],'Only the new image is submitted');
 await page.locator('.portal-signing').waitFor({state:'detached'});
 const final=(await call(client,'detail',{params:{id:result.id}})).submission;
 assert.equal(final.signature_state,'electronic');assert.equal(final.profile.pdf_layout.pages,13);assert.equal(final.edited_from,saved.id);assert.deepEqual(final.answers,before.answers);
 assert.deepEqual(Object.keys(final.signatures).sort(),['authorization_0','terms_0']);assert.equal(final.signatures.terms_0,image);assert.equal(final.signatures.authorization_0,metadata.signatures.authorization_0);
 const prior=await client.request.get(f.base+'/api/portal.php?action=pdf&id='+saved.id),current=await client.request.get(f.base+'/api/portal.php?action=pdf&id='+result.id);assert.equal(prior.status(),200);assert.equal(current.status(),200);
 const currentBytes=await current.body();assert.equal(digest(await prior.body()),digest(partialBytes));assert.equal(digest(currentBytes),sent.pdfSha256);assert.equal((await PDFDocument.load(currentBytes)).getPageCount(),13);
 assert.deepEqual(core((await call(client,'detail',{params:{id:saved.id}})).submission),core(before));
 const managed=(await call(admin,'admin_detail',{params:{id:result.id}})).submission;assert.equal(managed.signature_state,'electronic');assert.deepEqual(managed.signatures,final.signatures);
 await fs.writeFile(out+'/completed-13-page.pdf',currentBytes);
 report.pdfs={archived_template_sha256:digest(original),partial_saved_sha256:digest(partialBytes),completed_sha256:digest(currentBytes),current_38_page_template_sha256:digest(await fs.readFile('public/pdfs/terms-and-conditions.pdf')),previous_version_unchanged:true};
 report.request_signature_ids=Object.keys(metadata.signatures);report.saved_signature_ids=Object.keys(final.signatures).sort();report.result_signature_state=final.signature_state;
 report.coverage={responsive_views:2,preview_pages:13,compared_page_pairs:13,unchanged_pages:12,changed_page:13};
 check('Actual UI submits only authorization_0; API and management retain both images, report electronic, and preserve old answers/PDF hash');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error.stack||error).replaceAll(process.cwd()+'/', '');if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;console.error(error);}
finally{await browser?.close();await f?.close();await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log('REPORT '+path.relative(process.cwd(),reportPath));}
