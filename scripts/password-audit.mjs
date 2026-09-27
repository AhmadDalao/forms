import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomInt} from 'node:crypto';

const out=path.resolve(process.env.QA_OUT||'tmp/passwords/audit'),base=(process.env.QA_BASE||'http://127.0.0.1:8195').replace(/\/$/,''),remote=!!process.env.QA_BASE;
if(remote)assert.ok(process.env.QA_CREDENTIALS,'Remote mode requires QA_CREDENTIALS');
const credentials=remote?JSON.parse(await fs.readFile(process.env.QA_CREDENTIALS,'utf8')):{username:'qa.manager',password:randomBytes(24).toString('base64url')+'aA7!'};
if(!remote){assert.ok(out.startsWith(path.resolve('tmp')+path.sep));await fs.rm(out,{recursive:true,force:true});}
await fs.mkdir(out,{recursive:true});
if(remote)assert.equal(await fs.access(out+'/test-accounts.json').then(()=>true,()=>false),false,'Use a fresh QA_OUT so an earlier cleanup ledger is preserved');
const checks=[],errors=[],accounts=[],clients=[],tokens=new Map(),initial='12345678',changed='87654321',finalPassword='11223344',arabic72='س'.repeat(36),arabic74='س'.repeat(37);
let server,log,browser;
const pass=message=>{checks.push(message);console.log('PASS '+message);};
const remember=async user=>{if(user&&!accounts.some(a=>a.id===user.id)){accounts.push({id:user.id,name:user.name,phone:user.phone});await fs.writeFile(out+'/test-accounts.json',JSON.stringify(accounts,null,2),{mode:0o600});}};
const track=page=>page.on('pageerror',error=>errors.push(error.message));
async function call(ctx,action,data,status=200){
 const r=await ctx.request[data?'post':'get'](base+'/api/portal.php?'+new URLSearchParams({action}),{...(data?{data}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)||''},timeout:20000});
 const json=await r.json();if(action==='register')await remember(json.user);
 assert.equal(r.status(),status,action+' returned unexpected status'+(json.error?' ('+json.error+')':''));
 if(json.csrf)tokens.set(ctx,json.csrf);return json;
}
async function submit(page,selector,action,status=200){
 const [r]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).searchParams.get('action')===action&&r.request().method()==='POST'),page.locator(selector+' .primary').click()]);
 // Signup/login navigate immediately; a response body may be discarded by the browser.
 assert.equal(r.status(),status,action+' UI returned unexpected status');
 if(action==='register'){const session=await call(page.context(),'session');await remember(session.user);return session;}
 return {};
}
async function login(page,ctx,phone,password,lang='en',forced=false){
 await page.goto(base+'/login/?lang='+lang);await page.locator('#auth-form').waitFor();
 await page.locator('[name=phone]').fill(phone);await page.locator('[name=password]').fill(password);
 await submit(page,'#auth-form','login');await page.waitForURL('**/my-applications/');
 await page.locator(forced?'#password-form':'.account-documents').waitFor();await call(ctx,'session');
}
async function signOut(ctx){await call(ctx,'logout',{});await call(ctx,'session');}
async function openPassword(page,lang){
 await page.goto(base+'/my-applications/?lang='+lang);await page.locator('.account-settings summary').click();
 await page.locator('#change-password').click();await page.locator('#password-form').waitFor();
}
async function toggle(page,name,lang,value='T7!qR2@v'){
 const input=page.locator(`[name="${name}"]`),eye=page.locator(`.password-eye[data-eye="${name}"]`),slash=eye.locator('svg [data-eye-slash]');
 await input.fill(value);assert.equal(await eye.getAttribute('type'),'button');assert.equal(await eye.getAttribute('aria-controls'),await input.getAttribute('id'));assert.equal(await slash.count(),1);
 for(const visible of [false,true,false]){
  if(visible||await input.getAttribute('type')==='text')await eye.click();
  assert.equal(await input.getAttribute('type'),visible?'text':'password');
  assert.equal(await eye.getAttribute('aria-pressed'),String(visible));
  assert.equal(await slash.isVisible(),visible,'Eye slash must visibly follow the password state');
  assert.ok(await input.inputValue()===value,'Toggling must preserve the typed value');
  assert.match(await eye.getAttribute('aria-label')||'',lang==='ar'?(visible?/إخفاء/:/إظهار/):(visible?/hide/i:/show/i));
 }
}
async function strength(page,lang){
 const widget=page.locator('[data-password-strength="password"]'),meter=widget.locator('[role=meter]');
 assert.equal(await page.locator('[data-password-strength]').count(),1,'Only the new password gets a strength indicator');
 assert.equal(await meter.count(),1);assert.equal(await meter.getAttribute('aria-valuemin'),'0');assert.equal(await meter.getAttribute('aria-valuemax'),'4');
 const labels=[];
 for(const [value,score] of [['',0],[initial,1],['T7!qR2@v',2],['purple-cactus-river-moon',4]]){
  await page.locator('[name=password]').fill(value);
  assert.equal(await widget.getAttribute('data-score'),String(score));assert.equal(await meter.getAttribute('aria-valuenow'),String(score));
  const label=(await widget.locator('[data-strength-label]').innerText()).trim();assert.ok(label,'Strength needs a readable label');
  if(score){assert.match(label,lang==='ar'?/[\u0600-\u06ff]/:/[A-Za-z]/);labels.push(label);}
 }
 assert.equal(new Set(labels).size,3,'Weak, fair and strong must have distinct labels');
 await page.locator('[name=password]').fill(initial);assert.equal(await page.locator('[name=password]').evaluate(el=>el.validity.valid),true,'A weak eight-character password remains valid');
}
async function fields(page,names,lang,{newPassword=false}={}){
 for(const name of names){
  const input=page.locator(`[name="${name}"]`),isCurrent=name==='current'||!newPassword;
  if(isCurrent)assert.ok(await input.evaluate(el=>el.minLength)<=0,'Current/login password must have no native minimum');
  else assert.equal(await input.evaluate(el=>el.minLength),8,'New and confirmation fields need minlength=8');
  await toggle(page,name,lang);
 }
 if(newPassword){
  for(const name of ['password','confirm']){
   const input=page.locator(`[name="${name}"]`);
   for(const [value,valid] of [['1234567',false],[arabic74,false],[arabic72,true]]){await input.fill(value);assert.equal(await input.evaluate(el=>el.validity.valid),valid,'New-password field must enforce eight characters and the UTF-8 byte limit');}
  }
  await strength(page,lang);
 }else assert.equal(await page.locator('[data-password-strength]').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Password UI must fit the viewport');
}
async function changeInUI(page,ctx,current,password){
 await page.locator('[name=current]').fill(current);await page.locator('[name=password]').fill(password);await page.locator('[name=confirm]').fill(password);
 await submit(page,'#password-form','password');await page.locator('.account-documents').waitFor();await call(ctx,'session');
}

try{
 if(!remote){
  assert.equal(spawnSync('php',['scripts/management-init.php',out+'/management',credentials.username],{input:credentials.password}).status,0);
  log=await fs.open(out+'/server.log','w');
  server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8195','-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:out+'/management',FORMS_PORTAL_DATA_DIR:out+'/data'},stdio:['ignore',log.fd,log.fd]});
 }
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/api/portal.php',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Portal did not become ready');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const manager=await browser.newContext(),anon=await browser.newContext();
 const ms=await(await manager.request.get(base+'/api/management.php?action=session')).json();
 assert.equal((await manager.request.post(base+'/api/management.php?action=login',{data:credentials,headers:{'X-CSRF-Token':ms.csrf}})).status(),200,'Manager login failed');
 tokens.set(manager,(await(await manager.request.get(base+'/api/management.php?action=session')).json()).csrf);
 const baseline=(await call(manager,'admin_dashboard')).stats;await fs.writeFile(out+'/baseline.json',JSON.stringify(baseline),{mode:0o600});
 const phones=new Set();while(phones.size<2)phones.add('59'+String(randomInt(10000000)).padStart(7,'0'));
 const plans=[...phones].map((phone,index)=>({first_name:'QA',last_name:index?'Company':'Individual',account_type:index?'corporate':'individual',phone}));
 await call(anon,'session');
 for(const value of ['1234567','س'.repeat(7),arabic74])assert.equal((await call(anon,'register',{...plans[0],password:value,confirm:value},400)).error,'password_weak');
 assert.equal((await call(anon,'register',{...plans[0],password:initial,confirm:changed},400)).error,'password_mismatch');
 assert.ok(Buffer.byteLength(arabic72)===72&&Buffer.byteLength(arabic74)===74);
 pass('Registration server rejects seven English/Arabic characters, mismatched confirmation and more than 72 UTF-8 bytes');
 for(const [index,plan] of plans.entries()){
  const lang=index?'ar':'en',ctx=await browser.newContext({viewport:{width:index?390:1440,height:1000}});ctx.setDefaultTimeout(15000);
  const page=await ctx.newPage();track(page);await page.goto(base+'/register/?lang='+lang);await page.locator('#auth-form').waitFor();
  await fields(page,['password','confirm'],lang,{newPassword:true});
  await page.locator(`[name=account_type][value=${plan.account_type}]`).check();await page.locator('[name=first_name]').fill(plan.first_name);await page.locator('[name=last_name]').fill(plan.last_name);await page.locator('[name=phone]').fill(plan.phone);
  await page.locator('[name=password]').fill(initial);await page.locator('[name=confirm]').fill(initial);
  const registered=await submit(page,'#auth-form','register',201);await page.waitForURL('**/'+(index?'companies':'individuals')+'/');
  const user=(await call(ctx,'session')).user;assert.equal(user.id,registered.user.id);assert.equal(user.name,'QA '+plan.last_name);assert.equal(user.account_type,plan.account_type);assert.match(user.phone,/^\+96659\d{7}$/);clients.push({ctx,user});
  await page.goto(base+'/my-applications/?lang='+lang);await page.locator('#portal-logout').click();await page.waitForURL('**/login/?lang='+lang);await call(ctx,'session');
  await login(page,ctx,user.phone,initial,lang);
  for(const value of ['1234567','س'.repeat(7),arabic74])assert.equal((await call(ctx,'password',{current:initial,password:value,confirm:value},400)).error,'password_weak');
  assert.equal((await call(ctx,'password',{current:initial,password:changed,confirm:initial},400)).error,'password_mismatch');
  await call(ctx,'password',{current:initial,password:arabic72,confirm:arabic72});
  await openPassword(page,lang);await fields(page,['current','password','confirm'],lang,{newPassword:true});await changeInUI(page,ctx,arabic72,changed);
  await signOut(ctx);await call(ctx,'login',{phone:user.phone,password:initial},401);await call(ctx,'login',{phone:user.phone,password:arabic72},401);await call(ctx,'login',{phone:user.phone,password:changed});
  const temporaryPassword='Chosen8!';const reset=await call(manager,'admin_reset',{id:user.id,password:temporaryPassword,confirm:temporaryPassword});assert.equal(reset.ok,true);
  await call(ctx,'submissions',null,401);await call(ctx,'session');await call(ctx,'login',{phone:user.phone,password:changed},401);
  await login(page,ctx,user.phone,temporaryPassword,lang,true);await call(ctx,'submissions',null,403);
  await fields(page,['current','password','confirm'],lang,{newPassword:true});assert.equal(await page.locator('#password-back').count(),0,'Temporary passwords require replacement');
  await changeInUI(page,ctx,temporaryPassword,finalPassword);assert.equal(Number((await call(ctx,'session')).user.reset_required),0);
  await signOut(ctx);await call(ctx,'login',{phone:user.phone,password:temporaryPassword},401);await call(ctx,'login',{phone:user.phone,password:finalPassword});
  pass(plan.account_type+': weak eight-character signup/login, 72-byte Arabic password, confirmation validation, password replacement, reset/session revocation and forced eight-character replacement');
 }
 assert.equal(accounts.length,2);assert.equal(Number((await call(manager,'admin_dashboard')).stats.users),Number(baseline.users)+2);
 for(const [engine,name,opts] of [[chromium,'chrome',{channel:'chrome'}],[firefox,'firefox',{}],[webkit,'webkit',{}]]){
  const engineBrowser=await engine.launch({headless:true,...opts});
  try{
   for(const lang of ['en','ar'])for(const width of [1440,390]){
    const ctx=await engineBrowser.newContext({viewport:{width,height:1000}});ctx.setDefaultTimeout(15000);
    try{
     const page=await ctx.newPage();track(page);
     await page.goto(base+'/register/?lang='+lang);await page.locator('#auth-form').waitFor();await fields(page,['password','confirm'],lang,{newPassword:true});
     await page.screenshot({path:out+'/signup-'+name+'-'+lang+'-'+width+'.png',fullPage:true});
     await page.goto(base+'/login/?lang='+lang);await page.locator('#auth-form').waitFor();await fields(page,['password'],lang);
     await page.screenshot({path:out+'/login-'+name+'-'+lang+'-'+width+'.png',fullPage:true});
     await login(page,ctx,clients[0].user.phone,finalPassword,lang);await openPassword(page,lang);await fields(page,['current','password','confirm'],lang,{newPassword:true});
     await page.screenshot({path:out+'/new-password-'+name+'-'+lang+'-'+width+'.png',fullPage:true});
    }finally{await ctx.close();}
   }
   pass(name+': English/Arabic desktop/mobile signup, login and new-password screens; two visible eye transitions, preserved values, accessible controls, advisory scores and no overflow');
  }finally{await engineBrowser.close();}
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({base,passed:true,checks,errors,clients:accounts.length},null,2));
 console.log('PASS Password audit complete; cleanup identities are in '+out+'/test-accounts.json');
}catch(error){
 await fs.writeFile(out+'/results.json',JSON.stringify({base,passed:false,checks,errors,error:error.message,clients:accounts.length},null,2));throw error;
}finally{await browser?.close();server?.kill();await log?.close();}
