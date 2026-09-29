// Synthetic accounts on an isolated copy. Never points at production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium,firefox,webkit} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';
const f=await fixture({protectedRoutes:true}),report={checks:[],errors:[],passed:false};let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const call=(ctx,a,o)=>f.call(ctx,'portal',a,o);
const state=async ctx=>(await call(ctx,'session')).workflow;
const detail=async(ctx,id,admin=false)=>(await call(ctx,admin?'admin_detail':'detail',{params:{id}})).submission;
const decision=async(ctx,s,status,note='',extra={})=>call(ctx,'admin_review',{data:{id:s.id,status,reason_text:note,expectedRevision:Number(s.review_revision||0),requestKey:randomUUID(),...extra}});
const immutable=s=>Object.fromEntries(['answers','profile','signatures','sha256','created_at'].map(k=>[k,s[k]]));
async function mode(owner,enabled){const w=(await call(owner,'admin_workflow')).workflow;if(w.review_enabled===enabled)return w;return (await call(owner,'admin_workflow_update',{data:{reviewEnabled:enabled,expectedRevision:w.revision,requestKey:randomUUID()}})).workflow;}
async function post(ctx,user,options={}){return f.submit(ctx,user,{signatures:{},signatureModes:{},workflowRevision:(await state(ctx)).revision,...options});}
const previewReady=p=>p.waitForFunction(()=>document.querySelector('.portal-preview [data-preview-status]')?.textContent==='');
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const owner=await browser.newContext(),admin=await browser.newContext(),second=await browser.newContext(),anonymous=await browser.newContext();await f.login(owner,'superadmin');await f.login(admin,'admin');await f.login(second,'admin');
 assert.equal((await state(anonymous)).review_enabled,false);
 await call(anonymous,'admin_review',{data:{},status:401});
 await call(admin,'admin_workflow_update',{data:{reviewEnabled:true,expectedRevision:1,requestKey:randomUUID()},status:403});
 await call(owner,'admin_workflow_update',{data:{reviewEnabled:true,expectedRevision:1,requestKey:randomUUID()},headers:{'X-CSRF-Token':'bad'},status:403});
 await call(owner,'admin_review',{data:{id:'x'},headers:{'X-CSRF-Token':'bad'},status:403});
 for(const bad of [null,1,'true'])await call(owner,'admin_workflow_update',{data:{reviewEnabled:bad,expectedRevision:1,requestKey:randomUUID()},status:400});
 pass('Default off; superadmin-only switch; both mutations require sessions, CSRF and valid input');
 const users=[];
 for(const audience of ['individual','corporate']){
  await mode(owner,false);const ctx=await browser.newContext(),user=await f.client(ctx,audience);users.push({ctx,user});
  const direct=await post(ctx,user,{metadata:{submissionMode:'review',profile:{submission_mode:'review',review_required:true}}});assert.equal(direct.presentation_status,'received');
  const original=await detail(ctx,direct.id);assert.equal(original.signature_state,'unsigned');
  const oldWorkflow=await state(ctx),on=await mode(owner,true);
  await call(admin,'admin_review',{data:{id:direct.id,status:'approved',expectedRevision:0,requestKey:randomUUID()},status:409});
  assert.equal((await detail(ctx,direct.id)).presentation_status,'received');
  assert.equal((await post(ctx,user,{expectedCurrent:direct.id,workflowRevision:oldWorkflow.revision,status:409})).error,'workflow_conflict');
  assert.equal((await post(ctx,user,{source:'upload',expectedCurrent:direct.id,workflowRevision:oldWorkflow.revision,status:409})).error,'workflow_conflict');
  const pending=await post(ctx,user,{expectedCurrent:direct.id,metadata:{submissionMode:'direct',profile:{review_required:false}}});assert.equal(pending.presentation_status,'pending');
  assert.deepEqual(immutable(await detail(ctx,direct.id)),immutable(original));
  for(const status of ['rejected','correction_required'])await call(admin,'admin_review',{data:{id:pending.id,status,reason_text:' ',expectedRevision:0,requestKey:randomUUID()},status:422});
  const requestKey=randomUUID(),request={id:pending.id,status:'correction_required',reason_text:'Please correct the name / يرجى تصحيح الاسم',expectedRevision:0,requestKey};
  const [one,two]=await Promise.all([call(admin,'admin_review',{data:request}),call(admin,'admin_review',{data:request})]);assert.ok(one.duplicate||two.duplicate);
  const changed=await detail(ctx,pending.id);assert.equal(changed.review_history.length,1);assert.equal(changed.review_status,'correction_required');assert.match(changed.reason_text,/correct/);
  await call(second,'admin_review',{data:{id:pending.id,status:'approved',expectedRevision:0,requestKey:randomUUID()},status:409});
  const notifications=await call(ctx,'notifications');assert.equal(notifications.unread,1);const notificationId=notifications.notifications[0].id;
  await call(ctx,'notification_read',{data:{id:notificationId}});await call(ctx,'notification_read',{data:{id:notificationId}});assert.equal((await call(ctx,'notifications')).unread,0);
  await mode(owner,false);const corrected=await post(ctx,user,{expectedCurrent:pending.id,values:{client_name:'Corrected Customer'}});assert.equal(corrected.presentation_status,'pending');
  await call(admin,'admin_review',{data:{id:pending.id,status:'approved',expectedRevision:changed.review_revision,requestKey:randomUUID()},status:409});
  assert.equal((await call(admin,'admin_submissions',{params:{status:'pending'}})).submissions.some(s=>s.id===corrected.id),true);
  await decision(admin,corrected,'signature_required');
  assert.equal((await post(ctx,user,{expectedCurrent:corrected.id,status:422})).error,'signature_required');
  assert.equal((await post(ctx,user,{source:'upload',signedConfirmed:false,expectedCurrent:corrected.id,status:422})).error,'signed_confirmation_required');
  const signed=await post(ctx,user,{source:'upload',signedConfirmed:true,expectedCurrent:corrected.id});assert.equal(signed.presentation_status,'pending');assert.equal((await detail(ctx,signed.id)).signature_state,'uploaded');
  const approved=await decision(admin,signed,'approved','Accepted / تم القبول');assert.equal(approved.review.reason_text,'Accepted / تم القبول');
  await call(second,'admin_review',{data:{id:signed.id,status:'rejected',reason_text:'Late change',expectedRevision:approved.review.review_revision,requestKey:randomUUID()},status:409});
  const afterApproval=await post(ctx,user,{expectedCurrent:signed.id});assert.equal(afterApproval.presentation_status,'received');
  await mode(owner,true);const next=await post(ctx,user,{expectedCurrent:afterApproval.id});await decision(admin,next,'rejected','Application rejected with explanation');await mode(owner,false);
  const afterRejection=await post(ctx,user,{expectedCurrent:next.id});assert.equal(afterRejection.presentation_status,'received');
  await mode(owner,true);const unsignedUpload=await post(ctx,user,{source:'upload',signedConfirmed:false,document:'al-naeem-terms-consent'});assert.equal(unsignedUpload.presentation_status,'pending');assert.equal((await detail(ctx,unsignedUpload.id)).signature_state,'unknown');
  await decision(admin,unsignedUpload,'correction_required','Replace the PDF');await mode(owner,false);const replaced=await post(ctx,user,{source:'upload',signedConfirmed:false,document:'al-naeem-terms-consent',expectedCurrent:unsignedUpload.id});assert.equal(replaced.presentation_status,'pending');
  // Actual frozen-PDF electronic signing endpoint, including request completion after switch-off.
  await decision(admin,replaced,'signature_required','Add your signature');const info=await call(ctx,'signing_details',{params:{id:replaced.id}}),png='data:image/png;base64,'+(await fs.readFile('tests/fixtures/signature.png')).toString('base64'),images=Object.fromEntries(info.signing.requiredSignatureIds.map(id=>[id,png]));
  const bytes=await fs.readFile(f.out+'/site/pdfs/al-naeem-terms-consent.pdf'),signMeta={account:user.id,sourceId:replaced.id,sourceSha256:info.signing.sourceSha256,expectedCurrent:replaced.id,workflowRevision:(await state(ctx)).revision,requestKey:randomUUID(),signatures:images};
  const sendSign=()=>call(ctx,'sign_submission',{multipart:{metadata:JSON.stringify(signMeta),pdf:{name:'signed.pdf',mimeType:'application/pdf',buffer:bytes}},status:201});
  const electronic=(await sendSign()).submission;assert.equal(electronic.presentation_status,'pending');assert.equal((await detail(ctx,electronic.id)).signature_state,'electronic');
  const retry=await call(ctx,'sign_submission',{multipart:{metadata:JSON.stringify(signMeta),pdf:{name:'signed.pdf',mimeType:'application/pdf',buffer:bytes}}});assert.equal(retry.duplicate,true);
  assert.equal((await detail(ctx,pending.id)).current_id,afterRejection.id);
  assert.equal((await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+direct.id)).status(),200);
  assert.equal((await ctx.request.get(f.base+'/api/portal.php?action=zip')).status(),200);
  pass(audience+': unsigned direct/review, corrections, both signature follow-ups, approval/rejection, mode changes, duplicate decisions/signing, stale versions, read receipts, immutable snapshots and downloads');
 }
 const {ctx,user}=users[0];await call(users[1].ctx,'detail',{params:{id:(await call(ctx,'submissions')).submissions[0].id},status:404});
 const current=await post(ctx,user,{document:'terms-and-conditions',source:'upload',signedConfirmed:false});await mode(owner,true);const reviewed=await post(ctx,user,{document:'terms-and-conditions',source:'upload',signedConfirmed:false,expectedCurrent:current.id});
 await decision(admin,reviewed,'correction_required','Upload the corrected PDF');
 const racer=users[1],race=await post(racer.ctx,racer.user,{document:'terms-and-conditions',source:'upload',signedConfirmed:false});
 const responses=await Promise.all([owner,second].map((ctx,i)=>ctx.request.post(f.base+'/api/portal.php?action=admin_review',{headers:{'X-CSRF-Token':f.tokens.get(ctx).portal},data:{id:race.id,status:i?'correction_required':'approved',reason_text:'Concurrent decision',expectedReview:0,requestKey:randomUUID()}})));
 assert.deepEqual(responses.map(r=>r.status()).sort(),[200,409]);assert.equal((await detail(racer.ctx,race.id)).review_history.length,1);pass('Simultaneous administrators produce exactly one decision; the losing revision is rejected');
 const dashboard=await call(admin,'admin_dashboard'),currentRows=(await call(admin,'admin_submissions')).submissions;
 assert.equal(dashboard.stats.active_submissions,dashboard.review_counts.reduce((n,c)=>n+Number(c.count),0));assert.equal(currentRows.every(s=>!s.archived_at),true);
 for(const status of ['received','pending','correction_required','signature_required','approved','rejected']){const list=await call(admin,'admin_submissions',{params:{status}});assert.equal(list.submissions.every(s=>s.presentation_status===status),true);}
 pass('Current-only status filters and dashboard counts; account isolation');
 // Create an online correction case for browser actions and a signature case for both audiences.
 const uiCases=[];
 for(const person of users){const rows=(await call(person.ctx,'submissions')).submissions,current=rows.find(s=>s.doc_id==='signature-form'&&!s.archived_at);const s=await post(person.ctx,person.user,{expectedCurrent:current.id,values:{client_name:'Saved correction name'}});await decision(admin,s,'correction_required','Keep the saved answers');uiCases.push({...person,submission:s});}
 const ownerCookies=await owner.cookies(),adminCookies=await admin.cookies(),clientCookies=await ctx.cookies();
 await browser.close();browser=null;
 for(const [engine,launcher]of Object.entries({chrome:chromium,firefox,webkit})){
  browser=await launcher.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
  for(const [role,cookies]of [['superadmin',ownerCookies],['admin',adminCookies]]){
   const c=await browser.newContext();await c.addCookies(cookies);page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));
   for(const lang of ['en','ar'])for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});await page.goto(f.base+'/management/?lang='+lang);await page.locator('.admin-stats').waitFor();if(await page.locator('html').getAttribute('lang')!==lang){await page.locator('[data-admin-language]').click();await page.locator('html[lang='+lang+']').waitFor();await page.locator('.admin-stats').waitFor();}
    assert.equal(await page.locator('[data-management-view=overview]').innerText(),lang==='ar'?'لوحة التحكم':'Dashboard');assert.equal(await page.locator('[data-management-view=reviews]').innerText(),lang==='ar'?'الطلبات المستلمة':'Received applications');
    assert.equal(await page.locator('#review-new-submissions').count(),role==='superadmin'?1:0);assert.equal(await page.locator('.category-audience').count(),2);
    for(const audience of ['individual','corporate']){const column=page.locator('[data-category-audience='+audience+']');assert.equal(await column.locator('article').count(),6);for(const row of dashboard.counts.filter(c=>c.audience===audience)){const count=column.locator('[data-category-document="'+row.doc_id+'"] .category-count');assert.equal(Number(await count.innerText()),Number(row.active_count));}}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('[data-management-view=reviews]').click();await page.locator('#review-filters').waitFor();assert.equal(await page.locator('[data-review-status]').count(),7);
    await page.locator('[data-preview="'+uiCases[0].submission.id+'"]').click();await previewReady(page);assert.equal(await page.locator('.review-form [name=decision]').inputValue(),'');
    await page.locator('.review-form [name=decision]').selectOption('correction_required');assert.equal(await page.locator('.review-form [name=note]').getAttribute('required'),'');await page.locator('.review-form [name=decision]').selectOption('approved');assert.equal(await page.locator('.review-form [name=note]').getAttribute('required'),null);
    assert.equal(await page.locator('.portal-answer-details').evaluate(n=>n.open),false);await page.screenshot({path:f.out+`/${engine}-${role}-${lang}-${width}.png`,fullPage:true});await page.locator('.portal-preview [data-close]').click();
   }
   await c.close();
  }
  const c=await browser.newContext();await c.addCookies(clientCookies);page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(f.base+'/individuals/?lang=en');await page.locator('[data-follow-up=edit]').waitFor();await page.locator('[data-follow-up=edit]').click();await page.locator('.workspace').waitFor();assert.equal(await page.locator('.revision-banner').count(),1);assert.ok((await page.locator('input').evaluateAll(nodes=>nodes.map(n=>n.value))).some(value=>value.includes('Saved')));
  await c.close();pass(engine+': review controls, all status filters, audience counts, AR/EN desktop/mobile layout and latest saved correction editor');await browser.close();browser=null;
 }
 report.passed=true;
}catch(error){report.error=error.stack;await page?.screenshot({path:f.out+'/optional-review-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/optional-review-report.json',JSON.stringify(report,null,2));console.log('REPORT '+f.out+'/optional-review-report.json');await browser?.close();await f.close();}
