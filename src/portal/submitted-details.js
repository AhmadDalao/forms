import {withAnswerTotals} from '../answer-totals.js';
import {docs} from '../forms/index.js';
import {sharedGroups} from '../shared-fields.js';
import {signatureSlots} from '../signatures.js';
import {e} from './api.js';

const metadataKeys=new Set(['submission_source','submission_schema','pdf_layout','field_definitions','section_definitions','shared_field_definitions','signature_definitions','definition_fallback']);
const blank=value=>value===null||value===undefined||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&value.length===0);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const plainLabel=id=>String(id).replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const localized=(field,lang,fallback)=>String((lang==='ar'?field?.ar:field?.label||field?.title)||(lang==='ar'?field?.label||field?.title:field?.ar)||fallback);
function options(field){return (field.selectOptions||field.options||[]).map(option=>Array.isArray(option)?{value:option[0],label:option[1],ar:option[2]}:option);}
function answerValue(field,value,lang){
 const t=(en,ar)=>lang==='ar'?ar:en;
 if(blank(value))return t('Not provided','لم يُقدّم');
 if(Array.isArray(value))return value.map(v=>answerValue(field,v,lang)).join('\n');
 const choice=options(field).find(option=>String(option.value)===String(value));
 if(choice)return localized(choice,lang,String(value));
 if(typeof value==='boolean')return value?t('Yes','نعم'):t('No','لا');
 return typeof value==='object'?JSON.stringify(value,null,2):String(value);
}
function direction(field,value){
 if(['email','tel','date'].includes(field.type))return 'ltr';
 const hasOptions=options(field).length>0;
 if(!hasOptions&&/(?:^|_)(?:email|phone|mobile|fax|iban|tin|giin|passport|id_number|id_no|auth_id|account_number|client_number|company_id_number|registration_number)(?:_|$)/i.test(field.id))return 'ltr';
 if(/\p{Script=Arabic}/u.test(value))return 'rtl';
 if(field.direction==='ltr'||/^[\s\d٠-٩۰-۹+().\-/]+$/.test(value)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return 'ltr';
 return 'auto';
}
function fieldsFor(definitions,values,lang,audience){
 const fields=new Map(),excluded=new Set(definitions.filter(field=>field?.uiOnly&&field.joinAudience&&field.joinAudience!==audience).map(field=>field.id));
 for(const field of definitions)if(field&&typeof field.id==='string'&&!excluded.has(field.id)&&!fields.has(field.id))fields.set(field.id,field);
 for(const id of Object.keys(values))if(!excluded.has(id)&&!fields.has(id))fields.set(id,{id});
 return [...fields.values()].map(field=>{const value=answerValue(field,values[field.id],lang);const label=localized(field,lang,plainLabel(field.id));return {id:field.id,label,value,empty:blank(values[field.id]),direction:direction(field,value),wide:!!field.wide||field.type==='textarea'||label.length>100||value.length>100};});
}
export function submissionDetailsModel(submission,lang='en'){
 const t=(en,ar)=>lang==='ar'?ar:en,profile=record(submission.profile),answers=record(submission.answers),known=docs.find(d=>d.id===submission.doc_id),uploaded=(submission.source||profile.submission_source)==='upload';
 const definitions=Array.isArray(profile.field_definitions)?profile.field_definitions:known?.fields||[],fields=uploaded?[]:fieldsFor(definitions,withAnswerTotals(definitions.map(f=>({...f,sum:f.sum||known?.fields.find(k=>k.id===f.id)?.sum})),answers),lang,submission.audience),byId=new Map(fields.map(field=>[field.id,field]));
 const sections=Array.isArray(profile.section_definitions)?profile.section_definitions:(known?.sections||[]).map(section=>({...section,field_ids:section.fields.map(field=>field.id)}));
 const used=new Set(),groups=[];
 for(const section of sections){const rows=(section.field_ids||[]).filter(id=>byId.has(id)&&!used.has(id)).map(id=>{used.add(id);return byId.get(id);});if(rows.length)groups.push({id:section.id,label:localized({...section,label:section.title},lang,t('Document fields','حقول المستند')),fields:rows});}
 const remaining=fields.filter(field=>!used.has(field.id));if(remaining.length)groups.push({id:'other',label:groups.length?t('Other submitted details','بيانات مرسلة أخرى'):t('Document fields','حقول المستند'),fields:remaining});
 const sharedValues=Object.fromEntries(Object.entries(profile).filter(([id])=>!metadataKeys.has(id))),knownShared=sharedGroups(submission.audience),sharedDefinitions=Array.isArray(profile.shared_field_definitions)?profile.shared_field_definitions:knownShared.flatMap(group=>group.fields);
 // Older snapshots captured only a subset. Do not imply uncaptured fields were submitted blank.
 const sharedFields=fieldsFor(sharedDefinitions.filter(field=>own(sharedValues,field.id)),sharedValues,lang,submission.audience),sharedById=new Map(sharedFields.map(field=>[field.id,field])),sharedUsed=new Set(),shared=[];
 for(const [index,group]of knownShared.entries()){const rows=group.fields.filter(field=>sharedById.has(field.id)).map(field=>{sharedUsed.add(field.id);return sharedById.get(field.id);});if(rows.length)shared.push({id:'shared-'+index,label:localized(group,lang,t('Shared customer details','بيانات العميل المشتركة')),fields:rows});}
 const sharedRemaining=sharedFields.filter(field=>!sharedUsed.has(field.id));if(sharedRemaining.length)shared.push({id:'shared-other',label:t('Other shared details','بيانات مشتركة أخرى'),fields:sharedRemaining});
 const images=record(submission.signatures),signatureDefinitions=Array.isArray(profile.signature_definitions)?profile.signature_definitions:known?signatureSlots(known):[],signatureMap=new Map(signatureDefinitions.map(field=>[field.id,field]));
 for(const id of Object.keys(images))if(!signatureMap.has(id))signatureMap.set(id,{id});
 const signatures=uploaded?[]:[...signatureMap.values()].map(field=>{
  const image=typeof images[field.id]==='string'&&images[field.id].length<=500000&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(images[field.id])?images[field.id]:null;
  return {id:field.id,label:localized(field,lang,plainLabel(field.id)),image,status:image?t('Signature image submitted','تم إرسال صورة التوقيع'):field.id==='applicant'&&answers.signature_mode==='manual'?t('Manual signing selected — no signature image','تم اختيار التوقيع اليدوي — لا توجد صورة توقيع'):t('No signature image provided','لم تُقدّم صورة توقيع')};
 });
 return {uploaded,groups,shared,signatures};
}
function fieldHTML(field){return `<div class="submitted-field${field.wide?' submitted-field-wide':''}" data-answer-field="${e(field.id)}"><dt>${e(field.label)}</dt><dd dir="${field.direction}" class="${field.empty?'not-provided':''}">${e(field.value)}</dd></div>`;}
export function renderSubmissionDetails(submission,lang='en'){
 const t=(en,ar)=>lang==='ar'?ar:en,model=submissionDetailsModel(submission,lang);
 return `<div class="submitted-details" data-submitted-version="${e(submission.id)}" dir="${lang==='ar'?'rtl':'ltr'}"><p class="submitted-details-note">${t('Answers saved with this document.','الإجابات المحفوظة مع هذا المستند.')}</p>${model.uploaded?`<p class="submitted-upload-only">${t('This submission contains an uploaded PDF. No online form answers were captured; preview or download the PDF to read its contents.','يتضمن هذا الإرسال ملف PDF مرفوعًا. لم تُحفظ إجابات نموذج إلكتروني؛ عاين الملف أو نزّله للاطلاع على محتواه.')}</p>`:model.groups.length?model.groups.map(group=>`<details class="submitted-detail-section" data-submission-section="${e(group.id)}"><summary>${e(group.label)}</summary><dl class="submitted-fields">${group.fields.map(field=>fieldHTML(field)).join('')}</dl></details>`).join(''):`<p class="submitted-details-note">${t('No online form answers were saved with this submission.','لم تُحفظ إجابات نموذج إلكتروني مع هذا الإرسال.')}</p>`}${model.signatures.length?`<details class="submitted-detail-section" data-signature-snapshot><summary>${t('Submitted signatures','التوقيعات المرسلة')}</summary><div class="submitted-signatures">${model.signatures.map(signature=>`<figure data-signature-slot="${e(signature.id)}"><figcaption>${e(signature.label)}</figcaption>${signature.image?`<img src="${e(signature.image)}" alt="${e(signature.label)}" loading="lazy">`:''}<p>${e(signature.status)}</p></figure>`).join('')}</div></details>`:''}</div>`;
}
