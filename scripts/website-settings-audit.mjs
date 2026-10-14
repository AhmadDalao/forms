// Run after the final build. Every write targets a copied build and isolated
// synthetic-account fixture; this script accepts no remote origin or credentials.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture,digest} from './workflow-harness.mjs';

const reportPath=path.resolve('docs/website-settings-2026-10-14/browser-verification.json');
const canonical=JSON.parse(await fs.readFile('scripts/pdf-design/national-address.json','utf8'));
const parts=canonical.text.split(' | '),defaultAddress=[parts[0],parts.slice(1,3).join(' · '),parts.slice(3).join(' · ')].join('\n');
const f=await fixture({protectedRoutes:true}),out=path.join(f.out,'website-settings');
await fs.mkdir(out,{recursive:true});await fs.mkdir(path.dirname(reportPath),{recursive:true});
const report={createdAt:new Date().toISOString(),scope:'Copied local build, isolated private storage, synthetic accounts only. No production requests or submissions.',build:f.baseline.build,checks:[],footerViews:[],browserErrors:[],screenshots:[],passed:false};
for(const file of ['api/management.php','api/website-settings.php','api/national-address.json'])report.build[file]=digest(await fs.readFile(path.join(f.out,'site',file)));
let browser,page;
const pass=(name,evidence={})=>{report.checks.push({name,...evidence});console.log('PASS '+name);};
const action=request=>new URL(request.url()).searchParams.get('action');
const field=p=>p.locator('#website-national-address');
const submit=p=>p.locator('#website-settings-form [type=submit]');
const settings=async ctx=>(await f.call(ctx,'management','website_settings')).website;
async function context(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 ctx.on('page',p=>{p.setDefaultTimeout(20000);p.on('pageerror',error=>report.browserErrors.push(error.message));});
 return ctx;
}
async function language(p,lang){
 if(await p.locator('html').getAttribute('lang')!==lang)await p.locator('#language,#portal-language,[data-admin-language]').click();
 await p.locator('html[lang='+lang+']').waitFor();
}
async function openSettings(p){
 await p.goto(f.base+'/management/');await p.locator('.admin-stats').waitFor();
 await p.locator('[data-management-view=website]').click();await field(p).waitFor();
}
async function save(p,value){
 await field(p).fill(value);
 const response=p.waitForResponse(r=>action(r.request())==='website_settings_save'&&r.request().method()==='POST');
 await submit(p).click();const result=await response;assert.equal(result.status(),200);
 await p.locator('[data-address-status]').filter({hasText:/Address saved|تم حفظ العنوان/}).waitFor();
 assert.equal(await submit(p).isDisabled(),true);return (await result.json()).website;
}
async function shot(p,name,target=p){
 await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' horizontal page overflow');
 assert.equal(await p.locator('.site-header').count(),1,name+' has one header');
 const filename=name+'.png';await target.screenshot({path:path.join(out,filename),...(target===p?{fullPage:true}:{})});
 report.screenshots.push(path.relative(process.cwd(),path.join(out,filename)));
}
async function footer(p,screen,expected){
 for(const lang of ['en','ar']){
  await p.locator('.site-footer').waitFor();await language(p,lang);
  await p.waitForFunction(value=>[...document.querySelectorAll('.site-footer address span')].map(n=>n.textContent).join('\n')===value,expected);
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});await p.evaluate(()=>document.fonts.ready);
   const node=p.locator('.site-footer');await node.scrollIntoViewIfNeeded();
   const evidence=await node.evaluate(footer=>{
    const address=footer.querySelector('address'),box=address.getBoundingClientRect(),footerBox=footer.getBoundingClientRect();
    const spans=[...address.querySelectorAll('span')];
    return {footerCount:document.querySelectorAll('footer').length,heading:footer.querySelector('strong').textContent,language:address.lang,direction:address.dir,lines:spans.map(s=>s.textContent),allLineDirectionsAuto:spans.every(s=>s.dir==='auto'),markupNodes:address.querySelectorAll('img,script,iframe,svg').length,injected:window.__websiteAddressInjected===1,clipped:spans.some(s=>{const range=document.createRange();range.selectNodeContents(s);return [...range.getClientRects()].some(r=>r.left<box.left-1||r.right>box.right+1||r.top<footerBox.top-1||r.bottom>footerBox.bottom+1);}),footerOutsideViewport:footerBox.left<-.5||footerBox.right>innerWidth+.5,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.equal(evidence.footerCount,1,screen+' has one footer');assert.deepEqual(evidence.lines,expected.split('\n'),screen+' saved text');
   assert.equal(evidence.heading,lang==='ar'?'العنوان الوطني لإتقان كابيتال':'Itqan Capital · National address');
   assert.equal(evidence.language,/\p{Script=Arabic}/u.test(expected)?'ar':'en');
   assert.equal(evidence.direction,evidence.language==='ar'?'auto':'ltr');assert.ok(evidence.allLineDirectionsAuto);
   assert.equal(evidence.markupNodes,0);assert.equal(evidence.injected,false);assert.equal(evidence.clipped,false,screen+' clipped text');assert.equal(evidence.footerOutsideViewport,false);assert.equal(evidence.horizontalOverflow,false,screen+' overflow');
   await shot(p,`${screen}-${lang}-${width}`,node);
   const {lines,...safe}=evidence;report.footerViews.push({screen,uiLanguage:lang,width,...safe,lineCount:lines.length,addressSha256:digest(Buffer.from(expected))});
  }
 }
 console.log('FOOTER '+screen);
}
async function publicMetadata(ctx,area,expected){
 const session=await f.call(ctx,area,'session');assert.deepEqual(Object.keys(session.website).sort(),['national_address']);assert.equal(session.website.national_address,expected);
}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const owner=await context(),stale=await context(),admin=await context(),anonymous=await context();
 await f.login(owner,'superadmin');await f.login(stale,'superadmin');await f.login(admin,'admin');
 const initial=await settings(owner);assert.equal(initial.national_address,defaultAddress);assert.equal(initial.revision,0);
 for(const [ctx,area]of [[owner,'management'],[admin,'management'],[anonymous,'management'],[anonymous,'portal']])await publicMetadata(ctx,area,defaultAddress);
 pass('Canonical three-line default and session metadata expose only national_address');
 const op=await owner.newPage(),sp=await stale.newPage();page=op;
 await openSettings(op);await language(op,'en');assert.equal(await field(op).inputValue(),defaultAddress);assert.equal(await submit(op).isDisabled(),true);
 const draft='QA Website Settings — synthetic address\n2505 QA Street · Unit 7940\nJeddah 23425 · Saudi Arabia';
 await field(op).fill(draft);await language(op,'ar');assert.equal(await field(op).inputValue(),draft);await language(op,'en');assert.equal(await field(op).inputValue(),draft);
 pass('Superadmin editor preserves its unsaved multiline draft across both language switches');
 const first=await save(op,draft);assert.equal(first.revision,1);assert.equal(first.national_address,draft);
 await op.reload();await op.locator('.admin-stats').waitFor();await op.locator('[data-management-view=website]').click();await field(op).waitFor();assert.equal(await field(op).inputValue(),draft);
 await footer(op,'superadmin-settings',draft);pass('Superadmin save updates its footer and survives a complete reload',{revision:first.revision});
 await openSettings(sp);await language(sp,'en');const staleDraft='QA Stale unsaved address\nDo not discard this draft';await field(sp).fill(staleDraft);
 const winner='QA Winning address\nSecond saved revision';const second=await save(op,winner);assert.equal(second.revision,2);
 const conflict=sp.waitForResponse(r=>action(r.request())==='website_settings_save');await submit(sp).click();assert.equal((await conflict).status(),409);
 await sp.locator('[data-address-reload]').waitFor();assert.equal(await field(sp).inputValue(),staleDraft);assert.equal(await submit(sp).isDisabled(),true);
 await language(sp,'ar');assert.equal(await field(sp).inputValue(),staleDraft);assert.match(await sp.locator('[data-address-status]').innerText(),/تغيّر العنوان في نافذة أخرى/);await shot(sp,'conflict-draft-preserved',sp.locator('.website-settings'));
 await sp.locator('[data-address-reload]').click();await sp.waitForFunction(value=>document.querySelector('#website-national-address')?.value===value,winner);assert.equal(await sp.locator('[data-address-reload]').isVisible(),false);
 pass('Concurrent revision 409 preserves the draft until explicit reload; a language switch translates the conflict status and keeps the draft',{winningRevision:second.revision});
 const uncertainAddress='QA Response-lost address\nSaved once despite a retry';let committed;
 const pattern='**/api/management.php?action=website_settings_save';
 await op.route(pattern,async route=>{const response=await route.fetch();assert.equal(response.status(),200);committed=(await response.json()).website;await route.abort('failed');},{times:1});
 await field(op).fill(uncertainAddress);await submit(op).click();await op.locator('[data-address-status]').filter({hasText:/Could not confirm|تعذّر تأكيد/}).waitFor();
 assert.equal(await field(op).inputValue(),uncertainAddress);assert.equal(await submit(op).isEnabled(),true);assert.equal(committed.revision,3);
 const storedAfterLoss=await settings(owner);assert.equal(storedAfterLoss.national_address,uncertainAddress);assert.equal(storedAfterLoss.revision,3);
 await shot(op,'uncertain-save-draft-preserved',op.locator('.website-settings'));const retried=await save(op,uncertainAddress);assert.equal(retried.revision,3);assert.equal(retried.updated_at,committed.updated_at);
 pass('A committed save with a lost response retains text and retries without incrementing the revision',{revisionAfterLoss:3,revisionAfterRetry:retried.revision});
 const hostile='QA synthetic address <img src=x onerror="window.__websiteAddressInjected=1">\nعنوان اختبار اصطناعي — جدة · المملكة العربية السعودية\n'+('LongAddressSegment'.repeat(16));
 const final=await save(op,hostile);assert.equal(final.revision,4);assert.equal(final.national_address,hostile);
 assert.equal(await op.evaluate(()=>window.__websiteAddressInjected===1),false);assert.equal(await op.locator('#website-settings-form img,#website-settings-form script').count(),0);
 for(const width of [1440,390]){await op.setViewportSize({width,height:1000});await shot(op,'saved-settings-'+width,op.locator('.website-settings'));}
 await footer(op,'superadmin-updated-settings',hostile);
 pass('Markup stays literal in the editor and a mixed-language long address saves successfully',{revision:final.revision});
 const anonPage=await anonymous.newPage();page=anonPage;
 for(const route of ['login','register','management']){
  await anonPage.goto(f.base+'/'+route+'/');await anonPage.locator(route==='management'?'#login':'#auth-form').waitFor();
  assert.equal(await anonPage.locator('[data-management-view=website],#website-settings-form').count(),0);
  await footer(anonPage,route==='management'?'management-login':route,hostile);
 }
 for(const audience of ['individual','corporate']){
  const ctx=await context();await f.client(ctx,audience);await publicMetadata(ctx,'portal',hostile);const p=await ctx.newPage();page=p;
  const folder=audience==='individual'?'individuals':'companies';await p.goto(f.base+'/'+folder+'/');await p.locator('.home').waitFor();
  assert.equal(await p.locator('[data-management-view=website],#website-settings-form').count(),0);await footer(p,audience+'-catalogue',hostile);
  await p.locator('[data-doc="kyc-'+audience+'"]').click();await p.locator('.workspace').waitFor();await footer(p,audience+'-kyc-editor',hostile);
  await p.locator('#back-home').click();await p.locator('.home').waitFor();
  await p.locator('[data-doc="'+(audience==='individual'?'subscription-form':'subscription-company')+'"]').click();await p.locator('.subscription-workspace').waitFor();await footer(p,audience+'-subscription-editor',hostile);
  await p.goto(f.base+'/account/');await p.locator('#profile-form').waitFor();await footer(p,audience+'-profile',hostile);
  assert.equal(await p.locator('[data-management-view=website],#website-settings-form,#website-national-address').count(),0);
 }
 const ap=await admin.newPage();page=ap;await ap.goto(f.base+'/management/');await ap.locator('.admin-stats').waitFor();
 assert.equal(await ap.locator('[data-management-view=website],#website-settings-form,#website-national-address').count(),0);await footer(ap,'admin-dashboard',hostile);
 for(const [ctx,area]of [[owner,'management'],[admin,'management'],[anonymous,'management'],[anonymous,'portal']])await publicMetadata(ctx,area,hostile);
 pass('Updated public-only address reaches anonymous, client and management sessions; ordinary admin and clients have no editing UI');
 pass('Updated footer renders exact literal lines in English/Arabic at desktop/mobile widths without overflow',{viewCount:report.footerViews.length});
 assert.deepEqual(report.browserErrors,[]);report.passed=true;
}catch(error){report.failure=String(error.message).replaceAll(f.base,'[isolated-local-origin]');await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;console.error(report.failure);}
finally{
 report.completedAt=new Date().toISOString();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 await browser?.close();await f.close();console.log('REPORT '+reportPath);console.log('SCREENSHOTS '+out);
}
