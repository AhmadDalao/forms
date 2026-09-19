// Submitted snapshot regression against isolated local storage only.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {sharedGroups,cleanShared} from '../src/shared-fields.js';

const root=process.cwd(),out=path.resolve(process.env.QA_OUT||'tmp/submission-details-audit'),port=Number(process.env.QA_PORT||8203),base=`http://127.0.0.1:${port}`;
assert.ok(out.startsWith(path.resolve('tmp')+path.sep));assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
await fs.mkdir(out,{recursive:true});const run=path.join(out,'run-'+Date.now()),management=path.join(run,'management'),data=path.join(run,'data');
const credentials={admin:{username:'qa.admin',password:randomBytes(24).toString('base64url')+'aA7!'},superadmin:{username:'superadmin',password:randomBytes(24).toString('base64url')+'aA7!'}};
for(const [role,file] of [['admin','management-init.php'],['superadmin','management-superadmin-init.php']]){const r=spawnSync('php',[`scripts/${file}`,management,credentials[role].username],{input:credentials[role].password,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
const log=await fs.open(path.join(run,'php.log'),'w'),server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S',`127.0.0.1:${port}`,'-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:management,FORMS_PORTAL_DATA_DIR:data},stdio:['ignore',log.fd,log.fd]});
const tokens=new WeakMap(),checks=[],errors=[],screenshots=[],saved=[],clients=[];let browser;
const hash=b=>createHash('sha256').update(b).digest('hex');
const pass=s=>{checks.push(s);console.log('PASS '+s);};
async function api(ctx,area,action,{data:body,multipart,status=200,params={}}={}){
 const response=await ctx.request[body||multipart?'post':'get'](`${base}/api/${area}.php?${new URLSearchParams({action,...params})}`,{...(body?{data:body}:{}),...(multipart?{multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)?.[area]||''}});
 const text=await response.text();assert.equal(response.status(),status,`${area}/${action}: ${text}`);const result=JSON.parse(text);if(result.csrf)tokens.set(ctx,{...tokens.get(ctx),[area]:result.csrf});return result;
}
const mg=(ctx,action,opts)=>api(ctx,'management',action,opts),portal=(ctx,action,opts)=>api(ctx,'portal',action,opts);
const detail=async(ctx,id,admin=true)=>(await portal(ctx,admin?'admin_detail':'detail',{params:{id}})).submission;
async function login(ctx,role){await mg(ctx,'session');const session=await mg(ctx,'login',{data:credentials[role]});tokens.set(ctx,{...tokens.get(ctx),portal:session.csrf});}
async function shot(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file});screenshots.push(file);}
function database(id){const r=spawnSync('php',['-r','$db=new PDO("sqlite:".$argv[1]);$s=$db->prepare("SELECT * FROM submissions WHERE id=?");$s->execute([$argv[2]]);echo json_encode($s->fetch(PDO::FETCH_ASSOC),JSON_UNESCAPED_UNICODE);',path.join(data,'clients.sqlite'),id],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
function snapshot(s){return {answers:s.answers,profile:s.profile,signatures:s.signatures,sha256:s.sha256};}
function profileFor(audience){
 const p={};for(const [i,f] of sharedGroups(audience).flatMap(g=>g.fields).entries())p[f.id]=f.type==='checkbox'?i%2===0:f.type==='email'?`${audience}.snapshot@example.com`:f.type==='date'?'1990-03-04':f.type==='tel'?'+966551234567':f.options?f.options[0][0]:`${audience==='individual'?'فرد':'شركة'} ${f.id} QA`;
 if(audience==='individual')Object.assign(p,{name_language:'ar',en_first:'Ahmad',en_second:'Ali',en_third:'',en_last:'Snapshot',ar_first:'أحمد',ar_second:'علي',ar_third:'',ar_last:'الاختبار',id_type:'other',id_other:'QA Identity',also_residence:false});
 else Object.assign(p,{company_name:'شركة الاختبار QA Company',auth_id_type:'other',auth_id_other:'QA Authorized Identity',also_residence:true,also_head:false,also_mail:true});
 return p;
}
function valuesFor(def){
 const values={};for(const [i,f] of def.fields.entries())values[f.id]=f.selectOptions?f.selectOptions[0][0]:f.options?(f.multiple?f.options.slice(0,2).map(o=>o.value):f.options[0].value):f.type==='date'?'2026-09-19':f.type==='email'?'form.snapshot@example.com':f.type==='tel'?'+966559876543':i%9===0?'':i%7===0?'0':i%2?`Arabic English ${i}`:`بيانات الاختبار ${i}`;
 for(const field of def.fields)if(field.join)values[field.id]=field.join.map(id=>values[id]?.trim()).filter(Boolean).join(' ');
 return values;
}
async function assertStored(s,expected){
 const row=database(s.id);assert.deepEqual(JSON.parse(row.answers),s.answers);assert.deepEqual(JSON.parse(row.profile),s.profile);assert.deepEqual({...JSON.parse(row.signatures)},{...s.signatures});
 assert.equal(row.sha256,s.sha256);assert.equal(hash(await fs.readFile(path.join(data,'pdfs',s.id+'.pdf'))),s.sha256);
 if(expected)assert.deepEqual(snapshot(s),expected);
}
async function assertDisplayed(page,s,lang,rootSelector='[data-submitted-version]'){
 const root=page.locator(rootSelector);await root.waitFor();
 const rows=await root.locator('[data-answer-field]').evaluateAll(els=>els.map(el=>({id:el.dataset.answerField,text:el.textContent,value:el.querySelector('dd')?.textContent,dir:el.querySelector('dd')?.getAttribute('dir'),bidi:el.querySelector('dd')?getComputedStyle(el.querySelector('dd')).unicodeBidi:null})));
 const definitions=s.profile.field_definitions||[];
 if(s.source!=='upload'){
  const expected=new Set([...definitions.map(f=>f.id),...Object.keys(s.answers)]);
  assert.equal(rows.length,expected.size,'Every stored or defined field should appear exactly once');
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'Duplicate submitted detail rows');
 }
 if(s.source==='upload')assert.equal(rows.length,0,'PDF-only upload must not pretend to have online answers');
 else for(const f of definitions){
  const row=rows.find(r=>r.id===f.id);assert.ok(row,`Missing form field ${f.id}`);assert.ok(row.text.includes(lang==='ar'?f.ar||f.label:f.label||f.ar),`Missing saved field label ${f.id}`);
  const raw=s.answers[f.id];if(raw===undefined||raw===''||Array.isArray(raw)&&!raw.length)continue;
  const vals=Array.isArray(raw)?raw:[raw];for(const v of vals){const option=f.selectOptions?.find(o=>o[0]===v)||f.options?.find(o=>o.value===v);const expected=Array.isArray(option)?option[lang==='ar'?2:1]:option?(lang==='ar'?option.ar:option.label):String(v);assert.ok(row.text.includes(expected),`${f.id} value missing: ${expected}`);}
  if(f.type==='email')assert.equal(row.dir,'ltr','Email must remain LTR');
  if(row.dir==='ltr')assert.equal(row.bidi,'isolate','Mixed text must not override explicit LTR identifiers');
 }
 const shared=await root.locator('[data-shared-field]').evaluateAll(els=>els.map(el=>({id:el.dataset.sharedField,text:el.textContent})));
 for(const f of s.profile.shared_field_definitions||[])if(Object.hasOwn(s.profile,f.id)){
  const row=shared.find(r=>r.id===f.id);assert.ok(row,'Missing shared snapshot '+f.id);assert.ok(row.text.includes(lang==='ar'?f.ar:f.label));
 }
 for(const [id,image] of Object.entries(s.signatures||{})){const img=root.locator(`[data-signature-slot="${id}"] img`);assert.equal(await img.getAttribute('src'),image);}
 assert.equal(await page.locator('script[data-audit-injected],img[data-audit-injected]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
}
try{
 let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/portal.php')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:'chrome',headless:true});const admin=await browser.newContext(),superadmin=await browser.newContext(),anon=await browser.newContext();await login(admin,'admin');await login(superadmin,'superadmin');await portal(anon,'session');
 const canvasPage=await browser.newPage();const signature=await canvasPage.evaluate(()=>{const c=document.createElement('canvas');c.width=180;c.height=60;const ctx=c.getContext('2d');ctx.font='italic 24px serif';ctx.fillText('QA Snapshot',4,40);return c.toDataURL();});await canvasPage.close();
 const defs=JSON.parse(await fs.readFile('dist/api/portal-defaults.json','utf8')),source=await fs.readFile('public/pdfs/signature-form.pdf');
 for(const audience of ['individual','corporate']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),password=randomBytes(24).toString('base64url')+'aA7!';await portal(ctx,'session');const user=(await portal(ctx,'register',{status:201,data:{first_name:audience==='individual'?'Individual':'Company',last_name:'Snapshot QA',phone:'59'+String(Math.floor(Math.random()*1e7)).padStart(7,'0'),password,confirm:password,account_type:audience}})).user;
  const client={ctx,user,password,profile:profileFor(audience),audience,records:[]};clients.push(client);
  client.submit=async(document,values,extra={})=>{
   const meta={account:user.id,document,audience,requestKey:randomUUID(),expectedCurrent:null,values,profile:client.profile,signatures:{},...extra};
   const result=await portal(ctx,'submit',{status:201,multipart:{metadata:JSON.stringify(meta),pdf:{name:'snapshot.pdf',mimeType:'application/pdf',buffer:source}}});const s=await detail(admin,result.submission.id);await assertStored(s);client.records.push(s);saved.push(s);return s;
  };
  const id=audience==='individual'?'kyc-individual':'kyc-corporate',values=valuesFor(defs[id]);values.email='visible.ltr@example.com';values[audience==='individual'?'name_1':'company']='<img data-audit-injected src=x onerror="alert(1)"> أحمد QA';
  const images=Object.fromEntries(defs[id].signatureSlots.map(slot=>[slot.id,signature]));
  const generic=await client.submit(id,values,{signatures:images,profile:{...client.profile,...(audience==='individual'?{company_name:'MUST NOT LEAK'}:{en_first:'MUST NOT LEAK'}),field_definitions:[{id:'forged',label:'Untrusted definition'}]}});
  assert.deepEqual(generic.answers,values);assert.equal(generic.profile.submission_schema,2);assert.equal(generic.profile.field_definitions.some(f=>f.id==='forged'),false);
  assert.equal(generic.profile[audience==='individual'?'company_name':'en_first'],undefined);
  for(const [key,value] of Object.entries(client.profile))assert.deepEqual(generic.profile[key],value,`${audience} profile ${key}`);
  assert.ok(generic.profile.section_definitions.length>1);assert.equal(generic.profile.field_definitions.length,defs[id].fields.length);client.generic=generic;
  const subscriptionId=audience==='individual'?'subscription-form':'subscription-company',subscription=valuesFor(defs[subscriptionId]);
  Object.assign(subscription,{first_name:'أحمد',second_name:'علي',third_name:'',family_name:'الاختبار',nationality:'Saudi Arabia',id_type:'national',id_number:'1000012345',company_name:'شركة الاختبار QA Company',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name:'Ahmad Snapshot',subscription_type:'new',payment_method:'transfer',units:audience==='individual'?'10':'12',unit_price:'1',investment_amount:'1',subscription_fee:'1',total_amount:'1',total_words:'FORGED',applicant_name:'Ahmad علي Snapshot',date:'2026-09-19',signature_mode:'electronic'});
  const subscriptionResult=await client.submit(subscriptionId,subscription,{signatures:{applicant:signature}});assert.equal(subscriptionResult.answers.unit_price,'1000');assert.equal(subscriptionResult.answers.total_amount,audience==='individual'?'10200':'12240');assert.equal(subscriptionResult.answers.subscription_fee,audience==='individual'?'200':'240');assert.notEqual(subscriptionResult.answers.total_words,'FORGED');client.subscription=subscriptionResult;
  const pdfOnly=await client.submit('al-naeem-terms-consent',{name:'Must not be extracted'},{source:'upload',signedConfirmed:true,signatures:{specimen:signature}});assert.deepEqual(pdfOnly.answers,[]);assert.deepEqual(pdfOnly.signatures,[]);assert.equal(pdfOnly.profile.signed_confirmed,true);client.pdfOnly=pdfOnly;
  const updated=await client.submit(id,{...values,email:'changed@example.com'},{expectedCurrent:generic.id,editedFrom:generic.id,profile:{...client.profile,city:'Changed city'},signatures:images});
  await assertStored(await detail(admin,generic.id),snapshot(generic));
  const restoredId=(await portal(superadmin,'admin_restore',{status:201,data:{id:generic.id,expectedCurrent:updated.id,requestKey:randomUUID()}})).submission.id;
  const restored=await detail(admin,restoredId);await assertStored(restored,snapshot(generic));client.records.push(restored);saved.push(restored);client.restored=restored;
  for(const docId of ['signature-form','terms-and-conditions',audience==='individual'?'fatca-crs-individual':'fatca-crs-corporate']){
   const document=defs[docId],answers=valuesFor(document),signatures=Object.fromEntries(document.signatureSlots.map(slot=>[slot.id,signature]));
   const complete=await client.submit(docId,answers,{signatures});assert.deepEqual(complete.answers,answers);
   assert.equal(complete.profile.field_definitions.length,document.fields.length);
   assert.equal(new Set(complete.profile.field_definitions.map(f=>f.id)).size,document.fields.length);
   await assertStored(complete);
  }
 }
 pass('All eight editable built-in documents: every field, choice array, blank, zero, full audience-specific shared profile and signature saved in actual SQLite/PDF storage; both subscription totals recalculated by server');
 pass('Editing archives original answers/profile/signatures/PDF; management restoration copies the exact original snapshot');
 for(const c of clients)for(const s of c.records){await portal(clients.find(x=>x!==c).ctx,'detail',{params:{id:s.id},status:404});await portal(anon,'admin_detail',{params:{id:s.id},status:401});assert.equal((await clients.find(x=>x!==c).ctx.request.get(`${base}/api/portal.php?action=pdf&id=${s.id}`)).status(),404);}
 pass('Cross-client access and anonymous management snapshot access rejected');

 // Trusted labels are frozen with each custom-document submission, including choices.
 const pdf=await PDFDocument.create();pdf.addPage([595,842]).drawText('Snapshot label fixture',{x:40,y:790});const customBytes=Buffer.from(await pdf.save());let state=await mg(superadmin,'state');
 const fields=[{id:'custom_name',page:1,label:'Original full name',ar:'الاسم الكامل الأصلي',type:'text',rect:[60,90,200,20]},{id:'custom_number',page:1,label:'Original number',ar:'الرقم الأصلي',type:'text',rect:[60,130,200,20]},{id:'custom_choices',page:1,label:'Original choices',ar:'الاختيارات الأصلية',type:'choice',multiple:true,options:[{value:'one',label:'Original One',ar:'الأول الأصلي',rect:[60,180,12,12]},{value:'two',label:'Original Two',ar:'الثاني الأصلي',rect:[90,180,12,12]}]}];
 state=await mg(superadmin,'upload',{multipart:{revision:String(state.revision),metadata:JSON.stringify({title:'Snapshot custom document',ar:'مستند حفظ البيانات',group:'shared',pageSizes:[[595,842]],fields,signatures:[{id:'custom_signature',page:1,label:'Signature',ar:'التوقيع',rect:[60,220,180,60]}],description:'',arDescription:''}),pdf:{name:'custom.pdf',mimeType:'application/pdf',buffer:customBytes}}});const custom=state.draft.documents.at(-1);state=await mg(superadmin,'review',{data:{revision:state.revision,id:custom.id}});state=await mg(superadmin,'publish',{data:{revision:state.revision}});
 const customOld=await clients[0].submit(custom.id,{custom_name:'أحمد Original',custom_number:'0',custom_choices:['one','two']},{signatures:{custom_signature:signature}});
 const row=state.draft.documents.find(d=>d.id===custom.id);row.title='Renamed catalogue document';row.ar='مستند أعيدت تسميته';for(const field of row.fields){field.label='Changed '+field.label;field.ar='جديد '+field.ar;for(const option of field.options||[]){option.label='Changed '+option.label;option.ar='جديد '+option.ar;}}
 state=await mg(superadmin,'save',{data:{revision:state.revision,draft:state.draft}});state=await mg(superadmin,'review',{data:{revision:state.revision,id:custom.id}});state=await mg(superadmin,'publish',{data:{revision:state.revision}});
 const customNew=await clients[0].submit(custom.id,{custom_name:'New content',custom_number:'',custom_choices:['two']},{expectedCurrent:customOld.id,editedFrom:customOld.id,signatures:{custom_signature:signature}});
 assert.ok(customNew.profile.field_definitions[0].label.startsWith('Changed'));await assertStored(await detail(admin,customOld.id),snapshot(customOld));clients[0].customOld=customOld;clients[0].customNew=customNew;
 pass('Catalogue title/label/option changes cannot rewrite prior custom-document snapshots');

 // One real customer form submission also checks the browser passes the full shared profile.
 const c=clients[0],customerPage=await c.ctx.newPage();customerPage.on('pageerror',e=>errors.push(e.message));await customerPage.goto(base+'/individuals/');
 const uiValues={client_name:'أحمد علي الاختبار',client_number:'123',account_number:'456',date:'2026-09-19',signer_name:'Ahmad Ali',id_type:'Passport',id_number:'1000012345',phone:'+966551234567'};
 await customerPage.evaluate(({id,profile,values,signature})=>{const prefix=`itqan.forms.v1.account.${id}.individual.`;localStorage.setItem(prefix+'shared-fields',JSON.stringify(profile));localStorage.setItem(prefix+'signature-form',JSON.stringify({values,signatures:{specimen:signature},signatureModes:{specimen:'electronic'},step:1}));localStorage.setItem(prefix+'preferences',JSON.stringify({lang:'en',active:'signature-form'}));},{id:c.user.id,profile:cleanShared('individual',c.profile),values:uiValues,signature});
 await customerPage.goto(base+'/individuals/?shared=1');await customerPage.locator('#shared-also_residence').check();await customerPage.locator('#shared-also_residence').uncheck();await customerPage.reload();assert.equal(await customerPage.locator('#shared-also_residence').isChecked(),false);
 assert.equal(await customerPage.evaluate(id=>JSON.parse(localStorage.getItem(`itqan.forms.v1.account.${id}.individual.shared-fields`)).also_residence,c.user.id),false);
 await customerPage.goto(base+'/individuals/');await customerPage.locator('#review-tab').click();await customerPage.locator('#submit-form').click();await customerPage.locator('[data-confirm]').click();await customerPage.locator('.submitted-mark').waitFor();await customerPage.locator('.submission-dialog [data-close]').click();
 const uiId=(await portal(c.ctx,'submissions')).submissions.find(s=>s.doc_id==='signature-form').id,uiSaved=await detail(admin,uiId);await assertStored(uiSaved);assert.equal(uiSaved.profile.en_second,'Ali');assert.equal(uiSaved.profile.ar_first,'أحمد');assert.equal(uiSaved.profile.additional,c.profile.additional);assert.equal(uiSaved.profile.also_residence,false);assert.equal(uiSaved.signatures.specimen,signature);c.records.push(uiSaved);saved.push(uiSaved);
 await customerPage.evaluate(()=>localStorage.clear());await customerPage.close();
 pass('Actual browser checkbox uncheck survives reload and submit as false; full shared data/signature remains in management after browser storage is cleared');

 for(const [engine,name,options] of [[chromium,'chrome',{channel:'chrome'}],[firefox,'firefox',{}],[webkit,'webkit',{}]]){
  if(process.env.BROWSERS&&!process.env.BROWSERS.split(',').includes(name))continue;const engineBrowser=await engine.launch({headless:true,...options});
  try{for(const role of ['admin','superadmin']){
   const ctx=await engineBrowser.newContext({viewport:{width:1440,height:1000}});await login(ctx,role);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const lang of ['en','ar'])for(const width of name==='chrome'?[1440,390,320]:[390]){
    await page.setViewportSize({width,height:1000});await page.goto(base+'/management/');await page.locator('[data-management-view=users]').click();if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('[data-admin-language]').click();await page.locator('#client-search').waitFor();
    for(const client of clients){
     await page.locator(`[data-client="${client.user.id}"]`).click();await page.locator('#client-submitted-details').waitFor();
     const versions=await page.locator('#submitted-version option').evaluateAll(els=>els.map(el=>el.value));const records=client===c?[client.restored,client.generic,client.subscription,client.pdfOnly,customOld,customNew,uiSaved]:[client.restored,client.generic,client.subscription,client.pdfOnly];
     for(const s of records){assert.ok(versions.includes(s.id),'Missing current/archive version option');await page.locator('#submitted-version').selectOption(s.id);await page.locator(`[data-submitted-version="${s.id}"]`).waitFor();await assertDisplayed(page,s,lang);}
     if(name==='chrome'&&role==='admin'&&client===c){await page.locator('#submitted-version').selectOption(customOld.id);await page.locator(`[data-submitted-version="${customOld.id}"]`).waitFor();await page.locator('#client-submitted-details').evaluate(el=>el.scrollIntoView({block:'start'}));await shot(page,`client-snapshot-${lang}-${width}`);}
     await page.locator('[data-management-view=users]').click();await page.locator('#client-search').waitFor();
    }
   }
   await ctx.close();pass(`${name} ${role}: all stored values, original labels, choice text, shared fields/signatures, blanks and version selection visible directly in EN/AR responsive client profiles`);
  }}finally{await engineBrowser.close();}
 }
 // Own-client preview uses the same saved data; no extraction is claimed for uploaded PDFs.
 const own=await c.ctx.newPage();own.on('pageerror',e=>errors.push(e.message));await own.goto(base+'/my-applications/?lang=ar');await own.locator(`[data-preview="${uiSaved.id}"]`).click();await own.locator('.portal-answer-details[open]').waitFor();await assertDisplayed(own,uiSaved,'ar','.portal-answer-details');await own.locator('.portal-preview [data-close]').click();
 await own.locator(`[data-preview="${c.pdfOnly.id}"]`).click();await own.locator('.portal-answer-details[open]').waitFor();await assertDisplayed(own,c.pdfOnly,'ar','.portal-answer-details');await shot(own,'uploaded-pdf-details-ar');await own.close();
 pass('Own-client preview reuses saved snapshots; uploaded PDFs display no fabricated online answers');
 const stats=(await portal(admin,'admin_dashboard')).stats;assert.equal(stats.submissions,saved.length);assert.equal(stats.users,2);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:true,date:new Date().toISOString(),checks,errors,screenshots,counts:{submittedVersions:saved.length,currentForms:stats.active_submissions,clients:stats.users,answerEntries:saved.reduce((n,s)=>n+Object.keys(s.answers).length,0)},database:path.join(data,'clients.sqlite')},null,2));
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,errors},null,2));throw error;}
finally{await browser?.close();server.kill();await log.close();}
