// Independent browser end-to-end shared-field coverage against an isolated PHP
// deployment, synthetic accounts and private temporary storage only.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fixture} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
import {sharedGroups} from '../src/shared-fields.js';
const f=await fixture(),out=path.join(f.out,'shared-complete');await fs.mkdir(out,{recursive:true});
const address={short_address:'ABCD1234',building:'1122',street:'King Faisal Street',district:'Al Nakheel',city:'Al Khobar',postal:'03456',additional:'0078',country:'United Arab Emirates'};
const individual={en_first:'Abdul Rahman',en_second:'Bilal',en_third:'Charles',en_last:'Al Ghamdi',ar_first:'عبد الرحمن',ar_second:'بلال',ar_third:'حسن',ar_last:'الغامدي',name_language:'en',title:'dr',gender:'male',dob:'1991-03-24',nationality:'Syrian',id_type:'other',id_other:'Travel document',id_number:'0011223344',phone:'0130123456',mobile:'0557654321',email:'individual.qa@example.test',client_number:'0000111',account_number:'0000222',...address,also_residence:true};
const corporate={company_name:'Independent Audit Company',inc_country:'United Kingdom',company_id_type:'license',company_id_number:'LIC003344',client_number:'0000333',account_number:'0000444',phone:'0139988776',mobile:'0551122334',email:'company.qa@example.test',...address,city:'Company City',also_residence:true,also_head:true,also_mail:true,auth_first:'Company Signer',auth_second:'Ali',auth_third:'Hasan',auth_last:'Al Madani',auth_id_type:'other',auth_id_other:'Emergency passport',auth_id:'0099887766'};
const report={base:f.base,baseline:f.baseline,checks:[],browserErrors:[],pdfFailures:[],passed:false};let page,browser;
const pass=(engine,message)=>{report.checks.push({engine,message});console.log('PASS '+engine+' '+message);};
const saved=p=>p.waitForFunction(()=>[...document.querySelectorAll('[data-shared-save-status]')].some(node=>['Shared details saved to account','البيانات المشتركة محفوظة في الحساب'].includes(node.textContent)));
const get=async(ctx,user)=>(await f.call(ctx,'portal','shared_profile',{params:{account:user.id,audience:user.account_type}})).shared;
const open=async(ctx,user,lang='en')=>{const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',error=>report.browserErrors.push(error.message));await p.goto(f.base+'/'+(user.account_type==='individual'?'individuals':'companies')+'/?shared=1&lang='+lang);await p.locator('#shared-fields-form').waitFor();await saved(p);return p;};
const fill=async(p,profile)=>{for(const [id,value]of Object.entries(profile)){const el=p.locator('#shared-'+id);if(typeof value==='boolean')await el.setChecked(value);else if(await el.evaluate(el=>el.tagName)==='SELECT')await el.selectOption(value);else await el.fill(value);}await saved(p);};
const matchUI=async(p,profile)=>{for(const [id,value]of Object.entries(profile)){const el=p.locator('#shared-'+id);assert.equal(typeof value==='boolean'?await el.isChecked():await el.inputValue(),value,id);}};
const matchServer=async(ctx,user,profile)=>{const state=await get(ctx,user);for(const [id,value]of Object.entries(profile))assert.equal(state.profile[id],value,'Server '+id);return state;};
const home=async p=>{if(await p.locator('.signing-guide[open] [data-close]').count())await p.locator('.signing-guide[open] [data-close]').click();if(await p.locator('#back-home').count())await p.locator('#back-home').click();else if(await p.locator('#sub-home').count())await p.locator('#sub-home').click();};
const showShared=async p=>{if(!await p.locator('#shared-fields-panel').evaluate(node=>node.open))await p.locator('#shared-fields-panel>summary').click();};
const snap=async(p,name)=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
const waitCloud=async(ctx,user,expected)=>{for(let n=0;n<100;n++){const value=await get(ctx,user);if(Object.entries(expected).every(([id,v])=>value.profile[id]===v))return value;await new Promise(resolve=>setTimeout(resolve,100));}await matchServer(ctx,user,expected);};
try{
 for(const [engine,type]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
  if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(engine))continue;
  browser=await type.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  const contexts=[];
  try{
   for(const audience of ['individual','corporate']){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(ctx);const user=await f.client(ctx,audience),profile=audience==='individual'?individual:corporate;
    page=await open(ctx,user);await fill(page,profile);await matchUI(page,profile);const cloud=await matchServer(ctx,user,profile);
    assert.equal(Object.keys(profile).length,sharedGroups(audience).flatMap(g=>g.fields).filter(field=>!field.hidden).length,'Every editable shared field exercised');
    const newer=await browser.newContext({viewport:{width:390,height:900}});contexts.push(newer);await newer.addCookies(await ctx.cookies());const fresh=await open(newer,user,'ar');await matchUI(fresh,profile);assert.equal((await get(newer,user)).revision,cloud.revision);await snap(fresh,engine+'-'+audience+'-all-fields-mobile-ar');
    pass(engine,`${audience}: all ${Object.keys(profile).length} editable shared fields save exactly and restore in a fresh Arabic mobile browser`);
    const id=audience==='individual'?'kyc-individual':'kyc-corporate';await page.locator(`[data-doc="${id}"]`).click();
    const values=audience==='individual'?{nationality:profile.nationality,city:profile.city+' '+profile.district,postal_additional:profile.additional,phone:profile.phone,email:profile.email}:{cr:profile.company_id_number,inc_country:profile.inc_country,city:profile.city,district:profile.district,phone:profile.phone};
    for(const [key,value]of Object.entries(values))assert.equal(await page.locator(`[name="${key}"]`).inputValue(),value,'Rendered '+id+'/'+key);
    const downloadPromise=page.waitForEvent('download',{timeout:15000}).catch(()=>null);await page.locator('#download-now').click();const download=await downloadPromise;
    if(download){await download.saveAs(path.join(out,engine+'-'+id+'-shared.pdf'));assert.ok((await fs.stat(path.join(out,engine+'-'+id+'-shared.pdf'))).size>10000);pass(engine,`${audience}: shared data reaches visible KYC fields, including new semantic regressions, and filled PDF downloads`);}
    else{report.pdfFailures.push({engine,document:id,status:await page.locator('#status').innerText(),fields:await page.locator('[data-field].invalid').evaluateAll(nodes=>nodes.map(node=>node.dataset.field))});await snap(page,engine+'-'+id+'-pdf-failure');pass(engine,`${audience}: shared data reaches visible KYC fields; PDF failure separately reported`);}
    await home(page);await page.locator('[data-doc="signature-form"]').click();
    if(audience==='individual')await page.locator('[name="client_name_first"]').fill('Manual Override');else await page.locator('[name="client_name"]').fill('Manual Company');
    await fresh.locator('#shared-'+(audience==='individual'?'en_first':'company_name')).fill('Shared Updated');await saved(fresh);await page.reload();await page.locator('.home,.workspace').waitFor();if(await page.locator('[data-doc="signature-form"]').count())await page.locator('[data-doc="signature-form"]').click();
    assert.equal(await page.locator(audience==='individual'?'[name="client_name_first"]':'[name="client_name"]').inputValue(),audience==='individual'?'Manual Override':'Manual Company');
    await page.locator(audience==='individual'?'[data-shared-use="client_name_first"]':'[data-shared-use="client_name"]').click();assert.equal(await page.locator(audience==='individual'?'[name="client_name_first"]':'[name="client_name"]').inputValue(),'Shared Updated');
    pass(engine,`${audience}: explicit manual name override survives cloud refresh; Use shared value restores account data`);
    if(engine==='chrome'&&audience==='individual'){
     await home(page);await showShared(page);await fresh.setViewportSize({width:1280,height:900});
     await newer.setOffline(true);await fresh.locator('#shared-city').fill('Offline Disjoint City');await fresh.locator('[data-shared-retry]').waitFor();
     await page.locator('#shared-district').fill('Online District');await saved(page);await newer.setOffline(false);await fresh.evaluate(()=>window.dispatchEvent(new Event('online')));await saved(fresh);await waitCloud(ctx,user,{city:'Offline Disjoint City',district:'Online District'});
     pass(engine,'Disjoint offline-device and online-device field edits merge without losing either value');
     await newer.setOffline(true);await fresh.locator('#shared-city').fill('Offline Conflicting City');await fresh.locator('[data-shared-retry]').waitFor();await page.reload();await showShared(page);await page.locator('#shared-city').fill('Online Winning City');await saved(page);await newer.setOffline(false);await fresh.evaluate(()=>window.dispatchEvent(new Event('online')));await fresh.locator('[data-shared-resolve="remote"]').waitFor();await snap(fresh,'chrome-conflict-ar');await fresh.reload();await fresh.locator('[data-shared-resolve="remote"]').waitFor();await fresh.locator('[data-shared-resolve="remote"]').click();await saved(fresh);assert.equal(await fresh.locator('#shared-city').inputValue(),'Online Winning City');
     pass(engine,'Conflicting same-field edits require a visible choice, survive reload, and Use account details keeps the chosen server value');
     await page.reload();await showShared(page);const tab=await open(ctx,user);await ctx.setOffline(true);await page.locator('#shared-city').fill('Tab A Offline City');await page.locator('[data-shared-retry]').waitFor();await tab.locator('#shared-email').fill('tab.b.offline@example.test');await tab.locator('[data-shared-retry]').waitFor();const state=await ctx.storageState();await page.close();await tab.close();await ctx.setOffline(false);
     const reopened=await browser.newContext({storageState:state,viewport:{width:1280,height:900}});contexts.push(reopened);page=await open(reopened,user);await saved(page);await waitCloud(reopened,user,{city:'Tab A Offline City',email:'tab.b.offline@example.test'});
     pass(engine,'Two offline tabs keep independent field queues through closing and reopening the browser state');
    }
   }
  }catch(error){await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{for(const ctx of contexts)await ctx.close();await browser.close();browser=null;}
 }
 assert.deepEqual(report.browserErrors,[]);assert.deepEqual(report.pdfFailures,[],'Shared data must generate downloadable PDFs');report.passed=true;
}catch(error){report.error=error.stack;await page?.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();await f.close();console.log('REPORT '+path.join(out,'report.json'));}
