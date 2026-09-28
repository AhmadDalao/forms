import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {fixture} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true}),report={checks:[],errors:[]};
const doc=docs.find(d=>d.id==='fatca-crs-individual'),step=doc.sections.findIndex(s=>s.id==='staff'),keys=['first','second','third','last'].map(p=>'staff_account_holder_'+p);
const profile={ar_first:'أحمد',ar_second:'محمد',ar_third:'',ar_last:'علي',en_first:'Ahmad',en_second:'Mohammed',en_third:'',en_last:'Ali',name_language:'ar'};
try{
 for(const lang of ['ar','en']){
  const ctx=await browser.newContext({viewport:{width:lang==='ar'?1440:390,height:900}}),user=await f.client(ctx,'individual');
  await f.call(ctx,'portal','shared_profile_save',{data:{account:user.id,audience:'individual',expectedRevision:0,changes:profile}});
  if(lang==='ar')await ctx.addInitScript(({id,keys,step})=>{
   if(sessionStorage.getItem('qa-staff-seeded'))return;sessionStorage.setItem('qa-staff-seeded','1');
   const inherited={...Object.fromEntries(keys.map((key,i)=>[key,['أحمد','محمد','','علي'][i]])),staff_account_holder:'أحمد محمد علي'};
   localStorage.setItem('itqan.forms.v1.account.'+id+'.individual.fatca-crs-individual',JSON.stringify({values:inherited,shared:inherited,overrides:[],signatures:{},signatureModes:{},step}));
  },{id:user.id,keys,step});
  const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.setDefaultTimeout(30000);
  const open=async()=>{await p.goto(f.base+'/individuals/?lang='+lang);await p.locator('[data-doc=fatca-crs-individual]').click();await p.locator('[data-step="0"]').click();await p.waitForFunction(()=>document.querySelector('[name=ar_first]')?.value==='أحمد');await p.locator('[data-step="'+step+'"]').click();};
  await open();
  for(const key of [...keys,'staff_employee_id','staff_cif'])assert.equal(await p.locator('[name="'+key+'"]').inputValue(),'');
  assert.equal(await p.locator('[data-signature-mode]:checked').count(),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.screenshot({path:f.out+'/staff-'+lang+'-blank.png',fullPage:true});
  await p.locator('#review-tab').click();await p.locator('#submit-form:not([disabled])').waitFor();
  assert.equal(await p.locator('[data-full-page]').count(),doc.pages);await p.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300));
  const pending=p.waitForEvent('download');await p.locator('#download').click();const download=await pending;await download.saveAs(f.out+'/staff-'+lang+'-blank.pdf');
  await p.locator('#submit-form').click();await p.locator('.submission-reference').waitFor();await p.locator('.submission-dialog [data-close]').click();
  const submission=(await f.call(ctx,'portal','submissions')).submissions.find(s=>s.doc_id===doc.id);
  const before=(await f.call(ctx,'portal','detail',{params:{id:submission.id}})).submission;
  for(const key of ['staff_account_holder',...keys])assert.ok(!before.answers[key],key+' was not automatically submitted');
  const snapshot=JSON.stringify(before);
  await p.locator('#edit-again').click();await p.locator('[data-step="'+step+'"]').click();
  for(const [i,key]of keys.entries())await p.locator('[name="'+key+'"]').fill(['Staff','Manual','','Entry'][i]);
  await open();for(const [i,key]of keys.entries())assert.equal(await p.locator('[name="'+key+'"]').inputValue(),['Staff','Manual','','Entry'][i]);
  const saved=(await f.call(ctx,'portal','shared_profile',{params:{account:user.id,audience:'individual'}})).shared.profile;
  for(const [key,value]of Object.entries(profile))assert.equal(saved[key],value,'staff typing does not change customer '+key);
  assert.equal(JSON.stringify((await f.call(ctx,'portal','detail',{params:{id:submission.id}})).submission),snapshot);
  report.checks.push(lang+': '+(lang==='ar'?'old inherited':'new')+' staff names empty; final preview/download/submission retain blanks; manual names survive reload without changing shared identity or submitted snapshot');
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await fs.writeFile(f.out+'/staff-name-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({report:f.out+'/staff-name-report.json',...report}));await browser.close();await f.close();}
