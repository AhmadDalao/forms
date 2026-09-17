import {chromium,request} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'tmp/management-audit'),dataDir=path.join(out,'data-'+Date.now()),base='http://127.0.0.1:8182';
await fs.mkdir(out,{recursive:true});const password=randomBytes(24).toString('hex');
const init=spawnSync('php',['scripts/management-init.php',dataDir],{input:password,encoding:'utf8'});assert.equal(init.status,0,init.stderr);
const server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8182','-t','dist','scripts/management-router.php'],{cwd:root,env:{...process.env,FORMS_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',b=>logs+=b);server.stdout.on('data',b=>logs+=b);
let browser,owner,anon;
try{
 for(let i=0;i<30;i++){try{await fetch(base+'/api/management.php?action=session');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 owner=await request.newContext({baseURL:base});anon=await request.newContext({baseURL:base});
 let csrf=(await (await owner.get('/api/management.php?action=session')).json()).csrf;
 const call=async(action,body,status=200,context=owner,token=csrf)=>{const r=body?await context.post('/api/management.php?action='+action,{data:body,headers:{'X-CSRF-Token':token}}):await context.get('/api/management.php?action='+action);assert.equal(r.status(),status,action+': '+await r.text());return r.json();};
 const initial=await call('catalogue',null,200,anon);
 await call('state',null,401,anon);await call('login',{password},403,owner,'wrong');await call('login',{password:'incorrect'},401);
 csrf=(await call('login',{password})).csrf;
 for(const p of ['/_private/management/password.php','/../management-data/password.php','/.env.local'])assert.notEqual((await anon.get(p)).status(),200,p);
 let state=await call('state');const original=structuredClone(state.draft);state.draft.documents[0].title='Title changed in draft';state.draft.documents[0].ar='عنوان معدل في المسودة';state.draft.orders.individual.reverse();
 state=await call('save',{revision:state.revision,draft:state.draft});assert.deepEqual(await call('catalogue',null,200,anon),initial);
 await call('save',{revision:0,draft:state.draft},409);
 state=await call('publish',{revision:state.revision});assert.deepEqual((await call('catalogue',null,200,anon)).orders.individual,state.draft.orders.individual);
 state=await call('restore',{revision:state.revision});assert.deepEqual(state.draft,original);state=await call('publish',{revision:state.revision});
 console.log('PASS authentication, CSRF, private storage, draft isolation, revisions, ordering, publish and rollback');
 // Native PDF fixture exercises the automatic widget importer and customer renderer.
 const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText('Management test form',{x:50,y:780,size:18,font});page.drawText('Name',{x:50,y:716,size:12,font});page.drawText('Email',{x:50,y:646,size:12,font});
 const form=pdf.getForm();form.createTextField('Full name').addToPage(page,{x:160,y:700,width:350,height:28});form.createTextField('Email').addToPage(page,{x:160,y:630,width:350,height:28});form.createCheckBox('Agreement').addToPage(page,{x:160,y:570,width:12,height:12});page.drawText('I agree',{x:185,y:572,size:10,font});const radio=form.createRadioGroup('Category');radio.addOptionToPage('Individual',page,{x:160,y:520,width:12,height:12});radio.addOptionToPage('Company',page,{x:300,y:520,width:12,height:12});page.drawText('Individual',{x:185,y:522,size:10,font});page.drawText('Company',{x:325,y:522,size:10,font});const country=form.createDropdown('Country');country.addOptions(['Saudi Arabia','United States of America']);country.addToPage(page,{x:160,y:450,width:350,height:28});form.updateFieldAppearances(font);
 const fixture=path.join(out,'native-form.pdf');await fs.writeFile(fixture,await pdf.save());
 browser=await chromium.launch({channel:'chrome'});const admin=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(base+'/management/');await admin.locator('#password').fill(password);await admin.locator('#login button').click();await admin.locator('#upload').waitFor();
 await admin.screenshot({path:path.join(out,'management-catalogue.png'),fullPage:true});
 await admin.locator('#upload').click();await admin.locator('input[name=pdf]').setInputFiles(fixture);await admin.locator('input[name=title]').fill('New shared form');await admin.locator('input[name=ar]').fill('نموذج مشترك جديد');await admin.locator('select[name=group]').selectOption('shared');await admin.locator('#upload-submit').click();await admin.locator('#field-properties').waitFor().catch(async err=>{console.log('UI:',await admin.locator('#notice').innerText(),errors);await admin.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw err;});
 assert.equal(await admin.locator('[data-select]').count(),5);await admin.locator('[data-select]').nth(0).click();await admin.locator('[data-prop=ar]').fill('الاسم الكامل');await admin.locator('[data-prop=ar]').blur();await admin.locator('[data-shared=individual]').selectOption('full_name');await admin.locator('[data-shared=corporate]').selectOption('company_name');
 await admin.locator('[data-select]').nth(1).click();await admin.locator('[data-prop=ar]').fill('البريد الإلكتروني');await admin.locator('[data-prop=ar]').blur();await admin.locator('[data-shared=individual]').selectOption('email');await admin.locator('[data-shared=corporate]').selectOption('email');
 for(const [i,label] of [[2,'الموافقة'],[3,'الفئة'],[4,'الدولة']]){await admin.locator('[data-select]').nth(i).click();await admin.locator('[data-prop=ar]').fill(label);await admin.locator('[data-prop=ar]').blur();}
 await admin.locator('#save-editor').click();await admin.locator('#notice').filter({hasText:'Field layout saved'}).waitFor();
 state=await call('state');const uploaded=state.draft.documents.at(-1);assert.equal(uploaded.fields.length,5);assert.equal(uploaded.importedWidgets,true);
 await call('publish',{revision:state.revision},400);
 assert.equal((await anon.get('/api/management.php?action=document&id='+uploaded.id)).status(),404);
 for(const lang of ['en','ar']){const pending=admin.waitForEvent('download');await admin.locator('[data-sample='+lang+']').click();const d=await pending;await d.saveAs(path.join(out,'sample-'+lang+'.pdf'));assert.equal((await PDFDocument.load(await fs.readFile(path.join(out,'sample-'+lang+'.pdf')))).getForm().getFields().length,0);}
 await admin.locator('#review-confirm').check();await admin.locator('#review-document').click();await admin.locator('#notice').filter({hasText:'Document reviewed'}).waitFor();await admin.screenshot({path:path.join(out,'management-field-editor.png'),fullPage:true});
 state=await call('state');assert.equal(state.draft.documents.at(-1).reviewed,true);state=await call('publish',{revision:state.revision});
 const publicPDF=await anon.get('/api/management.php?action=document&id='+uploaded.id);assert.equal(publicPDF.status(),200);assert.equal(createHash('sha256').update(await publicPDF.body()).digest('hex'),createHash('sha256').update(await fs.readFile(fixture)).digest('hex'));
 console.log('PASS native PDF upload, automatic fields, bilingual labels, private draft file, review gate, both sample downloads and published source');
 for(const folder of ['individuals','companies']){
  const customer=await browser.newPage({viewport:{width:1440,height:1000}});customer.on('pageerror',e=>errors.push(e.message));await customer.goto(base+'/'+folder+'/');await customer.locator('[data-doc="'+uploaded.id+'"]').waitFor();assert.equal(await customer.locator('[data-card]').count(),7);assert.equal(await customer.locator('[data-card="'+uploaded.id+'"] .card-number').innerText(),'7');
  await customer.locator('#shared-fields-panel>summary').click();if(folder==='individuals'){await customer.locator('#shared-en_first').fill('Individual');await customer.locator('#shared-en_last').fill('Client');}else await customer.locator('#shared-company_name').fill('Company Client');await customer.locator('#shared-email').fill(folder+'@example.com');
  await customer.locator('[data-doc="'+uploaded.id+'"]').click();assert.equal(await customer.locator('[name="'+uploaded.fields[0].id+'"]').inputValue(),folder==='individuals'?'Individual Client':'Company Client');assert.equal(await customer.locator('[name="'+uploaded.fields[1].id+'"]').inputValue(),folder+'@example.com');
  for(const lang of ['en','ar']){if(await customer.locator('html').getAttribute('lang')!==lang)await customer.locator('#language').click();assert.ok((await customer.locator('#fields-content').innerText()).includes(lang==='ar'?'الاسم الكامل':'Full name'));await customer.locator('[name="'+uploaded.fields[0].id+'"]').fill(lang==='ar'?'أحمد علي':'Ahmad Ali');const pending=customer.waitForEvent('download');await customer.locator('#download-now').click();const d=await pending;await d.saveAs(path.join(out,folder+'-'+lang+'.pdf'));}
  await customer.reload();await customer.locator('[name="'+uploaded.fields[0].id+'"]').waitFor();assert.equal(await customer.locator('[name="'+uploaded.fields[0].id+'"]').inputValue(),'أحمد علي');await customer.close();
 }
 // A flat PDF should produce reviewable suggestions without pretending labels are complete.
 const flat=await PDFDocument.create(),fp=flat.addPage([595,842]);fp.drawText('Name',{x:50,y:710,size:12});fp.drawLine({start:{x:160,y:700},end:{x:510,y:700},thickness:.8});const flatPath=path.join(out,'flat-form.pdf');await fs.writeFile(flatPath,await flat.save());
 await admin.reload();await admin.locator('#upload').click();await admin.locator('input[name=pdf]').setInputFiles(flatPath);await admin.locator('input[name=title]').fill('Flat form');await admin.locator('input[name=ar]').fill('نموذج ورقي');await admin.locator('#upload-submit').click();await admin.locator('#field-properties').waitFor().catch(async err=>{console.log('UI:',await admin.locator('#notice').innerText(),errors);await admin.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw err;});assert.ok(await admin.locator('[data-select]').count()>=1);await admin.screenshot({path:path.join(out,'flat-suggestion.png'),fullPage:true});
 // Draw and move a signature area, then confirm the saved coordinates and sample.
 await admin.locator('[data-draw=signature]').click();const paper=await admin.locator('#paper').boundingBox();const px=x=>paper.x+x/595*paper.width,py=y=>paper.y+y/842*paper.height;
 await admin.mouse.move(px(160),py(250));await admin.mouse.down();await admin.mouse.move(px(350),py(285),{steps:6});await admin.mouse.up();await admin.locator('[data-prop=label]').fill('Signature');await admin.locator('[data-prop=label]').blur();await admin.locator('[data-prop=ar]').fill('التوقيع');await admin.locator('[data-prop=ar]').blur();
 await admin.locator('#save-editor').click();await admin.locator('#notice').filter({hasText:'Field layout saved'}).waitFor();state=await call('state');let sig=state.draft.documents.at(-1).signatures[0];assert.ok(Math.abs(sig.rect[0]-160)<1);assert.ok(Math.abs(sig.rect[1]-250)<1);
 const box=await admin.locator('[data-box="'+sig.id+'"]').boundingBox();await admin.mouse.move(box.x+box.width/2,box.y+box.height/2);await admin.mouse.down();await admin.mouse.move(box.x+box.width/2+10,box.y+box.height/2+10,{steps:3});await admin.mouse.up();await admin.locator('#save-editor').click();await admin.locator('#notice').filter({hasText:'Field layout saved'}).waitFor();state=await call('state');assert.ok(state.draft.documents.at(-1).signatures[0].rect[0]>160);
 const signDownload=admin.waitForEvent('download');await admin.locator('[data-sample=en]').click();await (await signDownload).saveAs(path.join(out,'signature-sample.pdf'));
 // Server rejects out-of-page placement and cross-audience mappings without changing state.
 const bad=structuredClone(state.draft);bad.documents.at(-1).fields[0].rect=[590,1,100,20];await call('save',{revision:state.revision,draft:bad},400);assert.equal((await call('state')).revision,state.revision);
 const foreign=structuredClone(state.draft);foreign.documents.at(-1).fields[0].shared={individual:'company_name'};await call('save',{revision:state.revision,draft:foreign},400);
 await admin.reload();await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await admin.screenshot({path:path.join(out,'management-mobile.png'),fullPage:true});
 // Persistent password throttling and malformed upload rejection.
 const badUpload=await owner.post('/api/management.php?action=upload',{headers:{'X-CSRF-Token':csrf},multipart:{pdf:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf document')},revision:String(state.revision),metadata:'{}'}});assert.equal(badUpload.status(),400);
 for(let i=0;i<10;i++)await call('login',{password:'incorrect'},401);await call('login',{password:'incorrect'},429);
 assert.deepEqual(errors,[]);console.log('PASS new seventh form, both audiences/languages, shared-field isolation, filled downloads, draft reload and flat-PDF suggestions');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,date:new Date().toISOString(),checks:['authentication','csrf','private files','draft isolation','revision conflict','publish rollback','native widget import','review gate','EN/AR samples','new card 7','both audiences','shared fields','downloads','draft recovery','flat suggestions'],errors},null,2));
}finally{await browser?.close();await owner?.dispose();await anon?.dispose();server.kill();await fs.writeFile(path.join(out,'php.log'),logs);}
