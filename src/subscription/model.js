import {calculateSubscription} from './calculations.js';
import {appRoot} from '../routes.js';
import {today} from '../dates.js';
export {today} from '../dates.js';
export const isSubscription=doc=>doc?.workflow==='subscription';
export const joinedName=v=>['first_name','second_name','third_name','family_name'].map(k=>(v[k]||'').trim()).filter(Boolean).join(' ');
export const visibleField=(f,values)=>!f.when||f.when.includes(values[f.dependsOn]);
export function normalizeSubscription(doc,input,{applicantEdited=false}={}){
 const values={...input};
 if(values.id_type==='family'){values.id_type='other';values.id_other='بطاقة عائلية / Family ID';}
 if(!('date' in values))values.date=today();
 values.signature_mode=values.signature_mode||'manual';
 values.full_name=doc.group==='individual'?joinedName(values):values.company_name||'';
 if(!applicantEdited)values.applicant_name=doc.group==='individual'?values.full_name:values.auth_name||'';
 try{Object.assign(values,calculateSubscription(values.units));}catch{
  Object.assign(values,calculateSubscription(''));values.units=input.units;
 }
 return values;
}
export function visibleFields(doc,values,section=null){return (section?.fields||doc.fields).filter(f=>!f.hidden&&visibleField(f,values));}
export function sectionProgress(doc,section,values,signatures){
 const fields=visibleFields(doc,values,section).filter(f=>!f.optional);
 let completed=fields.filter(f=>String(values[f.id]??'').trim()&&!(f.id==='units'&&!values.total_amount)).length,total=fields.length;
 if(section.id==='applicant'&&values.signature_mode==='electronic'){total++;if(signatures.applicant)completed++;}
 return {completed,total};
}
export function missingRequired(doc,values,signatures){
 const missing=visibleFields(doc,values).filter(f=>f.required&&!String(values[f.id]??'').trim()).map(f=>f.id);
 if(values.units&&!values.total_amount)missing.push('units');
 if(values.signature_mode==='electronic'&&!signatures.applicant)missing.push('signature_mode');
 return [...new Set(missing)];
}
export async function canonicalSubscription(doc,values){
 let response;
 try{response=await fetch(`${appRoot}api/subscription/calculate.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({units:values.units||''}),signal:AbortSignal.timeout(10000)});}catch{throw Error('calculation_unavailable');}
 if(!response.ok){if(response.status===422)throw Object.assign(Error('units'),{fields:['units'],validation:true});throw Error('calculation_unavailable');}
 const calculated=await response.json(),expected=calculateSubscription(values.units||'');
 if(Object.keys(expected).some(k=>calculated[k]!==expected[k]))throw Error('calculation_mismatch');
 const normalized=normalizeSubscription(doc,values,{applicantEdited:true});
 for(const f of doc.fields)if(!visibleField(f,normalized))delete normalized[f.id];
 const id=doc.fields.find(f=>f.id==='id_type');
 return {...normalized,...calculated,...(id?{id_type_label:id.selectOptions.find(o=>o[0]===normalized.id_type)?.slice(1).reverse().join(' / ')||''}:{}),
  title_label:doc.group==='corporate'?(normalized.title||''):doc.fields.find(f=>f.id==='title').selectOptions.find(o=>o[0]===normalized.title)?.slice(1).join(' / ')||'',
  company_id_type_label:doc.fields.find(f=>f.id==='company_id_type')?.selectOptions.find(o=>o[0]===normalized.company_id_type)?.slice(1).reverse().join(' / ')||'',
  subscription_type_label:({'new':'طلب جديد / New Subscription',additional:'إضافة وحدات / Additional Units'})[normalized.subscription_type]||'',
  payment_method_label:({transfer:'حوالة / Bank Transfer',cheque:'شيك / Cheque'})[normalized.payment_method]||''};
}
