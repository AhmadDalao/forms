// Reproducible field ledger. Source semantics are reviewed against the paper
// inventory; render coverage is backed by the generated-PDF audit, not inferred.
import fs from 'node:fs';
import {docs} from '../src/forms/index.js';
import {sharedRules} from '../src/shared-fields.js';
import {signatureSlots} from '../src/signatures.js';
const rendering=JSON.parse(fs.readFileSync('tmp/next-update-pdfs/verification.json'));
const source=JSON.parse(fs.readFileSync('tmp/next-update-paper/structure-report.json'));
const ledger={date:'2026-09-20',scope:'Eight editable forms and one download-only consent document',
 evidence:{paperInventory:'docs/paper-field-match-verification.md',sourceHashes:'tmp/next-update-paper/structure-report.json',rendering:'tmp/next-update-pdfs/verification.json',visualReview:'All 14 Arabic/English long-answer contact sheets inspected; exact paper text preserved by render checks.'},
 notes:['Labels below are the source-aligned UI labels; approved subscription wording and UI-only name/address parts intentionally differ from the printed layout.','Coordinates use PDF points measured from the top left; UI-only fields identify the derived printed destinations.','Sharing lists include conditional account-holder/authorized-person rules. Different representatives, overseas addresses and tax answers remain independent.','A passed layout audit does not certify regulatory compliance or guarantee that unlimited text fits.'],documents:[]};
for(const doc of docs){
 const audiences=doc.group==='shared'?['individual','corporate']:[doc.group];
 const destination=f=>({field:f.id,page:f.page,rect:f.rect||null,rtlRect:f.rtlRect||null,cells:f.parts||null,extraRects:f.extraRects||[],options:(f.options||[]).filter(o=>o.rect).map(o=>({value:o.value,rect:o.rect,extraRects:o.extraRects||[]}))});
 const targets=(field,seen=new Set())=>{
  if(seen.has(field.id))return [];seen.add(field.id);
  if(field.rect||field.options?.some(o=>o.rect))return [destination(field)];
  return doc.fields.filter(f=>f.join?.includes(field.id)).flatMap(f=>targets(f,seen));
 };
 const mappedSource=source.documents.find(d=>d.id===doc.id);
 const fields=doc.fields.map(f=>{
  const group=doc.personNameGroups?.find(g=>g.partIds.includes(f.id));
  const rules=Object.fromEntries(audiences.map(audience=>{const r=sharedRules(doc,{signer_role:audience==='individual'?'client':'authorized',capacity:'holder'},{},audience)[f.id];return [audience,r?{keys:r.keys,direction:r.write?'bidirectional':'derived/read',condition:f.id.startsWith('signer_')&&['signature-form','fatca-crs-individual'].includes(doc.id)?'Only when account holder / authorized person is selected':null}:{direction:'independent'}];}));
  const destinationList=targets(f),options=f.options||f.selectOptions?.map(([value,label,ar])=>({value,label,ar}))||[];
  return {id:f.id,section:doc.sections.find(s=>s.fields.some(item=>item.id===f.id))?.id,label:{english:f.label,arabic:f.ar},type:f.type,uiOnly:!!f.uiOnly,derivedFrom:f.join||[],options:options.map(o=>({value:o.value,english:o.label,arabic:o.ar})),pdfDestinations:destinationList,language:{input:f.direction||group?.language||(['email','tel','url','date'].includes(f.type)?'ltr':'auto'),automaticTranslation:false},sharedMeaning:rules,validation:{required:!!f.required||!!group?.required&&f.personNamePart!=='third',optionalThirdName:f.personNamePart==='third'||/^(en|ar)_third$/.test(f.id),maxLength:f.maxLength??null,choicesRestricted:options.length>0,email:f.type==='email',date:f.type==='date',readOnly:!!f.readOnly||!!f.sum,visibleWhen:f.when?{field:f.dependsOn,values:f.when}:null,backendCalculated:doc.workflow==='subscription'&&['fund_name','currency','unit_price','amount_subscribed','subscription_fee','total_amount','total_words'].includes(f.id)},check:{destination:destinationList.length?'covered by rendered mapped-field audit':f.uiOnly?'UI control / no additional paper box':'no dynamic text destination',renderCoverage:{completeFills:rendering.coverage[doc.id].complete_success,uncoveredDestinations:destinationList.map(d=>d.field).filter(id=>rendering.coverage[doc.id].uncovered_fields.includes(id))},sourceReview:'See the corresponding page in paper inventory and long-answer contact sheet'}};
 });
 ledger.documents.push({id:doc.id,pages:doc.pages,template:mappedSource.template,sha256:mappedSource.sha256,fields,signatures:signatureSlots(doc).map(slot=>({...slot,submissionRequired:false,placementChecked:rendering.coverage[doc.id].signature_slots===rendering.coverage[doc.id].covered_signatures}))});
}
ledger.consent={id:'al-naeem-terms-consent',downloadOnly:true,pages:1,pdf:'public/pdfs/al-naeem-terms-consent.pdf',editableWord:'output/documents/al-naeem-terms-consent.docx',sha256:source.consent.sha256,upload:'My applications → Upload form; no structured answers or verified signature are inferred from uploaded contents.'};
ledger.totalFields=ledger.documents.reduce((total,d)=>total+d.fields.length,0);
fs.writeFileSync('docs/next-update-field-checklist.json',JSON.stringify(ledger,null,2)+'\n');
console.log(`Saved ${ledger.totalFields} field checklist entries across ${ledger.documents.length} forms, plus consent.`);
