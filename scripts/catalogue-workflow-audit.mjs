// Current authenticated catalogue workflow. Uses disposable local data only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture({protectedRoutes:true}),browser=await chromium.launch({channel:'chrome',headless:true});
const report={checks:[],errors:[]};let page;
const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
const context=async()=>{const c=await browser.newContext({viewport:{width:1440,height:1000}});c.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));return c;};
try{
 const owner=await context(),admin=await context(),guest=await context(),client=await context(),company=await context();
 await f.login(owner,'superadmin');await f.login(admin,'admin');const individual=await f.client(client,'individual'),corporate=await f.client(company,'corporate');
 const mg=(action,data,status=200)=>f.call(owner,'management',action,{...(data?{data}:{}),status});
 let state=await mg('state');const original=structuredClone(state.draft);
 for(const action of ['save','publish','restore','remove','review','upload'])await f.call(admin,'management',action,{data:{revision:state.revision},status:403});
 await f.call(guest,'management','catalogue',{status:401});
 const edit=structuredClone(original);edit.documents[0].title='QA renamed document';edit.documents[0].ar='نموذج فحص معدل';edit.orders.individual.reverse();
 state=await mg('save',{revision:state.revision,draft:edit});assert.deepEqual(await mg('catalogue'),original);
 await mg('save',{revision:0,draft:edit},409);state=await mg('publish',{revision:state.revision});assert.deepEqual(await mg('catalogue'),state.draft);
 state=await mg('restore',{revision:state.revision});assert.deepEqual(state.draft,original);assert.notDeepEqual(await mg('catalogue'),original);
 state=await mg('publish',{revision:state.revision});assert.deepEqual(await mg('catalogue'),original);
 pass('Superadmin-only title/order editing, private drafts, stale revision rejection, explicit publish and rollback');

 const pdf=await PDFDocument.create(),paper=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica),form=pdf.getForm();
 paper.drawText('Isolated upload test',{x:50,y:780,font,size:18});
 form.createTextField('Full name').addToPage(paper,{x:160,y:700,width:350,height:28});
 form.createTextField('Email').addToPage(paper,{x:160,y:630,width:350,height:28});
 form.createCheckBox('Agreement').addToPage(paper,{x:160,y:570,width:12,height:12});
 const category=form.createRadioGroup('Category');category.addOptionToPage('Individual',paper,{x:160,y:520,width:12,height:12});category.addOptionToPage('Company',paper,{x:300,y:520,width:12,height:12});
 const country=form.createDropdown('Country');country.addOptions(['Saudi Arabia','United States of America']);country.addToPage(paper,{x:160,y:450,width:350,height:28});form.updateFieldAppearances(font);
 const pdfPath=f.out+'/native-form.pdf';await fs.writeFile(pdfPath,await pdf.save());
 page=await owner.newPage();await page.goto(f.base+'/management/?lang=en');await page.locator('[data-documents]').click();await page.locator('#upload').click();
 await page.locator('[name=pdf]').setInputFiles(pdfPath);await page.locator('[name=title]').fill('QA shared form');await page.locator('[name=ar]').fill('نموذج فحص مشترك');await page.locator('[name=group]').selectOption('shared');await page.locator('#upload-submit').click();await page.locator('#field-properties').waitFor();
 assert.equal(await page.locator('[data-select]').count(),5);
 for(const [i,label] of ['الاسم الكامل','البريد الإلكتروني','الموافقة','الفئة','الدولة'].entries()){
  await page.locator('[data-select]').nth(i).click();await page.locator('[data-prop=ar]').fill(label);await page.locator('[data-prop=ar]').blur();
  if(i<2){await page.locator('[data-shared=individual]').selectOption(i?'email':'full_name');await page.locator('[data-shared=corporate]').selectOption(i?'email':'company_name');}
 }
 await page.locator('#save-editor').click();await page.locator('#notice').filter({hasText:'Field layout saved'}).waitFor();state=await mg('state');let uploaded=state.draft.documents.at(-1);
 assert.equal(uploaded.fields.length,5);assert.equal(uploaded.importedWidgets,true);await mg('publish',{revision:state.revision},400);
 assert.equal((await client.request.get(f.base+'/api/management.php?action=document&id='+uploaded.id)).status(),404);
 for(const language of ['en','ar']){const pending=page.waitForEvent('download');await page.locator('[data-sample='+language+']').click();const d=await pending;const file=f.out+'/sample-'+language+'.pdf';await d.saveAs(file);assert.equal((await PDFDocument.load(await fs.readFile(file))).getForm().getFields().length,0);}
 await page.locator('#review-confirm').check();await page.locator('#review-document').click();await page.locator('#notice').filter({hasText:'Document reviewed'}).waitFor();state=await mg('state');state=await mg('publish',{revision:state.revision});uploaded=state.draft.documents.at(-1);
 assert.equal(digest(await(await client.request.get(f.base+'/api/management.php?action=document&id='+uploaded.id)).body()),digest(await fs.readFile(pdfPath)));
 pass('Native PDF upload imports all five fields; both language samples flatten correctly; review gate protects publication');

 const submitted=[];
 for(const [ctx,user,audience,folder] of [[client,individual,'individual','individuals'],[company,corporate,'corporate','companies']]){
  const profile=audience==='individual'?{en_first:'Omar',en_second:'Ali',en_last:'Client',name_language:'en'}:{company_name:'QA Company',company_name_ar:'شركة الفحص',company_name_en:'QA Company'};
  await f.call(ctx,'portal','shared_profile_save',{data:{account:user.id,audience,expectedRevision:0,changes:{...profile,email:audience+'@example.test'}}});
  const p=await ctx.newPage();await p.goto(f.base+'/'+folder+'/?lang=en');await p.locator('[data-doc="'+uploaded.id+'"]').waitFor();
  assert.equal(await p.locator('[data-card]').count(),7);assert.equal(await p.locator('[data-card="'+uploaded.id+'"] .card-number').innerText(),'7');
  await p.locator('[data-doc="'+uploaded.id+'"]').click();const [name,email,agreement,type,nation]=uploaded.fields;
  await p.waitForFunction(({id,expected})=>document.querySelector('[name="'+id+'"]')?.value===expected,{id:email.id,expected:audience+'@example.test'});
  assert.equal(await p.locator('[name="'+name.id+'"]').inputValue(),audience==='individual'?'Omar Ali Client':profile.company_name);
  await p.locator('[name="'+name.id+'"]').fill(audience==='individual'?'أحمد علي':'شركة أخرى');await p.locator('[name="'+agreement.id+'"]').first().check();await p.locator('[name="'+type.id+'"]').first().check();await p.locator('[name="'+nation.id+'"]').selectOption('Saudi Arabia');
  await p.locator('#review-tab').click();await p.locator('#submit-form:not([disabled])').waitFor({timeout:60000});await p.locator('#submit-form').click();await p.locator('.submission-reference').waitFor();
  const s=(await f.call(ctx,'portal','submissions')).submissions[0],detail=(await f.call(owner,'portal','admin_detail',{params:{id:s.id}})).submission;
  assert.equal(detail.doc_id,uploaded.id);assert.equal(detail.answers[email.id],audience+'@example.test');assert.equal(detail.answers[nation.id],'Saudi Arabia');
  const bytes=await(await ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+s.id)).body();assert.equal(digest(bytes),detail.sha256);submitted.push({ctx,id:s.id,sha:detail.sha256});await p.close();
 }
 pass('New card 7 works for both client categories, reuses account details, submits actual controls and preserves exact downloadable PDFs');

 state=await mg('state');const good=structuredClone(state.draft),bad=structuredClone(good);bad.documents.at(-1).fields[0].rect=[590,1,100,20];await mg('save',{revision:state.revision,draft:bad},400);
 bad.documents.at(-1).fields[0]={...good.documents.at(-1).fields[0],shared:{individual:'company_name'}};await mg('save',{revision:state.revision,draft:bad},400);
 const overlapping=structuredClone(good);overlapping.documents.at(-1).fields.push({...overlapping.documents.at(-1).fields[0],id:'overlap_test'});state=await mg('save',{revision:state.revision,draft:overlapping});
 const refused=await mg('review',{revision:state.revision,id:uploaded.id},400);assert.match(refused.error,/overlap/);await mg('publish',{revision:state.revision},400);
 state=await mg('save',{revision:state.revision,draft:good});state=await mg('review',{revision:state.revision,id:uploaded.id});
 const fake=await owner.request.post(f.base+'/api/management.php?action=upload',{headers:{'X-CSRF-Token':f.tokens.get(owner).management},multipart:{revision:String(state.revision),metadata:'{}',pdf:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF document')}}});assert.equal(fake.status(),400);
 await mg('remove',{revision:state.revision,id:original.documents[0].id},400);state=await mg('remove',{revision:state.revision,id:uploaded.id});state=await mg('publish',{revision:state.revision});
 assert.equal((await mg('catalogue')).documents.some(d=>d.id===uploaded.id),false);
 for(const s of submitted)assert.equal(digest(await(await s.ctx.request.get(f.base+'/api/portal.php?action=pdf&id='+s.id)).body()),s.sha);
 pass('Invalid placements, cross-category mappings, overlapping answers and malformed uploads are rejected; removing a template preserves submitted PDFs');

 await f.call(admin,'portal','admin_account_type',{data:{id:individual.id,account_type:'corporate',expected_type:'individual'},status:403});
 await f.call(owner,'portal','admin_account_type',{data:{id:individual.id,account_type:'corporate',expected_type:'individual'}});
 assert.equal((await f.call(client,'portal','session')).user.account_type,'corporate');
 await f.call(owner,'portal','admin_account_type',{data:{id:individual.id,account_type:'individual',expected_type:'individual'},status:409});
 assert.equal((await client.request.get(f.base+'/pdfs/kyc-individual.pdf')).status(),403);assert.equal((await client.request.get(f.base+'/pdfs/kyc-corporate.pdf')).status(),200);
 const switched=(await f.call(client,'portal','shared_profile',{params:{account:individual.id,audience:'corporate'}})).shared;assert.ok(!switched.profile.ar_first&&!switched.profile.company_name);
 await f.call(owner,'portal','admin_account_type',{data:{id:individual.id,account_type:'individual',expected_type:'corporate'}});
 const prior=(await f.call(client,'portal','shared_profile',{params:{account:individual.id,audience:'individual'}})).shared;assert.equal(prior.profile.email,'individual@example.test');
 pass('Only superadmin changes account type; stale changes fail; access follows category and prior shared details remain separate and recoverable');

 await f.call(guest,'management','session');for(let i=0;i<10;i++)await f.call(guest,'management','login',{data:{username:'qa.admin',password:'incorrect'},status:401});
 await f.call(guest,'management','login',{data:{username:'qa.admin',password:'incorrect'},status:429});
 pass('Management login throttling blocks repeated failures');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;await page?.screenshot({path:f.out+'/catalogue-failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await fs.writeFile(f.out+'/catalogue-workflow-report.json',JSON.stringify(report,null,2));console.log('REPORT '+f.out+'/catalogue-workflow-report.json');await browser.close();await f.close();}
