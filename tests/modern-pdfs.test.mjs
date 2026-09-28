import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';
import {submissionDetailsModel} from '../src/portal/submitted-details.js';
const original=JSON.parse(readFileSync('reference/documents/form-schema-20260927.json'));
const layouts=JSON.parse(readFileSync('src/forms/modern-layouts.json'));
const legacy=JSON.parse(readFileSync('scripts/pdf-design/legacy-signing-layouts.json'));
const semantic=field=>Object.fromEntries(['id','type','label','ar','uiOnly','hidden','join','joinAudience','required','optional','multiple','sum','sharedKey','dependsOn','when'].filter(k=>k in field).map(k=>[k,field[k]]));

test('published custom titles and order survive release-owned PDF page/version refresh',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'forms-catalogue-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const current=docs.find(d=>d.id==='signature-form');
 writeFileSync(path.join(dir,'document-catalogue.php'),readFileSync('public/api/document-catalogue.php'));
 writeFileSync(path.join(dir,'defaults.json'),JSON.stringify({documents:[{id:current.id,pages:current.pages,pdfVersion:current.pdfVersion}]}));
 const r=spawnSync('php',['-r',`require $argv[1];$doc=['id'=>'signature-form','builtin'=>true,'title'=>'Owner title','ar'=>'عنوان المالك','pages'=>1,'pdfVersion'=>'old'];$custom=['id'=>'upload_123','title'=>'Custom PDF','pages'=>3,'pdfVersion'=>'custom','builtin'=>false];echo json_encode(currentBuiltinPresentation(['documents'=>[$custom,$doc]])['documents']);`,path.join(dir,'document-catalogue.php')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const documents=JSON.parse(r.stdout);
 assert.deepEqual(documents[0],{id:'upload_123',title:'Custom PDF',pages:3,pdfVersion:'custom',builtin:false});
 assert.equal(documents[1].title,'Owner title');assert.equal(documents[1].ar,'عنوان المالك');
 assert.equal(documents[1].pages,current.pages);assert.equal(documents[1].pdfVersion,current.pdfVersion);
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

test('restored T&C keeps the exact original PDF and all original field/signature geometry',async()=>{
 const {createHash}=await import('node:crypto');
 const doc=docs.find(d=>d.id==='terms-and-conditions'),old=original.find(d=>d.id===doc.id);
 assert.equal(createHash('sha256').update(readFileSync('public/pdfs/terms-and-conditions.pdf')).digest('hex'),'8bdd17efdfa24c71ed0e667c9bb142cbe68d77085ef7ab82386d3bd0b3433106');
 assert.equal(doc.pages,13);assert.equal(doc.pdfVersion,'20260928-original-2');assert.equal(layouts[doc.id],undefined);
 assert.deepEqual(doc.fields,old.fields);assert.deepEqual(signatureSlots(doc),old.signatureSlots);
 assert.deepEqual(doc.fields.filter(f=>f.type==='date').map(f=>f.page),[11,13]);
 assert.ok(doc.fields.filter(f=>f.type==='date').every(f=>f.defaultToday&&f.dateParts.length===3));
});

test('restored signature form keeps the original PDF, one-page fields and specimen signature area',async()=>{
 const {createHash}=await import('node:crypto');
 const doc=docs.find(d=>d.id==='signature-form'),old=original.find(d=>d.id===doc.id);
 assert.equal(createHash('sha256').update(readFileSync('public/pdfs/signature-form.pdf')).digest('hex'),'9e318786ea04e80c9eac40c6c729369077782d15e4404d6a6f78298b550b92e0');
 assert.equal(doc.pages,1);assert.equal(doc.pdfVersion,'20260928-original-3');assert.equal(layouts[doc.id],undefined);
 assert.deepEqual(doc.fields,old.fields);assert.deepEqual(signatureSlots(doc),old.signatureSlots);
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
