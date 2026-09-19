import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const out=path.resolve('tmp/portal-audit'),base='http://127.0.0.1:8187',ownerPassword=randomBytes(24).toString('base64url')+'aA7!',password='Client-testing-strong-2026!';
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
assert.equal(spawnSync('php',['scripts/management-init.php',out+'/management'],{input:ownerPassword}).status,0);
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
  const res=await ctx.request[options.multipart||data?'post':'get'](base+'/api/portal.php?'+new URLSearchParams({action,...options.params}),{...(data?{data}:{}),...(options.multipart?{multipart:options.multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)||'',...options.headers}});
  assert.equal(res.status(),expected,`${action}: ${await res.text()}`);const json=await res.json();if(json.csrf)tokens.set(ctx,json.csrf);return json;
 }
 await call(anon,'session');await call(anon,'submissions',null,401);await call(anon,'admin_dashboard',null,401);
 await call(anon,'register',{name:'Test',phone:'55535445',password,confirm:password},400);
 await call(anon,'register',{name:'Test',phone:'551111111',password,confirm:'different'},400);
 await call(anon,'register',{name:'Test',phone:'551111111',password,confirm:password},403,{headers:{'X-CSRF-Token':'wrong'}});
 checks.push('Anonymous access, CSRF, phone and confirmation validation');
 const page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/individuals/');
 await page.evaluate(()=>{localStorage.setItem('itqan.forms.v1.individual.signature-form',JSON.stringify({values:{client_name:'Guest retained',signer_name:'Ahmad Ali',date:'2026-09-19'},step:1}));localStorage.setItem('itqan.forms.v1.individual.preferences',JSON.stringify({lang:'en',active:'signature-form'}));});
 await page.goto(base+'/register/?lang=en&next=individuals&resume=1');await page.locator('#auth-form').waitFor();await page.screenshot({path:out+'/register-en.png',fullPage:true});
 await page.locator('[name=name]').fill('Ahmad Mohammed Ali');await page.locator('[name=phone]').fill('0551111111');await page.locator('[name=password]').fill(password);await page.locator('[name=confirm]').fill(password);await page.locator('#auth-form [type=submit]').click();await page.waitForURL('**/individuals/');
 const accountA=(await call(a,'session')).user;assert.equal(accountA.phone,'+966551111111');
 assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('itqan.forms.v1.account.'+id+'.individual.signature-form')).values.client_name,accountA.id),'Guest retained');
 assert.equal(await page.evaluate(()=>localStorage.getItem('itqan.forms.v1.individual.signature-form')),null);
 await call(b,'session');const accountB=(await call(b,'register',{name:'محمد أحمد القحطاني',phone:'٥٥٢٢٢٢٢٢٢',password,confirm:password},201)).user;
 await call(anon,'register',{name:'Duplicate',phone:'+966551111111',password,confirm:password},409);
 await call(a,'admin_dashboard',null,401);
 checks.push('English browser signup, Saudi phone normalization, account draft migration and duplicate phone');
 const pdf=await fs.readFile('public/pdfs/al-naeem-terms-consent.pdf');
 const upload=(ctx,meta,buffer=pdf,status=201)=>call(ctx,'submit',null,status,{multipart:{metadata:JSON.stringify(meta),pdf:{name:'signed.pdf',mimeType:'application/pdf',buffer}}});
 const metadata={account:accountA.id,document:'al-naeem-terms-consent',audience:'individual',requestKey:randomBytes(16).toString('hex'),source:'upload'};
 await upload(a,metadata,Buffer.from('not a pdf'),400);
 await upload(a,{...metadata,account:accountB.id},pdf,409);
 await upload(a,{...metadata,document:'nonexistent'},pdf,404);
 const first=(await upload(a,metadata)).submission;assert.equal((await upload(a,metadata,pdf,200)).duplicate,true);
 await call(b,'detail',null,404,{params:{id:first.id}});
 assert.equal((await b.request.get(base+'/api/portal.php?action=pdf&id='+first.id)).status(),404);
 assert.equal((await anon.request.get(base+'/api/portal.php?action=pdf&id='+first.id)).status(),401);
 assert.equal((await anon.request.get(base+'/_private/portal/clients.sqlite')).status(),404);
 checks.push('Private PDF storage, owner checks, malformed PDF rejection and duplicate submission protection');
 // Submit the unchanged signature form through its actual review UI.
 await page.reload();await page.locator('#review-tab').click();await page.locator('#submit-form').waitFor();
 await page.locator('#submit-form').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.locator('.submission-dialog [data-close]').click();
 for(const corporate of [false,true]){
  const audience=corporate?'corporate':'individual',folder=corporate?'companies':'individuals',doc=corporate?'subscription-company':'subscription-form';
  const values={first_name:'Ahmad',second_name:'Mohammed',family_name:'Ali',company_name:'Al Noor Investment Company',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name:'Ahmad Mohammed Ali',nationality:'Saudi Arabia',id_type:'national',id_number:'1000012345',mobile:'+966551111111',short_address:'RABC1234',building:'1234',street:'King Fahd Road',additional:'5678',district:'Al Olaya',postal:'12345',city:'Riyadh',country:'المملكة العربية السعودية',email:'client@example.com',units:'10',subscription_type:'new',payment_method:'transfer',applicant_name:'Ahmad Mohammed Ali',date:'2026-09-19',signature_mode:'manual'};
  await page.evaluate(({id,audience,doc,values})=>{const prefix='itqan.forms.v1.account.'+id+'.'+audience+'.';localStorage.setItem(prefix+doc,JSON.stringify({values,step:3}));localStorage.setItem(prefix+'preferences',JSON.stringify({lang:'en',active:doc}));},{id:accountA.id,audience,doc,values});
  await page.goto(base+'/'+folder+'/');await page.locator('#sub-next').click();await page.locator('[data-submit]').waitFor();
  await page.locator('[data-submit]').click();await page.locator('[data-confirm]').click();await page.locator('.submitted-mark').waitFor();await page.screenshot({path:out+'/'+audience+'-submitted.png',fullPage:true});await page.locator('.submission-dialog [data-close]').click();
 }
 const submissions=(await call(a,'submissions')).submissions;assert.equal(submissions.length,4);
 const sub=submissions.find(s=>s.doc_id==='subscription-form'),details=(await call(a,'detail',null,200,{params:{id:sub.id}})).submission;
 assert.equal(details.answers.total_amount,'10200');assert.equal(details.answers.subscription_fee,'200');assert.equal(details.answers.total_words,'عشرة آلاف ومائتا ريال سعودي');
 assert.equal((await call(a,'submissions')).user.email,'client@example.com');
 // Server ignores forged read-only amounts even when metadata is posted outside the UI.
 const subscriptionPDF=await a.request.get(base+'/api/portal.php?action=pdf&id='+sub.id);
 const forged={account:accountA.id,document:'subscription-form',audience:'individual',requestKey:randomBytes(16).toString('hex'),values:{...details.answers,total_amount:'1',subscription_fee:'0',unit_price:'1'}};
 const forgedResult=await upload(a,forged,await subscriptionPDF.body());const canonical=(await call(a,'detail',null,200,{params:{id:forgedResult.submission.id}})).submission;assert.equal(canonical.answers.total_amount,'10200');
 checks.push('Signature and both subscription UI submissions, server totals and optional email capture');
 await page.goto(base+'/account/');await page.locator('.client-submission').first().waitFor();await page.screenshot({path:out+'/account-en.png',fullPage:true});
 await page.locator('[data-preview]').first().click();await page.locator('.portal-pdf-pages canvas').first().waitFor();await page.waitForFunction(()=>document.querySelector('.portal-pdf-pages canvas')?.width>100);await page.screenshot({path:out+'/client-preview.png',fullPage:true});await page.locator('.portal-preview [data-close]').click();
 await page.locator('#upload-completed').click();await page.locator('.portal-upload [name=document]').selectOption('al-naeem-terms-consent');await page.locator('.portal-upload [name=pdf]').setInputFiles('public/pdfs/al-naeem-terms-consent.pdf');await page.locator('.portal-upload .primary').click();await page.locator('.portal-upload').waitFor({state:'detached'});assert.equal(await page.locator('.client-submission').count(),6);
 await page.locator('#portal-language').click();await page.locator('html[lang=ar]').waitFor();await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/account-ar-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 // Admin uses the existing owner login and session, never a client cookie.
 const owner=await admin.newPage();owner.on('pageerror',e=>errors.push(e.message));await owner.goto(base+'/management/');await owner.locator('#password').fill(ownerPassword);await owner.locator('#login button').click();await owner.locator('.admin-stats').waitFor();
 const managementSession=await (await admin.request.get(base+'/api/management.php?action=session')).json();tokens.set(admin,managementSession.csrf);
 const stats=await call(admin,'admin_dashboard');assert.equal(stats.stats.users,2);assert.equal(stats.stats.submissions,6);assert.equal(stats.stats.submitted_users,1);assert.equal(stats.counts.find(c=>c.doc_id==='signature-form').count,1);
 await owner.screenshot({path:out+'/admin-overview-en.png',fullPage:true});await owner.locator('[data-users]').first().click();await owner.locator('#client-search').waitFor();await owner.locator('[data-client="'+accountA.id+'"]').click();await owner.locator('.admin-client-facts').waitFor();await owner.screenshot({path:out+'/admin-client-en.png',fullPage:true});
 await owner.locator('[data-preview]').first().click();await owner.locator('.portal-pdf-pages canvas').first().waitFor();await owner.locator('.portal-preview [data-close]').click();
 const zip=await admin.request.get(base+'/api/portal.php?action=admin_zip&id='+accountA.id);assert.equal(zip.status(),200);assert.ok(zip.headers()['content-disposition'].includes('Ahmad%20Mohammed%20Ali.zip'));await fs.writeFile(out+'/client.zip',await zip.body());
 const zipResult=spawnSync('php',['-r','$z=new ZipArchive();$z->open($argv[1]);$a=[];for($i=0;$i<$z->numFiles;$i++)$a[]=["name"=>$z->getNameIndex($i),"hash"=>hash("sha256",$z->getFromIndex($i))];echo json_encode($a);',out+'/client.zip'],{encoding:'utf8'});assert.equal(zipResult.status,0);
 const zipped=JSON.parse(zipResult.stdout),all=(await call(a,'submissions')).submissions;assert.equal(zipped.length,6);assert.equal(new Set(zipped.map(z=>z.name)).size,6);assert.deepEqual(zipped.map(z=>z.hash).sort(),all.map(s=>s.sha256).sort());
 checks.push('Account/admin previews, manual PDF upload, dashboard counts and ZIP exact-byte contents');
 await owner.locator('[data-reset]').click();await owner.locator('[data-generate]').click();await owner.locator('.temporary-password').waitFor();const temp=await owner.locator('.temporary-password').innerText();assert.ok(temp.length>=24&&/[a-z]/.test(temp)&&/[A-Z]/.test(temp)&&/[0-9]/.test(temp));await owner.locator('.client-reset-dialog [data-close]').click();
 await call(a,'submissions',null,401);await call(a,'session');await call(a,'login',{phone:'551111111',password},401);
 await page.goto(base+'/login/?lang=en');await page.locator('[name=phone]').fill('551111111');await page.locator('[name=password]').fill(temp);await page.locator('#auth-form [type=submit]').click();await page.waitForURL('**/account/');await page.locator('#password-form').waitFor();
 await call(a,'session');await call(a,'submissions',null,403);
 await page.locator('[name=current]').fill(temp);await page.locator('[name=password]').fill('New-client-strong-2026!');await page.locator('[name=confirm]').fill('New-client-strong-2026!');await page.locator('#password-form .primary').click();await page.locator('.account-documents').waitFor();await call(a,'session');assert.equal((await call(a,'submissions')).submissions.length,6);
 checks.push('Owner reset, strong one-time displayed password, old password/session revocation and mandatory change');
 // Arabic signup/login layout and password visibility, including mobile.
 const empty=await anon.newPage();empty.on('pageerror',e=>errors.push(e.message));await empty.goto(base+'/register/?lang=ar');await empty.locator('#auth-form').waitFor();await empty.screenshot({path:out+'/register-ar.png',fullPage:true});await empty.setViewportSize({width:390,height:844});await empty.screenshot({path:out+'/register-ar-mobile.png',fullPage:true});assert.equal(await empty.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await empty.goto(base+'/login/?lang=en');await empty.locator('#auth-form').waitFor();await empty.locator('[data-eye=password]').click();assert.equal(await empty.locator('[name=password]').getAttribute('type'),'text');await empty.screenshot({path:out+'/login-en-mobile.png',fullPage:true});
 await owner.locator('[data-admin-language]').click();await owner.locator('.client-management[dir=rtl]').waitFor();await owner.setViewportSize({width:390,height:844});await owner.screenshot({path:out+'/admin-client-ar-mobile.png',fullPage:true});assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await owner.locator('[data-documents]').click();await owner.locator('#upload').waitFor();await owner.locator('#client-dashboard').click();await owner.locator('.admin-stats').waitFor();
 for(let i=0;i<10;i++)await call(anon,'login',{phone:'559999999',password:'incorrect-password'},401);
 await call(anon,'login',{phone:'559999999',password:'incorrect-password'},429);
 assert.deepEqual(errors,[]);checks.push('English/Arabic mobile layouts, existing catalogue navigation and persistent login throttling');
 await fs.writeFile(out+'/results.json',JSON.stringify({checks,submissions:6,clients:2,consoleErrors:errors},null,2));console.log(checks.map(c=>'PASS '+c).join('\n'));
}finally{await browser?.close();server.kill();await log.close();}
