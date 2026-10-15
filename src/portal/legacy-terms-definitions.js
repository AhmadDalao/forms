// Display-only labels from reference/documents/archived/terms-13-page-schema.json.
// The retired 24-page redesign used these same answer and signature identities.
// Keep this compact snapshot independent of the current legal form and geometry.
const parts=[['first','First name','الاسم الأول'],['second','Second name','الاسم الثاني'],['third','Third name (optional)','الاسم الثالث (اختياري)'],['last','Family name','اسم العائلة']];
const groups=[
 ['terms','Acceptance of terms and conditions','قبول الشروط والأحكام','Client Name','Do you confirm your desire not to receive any confirmations or account statements except on request basis?','هل تؤكد عدم رغبتك في استلام أي مراسلات أو إشعارات أو كشوف الحساب إلا عند الطلب؟','Account terms','شروط الحساب'],
 ['authorization','Authorization Via Tel & Fax','تفويض قبول التعليمات بالهاتف والفاكس','Customer Name','Do you confirm your request and consent to Receive required services via Telephone & Fax','هل تؤكد رغبتك في الحصول على خدمة التعامل عن طريق الهاتف والفاكس؟','Telephone / fax authorization','تفويض الهاتف والفاكس'],
];
export const legacyTermsDefinitions={field_definitions:[],section_definitions:[{id:'document',title:'General terms and conditions document',ar:'وثيقة الشروط والأحكام العامة',field_ids:[]}],signature_definitions:[]};
for(const [prefix,title,ar,nameLabel,question,arQuestion,signature,arSignature] of groups){
 const fields=[{id:prefix+'_consent',label:question,ar:arQuestion,type:'choice',options:[{value:'no',label:'No',ar:'لا'},{value:'yes',label:'Yes',ar:'نعم'}]}];
 for(let i=0;i<3;i++){
  const id=`${prefix}_name_${i}`;
  fields.push({id,label:nameLabel,ar:'اسم العميل',type:'text',joinAudience:'individual'},...parts.map(([part,label,ar])=>({id:id+'_'+part,label,ar,type:'text',uiOnly:true,joinAudience:'individual'})));
  legacyTermsDefinitions.signature_definitions.push({id:`${prefix}_${i}`,label:`${signature} — signer ${i+1}`,ar:`${arSignature} — الموقع ${i+1}`});
 }
 fields.push({id:prefix+'_date',label:'Date',ar:'التاريخ',type:'date'});
 legacyTermsDefinitions.field_definitions.push(...fields);
 legacyTermsDefinitions.section_definitions.push({id:prefix,title,ar,field_ids:fields.map(f=>f.id)});
}
const fieldIds=new Set(legacyTermsDefinitions.field_definitions.map(f=>f.id));
const signatureIds=new Set(legacyTermsDefinitions.signature_definitions.map(f=>f.id));
export function legacyTermsDefinitionsFor(submission){
 if(submission.doc_id!=='terms-and-conditions')return null;
 const profile=submission.profile||{},layout=profile.pdf_layout||{};
 if([13,24].includes(layout.pages))return legacyTermsDefinitions;
 if(layout.pages)return null;
 const fields=Object.keys(submission.answers||{}),images=Object.keys(submission.signatures||{});
 const slots=layout.signatureSlots||layout.signatures||profile.signature_submission_policy?.signatureSlots||[];
 return fields.some(id=>fieldIds.has(id))||images.some(id=>signatureIds.has(id))||slots.some(slot=>signatureIds.has(slot.id))?legacyTermsDefinitions:null;
}
