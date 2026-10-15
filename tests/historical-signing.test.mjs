import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';

const read=name=>JSON.parse(readFileSync(name));
const old=read('reference/documents/archived/terms-13-page-schema.json');
const legacy=read('scripts/pdf-design/legacy-signing-layouts.json')[old.id];
const retired=read('reference/documents/archived/terms-modern-layout.json');
const current={id:old.id,title:'Current fund terms',ar:'شروط الصندوق',group:'shared',pages:38,pdfVersion:'test-38-page-terms',
 pageSizes:Array.from({length:38},()=>[595.28,841.89]),fields:[{id:'investor_name',type:'text',label:'Investor name',ar:'اسم المستثمر'},{id:'date',type:'date',label:'Date',ar:'التاريخ'}],
 signatureSlots:[{id:'investor',label:'Investor signature',ar:'توقيع المستثمر',page:38,rect:[100,700,200,30]}],legacyPdfLayout:legacy};
const image='data:image/png;base64,'+readFileSync('tests/fixtures/signature.png').toString('base64');
const base={id:'a'.repeat(32),sha256:'b'.repeat(64),source:'online',answers:{},profile:{},signatures:{}};
const layout=doc=>Object.fromEntries(['pages','pdfVersion','pageSizes','signatureSlots'].filter(k=>k in doc).map(k=>[k,doc[k]]));
const php=(code,input,args=[])=>{
 const r=spawnSync('php',['-r',code,...args],{input:JSON.stringify(input),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');return JSON.parse(r.stdout);
};
function inspect(cases){return php(`require $argv[1];$out=[];foreach(json_decode(stream_get_contents(STDIN),true) as $c){$s=$c['submission'];$d=$c['definition'];$before=$s;$out[]=['signing'=>submissionSigningCapability($s,$d),'state'=>submissionSignatureState($s,$d),'unchanged'=>$before===$s];}echo json_encode($out);`,cases,[path.resolve('public/api/portal-versions.php')]);}

test('legacy 13-page and saved 13/24-page terms use frozen identities for signed and unsigned status',()=>{
 const cases=[];
 for(const pdf of [null,layout(old),retired]){
  const profile=pdf?{pdf_layout:pdf}:{};
  for(const [answers,signatures,state] of [[{}, {},'unsigned'],[{}, {terms_0:image,authorization_0:image},'electronic'],[{terms_name_1:'Another signer'}, {terms_0:image,authorization_0:image},'unsigned'],[{terms_name_1:'Another signer'}, {terms_0:image,terms_1:image,authorization_0:image},'electronic']])cases.push({definition:current,submission:{...base,profile,answers,signatures},expected:state,pages:pdf?.pages||13});
 }
 const results=inspect(cases);
 results.forEach((r,i)=>{assert.equal(r.state.signature_state,cases[i].expected);assert.equal(r.signing.expectedPages,cases[i].pages);assert.equal(r.signing.use_saved_pdf,true);assert.equal(r.signing.can_sign_electronically,true);assert.equal(r.unchanged,true);assert.ok(r.signing.signatureSlots.every(s=>s.id!=='investor'));});
});

test('unchanged online layouts keep the editor; changed legal version, positions and uploaded PDFs use saved PDF',()=>{
 const saved={...base,profile:{pdf_layout:layout(current)}};
 const cases=[
  {definition:current,submission:saved},
  {definition:{...current,title:'Custom title'},submission:saved},
  {definition:current,submission:{...saved,source:'upload'}},
  {definition:{...current,pdfVersion:'next-legal-version'},submission:saved},
  {definition:{...current,signatureSlots:[{...current.signatureSlots[0],rect:[110,700,200,30]}]},submission:saved},
 ];
 assert.deepEqual(inspect(cases).map(r=>r.signing.use_saved_pdf),[false,false,true,true,true]);
 const states=inspect([{}, {investor:image}, {terms_0:image,authorization_0:image}].map(signatures=>({definition:current,submission:{...saved,signatures}})));
 assert.deepEqual(states.map(r=>r.state.signature_state),['unsigned','electronic','unsigned']);
});

test('saved online signatures are identified without counting stale manual or uploaded images',()=>{
 const signed={...base,profile:{pdf_layout:layout(old)},signatures:{terms_0:image,investor:image}};
 const subscription={pages:1,pdfVersion:'subscription',workflow:'subscription',signatureSlots:[{id:'applicant',page:1,rect:[10,20,100,20]}]};
 const cases=[
  {definition:current,submission:signed},
  {definition:current,submission:{...signed,signatures:JSON.stringify(signed.signatures),profile:JSON.stringify(signed.profile)}},
  {definition:current,submission:{...signed,source:'upload'}},
  {definition:subscription,submission:{...base,answers:{signature_mode:'manual'},signatures:{applicant:image}}},
  {definition:subscription,submission:{...base,answers:{signature_mode:'electronic'},signatures:{applicant:image}}},
  {definition:subscription,submission:{...base,profile:{electronic_signature:{source_id:'old',source_sha256:'hash'}},answers:{signature_mode:'manual'},signatures:{applicant:image}}},
 ];
 assert.deepEqual(inspect(cases).map(r=>r.signing.existingSignatureIds),[['terms_0'],['terms_0'],[],[],['applicant'],['applicant']]);
});

test('historical signing endpoint accepts saved slots, preserves source bytes/answers, and rejects current-only slots',async t=>{
 const folder=mkdtempSync(path.join(tmpdir(),'forms-historical-signing-')),site=path.join(folder,'site'),api=path.join(site,'api');
 let server;
 t.after(async()=>{if(server?.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}rmSync(folder,{recursive:true,force:true});});
 mkdirSync(site);mkdirSync(path.join(folder,'sessions'));cpSync('public/api',api,{recursive:true});
 const definitions=doc=>{
  const card={...doc,builtin:true,number:6,downloadOnly:false};
  writeFileSync(path.join(api,'defaults.json'),JSON.stringify({documents:[card],orders:{individual:[old.id],corporate:[old.id]}}));
  writeFileSync(path.join(api,'portal-defaults.json'),JSON.stringify({[old.id]:doc}));
  writeFileSync(path.join(api,'client-profile-defaults.json'),JSON.stringify({individual:[],corporate:[]}));
 };
 definitions(current);
 const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 server=spawn('php',['-d','session.save_path='+path.join(folder,'sessions'),'-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:'+port,'-t',site],{env:{...process.env,FORMS_DATA_DIR:path.join(folder,'management'),FORMS_PORTAL_DATA_DIR:path.join(folder,'portal')},stdio:['ignore','ignore','pipe']});
 let logs='';server.stderr.on('data',chunk=>logs+=chunk);
 const url='http://127.0.0.1:'+port+'/api/portal.php';let cookie='',csrf='',workflow;
 async function request(action,{data,form,params={},status=200,bytes=false}={}){
  const response=await fetch(url+'?'+new URLSearchParams({action,...params}),{method:data||form?'POST':'GET',headers:{Cookie:cookie,'X-CSRF-Token':csrf,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:form?{body:form}:{})});
  const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
  if(bytes){assert.equal(response.status,status);return new Uint8Array(await response.arrayBuffer());}
  const body=await response.json();assert.equal(response.status,status,action+': '+JSON.stringify(body));if(body.csrf)csrf=body.csrf;if(body.workflow)workflow=body.workflow;return body;
 }
 let ready=false;for(let i=0;i<80;i++){assert.equal(server.exitCode,null,logs);try{await request('session');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}assert.ok(ready,logs);
 const password='Historical-fixture-only-9!';const user=(await request('register',{data:{first_name:'Synthetic',last_name:'Signing',phone:'551990011',account_type:'individual',password,confirm:password},status:201})).user;
 const digest=data=>createHash('sha256').update(data).digest('hex');
 const row=id=>php(`$db=new PDO('sqlite:'.$argv[1]);$q=$db->prepare('SELECT answers,profile,sha256,source,signatures FROM submissions WHERE id=?');$q->execute([$argv[2]]);echo json_encode($q->fetch(PDO::FETCH_ASSOC));`,null,[path.join(folder,'portal/clients.sqlite'),id]);
 const oldBytes=readFileSync('reference/pdfs/archived/terms-13-page-riyadh-20261014.pdf'),retiredBytes=readFileSync('reference/documents/archived/terms-and-conditions-modern-20260928.pdf');
 const blank=await PDFDocument.create();for(let i=0;i<38;i++)blank.addPage([595.28,841.89]);const currentBytes=await blank.save();let expected=null;
 for(const item of [
  {name:'legacy13',doc:old,bytes:oldBytes,legacy:true},
  {name:'snapshot13',doc:old,bytes:oldBytes,partial:true},
  {name:'snapshot24',doc:{...old,...retired},bytes:retiredBytes,review:true},
  {name:'upload13',doc:old,bytes:oldBytes,source:'upload'},
  {name:'current38',doc:current,bytes:currentBytes},
 ]){
  definitions(item.doc);const answers=item.doc.pages===38?{investor_name:'Synthetic Investor',date:'2026-10-15'}:{terms_name_0:'Synthetic Investor',terms_name_1:'Additional Signer',authorization_name_0:'Synthetic Investor',terms_date:'2026-10-15'};
  const form=new FormData();form.set('pdf',new Blob([item.bytes],{type:'application/pdf'}),'original.pdf');form.set('metadata',JSON.stringify({account:user.id,document:old.id,audience:'individual',source:item.source||'online',pdfVersion:item.doc.pdfVersion,workflowRevision:workflow.revision,expectedCurrent:expected,requestKey:randomUUID(),values:answers,signatures:{},signatureModes:{}}));
  const saved=(await request('submit',{form,status:201})).submission;
  if(item.legacy)php(`$db=new PDO('sqlite:'.$argv[1]);$q=$db->prepare('UPDATE submissions SET profile=? WHERE id=?');$q->execute(['{}',$argv[2]]);echo 'true';`,null,[path.join(folder,'portal/clients.sqlite'),saved.id]);
  if(item.review)php(`$db=new PDO('sqlite:'.$argv[1]);$q=$db->prepare('SELECT profile FROM submissions WHERE id=?');$q->execute([$argv[2]]);$p=json_decode($q->fetchColumn(),true);$p['submission_mode']='review';$p['review_required']=true;$q=$db->prepare('UPDATE submissions SET profile=? WHERE id=?');$q->execute([json_encode($p),$argv[2]]);$q=$db->prepare('INSERT INTO submission_reviews(submission_id,status,admin_username,created_at,request_key) VALUES(?,?,?,?,?)');$q->execute([$argv[2],'signature_required','synthetic-reviewer','2026-10-15T00:00:00Z','synthetic-signature-request']);echo 'true';`,null,[path.join(folder,'portal/clients.sqlite'),saved.id]);
  const before=row(saved.id);definitions(current);
  const {signing}=await request('signing_details',{params:{id:saved.id}});assert.equal(signing.expectedPages,item.doc.pages);assert.equal(signing.use_saved_pdf,item.name!=='current38');
  const original=await request('pdf',{params:{id:saved.id},bytes:true});assert.equal(digest(original),digest(item.bytes));
  assert.equal((await request('detail',{params:{id:saved.id}})).submission.signature_state,item.source==='upload'?'unknown':'unsigned');
  const ids=item.partial?['terms_0']:signing.requiredSignatureIds,images=Object.fromEntries(ids.map(id=>[id,image]));
  const signed=await PDFDocument.load(original,{updateMetadata:false}),png=await signed.embedPng(image);for(const slot of signing.signatureSlots)if(images[slot.id]){const page=signed.getPage(slot.page-1);page.drawImage(png,{x:slot.rect[0],y:page.getHeight()-slot.rect[1]-slot.rect[3],width:slot.rect[2],height:slot.rect[3]});}
  const signedBytes=await signed.save();
  const overlay=signatures=>{const f=new FormData();f.set('pdf',new Blob([signedBytes],{type:'application/pdf'}),'signed.pdf');f.set('metadata',JSON.stringify({account:user.id,sourceId:saved.id,expectedCurrent:saved.id,sourceSha256:signing.sourceSha256,workflowRevision:workflow.revision,requestKey:randomUUID(),signatures}));return f;};
  if(item.doc.pages!==38)assert.equal((await request('sign_submission',{form:overlay({investor:image}),status:422})).error,'signature_image_required');
  if(item.review)assert.equal((await request('sign_submission',{form:overlay({terms_0:image,authorization_0:image}),status:422})).error,'signature_required');
  const result=(await request('sign_submission',{form:overlay(images),status:201})).submission;expected=result.id;
  const details=(await request('detail',{params:{id:result.id}})).submission;
  assert.equal(details.signature_state,item.partial?'unsigned':'electronic',item.name);assert.equal(details.edited_from,saved.id);assert.deepEqual(details.answers,JSON.parse(before.answers));
  assert.deepEqual(details.profile.signature_submission_policy.signatureSlots.map(s=>s.id),signing.signatureSlots.map(s=>s.id));
  assert.equal(digest(await request('pdf',{params:{id:result.id},bytes:true})),digest(signedBytes));
  assert.deepEqual(row(saved.id),before);assert.equal(digest(await request('pdf',{params:{id:saved.id},bytes:true})),digest(original));
  if(!item.legacy)assert.deepEqual(details.profile.pdf_layout,JSON.parse(before.profile).pdf_layout);
  if(item.partial){
   // This PDF already contains terms_0. A later signature request adds only the
   // two missing slots, preserving both its image metadata and source PDF bytes.
   php(`$db=new PDO('sqlite:'.$argv[1]);$q=$db->prepare('SELECT profile FROM submissions WHERE id=?');$q->execute([$argv[2]]);$p=json_decode($q->fetchColumn(),true);$p['submission_mode']='review';$p['review_required']=true;$q=$db->prepare('UPDATE submissions SET profile=? WHERE id=?');$q->execute([json_encode($p),$argv[2]]);$q=$db->prepare('INSERT INTO submission_reviews(submission_id,status,admin_username,created_at,request_key) VALUES(?,?,?,?,?)');$q->execute([$argv[2],'signature_required','synthetic-reviewer','2026-10-15T00:00:00Z','partial-signature-request']);echo 'true';`,null,[path.join(folder,'portal/clients.sqlite'),result.id]);
   const partialBefore=row(result.id),partial=(await request('signing_details',{params:{id:result.id}})).signing;
   assert.deepEqual(partial.existingSignatureIds,['terms_0']);
   const missing=partial.requiredSignatureIds.filter(id=>!partial.existingSignatureIds.includes(id));
   assert.deepEqual(missing,['terms_1','authorization_0']);
   const additions=Object.fromEntries(missing.map(id=>[id,image]));
   const completed=await PDFDocument.load(signedBytes,{updateMetadata:false}),stamp=await completed.embedPng(image);
   for(const slot of partial.signatureSlots)if(additions[slot.id]){const page=completed.getPage(slot.page-1);page.drawImage(stamp,{x:slot.rect[0],y:page.getHeight()-slot.rect[1]-slot.rect[3],width:slot.rect[2],height:slot.rect[3]});}
   const completedBytes=await completed.save();
   const completeOverlay=signatures=>{const f=new FormData();f.set('pdf',new Blob([completedBytes],{type:'application/pdf'}),'completed.pdf');f.set('metadata',JSON.stringify({account:user.id,sourceId:result.id,expectedCurrent:result.id,sourceSha256:partial.sourceSha256,workflowRevision:workflow.revision,requestKey:randomUUID(),signatures}));return f;};
   assert.equal((await request('sign_submission',{form:completeOverlay({terms_0:image,...additions}),status:422})).error,'signature_invalid','existing embedded image cannot be overlaid again');
   assert.equal((await request('sign_submission',{form:completeOverlay({authorization_0:'data:image/png;base64,broken'}),status:400})).error,'signature_invalid');
   assert.equal((await request('sign_submission',{form:completeOverlay({authorization_0:image}),status:422})).error,'signature_required','remaining conditional signer still required');
   const finished=(await request('sign_submission',{form:completeOverlay(additions),status:201})).submission;expected=finished.id;
   const final=(await request('detail',{params:{id:finished.id}})).submission;
   assert.equal(final.signature_state,'electronic');assert.deepEqual(final.signatures,{terms_0:image,...additions});assert.deepEqual(final.answers,details.answers);
   assert.equal(digest(await request('pdf',{params:{id:finished.id},bytes:true})),digest(completedBytes));
   assert.deepEqual(row(result.id),partialBefore);assert.equal(digest(await request('pdf',{params:{id:result.id},bytes:true})),digest(signedBytes));
   assert.deepEqual(row(saved.id),before);assert.equal(digest(await request('pdf',{params:{id:saved.id},bytes:true})),digest(original));
  }
 }
});
