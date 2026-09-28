import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixture} from './workflow-harness.mjs';
import {docs} from '../src/forms/index.js';
const f=await fixture({protectedRoutes:true}),out=f.out+'/customer-workflow';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={checks:[],errors:[]};let page;
const pass=text=>{report.checks.push(text);console.log('PASS '+text);};
const shot=async(name)=>{await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' horizontal overflow');await page.screenshot({path:out+'/'+name+'.png',fullPage:!name.includes('mobile')});};
try{
 for(const audience of ['individual','corporate']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),user=await f.client(ctx,audience),folder=audience==='corporate'?'companies':'individuals';page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(20000);
  for(const lang of ['ar','en']){
   await page.goto(f.base+'/'+folder+'/?lang='+lang);await page.locator('[data-card]').first().waitFor();await page.waitForFunction(()=>!document.body.textContent.includes('Loading status…')&&!document.body.textContent.includes('جارٍ تحميل الحالة…'));
   assert.equal(await page.locator('[data-card]').count(),6);assert.equal(await page.locator('[data-upload]').count(),6);
   assert.equal(await page.locator('.shared-badge,.flow,#clear-all,.home-note').count(),0);
   assert.ok(!/Saved on this browser|مركز المستندات|محفوظ في هذا المتصفح/.test(await page.locator('body').innerText()));
   await shot(audience+'-'+lang+'-home');await page.setViewportSize({width:390,height:844});await shot(audience+'-'+lang+'-home-mobile');await page.locator('[data-card]').last().scrollIntoViewIfNeeded();assert.ok(await page.locator('[data-upload]').last().isVisible());await shot(audience+'-'+lang+'-home-bottom-mobile');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.setViewportSize({width:1440,height:1000});
   for(const doc of docs.filter(d=>d.group===audience||d.group==='shared')){
    await page.locator('[data-doc="'+doc.id+'"]').click();
    const actions=page.locator(doc.workflow==='subscription'?'.sub-top-actions':'.document-actions');
    assert.equal(await actions.locator('a,button').count(),2,doc.id+' has only two header downloads');
    assert.equal(await page.locator('#toggle-preview,#document-preview,#preview-prepared-pdf').count(),0);
    for(const width of [390,1440]){
     await page.setViewportSize({width,height:1000});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,doc.id+' header overflow');
     const boxes=await actions.locator('a,button').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,right:r.right};}));
     assert.ok(boxes.every(b=>b.width>0&&b.x>=0&&b.right<=width+1),doc.id+' download buttons visible');
    }
    if(lang==='ar'&&doc.workflow!=='subscription'){
     await page.locator('#review-tab').click();await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});
     assert.equal(await page.locator('[data-full-page]').count(),doc.pages);
     await page.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300),{timeout:60000});
     await page.locator('#edit-again').click();
    }
    await page.locator(doc.workflow==='subscription'?'#sub-home':'#back-home').click();
   }
   pass(audience+'/'+lang+': all form headers keep two downloads, no duplicate preview, desktop/mobile fit'+(lang==='ar'?' and every generic final review renders all pages':''));
   await page.locator('[data-doc="kyc-'+audience+'"]').click();
   const kyc=docs.find(d=>d.id==='kyc-'+audience);
   for(const [index,section] of kyc.sections.entries()){
    await page.locator('[data-step="'+index+'"]').click();
    assert.equal(await page.locator('[name="rep_fax"],[name="issue_place"],[name="rep_issue"],[name="rep_place"],[name="auth_issue_date"],[name="auth_issue_place"]').count(),0);
    for(const ids of kyc.identityRows.filter(ids=>section.fields.some(f=>f.id===ids[0]))){
     const boxes=await Promise.all(ids.map(id=>page.locator('[name="'+id+'"]').boundingBox()));assert.ok(boxes.every(b=>Math.abs(b.y-boxes[0].y)<2),kyc.id+' '+ids+' same line');
     await shot(audience+'-'+lang+'-identity-'+index);
    }
    assert.equal(await page.locator('[data-signature-mode]:checked').count(),0);
   }
   await page.locator('#back-home').click();await page.locator('[data-doc="terms-and-conditions"]').click();await page.locator('[data-step="0"]').click();
   assert.equal(await page.locator('[data-full-page]').count(),13);await page.waitForFunction(()=>[...document.querySelectorAll('[data-full-page]')].every(c=>c.width>300),{timeout:60000});
   assert.equal(await page.locator('.section-tab').count(),4);assert.match(await page.locator('[data-step="1"]').innerText(),/Acceptance|قبول/);
   await page.locator('#next').click();assert.equal(await page.locator('[data-signature-mode]:checked').count(),0);
   await page.locator('#back-home').click();
  }
  pass(audience+': bilingual desktop/mobile catalogue, identity row order, no retired fields, T&C first step and unset signing choices');
  if(audience==='individual'){
   await page.locator('[data-doc="fatca-crs-individual"]').click();
   const index=docs.find(d=>d.id==='fatca-crs-individual').sections.findIndex(s=>s.id==='signatory');await page.locator('[data-step="'+index+'"]').click();
   assert.equal(await page.locator('#fields [name]').first().getAttribute('name'),'capacity');
   await page.locator('[name=capacity][value=holder]').check();assert.ok(await page.locator('[name=signer_en_first]').inputValue());
   const positions=await page.locator('[name=capacity]').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().top));assert.ok(positions.every(y=>Math.abs(y-positions[0])<2));
   await shot('individual-role-before-name');await page.locator('#back-home').click();pass('Individual FATCA: role first, all four choices on one desktop row, account-holder names prefill');
  }
  await page.locator('[data-doc="al-naeem-terms-consent"]').click();
  const name=audience==='individual'?'investor_name_first':'investor_name';await page.locator('[name="'+name+'"]').fill(audience==='individual'?'أحمد':'شركة الاختبار');if(audience==='individual'){await page.locator('[name=investor_name_second]').fill('محمد');await page.locator('[name=investor_name_third]').fill('');await page.locator('[name=investor_name_last]').fill('علي');}
  await page.locator('[data-signature-mode][value="electronic"]').check();await page.locator('[data-signature-file]').setInputFiles('tests/fixtures/signature.png');await page.locator('.sub-upload img').waitFor();
  await page.locator('#review-tab').click();await page.locator('#submit-form:not([disabled])').waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('[data-full-page]')?.width>300);await shot(audience+'-consent-review');
  await page.locator('#submit-form').click();await page.locator('.submission-reference').waitFor();await page.locator('.submission-dialog [data-close]').click();await page.locator('#back-home').click();
  await page.locator('[data-card="al-naeem-terms-consent"] [data-filled]').waitFor();assert.equal(await page.locator('[data-card="al-naeem-terms-consent"] [data-signature-state="electronic"]').count(),1);
  const first=(await f.call(ctx,'portal','submissions')).submissions.find(s=>s.doc_id==='al-naeem-terms-consent');
  assert.equal((await f.call(ctx,'portal','detail',{params:{id:first.id}})).submission.answers.investor_name,audience==='individual'?'أحمد محمد علي':'شركة الاختبار');
  const download=await ctx.request.get(new URL(await page.locator('[data-card="al-naeem-terms-consent"] [data-filled]').getAttribute('href'),f.base).href);assert.equal(download.status(),200);
  await page.locator('[data-upload="al-naeem-terms-consent"]').click();await page.locator('.portal-upload').waitFor();await page.locator('.portal-upload [name=pdf]').setInputFiles({name:'signed.pdf',mimeType:'application/pdf',buffer:await download.body()});await page.locator('.portal-upload [name=signedConfirmed]').check();await page.locator('.portal-upload button.primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});await page.locator('[data-card="al-naeem-terms-consent"] [data-signature-state="uploaded"]').waitFor();
  const versions=(await f.call(ctx,'portal','submissions')).submissions.filter(s=>s.doc_id===first.doc_id);assert.equal(versions.length,2);assert.ok(versions.find(s=>s.id===first.id).archived_at);assert.equal(versions.find(s=>!s.archived_at).source,'upload');
  const zip=await ctx.request.get(new URL(await page.locator('[data-download-all]').getAttribute('href'),f.base).href);assert.equal(zip.status(),200);assert.ok((await zip.body()).subarray(0,2).equals(Buffer.from('PK')));
  await page.locator('[data-notification-bell]').click();await page.locator('.notification-dialog .account-notifications').waitFor();await page.locator('.notification-dialog [data-close]').click();
  await page.locator('.client-account-link').click();await page.locator('#profile-form').waitFor();assert.equal(await page.locator('.account-documents,.account-history,[data-preview],#upload-completed').count(),0);await page.locator('[name=email]').fill('updated-'+audience+'@example.com');await page.locator('#profile-form [type=submit]').click();await page.locator('#profile-message.portal-success').waitFor();assert.equal((await f.call(ctx,'portal','session')).user.email,'updated-'+audience+'@example.com');await shot(audience+'-profile');await page.setViewportSize({width:390,height:844});await shot(audience+'-profile-mobile');
  await page.locator('#change-password').click();await page.locator('#password-form').waitFor();await page.locator('#password-back').click();await page.locator('#profile-form').waitFor();
  pass(audience+': fillable consent, electronic preview/submission, card statuses/download, signed upload replacement, immutable archive, ZIP, notifications and profile save');
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await f.close();console.log('REPORT '+out+'/report.json');}
