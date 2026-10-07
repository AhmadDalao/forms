import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const sources=JSON.parse(readFileSync('scripts/pdf-design/template-sources.json'));

test('current KYC uses modern Word sources while signature and terms keep original PDF bodies',()=>{
 assert.equal(sources.word_documents.length,7);
 assert.equal(sources.modern_documents.length,5);
 assert.deepEqual(sources.original_pdf_documents,['signature-form','terms-and-conditions']);
 for(const id of ['kyc-individual','kyc-corporate']){
  assert.ok(sources.word_documents.includes(id));
  assert.ok(sources.modern_documents.includes(id));
 }
 for(const id of sources.original_pdf_documents){
  assert.ok(!sources.word_documents.includes(id));
  assert.ok(!sources.modern_documents.includes(id));
 }
 assert.ok(sources.modern_documents.every(id=>sources.word_documents.includes(id)));
});

test('partial modern installation accepts KYC and preserves original PDFs and unrelated reviewed mappings',t=>{
 const root=mkdtempSync(path.join(tmpdir(),'forms-authoring-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const put=(name,value)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));};
 put('scripts/pdf-design/template-sources.json',sources);
 copyFileSync('scripts/pdf-design/install.py',path.join(root,'scripts/pdf-design/install.py'));
 const kept={'fatca-crs-individual':{pages:8,fields:{preserved:{page:1}},version:'reviewed-tax'},'kyc-corporate':{pages:9,fields:{company:{page:1}},version:'reviewed-kyc'}};
 put('src/forms/modern-layouts.json',{...kept,'signature-form':{pages:2,version:'retired-modern'}});
 put('scripts/pdf-design/artifacts.json',{'signature-form':{pages:2},'kyc-corporate':{pages:9,pdf_sha256:'reviewed-kyc'},'fatca-crs-individual':{pages:8,pdf_sha256:'reviewed'}});
 for(const id of [...sources.original_pdf_documents,'unknown-template']){
  put(`tmp/modern-pdfs/${id}/layout.json`,'invalid retired output must never be read');
  put(`public/pdfs/${id}.pdf`,'ORIGINAL '+id);
  put(`output/documents/${id}.docx`,'RETIRED '+id);
 }
 const layout={pages:1,fields:{investor_name:{page:1,rect:[50,100,200,20]}},version:'reviewed-consent'};
 put('tmp/modern-pdfs/al-naeem-terms-consent/layout.json',layout);
 put('tmp/modern-pdfs/al-naeem-terms-consent/final/al-naeem-terms-consent.pdf','APPROVED CONSENT PDF');
 put('tmp/modern-pdfs/al-naeem-terms-consent/al-naeem-terms-consent.docx','APPROVED CONSENT WORD');
 const kyc={pages:11,fields:{name_1:{page:1,rect:[50,100,200,20]}},version:'reviewed-kyc'};
 put('tmp/modern-pdfs/kyc-individual/layout.json',kyc);
 put('tmp/modern-pdfs/kyc-individual/final/kyc-individual.pdf','APPROVED KYC PDF');
 put('tmp/modern-pdfs/kyc-individual/kyc-individual.docx','APPROVED KYC WORD');
 const result=spawnSync('python3',[path.join(root,'scripts/pdf-design/install.py')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 for(const id of [...sources.original_pdf_documents,'unknown-template']){
  assert.equal(readFileSync(path.join(root,`public/pdfs/${id}.pdf`),'utf8'),'ORIGINAL '+id);
  assert.equal(readFileSync(path.join(root,`output/documents/${id}.docx`),'utf8'),'RETIRED '+id);
  assert.equal(existsSync(path.join(root,`output/documents/${id}.pdf`)),false);
 }
 assert.deepEqual(JSON.parse(readFileSync(path.join(root,'src/forms/modern-layouts.json'))),{...kept,'al-naeem-terms-consent':layout,'kyc-individual':kyc});
 const artifacts=JSON.parse(readFileSync(path.join(root,'scripts/pdf-design/artifacts.json')));
 assert.equal(artifacts['signature-form'],undefined);
 assert.equal(artifacts['kyc-individual'].pages,11);
 assert.deepEqual(artifacts['kyc-corporate'],{pages:9,pdf_sha256:'reviewed-kyc'});
 assert.deepEqual(artifacts['fatca-crs-individual'],{pages:8,pdf_sha256:'reviewed'});
 assert.equal(readFileSync(path.join(root,'public/pdfs/al-naeem-terms-consent.pdf'),'utf8'),'APPROVED CONSENT PDF');
 assert.equal(readFileSync(path.join(root,'output/documents/al-naeem-terms-consent.docx'),'utf8'),'APPROVED CONSENT WORD');
 assert.equal(readFileSync(path.join(root,'public/pdfs/kyc-individual.pdf'),'utf8'),'APPROVED KYC PDF');
 assert.equal(readFileSync(path.join(root,'output/documents/kyc-individual.docx'),'utf8'),'APPROVED KYC WORD');
 assert.equal(readFileSync(path.join(root,'output/documents/kyc-individual.pdf'),'utf8'),'APPROVED KYC PDF');
});
