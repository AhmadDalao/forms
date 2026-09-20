// Semantic structure/source-preservation checks; visual evidence and inventory live beside the report.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {signatureSlots} from '../src/signatures.js';
import {normalizePersonNames,personNameGroups} from '../src/person-names.js';
import {normalizeSubscription} from '../src/subscription/model.js';
const output=process.env.PAPER_MATCH_OUTPUT||'tmp/pdfs/paper-field-match-20260920';
fs.mkdirSync(output,{recursive:true});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const results=[];let nameCases=0;
const specimens=[['Ahmad','Mohammed','Abdullah','Al Madani'],['أحمد','محمد','عبدالله','المدني'],['Ahmad','Mohammed','','Al Madani'],['أحمد','محمد','','المدني'],['عبد الرحمن','Abdul Rahman','عبد الله','Al Abd Al Rahman']];
for(const doc of docs){
 const template=path.basename((doc.pdfUrl||doc.id+'.pdf').split('?')[0]);
 const active='public/pdfs/'+template,reference='reference/pdfs/'+template;
 const referenced=fs.existsSync(reference);if(referenced)assert.equal(sha(active),sha(reference),doc.id+' original differs');
 const ids=new Set(doc.fields.map(f=>f.id));assert.equal(ids.size,doc.fields.length,doc.id+' duplicate field');
 for(const f of doc.fields){
  assert(f.page>=1&&f.page<=doc.pages,doc.id+'/'+f.id+' page');
  if(f.join)for(const id of f.join)assert(ids.has(id),doc.id+'/'+f.id+' unknown name part');
  if(f.rectDirectionFrom)for(const id of f.rectDirectionFrom)assert(ids.has(id),doc.id+'/'+f.id+' unknown direction source');
  if(f.options)assert.equal(new Set(f.options.map(o=>o.value)).size,f.options.length,doc.id+'/'+f.id+' duplicate option');
 }
 for(const audience of doc.group==='shared'?['individual','corporate']:[doc.group])for(const group of personNameGroups(doc,audience))for(const specimen of specimens){
  const values=Object.fromEntries(group.partIds.map((id,i)=>[id,specimen[i]]));
  const normalized=normalizePersonNames(doc,values,{audience});
  for(const target of group.targets)assert.equal(normalized[target.id],target.join.map(id=>values[id]).filter(Boolean).join(' '),doc.id+'/'+group.id+' missing name part');nameCases++;
 }
 if(doc.id==='fatca-crs-individual')for(const prefix of ['ar','en'])assert.deepEqual(doc.fields.find(f=>f.id===prefix+'_middle').join,[prefix+'_second',prefix+'_third']);
 if(doc.id==='subscription-form')for(const specimen of specimens){const values=Object.fromEntries(['first_name','second_name','third_name','family_name'].map((id,i)=>[id,specimen[i]]));const normalized=normalizeSubscription(doc,values);assert.equal(normalized.full_name,specimen.filter(Boolean).join(' '));assert.equal(normalized.applicant_name,normalized.full_name);nameCases++;}
 results.push({id:doc.id,pages:doc.pages,template,sha256:sha(active),unchangedReference:referenced,fields:doc.fields.length,uiOnly:doc.fields.filter(f=>f.uiOnly).length,pdfAnswerFields:doc.fields.filter(f=>f.rect&&!f.staticPdf||f.type==='choice').length,radioCheckboxOptions:doc.fields.filter(f=>f.type==='choice').reduce((n,f)=>n+f.options.length,0),cardOptions:doc.fields.filter(f=>f.type==='cards').reduce((n,f)=>n+f.options.length,0),dropdownOptions:doc.fields.reduce((n,f)=>n+(f.selectOptions?.length||0),0),signatureSlots:signatureSlots(doc).length,pageFields:Array.from({length:doc.pages},(_,i)=>({page:i+1,fields:doc.fields.filter(f=>f.page===i+1).map(f=>f.id),signatureSlots:signatureSlots(doc).filter(s=>s.page===i+1).map(s=>s.id)}))});
}
const originals=JSON.parse(fs.readFileSync('docs/form-inventory.json')).documents.filter(d=>d.slug!=='al-naeem-terms-consent').flatMap(d=>d.source_files.map(filename=>{const source='/Users/ahmaddalao/Downloads/'+filename;assert.equal(sha(source),sha(d.local_pdf),'Uploaded original mismatch '+filename);return {source:filename,document:d.slug,sha256:sha(source),matchesReference:true};}));
const consent='public/pdfs/al-naeem-terms-consent.pdf';assert.equal(sha(consent),sha('reference/pdfs/al-naeem-terms-consent.pdf'));
const report={at:new Date().toISOString(),scope:'Current curated templates; semantic/source preservation checks plus separate fresh 43-page visual paper inventory',editors:results.length,activeEditorPages:results.reduce((n,d)=>n+d.pages,0),consentPages:1,totals:Object.fromEntries(['fields','uiOnly','pdfAnswerFields','radioCheckboxOptions','cardOptions','dropdownOptions','signatureSlots'].map(k=>[k,results.reduce((n,d)=>n+d[k],0)])),nameNormalizationCases:nameCases,originals,documents:results,consent:{downloadOnly:true,sha256:sha(consent),rebuiltEditableSource:'output/documents/al-naeem-terms-consent.docx'},limits:['This checks software/template consistency, not regulatory certification.','UI-only and derived fields are counted separately from actual paper targets.','Free-text content is bounded by each original answer space; this does not establish that arbitrarily long data can fit.']};
fs.writeFileSync(output+'/schema.json',JSON.stringify(docs.map(d=>({...d,signatureSlots:signatureSlots(d)})),null,2)+'\n');
fs.writeFileSync(output+'/structure-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({editors:report.editors,pages:report.activeEditorPages+1,totals:report.totals,nameNormalizationCases:nameCases,suppliedOriginalPdfMatches:originals.length},null,2));
