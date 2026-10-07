import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const sources=JSON.parse(readFileSync('scripts/pdf-design/template-sources.json'));

test('current KYC PDFs cannot be selected as editable Word or modern generator sources',()=>{
 assert.equal(sources.word_documents.length,5);
 for(const id of ['kyc-individual','kyc-corporate','signature-form','terms-and-conditions']){
  assert.ok(sources.original_pdf_documents.includes(id));
  assert.ok(!sources.word_documents.includes(id));
  assert.ok(!sources.modern_documents.includes(id));
 }
 assert.ok(sources.modern_documents.every(id=>sources.word_documents.includes(id)));
});

test('partial modern installation ignores stale KYC output and preserves original PDFs and unrelated mappings',t=>{
 const root=mkdtempSync(path.join(tmpdir(),'forms-authoring-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const put=(name,value)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));};
 put('scripts/pdf-design/template-sources.json',sources);
 copyFileSync('scripts/pdf-design/install.py',path.join(root,'scripts/pdf-design/install.py'));
 const kept={'fatca-crs-individual':{pages:8,fields:{preserved:{page:1}},version:'reviewed-tax'},'original-layout-example':{pages:7,fields:{original:{page:1}},version:'reviewed-original'}};
 put('src/forms/modern-layouts.json',{...kept,'kyc-individual':{pages:11,version:'retired-modern'}});
 put('scripts/pdf-design/artifacts.json',{'kyc-individual':{pages:11},'fatca-crs-individual':{pages:8,pdf_sha256:'reviewed'}});
 for(const id of [...sources.original_pdf_documents,'unknown-template']){
  put(`tmp/modern-pdfs/${id}/layout.json`,'invalid retired output must never be read');
  put(`public/pdfs/${id}.pdf`,'ORIGINAL '+id);
  put(`output/documents/${id}.docx`,'RETIRED '+id);
 }
 const layout={pages:1,fields:{investor_name:{page:1,rect:[50,100,200,20]}},version:'reviewed-consent'};
 put('tmp/modern-pdfs/al-naeem-terms-consent/layout.json',layout);
 put('tmp/modern-pdfs/al-naeem-terms-consent/final/al-naeem-terms-consent.pdf','APPROVED CONSENT PDF');
 put('tmp/modern-pdfs/al-naeem-terms-consent/al-naeem-terms-consent.docx','APPROVED CONSENT WORD');
 const result=spawnSync('python3',[path.join(root,'scripts/pdf-design/install.py')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 for(const id of [...sources.original_pdf_documents,'unknown-template']){
  assert.equal(readFileSync(path.join(root,`public/pdfs/${id}.pdf`),'utf8'),'ORIGINAL '+id);
  assert.equal(readFileSync(path.join(root,`output/documents/${id}.docx`),'utf8'),'RETIRED '+id);
  assert.equal(existsSync(path.join(root,`output/documents/${id}.pdf`)),false);
 }
 assert.deepEqual(JSON.parse(readFileSync(path.join(root,'src/forms/modern-layouts.json'))),{...kept,'al-naeem-terms-consent':layout});
 const artifacts=JSON.parse(readFileSync(path.join(root,'scripts/pdf-design/artifacts.json')));
 assert.equal(artifacts['kyc-individual'],undefined);
 assert.deepEqual(artifacts['fatca-crs-individual'],{pages:8,pdf_sha256:'reviewed'});
 assert.equal(readFileSync(path.join(root,'public/pdfs/al-naeem-terms-consent.pdf'),'utf8'),'APPROVED CONSENT PDF');
 assert.equal(readFileSync(path.join(root,'output/documents/al-naeem-terms-consent.docx'),'utf8'),'APPROVED CONSENT WORD');
});
