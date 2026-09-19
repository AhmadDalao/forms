// Real PHP/browser lifecycle coverage. Always uses an isolated copy of dist,
// private temporary storage, synthetic accounts, and an owned local server.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture(),out=path.join(f.out,'shared-account-browser');
await fs.mkdir(out,{recursive:true});
f.baseline.build['api/portal-shared.php']=digest(await fs.readFile(path.join(f.out,'site/api/portal-shared.php')));
const report={base:f.base,baseline:f.baseline,checks:[],errors:[],requests:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const contexts=[];let page,number=0;
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const folder=user=>user.account_type==='corporate'?'companies':'individuals';
const prefix=user=>'itqan.forms.v1.account.'+user.id+'.'+user.account_type+'.';
async function context(cookies=[]){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});contexts.push(ctx);
 if(cookies.length)await ctx.addCookies(cookies);
 ctx.on('page',p=>{p.setDefaultTimeout(15000);p.on('pageerror',error=>report.errors.push(error.message));p.on('response',response=>{
  const url=new URL(response.url());if(url.pathname==='/api/portal.php'&&['shared_profile','shared_profile_save'].includes(url.searchParams.get('action')))report.requests.push({action:url.searchParams.get('action'),status:response.status()});
 });});
 return ctx;
}
async function register(ctx,type,label){
 await f.call(ctx,'portal','session');const password=randomBytes(20).toString('base64url')+'aA7!',phone='55197'+String(++number).padStart(4,'0');
 const {user}=await f.call(ctx,'portal','register',{data:{first_name:'Shared QA',last_name:label,phone,account_type:type,password,confirm:password},status:201});
 return {user,password,phone};
}
async function shared(ctx,user){return (await f.call(ctx,'portal','shared_profile',{params:{account:user.id,audience:user.account_type}})).shared;}
async function cloudMatches(ctx,user,predicate,label){
 const end=Date.now()+15000;let last;
 do{last=await shared(ctx,user);if(predicate(last))return last;await new Promise(resolve=>setTimeout(resolve,125));}while(Date.now()<end);
 assert.fail(label+': '+JSON.stringify(last));
}
async function open(ctx,user,{lang='en'}={}){
 page=await ctx.newPage();await page.goto(f.base+'/'+folder(user)+'/?shared=1&lang='+lang);await page.locator('#shared-fields-form').waitFor();return page;
}
async function saved(p){await p.waitForFunction(()=>[...document.querySelectorAll('[data-shared-save-status]')].some(node=>['Shared details saved to account','البيانات المشتركة محفوظة في الحساب'].includes(node.textContent)));}
async function fill(p,values){for(const [key,value]of Object.entries(values)){const field=p.locator('#shared-'+key);if(typeof value==='boolean'){await field.setChecked(!value);await field.setChecked(value);}else if(await field.evaluate(node=>node.tagName)==='SELECT')await field.selectOption(value);else{if(value==='')await field.fill('Clear this value');await field.fill(value);}}}
async function assertFields(p,values){for(const [key,value]of Object.entries(values)){const field=p.locator('#shared-'+key);assert.equal(typeof value==='boolean'?await field.isChecked():await field.inputValue(),value,key);}}
async function screenshot(p,name){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function login(p,account){await p.locator('#auth-form').waitFor();await p.locator('[name=phone]').fill(account.phone);await p.locator('[name=password]').fill(account.password);await p.locator('#auth-form [type=submit]').click();await p.waitForURL(url=>!url.pathname.endsWith('/login/'));}

try{
 const owner=await context(),a=await register(owner,'individual','Owner');
 const aPage=await open(owner,a.user);await saved(aPage);
 const profile={en_first:'Abdul Rahman',en_second:'Ali',en_third:'',en_last:'Al Ghamdi',ar_first:'عبد الرحمن',ar_second:'علي',ar_third:'',ar_last:'الغامدي',name_language:'ar',city:'Cloud Riyadh',country:'الإمارات العربية المتحدة',phone:'001234567',also_residence:false};
 await fill(aPage,profile);const established=await cloudMatches(owner,a.user,s=>Object.entries(profile).every(([key,value])=>s.profile[key]===value),'Edited shared profile reaches PHP');await saved(aPage);
 assert.ok(established.revision>0);await screenshot(aPage,'individual-cloud-saved');
 pass('Real shared-field edits save to the account with exact EN/AR name parts, blank third, country replacement and false checkbox');

 const fresh=await context(await owner.cookies()),freshPage=await open(fresh,a.user,{lang:'ar'});await saved(freshPage);await assertFields(freshPage,profile);
 assert.equal((await shared(fresh,a.user)).revision,established.revision,'Restoration does not rewrite cloud');
 await freshPage.setViewportSize({width:390,height:900});await screenshot(freshPage,'fresh-browser-ar-mobile');
 pass('A separate browser context with cookies only restores the complete cloud profile without localStorage or an extra save');

 await freshPage.locator('[data-doc="signature-form"]').click();await freshPage.locator('[name=client_name_first]').fill('Manual override');await freshPage.locator('[name=client_number]').fill('007-manual');
 const local=await freshPage.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('itqan.forms.v1.'))));
 local[prefix(a.user)+'shared-fields']=JSON.stringify({...profile,en_first:'Stale browser name',ar_first:'قديم',city:'Stale City',country:'Stale Country'});
 delete local[prefix(a.user)+'shared-sync'];
 const stale=await context(await owner.cookies());await stale.addInitScript(({values,origin})=>{if(location.origin!==origin||sessionStorage.getItem('qa-shared-cache'))return;for(const [key,value]of Object.entries(values))localStorage.setItem(key,value);sessionStorage.setItem('qa-shared-cache','1');},{values:local,origin:f.base});
 const stalePage=await open(stale,a.user);await saved(stalePage);await assertFields(stalePage,profile);await stalePage.locator('[data-doc="signature-form"]').click();
 assert.equal(await stalePage.locator('[name=client_name_first]').inputValue(),'Manual override');assert.equal(await stalePage.locator('[name=client_number]').inputValue(),'007-manual');
 assert.equal((await shared(stale,a.user)).revision,established.revision,'Stale local profile must not overwrite cloud');
 await screenshot(stalePage,'cloud-wins-manual-draft-kept');
 pass('Existing cloud replaces stale local shared cache while individual form overrides survive');

 const guest=await context(),guestPage=await guest.newPage();page=guestPage;
 await guestPage.goto(f.base+'/individuals/?shared=1&lang=en');await guestPage.locator('#shared-fields-form').waitFor();await fill(guestPage,{en_first:'Guest auto',en_second:'Guest middle',en_last:'Guest family',name_language:'en',city:'Guest City'});
 await guestPage.locator('[data-doc="signature-form"]').click();await guestPage.locator('[name=client_name_first]').fill('Guest manual');await guestPage.locator('[name=client_number]').fill('guest-42');
 const guestRecord=await guestPage.evaluate(()=>JSON.parse(localStorage.getItem('itqan.forms.v1.individual.signature-form')));
 await guestPage.locator('.client-account-link').click();assert.equal(await guestPage.locator('[name=resume]').isChecked(),true);await login(guestPage,a);await guestPage.locator('[name=client_name_first]').waitFor();
 assert.equal(await guestPage.locator('[name=client_name_first]').inputValue(),'Guest manual');assert.equal(await guestPage.locator('[name=client_name_second]').inputValue(),'Guest middle');assert.equal(await guestPage.locator('[name=client_number]').inputValue(),'guest-42');
 const imported=await guestPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix(a.user)+'signature-form');
 for(const [id,value]of Object.entries(guestRecord.values))assert.deepEqual(imported.values[id],value,'Imported answer '+id);
 assert.deepEqual((await shared(guest,a.user)).profile,established.profile,'Guest details never replace established cloud');
 await guestPage.locator('#back-home').click();await guestPage.locator('#shared-fields-panel > summary').click();await assertFields(guestPage,profile);
 pass('Actual guest-to-account login imports manual and automatically copied draft answers without replacing the existing cloud profile');

 const bContext=await context(),b=await register(bContext,'individual','Other');const bPage=await open(bContext,b.user);await saved(bPage);await fill(bPage,{en_first:'Other client',city:'Other City',country:'United States of America'});const bCloud=await cloudMatches(bContext,b.user,s=>s.profile.city==='Other City','Second individual saved');
 const company=await context(),c=await register(company,'corporate','Company');const cPage=await open(company,c.user);await saved(cPage);await fill(cPage,{company_name:'Independent Company',auth_first:'Company Signer',auth_second:'Ali',auth_third:'',auth_last:'Family',city:'Company City',country:'Saudi Arabia',inc_country:'United Arab Emirates',also_mail:false});const cCloud=await cloudMatches(company,c.user,s=>s.profile.city==='Company City'&&s.profile.also_mail===false,'Company saved');
 assert.equal(cCloud.profile.en_first,undefined);assert.equal(bCloud.profile.company_name,undefined);assert.deepEqual((await shared(owner,a.user)).profile,established.profile);
 assert.equal((await f.call(owner,'portal','shared_profile',{params:{account:b.user.id,audience:'individual'},status:409})).error,'account_changed');
 assert.equal((await f.call(owner,'portal','shared_profile',{params:{account:a.user.id,audience:'corporate'},status:403})).error,'account_type_restricted');
 const companyFresh=await context(await company.cookies()),companyFreshPage=await open(companyFresh,c.user,{lang:'ar'});await saved(companyFreshPage);await assertFields(companyFreshPage,{company_name:'Independent Company',auth_first:'Company Signer',auth_third:'',country:'Saudi Arabia',inc_country:'United Arab Emirates',also_mail:false});
 pass('Different individuals and company accounts retain separate cloud profiles; account/audience mismatches are rejected by PHP');

 const clearContext=await context(await owner.cookies()),clearPage=await open(clearContext,a.user);await saved(clearPage);await clearPage.locator('#clear-shared').click();await clearPage.locator('#confirm-clear-shared').click();
 const cleared=await cloudMatches(clearContext,a.user,s=>s.revision>established.revision&&Object.keys(s.profile).length===0,'Clear persists empty profile');await saved(clearPage);await clearPage.reload();await clearPage.locator('#shared-fields-form').waitFor();await saved(clearPage);
 await assertFields(clearPage,{en_first:'',ar_first:'',country:'',mobile:''});assert.equal((await shared(clearContext,a.user)).revision,cleared.revision,'Reload cannot reseed cleared profile');
 const emptyContext=await context(await owner.cookies()),emptyPage=await open(emptyContext,a.user);await saved(emptyPage);await assertFields(emptyPage,{en_first:'',ar_first:'',country:'',mobile:''});await screenshot(emptyPage,'cleared-new-browser');
 assert.deepEqual((await shared(bContext,b.user)).profile,bCloud.profile);assert.deepEqual((await shared(company,c.user)).profile,cCloud.profile);
 pass('Clear shared fields persists an empty account profile across reload and a fresh browser without reseeding names, phone or country; other clients remain unchanged');

 await emptyPage.goto(f.base+'/my-applications/?lang=en');await emptyPage.locator('#portal-logout').click();await emptyPage.waitForURL('**/login/?lang=en');await login(emptyPage,b);await emptyPage.goto(f.base+'/individuals/?shared=1&lang=en');await emptyPage.locator('#shared-fields-form').waitFor();await saved(emptyPage);await assertFields(emptyPage,{en_first:'Other client',city:'Other City',country:'United States of America'});
 pass('Signing out and signing in as another client in the same browser loads the new account profile');

 const manager=await context();await f.login(manager,'admin');const managerPage=await manager.newPage();page=managerPage;await managerPage.goto(f.base+'/management/');await managerPage.locator('[data-management-view=users]').click();await managerPage.locator('[data-client="'+c.user.id+'"]').click();await managerPage.locator('[data-account-shared-profiles] > summary').click();
 const card=managerPage.locator('[data-account-shared-profiles]');assert.match(await card.innerText(),/Independent Company/);assert.match(await card.innerText(),/Company Signer/);assert.match(await card.innerText(),/United Arab Emirates/);assert.equal(await card.locator('input,select,textarea').count(),0);await screenshot(managerPage,'management-shared-profile');
 assert.deepEqual((await f.call(manager,'portal','admin_client',{params:{id:c.user.id}})).shared_profiles.find(entry=>entry.audience==='corporate').profile,cCloud.profile);
 pass('Management reads the saved account profile in the real client view without editing controls');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));for(const ctx of contexts)await ctx.close().catch(()=>{});await browser.close();await f.close();console.log('REPORT '+path.join(out,'report.json'));}
