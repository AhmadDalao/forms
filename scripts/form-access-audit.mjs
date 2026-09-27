// Real-session access boundary audit against an isolated copy of the build.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {request} from 'playwright';
import {fixture} from './workflow-harness.mjs';
const fx=await fixture({protectedRoutes:true}),contexts=[];
const report={started:new Date().toISOString(),base:fx.base,checks:[]};
const context=async()=>{const ctx=await request.newContext();contexts.push(ctx);return{request:ctx};};
const get=async(ctx,path,status)=>{const response=await ctx.request.get(fx.base+path,{maxRedirects:0});assert.equal(response.status(),status,path+': '+(await response.text()).slice(0,120));return response;};
try{
 const guest=await context(),individual=await context(),company=await context(),admin=await context(),owner=await context();
 const user=await fx.client(individual,'individual');await fx.client(company,'corporate');await fx.login(admin,'admin');await fx.login(owner,'superadmin');
 for(const path of ['/','/index.html','/individuals','/individuals/','/individuals/index.html','/companies/','/companies/index.html']){
  const r=await get(guest,path,302);assert.match(r.headers().location,/^\/login\//);assert.match(r.headers()['cache-control'],/no-store/);
 }
 for(const path of ['/pdfs/signature-form.pdf','/pdfs/subscription-form.pdf','/pdfs/subscription-individual.pdf','/pdfs/kyc-corporate.pdf','/api/template.php?id=signature-form','/api/management.php?action=catalogue','/api/management.php?action=document&id=upload_111111111111111111111111'])await get(guest,path,401);
 for(const path of ['/api/defaults.json','/api/portal-defaults.json','/api/client-profile-defaults.json'])await get(guest,path,404);
 for(const path of ['/preview-20260919/','/preview-20260919/pdfs/kyc-individual.pdf','/preview-20260919/api/management.php?action=catalogue']){
  const r=await get(guest,path,302);assert.match(r.headers().location,/^https:\/\/forms\.ahmaddalao\.com\//);
 }
 report.checks.push('Anonymous root/folder/index pages redirect; original PDFs, direct gateway and catalogue denied; defaults denied; retired preview redirects');
 for(const [ctx,folder,own,opposite] of [[individual,'individuals','kyc-individual','kyc-corporate'],[company,'companies','kyc-corporate','kyc-individual']]){
  assert.match((await get(ctx,'/',302)).headers().location,new RegExp('^/'+folder+'/'));
  await get(ctx,'/'+folder+'/',200);
  for(const suffix of ['', '/index.html'])assert.match((await get(ctx,'/'+folder+suffix+'?lang=ar',302)).headers().location,new RegExp('^/'+folder+'/\\?lang=ar$'));
  const wrong=folder==='individuals'?'companies':'individuals';assert.match((await get(ctx,'/'+wrong+'/',302)).headers().location,new RegExp('^/'+folder+'/'));
  for(const id of [own,'signature-form']){const r=await get(ctx,'/pdfs/'+id+'.pdf',200);assert.match(r.headers()['content-type'],/application\/pdf/);assert.match(r.headers()['cache-control'],/no-store/);assert.ok((await r.body()).subarray(0,5).equals(Buffer.from('%PDF-')));}
  await get(ctx,'/pdfs/'+opposite+'.pdf',403);
  const catalogue=await(await get(ctx,'/api/management.php?action=catalogue',200)).json();assert.ok(catalogue.documents.every(doc=>doc.group==='shared'||doc.group===(folder==='individuals'?'individual':'corporate')));
 }
 report.checks.push('Both client categories see only matching/shared catalogue and PDFs; direct opposite links denied; category landing works');
 const base=JSON.parse(await fs.readFile(fx.out+'/site/api/defaults.json','utf8'));
 const published={id:'upload_111111111111111111111111',title:'QA company',ar:'اختبار',group:'corporate',builtin:false,pages:1};
 const draft={...published,id:'upload_222222222222222222222222'};
 await fs.mkdir(fx.out+'/management/uploads',{recursive:true});
 for(const doc of [published,draft])await fs.copyFile(fx.out+'/site/pdfs/signature-form.pdf',fx.out+'/management/uploads/'+doc.id+'.pdf');
 await fs.writeFile(fx.out+'/management/state.json',JSON.stringify({revision:0,draft:{...base,documents:[...base.documents,published,draft]},published:{...base,documents:[...base.documents,published]},history:[]}));
 await get(individual,'/api/management.php?action=document&id='+published.id,403);
 await get(company,'/api/management.php?action=document&id='+published.id,200);
 await get(admin,'/api/management.php?action=document&id='+published.id,200);
 await get(company,'/api/management.php?action=document&id='+draft.id,404);
 await get(admin,'/api/management.php?action=document&id='+draft.id,404);
 await get(owner,'/api/management.php?action=document&id='+draft.id,200);
 for(const ctx of [admin,owner])for(const id of ['kyc-individual','kyc-corporate'])await get(ctx,'/pdfs/'+id+'.pdf',200);
 report.checks.push('Uploaded published documents enforce category; only superadmin can fetch draft uploads; management retains both-audience previews');
 // Admin identity deliberately remains authoritative if a browser also has a client session.
 await fx.login(individual,'superadmin');await get(individual,'/pdfs/kyc-corporate.pdf',200);await fx.call(individual,'management','logout',{data:{}});
 await get(individual,'/pdfs/kyc-corporate.pdf',403);
 const temporaryPassword='Chosen8!';await fx.call(admin,'portal','admin_reset',{data:{id:user.id,password:temporaryPassword,confirm:temporaryPassword}});
 await get(individual,'/pdfs/signature-form.pdf',401);assert.match((await get(individual,'/individuals/',302)).headers().location,/^\/login\//);
 const state=await company.request.storageState();const cookie=state.cookies.find(c=>c.name.startsWith('itqan_client'));assert.ok(cookie);
 const fake=await request.newContext({extraHTTPHeaders:{Cookie:cookie.name+'=not-a-real-session'}});contexts.push(fake);await get({request:fake},'/pdfs/signature-form.pdf',401);
 report.checks.push('Combined management/client cookies preserve preview access; logout restores category guard; reset revokes old PDF/page access; forged cookies fail closed');
 await fx.call(individual,'portal','session');
 await fx.call(individual,'portal','login',{data:{phone:user.phone,password:temporaryPassword}});
 assert.match((await get(individual,'/individuals/',302)).headers().location,/^\/my-applications\//);
 const blocked=await get(individual,'/pdfs/signature-form.pdf',403);assert.equal((await blocked.json()).error,'password_change_required');
 await fx.call(individual,'portal','password',{data:{current:temporaryPassword,password:'New.client.pass!2026',confirm:'New.client.pass!2026'}});
 await get(individual,'/pdfs/signature-form.pdf',200);await get(individual,'/individuals/',200);
 report.checks.push('Temporary-password clients must replace password before forms/templates; replacing it restores authenticated access');
 await fx.call(company,'portal','logout',{data:{}});await get(company,'/api/management.php?action=catalogue',401);await get(company,'/pdfs/kyc-corporate.pdf',401);
 report.checks.push('Client logout immediately blocks catalogue and template access');
 report.passed=true;
}finally{
 await fs.writeFile(fx.out+'/form-access-report.json',JSON.stringify(report,null,2));
 await Promise.all(contexts.map(ctx=>ctx.dispose()));await fx.close();
 console.log(JSON.stringify({out:fx.out,report},null,2));
}
