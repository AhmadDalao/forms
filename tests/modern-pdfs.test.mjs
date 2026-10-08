import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';
import {submissionDetailsModel} from '../src/portal/submitted-details.js';
const original=JSON.parse(readFileSync('reference/documents/form-schema-20260927.json'));
// Explicit input cleanup and source-verified KYC copy corrections are allowed;
// the historical snapshot itself remains unchanged.
for(const doc of original){
 const removed={'kyc-individual':['issue_place','rep_issue','rep_place'],'kyc-corporate':['auth_issue_place','auth_issue_date']}[doc.id]||[];
 doc.fields=doc.fields.filter(f=>!removed.includes(f.id));
 const fax=doc.fields.find(f=>f.id==='rep_fax');if(fax)Object.assign(fax,{id:'rep_email',label:'Email',ar:'البريد الإلكتروني',type:'email',uiOnly:true});
 for(const slot of doc.signatureSlots)if(slot.requireWhenFields)slot.requireWhenFields=slot.requireWhenFields.filter(id=>!removed.includes(id)).map(id=>id==='rep_fax'?'rep_email':id);
 if(doc.id.startsWith('kyc-')){
  doc.fields.find(f=>f.id==='risk_capital').ar='5. ماهي نسبة رأس المال التي سوف تستعملها لهذا الاستثمار (من إجمالي رأس المال باستثناء العقارات والاستثمارات غير النقدية) ؟';
  const objectives=doc.fields.find(f=>f.id==='objectives').options;
  objectives.find(o=>o.value==='balanced').ar='متوازنة';
  if(doc.id==='kyc-corporate')objectives.find(o=>o.value==='income').label='Realization of Income';
 }
}
const layouts=JSON.parse(readFileSync('src/forms/modern-layouts.json'));
const legacy=JSON.parse(readFileSync('scripts/pdf-design/legacy-signing-layouts.json'));
const semantic=field=>Object.fromEntries(['id','type','label','ar','uiOnly','hidden','join','joinAudience','required','optional','multiple','sum','sharedKey','dependsOn','when'].filter(k=>k in field).map(k=>[k,field[k]]));

