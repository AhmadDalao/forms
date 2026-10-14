// Shared website footer audit; copied build, isolated storage, synthetic accounts.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './workflow-harness.mjs';

const address=JSON.parse(await fs.readFile('scripts/pdf-design/national-address.json','utf8'));
const f=await fixture(),out=path.join(f.out,'website-address');
const reportPath=path.resolve(process.env.QA_REPORT||'docs/website-address-2026-10-14/browser-verification.json');
await fs.mkdir(out,{recursive:true});await fs.mkdir(path.dirname(reportPath),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={createdAt:new Date().toISOString(),scope:'Isolated local build with synthetic accounts only',address,build:f.baseline.build,checks:[],browserErrors:[],passed:false};
let page;
async function context(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 ctx.on('page',p=>{p.setDefaultTimeout(20000);p.on('pageerror',error=>report.browserErrors.push(error.message));});
 return ctx;
}
async function check(p,screen){
 for(const lang of ['en','ar']){
  await p.locator('.site-footer').waitFor();
  if(await p.locator('html').getAttribute('lang')!==lang)await p.locator('#language,#portal-language,[data-admin-language]').click();
  await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});await p.evaluate(()=>document.fonts.ready);
   const footer=p.locator('.site-footer');await footer.scrollIntoViewIfNeeded();
   const evidence=await footer.evaluate(node=>{
    const rect=node.getBoundingClientRect(),address=node.querySelector('address'),bounds=address.getBoundingClientRect(),range=document.createRange();
    const lines=[...address.querySelectorAll('span')].map(span=>{
     range.selectNodeContents(span);
     return {text:span.textContent,clipped:[...range.getClientRects()].some(r=>r.left<bounds.left-1||r.right>bounds.right+1||r.top<rect.top-1||r.bottom>rect.bottom+1)};
    });
    return {footerCount:document.querySelectorAll('footer').length,heading:node.querySelector('strong').textContent,addressLanguage:address.lang,addressDirection:address.dir,computedDirection:getComputedStyle(address).direction,lines,footerOutsideViewport:rect.left<-.5||rect.right>innerWidth+.5,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   const file=`${screen}-${lang}-${width}.png`;await footer.screenshot({path:path.join(out,file)});
   const expectedLines=[address.text.split(' | ')[0],address.text.split(' | ').slice(1,3).join(' · '),address.text.split(' | ').slice(3).join(' · ')];
   const issues=[];
   if(evidence.footerCount!==1)issues.push('Expected one footer');
   if(evidence.heading!==(lang==='ar'?'العنوان الوطني لإتقان كابيتال':'Itqan Capital · National address'))issues.push('Heading language mismatch');
   if(JSON.stringify(evidence.lines.map(line=>line.text))!==JSON.stringify(expectedLines))issues.push('Canonical address mismatch');
   if(evidence.addressLanguage!=='en'||evidence.addressDirection!=='ltr'||evidence.computedDirection!=='ltr')issues.push('English address must remain LTR');
   if(evidence.lines.some(line=>line.clipped)||evidence.footerOutsideViewport)issues.push('Footer text clipped');
   if(evidence.horizontalOverflow)issues.push('Horizontal page overflow');
   report.checks.push({screen,language:lang,width,...evidence,screenshot:path.relative(process.cwd(),path.join(out,file)),issues});
  }
 }
 console.log('CHECK '+screen);
}
async function home(p){
 if(await p.locator('#sub-home').count())await p.locator('#sub-home').click();
 else if(await p.locator('#back-home').count())await p.locator('#back-home').click();
 await p.locator('.home').waitFor();
}
async function fill(p,values){
 for(const [id,value] of Object.entries(values)){
  const input=p.locator(`[name="${id}"]`);
  if(await input.evaluate(node=>node.tagName)==='SELECT')await input.selectOption(value);else await input.fill(value);
 }
}
try{
 const anonymous=await context();page=await anonymous.newPage();
 for(const route of ['login','register','management']){
  await page.goto(f.base+'/'+route+'/');await page.locator(route==='management'?'#login':'#auth-form').waitFor();
  await check(page,route==='management'?'management-login':route);
 }
 const accounts=[];
 for(const audience of ['individual','corporate']){
  const ctx=await context(),user=await f.client(ctx,audience);accounts.push(user);
  page=await ctx.newPage();await page.goto(`${f.base}/${audience==='individual'?'individuals':'companies'}/`);
  await page.locator('.home').waitFor();await check(page,audience+'-catalogue');
  await page.locator(`[data-doc="${audience==='individual'?'subscription-form':'subscription-company'}"]`).click();
  await page.locator('.subscription-workspace').waitFor();await check(page,audience+'-subscription-editor');
  await page.locator('[data-sub-step="0"]').click();
  await fill(page,audience==='individual'?{first_name:'أحمد',second_name:'علي',family_name:'الاختبار',nationality:'سعودي',id_type:'national',id_number:'1012345678'}:{company_name:'شركة الاختبار',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name_first:'أحمد',auth_name_second:'علي',auth_name_last:'الاختبار'});
  await page.locator('[data-sub-step="2"]').click();
  await page.locator('[name="subscription_type"][value="new"]').check();await page.locator('[name="payment_method"][value="transfer"]').check();
  await fill(page,{units:'1'});await page.locator('[data-review]').click();
  await page.locator('.sub-review').waitFor({timeout:60000});
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-pdf-page]')].every(canvas=>canvas.width>300));
  await check(page,audience+'-subscription-review');
  await home(page);await page.locator(`[data-doc="kyc-${audience}"]`).click();await page.locator('.workspace').waitFor();
  await check(page,audience+'-kyc-editor');
  await page.goto(f.base+'/account/');await page.locator('#profile-form').waitFor();await check(page,audience+'-profile');
 }
 const admin=await context();await f.login(admin,'admin');page=await admin.newPage();
 await page.goto(f.base+'/management/');await page.locator('.admin-stats').waitFor();await check(page,'admin-dashboard');
 for(const user of accounts){
  await page.locator('[data-management-view="users"]').click();await page.locator(`[data-client="${user.id}"]`).click();
  await page.locator('.admin-profile-overview').waitFor();await check(page,'admin-'+user.account_type+'-client');
 }
 const failed=report.checks.filter(check=>check.issues.length);
 assert.deepEqual(report.browserErrors,[],'No browser errors');
 assert.equal(failed.length,0,JSON.stringify(failed.map(({screen,language,width,issues})=>({screen,language,width,issues})),null,2));
 report.passed=true;console.log('PASS '+report.checks.length+' footer views');
}catch(error){report.error=error.message;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(reportPath,JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+reportPath);console.log('SCREENSHOTS '+out);}
