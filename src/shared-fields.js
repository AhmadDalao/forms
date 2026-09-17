import {hasValue} from './schema.js';

const field=(id,label,ar,type='text',options=null)=>({id,label,ar,type,options});
const addressFields=()=>[
 field('building','Building number','رقم المبنى'),field('street','Street','الشارع'),field('district','District','الحي'),
 field('city','City','المدينة'),field('postal','Postal code','الرمز البريدي'),field('additional','Additional number','الرقم الإضافي'),field('country','Country','الدولة'),
];
const idOptions=[['national','National ID','هوية وطنية'],['passport','Passport','جواز سفر'],['residence','Residence ID','هوية مقيم'],['family','Family ID','بطاقة عائلية']];
export function sharedGroups(audience){
 if(audience==='individual')return [
  {label:'Your name',ar:'اسمك',fields:[
   field('en_first','First name in English','الاسم الأول بالإنجليزية'),field('en_middle','Middle names in English','الأسماء الوسطى بالإنجليزية'),field('en_last','Last name in English','الاسم الأخير بالإنجليزية'),
   field('ar_first','First name in Arabic','الاسم الأول بالعربية'),field('ar_middle','Middle names in Arabic','الأسماء الوسطى بالعربية'),field('ar_last','Last name in Arabic','الاسم الأخير بالعربية'),
   field('name_language','Name language in unlabelled name boxes','لغة الاسم في الخانات غير المحددة بلغة','select',[['en','English','الإنجليزية'],['ar','Arabic','العربية']]),
  ]},
  {label:'Personal and contact details',ar:'البيانات الشخصية وبيانات التواصل',fields:[
   field('title','Title','اللقب','select',[['mr','Mr.','السيد'],['mrs','Mrs.','السيدة'],['miss','Miss','الآنسة']]),
   field('gender','Gender','الجنس','select',[['male','Male','ذكر'],['female','Female','أنثى']]),field('dob','Date of birth','تاريخ الميلاد','date'),
   field('id_type','ID type','نوع الهوية','select',idOptions),field('id_number','ID number','رقم الهوية'),field('phone','Phone','الهاتف','tel'),field('mobile','Mobile','الجوال','tel'),field('email','Email','البريد الإلكتروني','email'),
   field('client_number','Client number (if known)','رقم العميل (إن وجد)'),field('account_number','Investment account number (if known)','رقم الحساب الاستثماري (إن وجد)'),
  ]},
  {label:'Correspondence address',ar:'عنوان المراسلة',fields:[...addressFields(),field('also_residence','Also use this as my current residence in Saudi Arabia','استخدمه أيضًا عنوانًا لإقامتي الحالية في السعودية','checkbox')]},
 ];
 if(audience==='corporate')return [
  {label:'Company details',ar:'بيانات الشركة',fields:[field('company_name','Full legal company name','الاسم القانوني الكامل للشركة'),field('inc_country','Country of incorporation','دولة التأسيس'),field('client_number','Client number (if known)','رقم العميل (إن وجد)'),field('account_number','Investment account number (if known)','رقم الحساب الاستثماري (إن وجد)')]},
  {label:'Company contact details',ar:'بيانات التواصل مع الشركة',fields:[field('phone','Company phone','هاتف الشركة','tel'),field('mobile','Contact mobile','جوال مسؤول التواصل','tel'),field('email','Contact email','البريد الإلكتروني للتواصل','email')]},
  {label:'Registered address',ar:'العنوان المسجل',fields:[...addressFields(),field('also_residence','Also use as the entity’s current residence address','استخدمه أيضًا عنوانًا للإقامة الحالية للكيان','checkbox'),field('also_head','Also use as the principal office address','استخدمه أيضًا عنوانًا للمكتب الرئيسي','checkbox'),field('also_mail','Also use as the correspondence address','استخدمه أيضًا عنوانًا للمراسلة','checkbox')]},
  {label:'Primary authorized signatory',ar:'المفوض الرئيسي بالتوقيع',fields:[field('auth_name','Authorized person’s full name','الاسم الكامل للمفوض'),field('auth_id_type','ID type','نوع الهوية','select',idOptions),field('auth_id','ID number','رقم الهوية')]},
 ];
 return [];
}
export function cleanShared(audience,profile){
 const clean={};
 for(const f of sharedGroups(audience).flatMap(g=>g.fields)){
  const v=profile?.[f.id];
  if(f.type==='checkbox'){if(v===true)clean[f.id]=true;}
  else if(typeof v==='string'&&v.length<=2000&&hasValue(v)&&(!f.options||f.options.some(o=>o[0]===v)))clean[f.id]=v;
 }
 return clean;
}
const joined=(...parts)=>parts.filter(hasValue).map(s=>s.trim()).filter(Boolean).join(' ');
const idLabel=(value,arabic)=>idOptions.find(o=>o[0]===value)?.[arabic?2:1]||'';

