import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const out=path.resolve(process.env.QA_OUT||'tmp/account-types/audit'),base=process.env.QA_BASE||'http://127.0.0.1:8198';
const remote=!!process.env.QA_BASE,credentials=remote?JSON.parse(await fs.readFile(process.env.QA_CREDENTIALS,'utf8')):{username:'qa.manager',password:randomBytes(24).toString('base64url')+'aA7!'};
if(!remote){assert.ok(out.startsWith(path.resolve('tmp')+path.sep));await fs.rm(out,{recursive:true,force:true});}
await fs.mkdir(out,{recursive:true});
let server,browser;const checks=[],errors=[],accounts=[];
if(!remote){
 assert.equal(spawnSync('php',['scripts/management-init.php',out+'/management',credentials.username],{input:credentials.password}).status,0);
 const log=await fs.open(out+'/server.log','w');
 server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8198','-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:out+'/management',FORMS_PORTAL_DATA_DIR:out+'/data'},stdio:['ignore',log.fd,log.fd]});
}
let clients=[];
const remember=async u=>{if(u&&!accounts.some(a=>a.id===u.id)){accounts.push({id:u.id,name:u.name,phone:u.phone});await fs.writeFile(out+'/test-accounts.json',JSON.stringify(accounts),{mode:0o600});}};
try{
 for(let n=0;n<50;n++){try{if((await fetch(base+'/api/portal.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const manager=await browser.newContext(),anon=await browser.newContext(),tokens=new Map();
 async function call(ctx,action,data,status=200,options={}){
  const r=await ctx.request[options.multipart||data?'post':'get'](base+'/api/portal.php?'+new URLSearchParams({action,...options.params}),{...(data?{data}:{}),...(options.multipart?{multipart:options.multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)||'',...options.headers}});
  const body=await r.text();assert.equal(r.status(),status,action+': '+body);const json=JSON.parse(body);if(json.csrf)tokens.set(ctx,json.csrf);return json;
 }
 const ms=await(await manager.request.get(base+'/api/management.php?action=session')).json();
 assert.equal((await manager.request.post(base+'/api/management.php?action=login',{data:credentials,headers:{'X-CSRF-Token':ms.csrf}})).status(),200);
 tokens.set(manager,(await(await manager.request.get(base+'/api/management.php?action=session')).json()).csrf);
 const baseline=(await call(manager,'admin_dashboard')).stats;
 await fs.writeFile(out+'/baseline.json',JSON.stringify(baseline),{mode:0o600});
 await call(anon,'session');
 const password=randomBytes(24).toString('base64url')+'aA7!',phone=()=> '59'+String(Math.floor(Math.random()*1e7)).padStart(7,'0');
 for(const account_type of [undefined,'both','admin']){
  const result=await call(anon,'register',{first_name:'QA',last_name:'Invalid',phone:phone(),password,confirm:password,account_type},400);assert.equal(result.error,'account_type_invalid');
 }
 await call(anon,'admin_account_type',{id:'a'.repeat(32),account_type:'corporate',expected_type:'individual'},401);
 const source=await fs.readFile('public/pdfs/al-naeem-terms-consent.pdf'),digest=b=>createHash('sha256').update(b).digest('hex');
 for(const [type,lang] of [['individual','en'],['corporate','ar']]){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});clients.push(ctx);
  const p=await ctx.newPage();p.on('pageerror',err=>errors.push(err.message));
  // A stale/opposite next link cannot choose the account category.
  const folder=type==='individual'?'individuals':'companies',opposite=type==='individual'?'companies':'individuals';
  await p.goto(base+'/register/?lang='+lang+'&next='+opposite+'&resume=1');await p.locator('#auth-form').waitFor();
  assert.equal(await p.locator('[name=account_type]').count(),2);
  assert.equal(await p.locator('#auth-form').evaluate(f=>f.checkValidity()),false);
  await p.locator(`[name=account_type][value=${type}]`).check();
  await p.locator('[name=first_name]').fill('QA');await p.locator('[name=last_name]').fill(type==='individual'?'Individual':'Company');
  const tel=phone();await p.locator('[name=phone]').fill(tel);await p.locator('[name=password]').fill(password);await p.locator('[name=confirm]').fill(password);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.screenshot({path:out+'/signup-'+lang+'.png',fullPage:true});
  await p.locator('#auth-form [type=submit]').click();await p.waitForURL('**/'+folder+'/');await p.locator('[data-doc]').first().waitFor();
  const u=(await call(ctx,'session')).user;await remember(u);assert.equal(u.account_type,type);
  await p.goto(base+'/'+opposite+'/');await p.waitForURL('**/'+folder+'/');await p.locator('[data-doc]').first().waitFor();
  const ids=await p.locator('[data-doc]').evaluateAll(els=>els.map(e=>e.dataset.doc));
  assert.ok(ids.includes(type==='individual'?'subscription-form':'subscription-company'));assert.ok(!ids.includes(type==='individual'?'subscription-company':'subscription-form'));assert.ok(ids.includes('signature-form'));
  await p.goto(base+'/my-applications/?lang='+lang);await p.locator('[data-account-forms]').waitFor();
  assert.equal(await p.locator('[data-account-forms]').getAttribute('href'),'/'+folder+'/');assert.equal(await p.locator(`a[href="/${opposite}/"]`).count(),0);
  await p.locator('#upload-completed').click();await p.locator('.portal-upload').waitFor();
  assert.equal(await p.locator('.portal-upload [name=audience]').inputValue(),type);assert.equal(await p.locator('.portal-upload select[name=audience]').count(),0);
  const options=await p.locator('.portal-upload [name=document] option').evaluateAll(els=>els.map(e=>e.value));assert.ok(!options.includes(type==='individual'?'subscription-company':'subscription-form'));
  await p.locator('.portal-upload [data-close]').click();
  await call(ctx,'profile',{name:u.name,email:'',account_type:type==='individual'?'corporate':'individual'},403);
  await call(ctx,'admin_account_type',{id:u.id,account_type:type,expected_type:type},401);
  const meta={account:u.id,document:'signature-form',audience:type,source:'online',values:{client_name:u.name},requestKey:randomUUID(),expectedCurrent:null};
  const submit=(m,status=201)=>call(ctx,'submit',null,status,{multipart:{metadata:JSON.stringify(m),pdf:{name:'test.pdf',mimeType:'application/pdf',buffer:source}}});
  await submit({...meta,audience:type==='individual'?'corporate':'individual'},403);
  const saved=(await submit(meta)).submission;
  assert.equal(digest(await(await ctx.request.get(base+'/api/portal.php?action=pdf&id='+saved.id)).body()),digest(source));
  u.saved=saved.id;u.ctx=ctx;u.page=p;u.meta=meta;u.password=password;
  ctx.test=u;
  checks.push(type+': signup, assigned landing page, opposite direct-link redirect, catalogue/upload filtering, client self-change rejection and server submission authorization');
 }
 const a=clients[0],u=a.test,p=u.page;
 const owner=await manager.newPage();owner.on('pageerror',err=>errors.push(err.message));await owner.goto(base+'/management/');await owner.locator('.admin-stats').waitFor();await owner.locator('[data-users]').first().click();await owner.locator(`[data-client="${u.id}"]`).click();await owner.locator('#account-type-form').waitFor();
 await p.goto(base+'/individuals/?shared=1');await p.locator('#shared-city').fill('Individual saved city');
 const key='itqan.forms.v1.account.'+u.id+'.individual.shared-fields';
 await call(manager,'admin_account_type',{id:u.id,account_type:'corporate',expected_type:'individual'},403,{headers:{'X-CSRF-Token':'wrong'}});
 await call(manager,'admin_account_type',{id:u.id,account_type:'both',expected_type:'individual'},400);
 assert.equal((await manager.request.get(base+'/api/portal.php?action=admin_account_type')).status(),405);
 await owner.locator('#client-account-type').selectOption('corporate');await owner.locator('#account-type-form [type=submit]').click();await owner.locator('[data-type-status]').filter({hasText:'Account type updated.'}).waitFor();
 assert.equal((await call(a,'session')).user.account_type,'corporate');
 await call(manager,'admin_account_type',{id:u.id,account_type:'individual',expected_type:'individual'},409);
 // Same open client session sees a management change when it regains focus.
 await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForURL('**/companies/');await p.locator('[data-doc]').first().waitFor();
 assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).city,key),'Individual saved city');
 await p.goto(base+'/companies/?shared=1');await p.locator('#shared-city').waitFor();assert.equal(await p.locator('#shared-city').inputValue(),'');
 await call(a,'submit',null,403,{multipart:{metadata:JSON.stringify({...u.meta,requestKey:randomUUID(),expectedCurrent:u.saved}),pdf:{name:'test.pdf',mimeType:'application/pdf',buffer:source}}});
 await p.goto(base+'/my-applications/?lang=en');await p.locator('[data-preview]').waitFor();
 assert.equal(await p.locator(`[data-edit="${u.saved}"]`).count(),0);assert.equal(await p.locator(`[data-replace="${u.saved}"]`).count(),0);
 const detail=(await call(a,'detail',null,200,{params:{id:u.saved}})).submission;assert.equal(detail.answers.client_name,u.name);assert.equal(detail.sha256,digest(source));
 assert.equal((await a.request.get(base+'/api/portal.php?action=zip')).status(),200);
 const corporate={...u.meta,audience:'corporate',requestKey:randomUUID()};
 const newer=await call(a,'submit',null,201,{multipart:{metadata:JSON.stringify(corporate),pdf:{name:'company.pdf',mimeType:'application/pdf',buffer:source}}});
 assert.equal(newer.submission.version,1);
 await owner.setViewportSize({width:390,height:844});await owner.locator('[data-admin-language]').click();await owner.locator('#account-type-form').waitFor();
 assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await owner.screenshot({path:out+'/management-ar.png',fullPage:true});
 await owner.locator('#client-account-type').selectOption('individual');await owner.locator('#account-type-form [type=submit]').click();await owner.locator('[data-type-status]').filter({hasText:'تم تحديث نوع الحساب.'}).waitFor();
 await p.goto(base+'/companies/');await p.waitForURL('**/individuals/');await p.locator('[data-doc]').first().waitFor();
 assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).city,key),'Individual saved city');
 await p.goto(base+'/my-applications/?lang=en');await p.locator(`[data-edit="${u.saved}"]`).waitFor();
 assert.equal(await p.locator(`[data-edit="${newer.submission.id}"]`).count(),0);
 checks.push('Management changes both directions, CSRF/method/validation/stale-write protection, active-session refresh, old PDF preservation, read-only prior-category history, separate shared fields and permitted new-category submission');
 // Persisted account type is applied on a fresh browser login too.
 for(const [name,engine] of [['firefox',firefox],['webkit',webkit]]){
  const other=await engine.launch({headless:true});try{
   const c=await other.newContext({viewport:{width:390,height:844}}),v=await c.newPage();v.on('pageerror',err=>errors.push(err.message));
   await v.goto(base+'/login/?lang=en&next=individuals');await v.locator('#auth-form').waitFor();await v.locator('[name=phone]').fill(clients[1].test.phone);await v.locator('[name=password]').fill(password);await v.locator('#auth-form [type=submit]').click();await v.waitForURL('**/companies/');await v.locator('[data-doc]').first().waitFor();
   await v.goto(base+'/individuals/');await v.waitForURL('**/companies/');await v.locator('[data-doc]').first().waitFor();assert.equal(await v.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await v.goto(base+'/my-applications/');await v.locator('[data-account-forms]').waitFor();assert.equal(await v.locator('[data-account-forms]').getAttribute('href'),'/companies/');
   checks.push(name+': fresh company login, opposite next/direct-link restrictions, account navigation and mobile layout');
  }finally{await other.close();}
 }
 assert.deepEqual(errors,[]);assert.equal((await call(manager,'admin_dashboard')).stats.users,baseline.users+2);
 await fs.writeFile(out+'/results.json',JSON.stringify({result:'pass',checks,consoleErrors:errors,temporaryAccounts:2,temporaryPDFs:3},null,2));console.log(checks.map(c=>'PASS '+c).join('\n'));
}finally{
 for(const ctx of clients){try{const r=await ctx.request.get(base+'/api/portal.php?action=session');await remember((await r.json()).user);}catch{}}
 await browser?.close();server?.kill();
}
