// Bounded API lifecycle against an isolated snapshot of the current public build.
// PDF rendering is covered by the separate browser audit; this checks storage.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {request} from 'playwright';
import {fixture,digest} from './workflow-harness.mjs';

const f=await fixture(),out=f.out+'/person-names-backend',contexts=[],evidence=[];
await fs.mkdir(out,{recursive:true});
const report={base:f.base,baseline:f.baseline,checks:[],passed:false,limits:['Local API requests only; PDF fixtures use original source bytes. Filled PDF appearance is verified in the separate browser audit.']};
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const api=(ctx,action,options)=>f.call(ctx,'portal',action,options);
const detail=async(ctx,id,admin=false)=>(await api(ctx,admin?'admin_detail':'detail',{params:{id}})).submission;
const snapshot=s=>({id:s.id,created_at:s.created_at,version:s.version,answers:s.answers,profile:s.profile,signatures:s.signatures,sha256:s.sha256,review_required:s.review_required});
const parts=(prefix,values)=>Object.fromEntries(['first','second','third','last'].map((key,i)=>[prefix+'_'+key,values[i]]));
const joined=values=>values.map(v=>v.trim()).filter(Boolean).join(' ');
const subscription={nationality:'Saudi Arabian',id_type:'national',id_number:'1000012345',company_name:'Example Holdings LLC',inc_country:'Saudi Arabia',company_id_type:'cr',company_id_number:'4030123456',auth_name:'Legacy authorized person',subscription_type:'new',payment_method:'transfer',units:'10',applicant_name:'Legacy applicant',date:'2026-09-20',signature_mode:'electronic'};
try{
 for(const file of ['portal-answers.php','portal-details.php']){
  const bytes=await fs.readFile(f.out+'/site/api/'+file);assert.equal(digest(bytes),digest(await fs.readFile('public/api/'+file)),file+' matches current source');report.baseline.build['api/'+file]=digest(bytes);
 }
 const definitions=JSON.parse(await fs.readFile(f.out+'/site/api/portal-defaults.json','utf8'));
 assert.deepEqual(definitions['subscription-form'].fields.find(field=>field.id==='english_name').join,['en_first','en_second','en_third','en_last']);
 assert.equal(definitions['signature-form'].fields.find(field=>field.id==='client_name_first').joinAudience,'individual');
 const context=async()=>{const ctx={request:await request.newContext()};contexts.push(ctx);return ctx;};
 const admin=await context(),individual=await context(),corporate=await context();await f.login(admin,'admin');
 const users={individual:await f.client(individual,'individual'),corporate:await f.client(corporate,'corporate')};
 const image='data:image/png;base64,'+(await fs.readFile('tests/fixtures/signature.png')).toString('base64');
 assert.deepEqual((await api(individual,'session')).workflow,{review_enabled:true,revision:0});
 pass('Fresh individual/company accounts and ordinary manager session use the built four-part definitions');
 const arabic=['أحمد','محمد','حسن','الدلاو'],english=['Ahmad','Mohammed','Hassan','Al Dalao'],signer=['Authorized','Second','Third','Family'];
 const plans=[
  {audience:'individual',document:'signature-form',pdf:'signature-form.pdf',values:{client_name:'FORGED',signer_name:'FORGED',...parts('client_name',arabic),...parts('signer_name',english)},groups:{client_name:parts('client_name',arabic),signer_name:parts('signer_name',english)},revise:'signer_name',revision:english.map((v,i)=>i===2?'':v)},
  {audience:'corporate',document:'signature-form',pdf:'signature-form.pdf',values:{client_name:'Example Holdings LLC',...parts('client_name',['Injected','Individual','Only','Name']),signer_name:'FORGED',...parts('signer_name',signer)},groups:{signer_name:parts('signer_name',signer)},company:'Example Holdings LLC',revise:'signer_name',revision:['Authorized','Revised','','Family']},
  {audience:'individual',document:'subscription-form',pdf:'subscription-individual.pdf',values:{...subscription,first_name:arabic[0],second_name:arabic[1],third_name:arabic[2],family_name:arabic[3],full_name:'FORGED',english_name:'FORGED',...parts('en',english),applicant_name:'FORGED',...parts('applicant_name',arabic)},groups:{english_name:parts('en',english),applicant_name:parts('applicant_name',arabic)},revise:'english_name',prefix:'en',revision:['Ahmad','Revised','','Al Dalao']},
  {audience:'corporate',document:'subscription-company',pdf:'subscription-company.pdf',values:{...subscription,company_name:'Example Holdings LLC',english_name:'Example International Holdings LLC',auth_name:'FORGED',...parts('auth_name',arabic),applicant_name:'FORGED',...parts('applicant_name',signer)},groups:{auth_name:parts('auth_name',arabic),applicant_name:parts('applicant_name',signer)},revise:'auth_name',revision:['عمر','محمد','','الدلاو']},
 ];
 const current=[];
 for(const plan of plans){
  const ctx=plan.audience==='individual'?individual:corporate,user=users[plan.audience],pdf=await fs.readFile(f.out+'/site/pdfs/'+plan.pdf),slot=plan.document.startsWith('subscription')?'applicant':'specimen';
  const submit=async(values,expectedCurrent=null,editedFrom=null,status=201,requestKey=randomUUID())=>{
   const metadata={account:user.id,audience:plan.audience,document:plan.document,source:'online',workflowRevision:0,expectedCurrent,editedFrom,requestKey,values,signatures:{[slot]:image},signatureModes:{[slot]:'electronic'}};
   return {metadata,result:await api(ctx,'submit',{multipart:{metadata:JSON.stringify(metadata),pdf:{name:'name-lifecycle.pdf',mimeType:'application/pdf',buffer:pdf}},status})};
  };
  const first=await submit(plan.values),saved=await detail(admin,first.result.submission.id,true);
  assert.deepEqual(snapshot(await detail(ctx,saved.id)),snapshot(saved));assert.equal(saved.review_required,true);assert.equal(saved.signature_state,'electronic');
  for(const [target,values]of Object.entries(plan.groups)){
   assert.equal(saved.answers[target],joined(Object.values(values)),plan.document+'/'+target);
   for(const [id,value]of Object.entries(values)){assert.equal(saved.answers[id],value);const field=saved.profile.field_definitions.find(field=>field.id===id);assert.equal(field.uiOnly,true);assert.ok(field.label&&field.ar);assert.ok(saved.profile.section_definitions.some(section=>section.field_ids.includes(id)));}
  }
  if(plan.company){assert.equal(saved.answers.client_name,plan.company);for(const id of Object.keys(parts('client_name',['','','',''])))assert.equal(saved.answers[id],undefined);}
  if(plan.document==='subscription-form')assert.equal(saved.answers.full_name,joined(arabic));
  if(plan.document==='subscription-company'){assert.equal(saved.answers.company_name,'Example Holdings LLC');assert.equal(saved.answers.english_name,'Example International Holdings LLC');}
  if(plan.document.startsWith('subscription')){assert.equal(saved.answers.total_amount,'10200');assert.equal(saved.answers.subscription_fee,'200');assert.equal(saved.answers.date,'2026-09-20');}
  const retry=await submit(plan.values,null,null,200,first.metadata.requestKey);assert.equal(retry.result.duplicate,true);assert.equal(retry.result.submission.id,saved.id);
  const revisionValues={...plan.values,...parts(plan.prefix||plan.revise,plan.revision),[plan.revise]:'STALE DERIVED NAME'};
  const second=await submit(revisionValues,saved.id,saved.id),revised=await detail(admin,second.result.submission.id,true),archived=await detail(admin,saved.id,true);
  assert.equal(revised.answers[plan.revise],joined(plan.revision));assert.equal(revised.version,2);assert.equal(revised.edited_from,saved.id);assert.equal(revised.replaces_id,saved.id);assert.ok(archived.archived_at);assert.deepEqual(snapshot(archived),snapshot(saved),'Archived names, definitions and signatures stay unchanged');
  assert.equal(revised.answers[(plan.prefix||plan.revise)+'_third'],'','Deliberately cleared third name stays blank');
  for(const version of [saved,revised]){const downloaded=await ctx.request.get(f.base+'/api/portal.php?'+new URLSearchParams({action:'pdf',id:version.id}));assert.equal(downloaded.status(),200);assert.equal(digest(await downloaded.body()),version.sha256);}
  if(plan.document.startsWith('subscription')){
   const invalid={...revisionValues,applicant_name:'Old applicant',...parts('applicant_name',['','','',''])};const rejected=await submit(invalid,revised.id,revised.id,422);assert.equal(rejected.result.error,'form_incomplete');
  }
  current.push({ctx,user,id:revised.id});evidence.push({original:saved,archived,revised});
  pass(plan.audience+' '+plan.document+': canonical parts/full names, manager details, retry, revision and immutable original');
 }
 await api(corporate,'detail',{params:{id:current.find(s=>s.user.account_type==='individual').id},status:404});
 await api(individual,'detail',{params:{id:current.find(s=>s.user.account_type==='corporate').id},status:404});
 for(const [audience,ctx]of [['individual',individual],['corporate',corporate]]){
  const clientRows=(await api(ctx,'submissions')).submissions,managerRows=(await api(admin,'admin_client',{params:{id:users[audience].id}})).submissions;
  assert.equal(clientRows.length,4);assert.equal(clientRows.filter(s=>!s.archived_at).length,2);assert.deepEqual(clientRows.map(s=>s.id).sort(),managerRows.map(s=>s.id).sort());
 }
 const stats=(await api(admin,'admin_dashboard')).stats;assert.equal(stats.users,2);assert.equal(stats.submissions,8);assert.equal(stats.active_submissions,4);
 pass('Client/management lists expose all eight versions, four current forms, and enforce account privacy');
 report.passed=true;report.coverage={accounts:2,forms:4,versions:8,current:4,groups:report.checks.length};
 await fs.writeFile(out+'/snapshots.json',JSON.stringify(evidence,null,2));
}catch(error){report.error=error.stack;throw error;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await Promise.all(contexts.map(ctx=>ctx.request.dispose()));await f.close();console.log('REPORT '+out+'/report.json');}