test('published custom titles and order survive release-owned PDF page/version refresh',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'forms-catalogue-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const current=docs.find(d=>d.id==='signature-form');
 writeFileSync(path.join(dir,'document-catalogue.php'),readFileSync('public/api/document-catalogue.php'));
 writeFileSync(path.join(dir,'defaults.json'),JSON.stringify({documents:[{id:current.id,pages:current.pages,pdfVersion:current.pdfVersion,downloadOnly:false}]}));
 const r=spawnSync('php',['-r',`require $argv[1];$doc=['id'=>'signature-form','builtin'=>true,'title'=>'Owner title','ar'=>'عنوان المالك','pages'=>1,'pdfVersion'=>'old','downloadOnly'=>true];$custom=['id'=>'upload_123','title'=>'Custom PDF','pages'=>3,'pdfVersion'=>'custom','builtin'=>false];echo json_encode(currentBuiltinPresentation(['documents'=>[$custom,$doc]])['documents']);`,path.join(dir,'document-catalogue.php')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const documents=JSON.parse(r.stdout);
 assert.deepEqual(documents[0],{id:'upload_123',title:'Custom PDF',pages:3,pdfVersion:'custom',builtin:false});
 assert.equal(documents[1].title,'Owner title');assert.equal(documents[1].ar,'عنوان المالك');
 assert.equal(documents[1].pages,current.pages);assert.equal(documents[1].pdfVersion,current.pdfVersion);assert.equal(documents[1].downloadOnly,false);
});

test('stale browser templates cannot submit answers onto a replaced PDF layout',()=>{
 const r=spawnSync('php',['-r',`function reject($code,$status=400){throw new Exception($code,$status);}require 'public/api/portal-versions.php';$d=['legacyPdfLayout'=>['pages'=>1],'pdfVersion'=>'modern'];$out=[];foreach([[$d,[],'online'],[$d,['pdfVersion'=>'old'],'online'],[$d,['pdfVersion'=>'modern'],'online'],[$d,[],'upload'],[[],[],'online']] as [$def,$meta,$source]){try{requireCurrentPdfTemplate($def,$meta,$source);$out[]='allowed';}catch(Exception $e){$out[]=[$e->getMessage(),$e->getCode()];}}echo json_encode($out);`],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 assert.deepEqual(JSON.parse(r.stdout),[['template_changed',409],['template_changed',409],'allowed','allowed','allowed']);
});

test('modern PDF design preserves every customer field, option, calculation and signature identity',()=>{
 for(const old of original){
  const doc=docs.find(d=>d.id===old.id);assert.ok(doc);
  assert.deepEqual(doc.fields.map(semantic),old.fields.map(semantic),old.id);
  for(const field of old.fields){
   const current=doc.fields.find(f=>f.id===field.id);
   assert.deepEqual(current.options?.map(({value,label,ar})=>({value,label,ar})),field.options?.map(({value,label,ar})=>({value,label,ar})),old.id+'/'+field.id);
  }
  assert.deepEqual(signatureSlots(doc).map(({id,section,requiredForSubmission,requireWhenFields})=>({id,section,requiredForSubmission,requireWhenFields})),old.signatureSlots.map(({id,section,requiredForSubmission,requireWhenFields})=>({id,section,requiredForSubmission,requireWhenFields})),old.id);
 }
});
test('every modern input destination is inside its page and does not overlap another input or signature',()=>{
 for(const doc of docs.filter(d=>layouts[d.id])){
  const boxes=[];
  for(const f of doc.fields.filter(f=>!f.uiOnly)){
   assert.ok(f.page>=1&&f.page<=doc.pages);
   assert.equal(f.cells,undefined);assert.equal(f.dateParts,undefined);assert.equal(f.placeholderRects,undefined);
   if(f.type==='choice')for(const o of f.options){assert.equal(o.extraRects,undefined);boxes.push({id:f.id+':'+o.value,page:f.page,rect:o.rect});}
   else boxes.push({id:f.id,page:f.page,rect:f.rect});
  }
  boxes.push(...signatureSlots(doc));
  for(const b of boxes){
   const [x,y,w,h]=b.rect;assert.ok(x>=48&&x+w<=548&&y>=93&&y+h<=781,doc.id+'/'+b.id+' outside content area');
   for(const a of boxes){if(a===b||a.page!==b.page)continue;
    const overlap=Math.min(a.rect[0]+a.rect[2],x+w)-Math.max(a.rect[0],x)>0.1&&Math.min(a.rect[1]+a.rect[3],y+h)-Math.max(a.rect[1],y)>0.1;
    assert.equal(overlap,false,doc.id+'/'+a.id+' overlaps '+b.id);
   }
  }
 }
});
test('old PDFs use frozen signing positions and new snapshots use their own positions without rewriting history',()=>{
 const doc=docs.find(d=>d.id==='signature-form');
 const current={...doc,legacyPdfLayout:legacy[doc.id]};
 const source={id:'a'.repeat(32),sha256:'b'.repeat(64),profile:{},answers:{},source:'online'};
 const snapshot={pages:doc.pages,pdfVersion:doc.pdfVersion,signatureSlots:signatureSlots(doc)};
 const cases=[source,{...source,profile:{pdf_layout:snapshot}},{...source,source:'upload',profile:{pdf_layout:snapshot}}];
 const r=spawnSync('php',['-r',`require 'public/api/portal-versions.php';$p=json_decode(stream_get_contents(STDIN),true);$out=[];foreach($p['cases'] as $s){$before=$s;$out[]=[submissionSigningCapability($s,$p['doc']),$before===$s];}echo json_encode($out);`],{input:JSON.stringify({doc:current,cases}),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const results=JSON.parse(r.stdout);
 assert.equal(results[0][0].expectedPages,legacy[doc.id].pages);
 assert.deepEqual(results[0][0].signatureSlots[0].rect,legacy[doc.id].signatureSlots[0].rect);
 for(const result of results.slice(1)){assert.equal(result[0].expectedPages,doc.pages);assert.deepEqual(result[0].signatureSlots[0].rect,signatureSlots(doc)[0].rect);}
 assert.ok(results.every(r=>r[1]));
 const model=submissionDetailsModel({...source,doc_id:doc.id,audience:'individual',profile:{pdf_layout:snapshot}});
 assert.equal(model.shared.flatMap(g=>g.fields).some(f=>f.id==='pdf_layout'),false);
});

test('restored T&C keeps the approved footer-updated PDF and original field/signature geometry',async()=>{
 const {createHash}=await import('node:crypto');
 const doc=docs.find(d=>d.id==='terms-and-conditions'),old=original.find(d=>d.id===doc.id);
 assert.equal(createHash('sha256').update(readFileSync('reference/pdfs/terms-and-conditions.pdf')).digest('hex'),'8bdd17efdfa24c71ed0e667c9bb142cbe68d77085ef7ab82386d3bd0b3433106');
 assert.equal(createHash('sha256').update(readFileSync('public/pdfs/terms-and-conditions.pdf')).digest('hex'),'f756a1dc5a44fe320c1ce160f963d301430b05350e3f51efcd15dc57eab1cd15');
 assert.equal(doc.pages,13);assert.equal(doc.pdfVersion,'20261007-national-address');assert.equal(layouts[doc.id],undefined);
 assert.deepEqual(doc.fields.map(({identityRow,compactChoices,control,dropdownOptions,...field})=>field),old.fields.map(({identityRow,compactChoices,control,dropdownOptions,...field})=>field));assert.deepEqual(signatureSlots(doc),old.signatureSlots);
 assert.deepEqual(doc.fields.filter(f=>f.type==='date').map(f=>f.page),[11,13]);
 assert.ok(doc.fields.filter(f=>f.type==='date').every(f=>f.defaultToday&&f.dateParts.length===3));
});

test('restored signature form keeps the approved footer update, one-page fields and specimen signature area',async()=>{
 const {createHash}=await import('node:crypto');
 const doc=docs.find(d=>d.id==='signature-form'),old=original.find(d=>d.id===doc.id);
 assert.equal(createHash('sha256').update(readFileSync('reference/pdfs/signature-form.pdf')).digest('hex'),'9e318786ea04e80c9eac40c6c729369077782d15e4404d6a6f78298b550b92e0');
 assert.equal(createHash('sha256').update(readFileSync('public/pdfs/signature-form.pdf')).digest('hex'),'9b9306cbe69bd3e18b04458ac9a2b6768ff63c7224b0f174f51468fba949ab0f');
 assert.equal(doc.pages,1);assert.equal(doc.pdfVersion,'20261007-national-address');assert.equal(layouts[doc.id],undefined);
 assert.deepEqual(doc.fields.map(({identityRow,compactChoices,control,dropdownOptions,...field})=>field),old.fields.map(({identityRow,compactChoices,control,dropdownOptions,...field})=>field));assert.deepEqual(signatureSlots(doc),old.signatureSlots);
});

test('original, retired modern and restored signature forms retain immutable signing destinations',()=>{
 const doc=docs.find(d=>d.id==='signature-form');
 const retired=JSON.parse(readFileSync('reference/documents/archived/signature-modern-layout.json'));
 const restored={pages:doc.pages,pdfVersion:doc.pdfVersion,signatureSlots:signatureSlots(doc)};
 const source={id:'a'.repeat(32),sha256:'b'.repeat(64),profile:{},answers:{},source:'online'};
 const cases=[source,...[retired,restored].map(pdf_layout=>({...source,profile:{pdf_layout}}))];
 const r=spawnSync('php',['-r',`require 'public/api/portal-versions.php';$p=json_decode(stream_get_contents(STDIN),true);$out=[];foreach($p['cases'] as $s){$before=$s;$out[]=[submissionSigningCapability($s,$p['doc']),$before===$s];}echo json_encode($out);`],{input:JSON.stringify({doc:{...doc,legacyPdfLayout:legacy[doc.id]},cases}),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const results=JSON.parse(r.stdout);
 for(const [i,layout] of [legacy[doc.id],retired,restored].entries()){
  assert.equal(results[i][0].expectedPages,layout.pages);
  assert.deepEqual(results[i][0].signatureSlots,layout.signatureSlots.map(({section,...slot})=>slot));
  assert.equal(results[i][1],true);
 }
 assert.deepEqual(results.map(r=>r[0].expectedPages),[1,2,1]);
});

test('original, retired modern and restored T&C submissions retain their own signing geometry',()=>{
 const doc=docs.find(d=>d.id==='terms-and-conditions');
 const retired=JSON.parse(readFileSync('reference/documents/archived/terms-modern-layout.json'));
 const restored={pages:doc.pages,pdfVersion:doc.pdfVersion,signatureSlots:signatureSlots(doc)};
 const source={id:'a'.repeat(32),sha256:'b'.repeat(64),profile:{},answers:{},source:'online'};
 const cases=[source,...[retired,restored].map(pdf_layout=>({...source,profile:{pdf_layout}}))];
 const r=spawnSync('php',['-r',`require 'public/api/portal-versions.php';$p=json_decode(stream_get_contents(STDIN),true);$out=[];foreach($p['cases'] as $s){$before=$s;$out[]=[submissionSigningCapability($s,$p['doc']),$before===$s];}echo json_encode($out);`],{input:JSON.stringify({doc:{...doc,legacyPdfLayout:legacy[doc.id]},cases}),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const results=JSON.parse(r.stdout);
 for(const [i,layout] of [legacy[doc.id],retired,restored].entries()){
  assert.equal(results[i][0].expectedPages,layout.pages);
  assert.deepEqual(results[i][0].signatureSlots,layout.signatureSlots.map(({section,...slot})=>slot));
  assert.equal(results[i][1],true);
 }
 assert.deepEqual(results.map(r=>r[0].expectedPages),[13,24,13]);
});

test('restored KYC templates use seven Letter pages and preserve original, modern and restored signing snapshots',()=>{
 const suppliedHashes={'kyc-individual':'79beab46fbc249f91d8d6945b5ac84b950bbd32f7e26eb82577b1c581f1f483e','kyc-corporate':'9411391263310da2a9f090734c9a9e1b6a8d5ecf4ab1536da28f3652f5185276'};
 for(const id of ['kyc-individual','kyc-corporate']){
  assert.equal(createHash('sha256').update(readFileSync(`reference/pdfs/supplied-20261007/${id}.pdf`)).digest('hex'),suppliedHashes[id]);
  const doc=docs.find(d=>d.id===id);
  assert.equal(doc.pages,7);assert.equal(doc.pdfVersion,'20261007-original-kyc');assert.equal(layouts[id],undefined);
  assert.deepEqual(doc.pageSizes,Array.from({length:7},()=>[612,792]));
  const retired=JSON.parse(readFileSync(`reference/documents/archived/${id}-modern-layout.json`));
  const restored={pages:doc.pages,pdfVersion:doc.pdfVersion,pageSizes:doc.pageSizes,signatureSlots:signatureSlots(doc)};
  const source={id:'a'.repeat(32),sha256:'b'.repeat(64),profile:{},answers:{},source:'online'};
  const cases=[source,...[retired,restored].map(pdf_layout=>({...source,profile:{pdf_layout}}))];
  const r=spawnSync('php',['-r',`require 'public/api/portal-versions.php';$p=json_decode(stream_get_contents(STDIN),true);$out=[];foreach($p['cases'] as $s){$before=$s;$out[]=[submissionSigningCapability($s,$p['doc']),$before===$s];}echo json_encode($out);`],{input:JSON.stringify({doc:{...doc,legacyPdfLayout:legacy[id]},cases}),encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);const results=JSON.parse(r.stdout);
  for(const [i,layout] of [legacy[id],retired,restored].entries()){
   assert.equal(results[i][0].expectedPages,layout.pages);
   assert.deepEqual(results[i][0].signatureSlots,layout.signatureSlots.map(({section,...slot})=>slot));
   assert.equal(results[i][1],true);
  }
  assert.deepEqual(results.map(r=>r[0].expectedPages),[7,id==='kyc-individual'?11:9,7]);
 }
});

test('representative email stays captured in management without printing in the original Fax box',()=>{
 const doc=docs.find(d=>d.id==='kyc-individual'),email=doc.fields.find(f=>f.id==='rep_email');
 assert.equal(email.uiOnly,true);assert.equal(email.rect,null);assert.equal(email.type,'email');
 const model=submissionDetailsModel({doc_id:doc.id,audience:'individual',source:'online',profile:{},answers:{rep_email:'representative@example.com'}});
 const captured=model.groups.flatMap(g=>g.fields).find(f=>f.id==='rep_email');
 assert.equal(captured.value,'representative@example.com');assert.equal(captured.label,'Email');
});
