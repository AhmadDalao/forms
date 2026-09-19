import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const out=path.resolve('tmp/portal-audit'),base='http://127.0.0.1:8187',ownerPassword=randomBytes(24).toString('base64url')+'aA7!',accountManagerPassword=randomBytes(24).toString('base64url')+'aA7!',password='Client-testing-strong-2026!';
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
assert.equal(spawnSync('php',['scripts/management-init.php',out+'/management','qa.manager'],{input:ownerPassword}).status,0);
assert.equal(spawnSync('php',['scripts/management-superadmin-init.php',out+'/management','qa.superadmin'],{input:accountManagerPassword}).status,0);
const log=await fs.open(out+'/server.log','w');
const server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8187','-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:out+'/management',FORMS_PORTAL_DATA_DIR:out+'/data'},stdio:['ignore',log.fd,log.fd]});
let browser;const errors=[],checks=[];
try{
 for(let i=0;i<50;i++){try{if((await fetch(base+'/api/portal.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=()=>browser.newContext({viewport:{width:1440,height:1100}});
 const a=await context(),b=await context(),anon=await context(),admin=await context();
 const tokens=new Map();
 async function call(ctx,action,data,expected=200,options={}){
  if(action==='register')data={account_type:'individual',...data};
  const res=await ctx.request[options.multipart||data?'post':'get'](base+'/api/portal.php?'+new URLSearchParams({action,...options.params}),{...(data?{data}:{}),...(options.multipart?{multipart:options.multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)||'',...options.headers}});
  assert.equal(res.status(),expected,`${action}: ${await res.text()}`);const json=await res.json();if(json.csrf)tokens.set(ctx,json.csrf);return json;
 }
 async function assertBrand(page){
  await page.locator('.brand-lockup .brand-itqan').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.brand-lockup img')].every(i=>i.complete&&i.naturalWidth>0));
  const wesal=await page.locator('.brand-wessal').boundingBox(),itqan=await page.locator('.brand-itqan').boundingBox();
  assert.ok(Math.abs(itqan.y+itqan.height/2-wesal.y-wesal.height/2)<2,'Logos must share a vertical centre');
  assert.ok(itqan.x>=wesal.x+wesal.width||wesal.x>=itqan.x+itqan.width,'Logos must sit beside each other without overlap');
 }
 await call(anon,'session');await call(anon,'submissions',null,401);await call(anon,'admin_dashboard',null,401);
 await call(anon,'register',{first_name:'Test',last_name:'Client',phone:'55535445',password,confirm:password},400);
 await call(anon,'register',{first_name:'Test',last_name:'Client',phone:'551111111',password,confirm:'different'},400);
 await call(anon,'register',{first_name:'Test',last_name:'Client',phone:'551111111',password,confirm:password},403,{headers:{'X-CSRF-Token':'wrong'}});
 for(const names of [{first_name:'Test'},{last_name:'Client'},{first_name:' ',last_name:'Client'}]){const result=await call(anon,'register',{...names,phone:'551111111',password,confirm:password},400);assert.equal(result.error,'registration_name_invalid');}
 checks.push('Anonymous access, CSRF, phone and confirmation validation');
 const accountManager=await context();
 const managerSession=await (await accountManager.request.get(base+'/api/management.php?action=session')).json();
 // Only this fixture helper is privileged to change audience; the dashboard/review/reset audit stays an ordinary admin.
 assert.equal((await accountManager.request.post(base+'/api/management.php?action=login',{data:{username:'qa.superadmin',password:accountManagerPassword},headers:{'X-CSRF-Token':managerSession.csrf}})).status(),200);
 tokens.set(accountManager,(await (await accountManager.request.get(base+'/api/management.php?action=session')).json()).csrf);
 async function setType(ctx,type){const user=(await call(ctx,'session')).user;await call(accountManager,'admin_account_type',{id:user.id,account_type:type,expected_type:user.account_type});}
 const page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/individuals/');
 await page.evaluate(()=>{localStorage.setItem('itqan.forms.v1.individual.signature-form',JSON.stringify({values:{client_name:'Guest retained',signer_name:'Ahmad Ali',date:'2026-09-19'},step:1}));localStorage.setItem('itqan.forms.v1.individual.preferences',JSON.stringify({lang:'en',active:'signature-form'}));});
 await page.goto(base+'/register/?lang=en&next=individuals&resume=1');await page.locator('#auth-form').waitFor();await assertBrand(page);assert.equal(await page.locator('#auth-form [name=name]').count(),0);const firstBox=await page.locator('[name=first_name]').boundingBox(),lastBox=await page.locator('[name=last_name]').boundingBox();assert.ok(Math.abs(firstBox.y-lastBox.y)<2);await page.screenshot({path:out+'/register-en.png',fullPage:true});
 await page.locator('[name=account_type][value=individual]').check();await page.locator('[name=first_name]').fill('Ahmad');await page.locator('[name=last_name]').fill('Ali');await page.locator('[name=phone]').fill('0551111111');await page.locator('[name=password]').fill(password);await page.locator('[name=confirm]').fill(password);await page.locator('#auth-form [type=submit]').click();await page.waitForURL('**/individuals/');
 const accountA=(await call(a,'session')).user;assert.equal(accountA.phone,'+966551111111');assert.equal(accountA.name,'Ahmad Ali');
 assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('itqan.forms.v1.account.'+id+'.individual.signature-form')).values.client_name,accountA.id),'Guest retained');
 assert.equal(await page.evaluate(()=>localStorage.getItem('itqan.forms.v1.individual.signature-form')),null);
 await call(b,'session');const accountB=(await call(b,'register',{first_name:'محمد',last_name:'القحطاني',phone:'٥٥٢٢٢٢٢٢٢',password,confirm:password},201)).user;
 await call(anon,'register',{first_name:'Duplicate',last_name:'Client',phone:'+966551111111',password,confirm:password},409);
 await call(a,'admin_dashboard',null,401);
 checks.push('English browser signup, Saudi phone normalization, account draft migration and duplicate phone');
 const pdf=await fs.readFile('public/pdfs/al-naeem-terms-consent.pdf');
 const upload=(ctx,meta,buffer=pdf,status=201)=>call(ctx,'submit',null,status,{multipart:{metadata:JSON.stringify(meta),pdf:{name:'signed.pdf',mimeType:'application/pdf',buffer}}});
 const metadata={account:accountA.id,document:'al-naeem-terms-consent',audience:'individual',requestKey:randomBytes(16).toString('hex'),source:'upload',expectedCurrent:null};
 await upload(a,metadata,Buffer.from('not a pdf'),400);
 await upload(a,{...metadata,account:accountB.id},pdf,409);
 await upload(a,{...metadata,document:'nonexistent'},pdf,404);
 const first=(await upload(a,metadata)).submission;assert.equal((await upload(a,metadata,pdf,200)).duplicate,true);
 await call(b,'detail',null,404,{params:{id:first.id}});
 assert.equal((await b.request.get(base+'/api/portal.php?action=pdf&id='+first.id)).status(),404);
 assert.equal((await anon.request.get(base+'/api/portal.php?action=pdf&id='+first.id)).status(),401);
 assert.equal((await anon.request.get(base+'/_private/portal/clients.sqlite')).status(),404);
 checks.push('Private PDF storage, owner checks, malformed PDF rejection and duplicate submission protection');
 // Submit the unchanged signature form, including an editable signature snapshot.
 const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=180;canvas.height=60;const c=canvas.getContext('2d');c.font='italic 24px serif';c.fillText('Test Signature',4,40);return canvas.toDataURL().split(',')[1];});
 await page.locator('[data-step="1"]').click();assert.equal(await page.locator('#signature-panel').count(),0);
 await page.locator('[data-signature-mode="specimen"][value="electronic"]').check();
 await page.locator('[data-signature-file="specimen"]').setInputFiles({name:'signature.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await page.locator('[data-signature-remove="specimen"]').waitFor();await page.locator('#review-tab:not([disabled])').waitFor();
 const signature=await page.evaluate(id=>JSON.parse(localStorage.getItem('itqan.forms.v1.account.'+id+'.individual.signature-form')).signatures.specimen,accountA.id);
 await page.reload();await page.locator('[data-signature-slot="specimen"] img').waitFor();assert.equal(await page.locator('[data-signature-mode="specimen"][value="electronic"]').isChecked(),true);
 await page.locator('#review-tab').click();await page.locator('#submit-form').waitFor();
 await page.locator('#submit-form').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.locator('.submission-dialog [data-close]').click();
 for(const corporate of [false,true]){
  await setType(a,corporate?'corporate':'individual');
  const audience=corporate?'corporate':'individual',folder=corporate?'companies':'individuals',doc=corporate?'subscription-company':'subscription-form';
  const values={first_name:'Ahmad',second_name:'Mohammed',family_name:'Ali',company_name:'Al Noor Investment Company',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name:'Ahmad Mohammed Ali',nationality:'Saudi Arabia',id_type:'national',id_number:'1000012345',mobile:'+966551111111',short_address:'RABC1234',building:'1234',street:'King Fahd Road',additional:'5678',district:'Al Olaya',postal:'12345',city:'Riyadh',country:'المملكة العربية السعودية',email:'client@example.com',units:'10',subscription_type:'new',payment_method:'transfer',applicant_name:'Ahmad Mohammed Ali',date:'2026-09-19',signature_mode:'manual'};
  await page.evaluate(({id,audience,doc,values})=>{const prefix='itqan.forms.v1.account.'+id+'.'+audience+'.';localStorage.setItem(prefix+doc,JSON.stringify({values,step:3}));localStorage.setItem(prefix+'preferences',JSON.stringify({lang:'en',active:doc}));},{id:accountA.id,audience,doc,values});
  await page.goto(base+'/'+folder+'/');await page.locator('#sub-next').click();await page.locator('[data-submit]').waitFor();
  await page.locator('[data-submit]').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.screenshot({path:out+'/'+audience+'-submitted.png',fullPage:true});await page.locator('.submission-dialog [data-close]').click();
 }
 await setType(a,'individual');
 const submissions=(await call(a,'submissions')).submissions;assert.equal(submissions.length,4);
 const sub=submissions.find(s=>s.doc_id==='subscription-form'),details=(await call(a,'detail',null,200,{params:{id:sub.id}})).submission;
 assert.equal(details.answers.total_amount,'10200');assert.equal(details.answers.subscription_fee,'200');assert.equal(details.answers.total_words,'عشرة آلاف ومائتا ريال سعودي');
 assert.equal((await call(a,'submissions')).user.email,'client@example.com');
 // Server ignores forged read-only amounts even when metadata is posted outside the UI.
 const subscriptionPDF=await a.request.get(base+'/api/portal.php?action=pdf&id='+sub.id);
 const forged={account:accountA.id,document:'subscription-form',audience:'individual',requestKey:randomBytes(16).toString('hex'),expectedCurrent:sub.id,values:{...details.answers,total_amount:'1',subscription_fee:'0',unit_price:'1'}};
 const forgedResult=await upload(a,forged,await subscriptionPDF.body());const canonical=(await call(a,'detail',null,200,{params:{id:forgedResult.submission.id}})).submission;assert.equal(canonical.answers.total_amount,'10200');
 checks.push('Signature and both subscription UI submissions, server totals and optional email capture');
 await page.goto(base+'/my-applications/');await page.locator('.client-submission').first().waitFor();assert.equal(await page.locator('h1').innerText(),'My applications');await assertBrand(page);await page.screenshot({path:out+'/account-en.png',fullPage:true});
 await page.locator('[data-preview]').first().click();await page.locator('.portal-pdf-pages canvas').first().waitFor();await page.waitForFunction(()=>document.querySelector('.portal-pdf-pages canvas')?.width>100);await page.screenshot({path:out+'/client-preview.png',fullPage:true});await page.locator('.portal-preview [data-close]').click();
 await page.locator('#upload-completed').click();await page.locator('.portal-upload [name=document]').selectOption('al-naeem-terms-consent');await page.locator('.portal-upload [name=pdf]').setInputFiles('public/pdfs/al-naeem-terms-consent.pdf');await page.locator('.portal-upload .primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelectorAll('.client-submission').length===6);assert.equal(await page.locator('.client-submission').count(),6);
 await page.locator('#portal-language').click();await page.locator('html[lang=ar]').waitFor();assert.equal(await page.locator('h1').innerText(),'طلباتي');await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/account-ar-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 // Admin uses the existing owner login and session, never a client cookie.
 const owner=await admin.newPage();owner.on('pageerror',e=>errors.push(e.message));await owner.goto(base+'/management/');await owner.locator('#username').fill('qa.manager');await owner.locator('#password').fill(ownerPassword);await owner.locator('#login button').click();await owner.locator('.admin-stats').waitFor();await assertBrand(owner);
 const managementSession=await (await admin.request.get(base+'/api/management.php?action=session')).json();tokens.set(admin,managementSession.csrf);
 const stats=await call(admin,'admin_dashboard');assert.equal(stats.stats.users,2);assert.equal(stats.stats.submissions,6);assert.equal(stats.stats.submitted_users,1);assert.equal(stats.counts.find(c=>c.doc_id==='signature-form').count,1);
 await owner.screenshot({path:out+'/admin-overview-en.png',fullPage:true});await owner.locator('[data-users]').first().click();await owner.locator('#client-search').waitFor();await owner.locator('[data-client="'+accountA.id+'"]').click();await owner.locator('.admin-client-facts').waitFor();await owner.screenshot({path:out+'/admin-client-en.png',fullPage:true});
 await owner.locator('[data-preview]').first().click();await owner.locator('.portal-pdf-pages canvas').first().waitFor();await owner.locator('.portal-preview [data-close]').click();
 const zip=await admin.request.get(base+'/api/portal.php?action=admin_zip&id='+accountA.id);assert.equal(zip.status(),200);assert.ok(zip.headers()['content-disposition'].includes('Ahmad%20Ali.zip'));await fs.writeFile(out+'/client.zip',await zip.body());
 const zipResult=spawnSync('php',['-r','$z=new ZipArchive();$z->open($argv[1]);$a=[];for($i=0;$i<$z->numFiles;$i++)$a[]=["name"=>$z->getNameIndex($i),"hash"=>hash("sha256",$z->getFromIndex($i))];echo json_encode($a);',out+'/client.zip'],{encoding:'utf8'});assert.equal(zipResult.status,0);
 const zipped=JSON.parse(zipResult.stdout),all=(await call(a,'submissions')).submissions;assert.equal(zipped.length,4);assert.equal(new Set(zipped.map(z=>z.name)).size,4);assert.deepEqual(zipped.map(z=>z.hash).sort(),all.filter(s=>!s.archived_at).map(s=>s.sha256).sort());
 const historyZip=await admin.request.get(base+'/api/portal.php?action=admin_zip&history=1&id='+accountA.id);await fs.writeFile(out+'/history.zip',await historyZip.body());const historyCount=spawnSync('php',['-r','$z=new ZipArchive();$z->open($argv[1]);echo $z->numFiles;',out+'/history.zip'],{encoding:'utf8'});assert.equal(historyCount.stdout,'6');assert.equal(stats.stats.active_submissions,4);
 checks.push('Account/admin previews, manual PDF upload, dashboard counts and ZIP exact-byte contents');
 // Edit a saved online form, keeping its old answers/signature and a separate working draft.
 const signatureOriginal=all.find(s=>s.doc_id==='signature-form');
 const original=(await call(a,'detail',null,200,{params:{id:signatureOriginal.id}})).submission;
 assert.equal(original.signatures.specimen,signature);
 await page.setViewportSize({width:1440,height:1100});
 await page.evaluate(id=>{const prefix='itqan.forms.v1.account.'+id+'.individual.';localStorage.setItem(prefix+'signature-form',JSON.stringify({values:{client_name:'Unsubmitted work'},step:0}));localStorage.setItem(prefix+'shared-fields',JSON.stringify({name_language:'en',en_first:'Different',en_last:'Profile',id_number:'999999'}));},accountA.id);
 await page.goto(base+'/account/?lang=en');await page.locator('[data-edit="'+signatureOriginal.id+'"]').click();await page.locator('.revision-banner').waitFor();
 await page.locator('[data-step="1"]').click();await page.locator('[data-signature-slot="specimen"] img').waitFor();assert.equal(await page.locator('[data-signature-mode="specimen"][value="electronic"]').isChecked(),true);assert.equal(await page.locator('[data-signature-slot="specimen"] img').getAttribute('src'),signature);
 await page.locator('[data-step="0"]').click();
 assert.equal(await page.locator('#f-client_name').inputValue(),original.answers.client_name);
 await page.locator('#f-client_name').fill('Updated client details');await page.reload();await page.locator('#f-client_name').waitFor();assert.equal(await page.locator('#f-client_name').inputValue(),'Updated client details');
 assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('itqan.forms.v1.account.'+id+'.individual.signature-form')).values.client_name,accountA.id),'Unsubmitted work');
 await page.locator('#review-tab').click();await page.locator('#submit-form').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.locator('.submission-dialog [data-close]').click();
 let versions=(await call(a,'submissions')).submissions;const updated=versions.find(s=>s.doc_id==='signature-form'&&!s.archived_at);assert.equal(updated.version,2);
 const revised=(await call(a,'detail',null,200,{params:{id:updated.id}})).submission;
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),'itqan.forms.v1.account.'+accountA.id+'.individual.revision.'+original.id+'.signature-form'),null);
 assert.equal(revised.answers.client_name,'Updated client details');assert.equal(revised.signatures.specimen,signature);assert.equal(revised.edited_from,original.id);
 const preserved=(await call(a,'detail',null,200,{params:{id:original.id}})).submission;assert.deepEqual(preserved.answers,original.answers);assert.equal(preserved.sha256,original.sha256);assert.ok(preserved.archived_at);
 assert.equal(versions.filter(s=>!s.archived_at).length,4);assert.equal(versions.filter(s=>s.doc_id==='subscription-company').length,1);
 await call(b,'detail',null,404,{params:{id:original.id}});await call(a,'admin_restore',{id:original.id,expectedCurrent:updated.id,requestKey:randomBytes(16).toString('hex')},401);
 // A stale edit cannot replace the latest version or leave an orphan PDF.
 const stale={account:accountA.id,document:'signature-form',audience:'individual',requestKey:randomBytes(16).toString('hex'),expectedCurrent:original.id,editedFrom:original.id,values:original.answers,signatures:original.signatures};
 const filesBefore=(await fs.readdir(out+'/data/pdfs')).length;assert.equal((await upload(a,stale,pdf,409)).error,'version_conflict');assert.equal((await fs.readdir(out+'/data/pdfs')).length,filesBefore);
 // Owner restores from history in the actual dashboard. Both old versions remain.
 await owner.reload();await owner.locator('[data-users]').first().click();await owner.locator('#client-search').waitFor();await owner.locator('[data-client="'+accountA.id+'"]').click();await owner.locator('.admin-history summary').click();
 await owner.locator('[data-restore="'+original.id+'"]').click();await owner.locator('[data-confirm-restore]').click();await owner.locator('.client-reset-dialog').waitFor({state:'detached'});await owner.locator('.admin-client-facts').waitFor();
 versions=(await call(a,'submissions')).submissions;const restored=versions.find(s=>s.doc_id==='signature-form'&&!s.archived_at);assert.equal(restored.version,3);assert.equal(restored.restored_from,original.id);assert.equal(restored.sha256,original.sha256);assert.equal(restored.replaces_id,updated.id);
 const restoredDetails=(await call(a,'detail',null,200,{params:{id:restored.id}})).submission;assert.deepEqual(restoredDetails.answers,original.answers);assert.deepEqual(restoredDetails.signatures,original.signatures);
 const restoreRequest={id:updated.id,expectedCurrent:restored.id,requestKey:randomBytes(16).toString('hex')};await call(admin,'admin_restore',restoreRequest,403,{headers:{'X-CSRF-Token':'wrong'}});
 const again=(await call(admin,'admin_restore',restoreRequest,201)).submission;assert.equal(again.version,4);assert.equal((await call(admin,'admin_restore',restoreRequest)).duplicate,true);
 assert.equal((await call(admin,'admin_restore',{...restoreRequest,requestKey:randomBytes(16).toString('hex')},409)).error,'version_conflict');
 // A replacement upload archives the active online version but leaves it editable in history.
 await page.goto(base+'/account/?lang=en');await page.locator('[data-replace="'+again.id+'"]').click();assert.equal(await page.locator('.portal-upload [name=document]').inputValue(),'signature-form');await page.locator('.portal-upload [name=pdf]').setInputFiles('public/pdfs/al-naeem-terms-consent.pdf');await page.locator('.portal-upload .primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});
 versions=(await call(a,'submissions')).submissions;const uploaded=versions.find(s=>s.doc_id==='signature-form'&&!s.archived_at);assert.equal(uploaded.version,5);assert.equal(uploaded.source,'upload');assert.equal(uploaded.replaces_id,again.id);assert.equal(await page.locator('[data-edit="'+uploaded.id+'"]').count(),0);
 // Same shared document in the other audience/account starts its own version chain.
 await setType(a,'corporate');await setType(b,'corporate');
 const separateMeta={account:accountA.id,document:'signature-form',audience:'corporate',requestKey:randomBytes(16).toString('hex'),expectedCurrent:null,values:{client_name:'Company only'}};
 const separate=(await upload(a,separateMeta)).submission;assert.equal(separate.version,1);
 const other=(await upload(b,{...separateMeta,account:accountB.id,requestKey:randomBytes(16).toString('hex')})).submission;assert.equal(other.version,1);
 await call(a,'detail',null,404,{params:{id:other.id}});
 await page.goto(base+'/account/?lang=en');await page.locator('.account-history summary').click();await page.screenshot({path:out+'/version-history-en.png',fullPage:true});
 await page.locator('#portal-language').click();await page.locator('html[lang=ar]').waitFor();await page.locator('.account-history summary').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/version-history-ar-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await owner.reload();await owner.locator('[data-users]').first().click();await owner.locator('#client-search').waitFor();await owner.locator('[data-client="'+accountA.id+'"]').click();await owner.locator('.admin-history summary').click();await owner.screenshot({path:out+'/admin-version-history.png',fullPage:true});
 for(const corporate of [false,true]){
  await setType(a,corporate?'corporate':'individual');
  const current=(await call(a,'submissions')).submissions.find(s=>s.doc_id===(corporate?'subscription-company':'subscription-form')&&!s.archived_at);
  await page.setViewportSize({width:1440,height:1100});await page.goto(base+'/account/?lang='+(!corporate?'ar':'en'));
  await page.locator('[data-edit="'+current.id+'"]').click();await page.locator('.revision-banner').waitFor();
  assert.equal(await page.locator('#sub-'+(corporate?'company_name':'first_name')).inputValue(),corporate?'Al Noor Investment Company':'Ahmad');
  await page.locator('[data-sub-step="2"]').click();await page.locator('#sub-units').fill(corporate?'12':'٢١');
  await page.locator('[data-review]').click();await page.locator('[data-submit]').waitFor();await page.locator('[data-submit]').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.locator('.submission-dialog [data-close]').click();
  const latest=(await call(a,'submissions')).submissions.find(s=>s.doc_id===current.doc_id&&!s.archived_at);
  assert.equal(latest.version,current.version+1);const detail=(await call(a,'detail',null,200,{params:{id:latest.id}})).submission;
  assert.equal(detail.answers.total_amount,corporate?'12240':'21420');assert.equal((await call(a,'detail',null,200,{params:{id:current.id}})).submission.sha256,current.sha256);
 }
 checks.push('Individual Arabic and company English subscription edits, recalculated amounts and prior-PDF preservation');
 const finalCount=(await call(a,'submissions')).submissions.length;
 checks.push('Client edit/resubmit and reload, separate working draft, signature recovery, immutable originals, archive dates, stale-edit rejection, owner restore, restore retry/CSRF, replacement upload and audience/account version isolation');
 await owner.locator('[data-reset]').click();await owner.locator('[data-generate]').click();await owner.locator('.temporary-password').waitFor();const temp=await owner.locator('.temporary-password').innerText();assert.ok(temp.length>=24&&/[a-z]/.test(temp)&&/[A-Z]/.test(temp)&&/[0-9]/.test(temp));await owner.locator('.client-reset-dialog [data-close]').click();
 await call(a,'submissions',null,401);await call(a,'session');await call(a,'login',{phone:'551111111',password},401);
 await page.goto(base+'/login/?lang=en');await page.locator('[name=phone]').fill('551111111');await page.locator('[name=password]').fill(temp);await page.locator('#auth-form [type=submit]').click();await page.waitForURL('**/my-applications/');await page.locator('#password-form').waitFor();
 await call(a,'session');await call(a,'submissions',null,403);
 await page.locator('[name=current]').fill(temp);await page.locator('[name=password]').fill('New-client-strong-2026!');await page.locator('[name=confirm]').fill('New-client-strong-2026!');await page.locator('#password-form .primary').click();await page.locator('.account-documents').waitFor();await call(a,'session');assert.equal((await call(a,'submissions')).submissions.length,finalCount);
 checks.push('Owner reset, strong one-time displayed password, old password/session revocation and mandatory change');
 // Arabic signup/login layout and password visibility, including mobile.
 const empty=await anon.newPage();empty.on('pageerror',e=>errors.push(e.message));await empty.goto(base+'/register/?lang=ar');await empty.locator('#auth-form').waitFor();await empty.screenshot({path:out+'/register-ar.png',fullPage:true});await empty.setViewportSize({width:390,height:844});await empty.screenshot({path:out+'/register-ar-mobile.png',fullPage:true});assert.equal(await empty.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await empty.goto(base+'/login/?lang=en');await empty.locator('#auth-form').waitFor();await empty.locator('[data-eye=password]').click();assert.equal(await empty.locator('[name=password]').getAttribute('type'),'text');await empty.screenshot({path:out+'/login-en-mobile.png',fullPage:true});
 await owner.locator('[data-admin-language]').click();await owner.locator('.client-management[dir=rtl]').waitFor();await owner.setViewportSize({width:390,height:844});await owner.screenshot({path:out+'/admin-client-ar-mobile.png',fullPage:true});assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.equal(await owner.locator('[data-documents],#upload,[data-move]').count(),0,'Ordinary admins cannot manage documents');await owner.locator('#client-dashboard').click();await owner.locator('.admin-stats').waitFor();
 for(let i=0;i<10;i++)await call(anon,'login',{phone:'559999999',password:'incorrect-password'},401);
 await call(anon,'login',{phone:'559999999',password:'incorrect-password'},429);
 assert.deepEqual(errors,[]);checks.push('Original side-by-side logos, My applications page in English/Arabic, compatible account links, mobile layouts, role-appropriate management navigation and persistent login throttling');
 await fs.writeFile(out+'/results.json',JSON.stringify({checks,submissions:finalCount,clients:2,consoleErrors:errors},null,2));console.log(checks.map(c=>'PASS '+c).join('\n'));
}finally{await browser?.close();server.kill();await log.close();}
