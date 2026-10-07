import {idOptions} from '../identity-options.js';

// Customer-requested input cleanup. Historical submissions retain their own
// captured definitions; these changes affect new and ordinary draft forms only.
export const retiredIdentityFields={
 'kyc-individual':['issue_place','rep_issue','rep_place'],
 'kyc-corporate':['auth_issue_place','auth_issue_date'],
};
export function applyCustomerWorkflow(docs){
 for(const doc of docs){
  const removed=new Set(retiredIdentityFields[doc.id]||[]);
  const fax=doc.fields.find(f=>f.id==='rep_fax');
  // The restored original has a Fax box, not an email box. Keep the requested
  // email in captured application details without printing it under Fax.
  if(fax){Object.assign(fax,{id:'rep_email',label:'Email',ar:'البريد الإلكتروني',type:'email',direction:'ltr',uiOnly:true,rect:null,
   help:'Saved with your application details. The original PDF has no representative email field.',
   arHelp:'يُحفظ ضمن بيانات الطلب. لا توجد خانة للبريد الإلكتروني للممثل في ملف PDF الأصلي.'});}
  doc.fields=doc.fields.filter(f=>!removed.has(f.id));
  for(const section of doc.sections){
   section.fields=section.fields.filter(f=>!removed.has(f.id));
   for(const group of section.paperGroups||[])group.fields=group.fields.filter(id=>!removed.has(id)).map(id=>id==='rep_fax'?'rep_email':id);
  }
  const rows=doc.id==='kyc-individual'?[['id_type','id_number','id_expiry'],['rep_type','rep_id','rep_expiry']]:doc.id==='kyc-corporate'?[['auth_id_type','auth_id','auth_expiry']]:doc.id==='signature-form'?[['id_type','id_number']]:doc.id==='subscription-form'?[['id_type','id_number']]:[];
  doc.identityRows=rows;
  for(const ids of rows){
   for(const id of ids){const f=doc.fields.find(f=>f.id===id);if(f)f.identityRow=ids[0];}
   for(const section of doc.sections){
    const reorder=list=>{const first=list.findIndex(id=>ids.includes(id));if(first<0)return list;return [...list.slice(0,first).filter(id=>!ids.includes(id)),...ids.filter(id=>list.includes(id)),...list.slice(first).filter(id=>!ids.includes(id))];};
    section.fields=reorder(section.fields.map(f=>f.id)).map(id=>doc.fields.find(f=>f.id===id));
    for(const group of section.paperGroups||[])group.fields=reorder(group.fields);
   }
  }
  if(doc.id==='signature-form')Object.assign(doc.fields.find(f=>f.id==='id_type'),{control:'select',dropdownOptions:idOptions.map(([,label,ar])=>({value:ar+' / '+label,label,ar}))});
  if(doc.id==='fatca-crs-individual'){
   const section=doc.sections.find(s=>s.id==='signatory');
   section.fields.sort((a,b)=>Number(b.id==='capacity')-Number(a.id==='capacity'));
   doc.fields.find(f=>f.id==='capacity').compactChoices=true;
   doc.sections=doc.sections.filter(s=>s!==section).concat(section);
  }
  if(doc.id==='signature-form')doc.fields.find(f=>f.id==='signer_role').compactChoices=true;
  if(doc.id==='terms-and-conditions'){
   Object.assign(doc.sections.find(s=>s.id==='terms'),{title:'Acceptance of terms and conditions',ar:'قبول الشروط والأحكام'});
   doc.sections.unshift({id:'document',title:'General terms and conditions document',ar:'وثيقة الشروط والأحكام العامة',page:1,fields:[],documentOnly:true});
  }
 }
}