// Map by meaning, never by matching words such as "Name". Extra client rows,
// controllers, witnesses, bank/custodian accounts and signatures are independent.
export function sharedCandidates(doc,profile,values,audience){
 if(!['individual','corporate'].includes(audience)||(doc.group!=='shared'&&doc.group!==audience))return {};
 const p=profile||{},out={};
 const copy=(id,value)=>{out[id]=value||'';};
 const fullEn=joined(p.en_first,p.en_middle,p.en_last),fullAr=joined(p.ar_first,p.ar_middle,p.ar_last);
 const name=audience==='individual'?(p.name_language==='ar'?fullAr||fullEn:fullEn||fullAr):p.company_name||'';
 const address=joined(p.building,p.street,p.district,p.city,p.postal,p.additional,p.country);
 if(doc.id==='subscription-form'){
  const corporate=audience==='corporate',arabicCompany=/\p{Script=Arabic}/u.test(p.company_name||'');
  copy('ar_name',corporate?(arabicCompany?p.company_name:''):fullAr);
  copy('en_name',corporate?(!arabicCompany?p.company_name:''):fullEn);
  copy('client_account',p.account_number||p.client_number);
  for(const key of ['phone','mobile','postal','city','country'])copy(key,p[key]);
  copy('applicant_name',corporate?p.auth_name:name);
  if(!corporate){
   copy('id_number',p.id_number);
   copy('id_type',p.id_type==='family'?'other':p.id_type);
   const title={mr:['Mr.','السيد'],mrs:['Mrs.','السيدة'],miss:['Miss','الآنسة']}[p.title];
   copy('en_title',title?.[0]);copy('ar_title',title?.[1]);
  }
 }
 if(doc.id==='signature-form'){
  copy('client_name',name);copy('client_number',p.client_number);copy('account_number',p.account_number);
  const self=audience==='individual'&&values.signer_role==='client',auth=audience==='corporate'&&values.signer_role==='authorized';
  copy('signer_name',self?name:auth?p.auth_name:'');copy('id_number',self?p.id_number:auth?p.auth_id:'');
  copy('id_type',self?idLabel(p.id_type,p.name_language==='ar'):auth?idLabel(p.auth_id_type,/\p{Script=Arabic}/u.test(p.auth_name||'')):'');
 }
 if(doc.id==='terms-and-conditions'){copy('terms_name_0',name);copy('authorization_name_0',name);}
 if(doc.id==='kyc-individual'){
  copy('name_1',name);copy('risk_client_name',name);
  for(const key of ['title','gender','dob','id_type','id_number','phone','mobile','email','building','street','postal','country'])copy(key,p[key]);
  copy('city',joined(p.city,p.district));copy('postal_additional',p.additional);
 }
 if(doc.id==='fatca-crs-individual'){
  for(const key of ['en_first','en_middle','en_last','ar_first','ar_middle','ar_last','title','gender','dob'])copy(key,p[key]);
  for(const key of ['building','street','district','city','postal','country']){copy('mail_'+key,p[key]);copy('sa_'+key,p.also_residence?p[key]:'');}
  copy('signer_en',values.capacity==='holder'?fullEn:'');copy('signer_ar',values.capacity==='holder'?fullAr:'');
  copy('staff_account_holder',name);
 }
 if(doc.id==='kyc-corporate'){
  copy('company',name);copy('risk_client_name',name);copy('inc_country',p.inc_country);
  for(const key of ['building','street','district','city','postal','additional','phone','mobile','email','auth_name','auth_id_type','auth_id'])copy(key,p[key]);
  copy('address',address);copy('business_phone',p.phone);copy('contact_address',p.also_mail?address:'');
 }
 if(doc.id==='fatca-crs-corporate'){
  copy('legal_name',name);copy('inc_country',p.inc_country);copy('signer_0_name',p.auth_name);
  for(const prefix of ['residence','head'])for(const key of ['building','street','district','city','postal','country'])copy(`${prefix}_${key}`,p[prefix==='head'?'also_head':'also_residence']?(key==='postal'?joined(p.postal,p.additional):p[key]):'');
 }
 return out;
}
export function reconcileShared(doc,record,profile,audience){
 const next={...record,values:{...record.values},shared:{},overrides:[...(record.overrides||[])]};
 for(const [id,value]of Object.entries(sharedCandidates(doc,profile,next.values,audience))){
  if(next.overrides.includes(id))continue;
  const old=record.shared?.[id],current=next.values[id];
  if(hasValue(current)&&current!==old&&current!==value)continue;
  if(hasValue(value)){next.values[id]=value;next.shared[id]=value;}
  else if(old!==undefined&&current===old)delete next.values[id];
 }
 return next;
}
