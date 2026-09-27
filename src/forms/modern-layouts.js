import layouts from './modern-layouts.json' with {type:'json'};
import {signatureSlots} from '../signatures.js';

// The Word probe is the coordinate authority. Field semantics, validation,
// shared-data links and submitted answers remain independent of presentation.
export function applyModernLayouts(documents){
 for(const doc of documents){
  const layout=layouts[doc.id];if(!layout)continue;
  const previousSlots=signatureSlots(doc);
  doc.pages=layout.pages;doc.pdfVersion=layout.version;
  doc.pageSizes=Array.from({length:doc.pages},()=>[595.3,841.9]);
  for(const field of doc.fields){
   if(field.uiOnly)continue;
   const position=layout.fields[field.id];
   if(!position)throw Error(`Missing modern PDF destination: ${doc.id}/${field.id}`);
   if(field.cells&&!field.maxLength&&field.type!=='date')field.maxLength=field.cells;
   for(const key of ['cells','dateParts','dateOrder','charRects','placeholderRects','mirrorRects','rtlRect'])delete field[key];
   Object.assign(field,{page:position.page,fontSize:10,minFontSize:6.5,padding:1.5});
   if(field.type==='choice')for(const option of field.options){
    if(!position.options[option.value])throw Error(`Missing modern PDF option: ${doc.id}/${field.id}/${option.value}`);
    option.rect=position.options[option.value];delete option.extraRects;delete option.mirrorRects;
   }
   else field.rect=position.rect;
  }
  if(doc.id==='kyc-individual'){
   const first=doc.fields.find(f=>f.id==='name_1'),last=doc.fields.find(f=>f.id==='name_2');
   first.rtlRect=[...last.rect];last.rtlRect=[...first.rect];
  }
  for(const field of doc.fields.filter(f=>f.uiOnly)){
   const parent=doc.fields.find(f=>!f.uiOnly&&f.join?.includes(field.id));
   if(parent)field.page=parent.page;
  }
  doc.signatureSlots=previousSlots.map(slot=>{
   const position=layout.fields['signature:'+slot.id];
   if(!position)throw Error(`Missing modern signature destination: ${doc.id}/${slot.id}`);
   return {...slot,...position};
  });
  doc.signing=[...new Set(doc.signatureSlots.map(s=>s.page))];
  for(const section of doc.sections)section.page=Math.min(...section.fields.filter(f=>!f.uiOnly).map(f=>f.page),...doc.signatureSlots.filter(s=>s.section===section.id).map(s=>s.page));
 }
}
