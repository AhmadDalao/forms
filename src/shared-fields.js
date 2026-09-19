import {nameParts} from './names.js';
import {hasValue} from './schema.js';
import {countryFields,sharedCountryIds} from './countries.js';
import {idOptions,titleOptions} from './identity-options.js';

const field=(id,label,ar,type='text',options=null)=>({id,label,ar,type,options});
const addressFields=()=>[
 field('short_address','Short address','العنوان المختصر'),field('building','Building number','رقم المبنى'),field('street','Street','الشارع'),field('district','District','الحي'),
 field('city','City','المدينة'),field('postal','Postal code','الرمز البريدي'),field('additional','Additional number','الرقم الإضافي'),field('country','Country','الدولة'),
];
const otherId=(id,dependsOn)=>({...field(id,'Specify other ID type','حدد نوع الهوية الأخرى'),dependsOn,when:['other']});
export const sharedFieldVisible=(field,profile)=>!field.when||field.when.includes(profile?.[field.dependsOn]);
export function sharedGroups(audience){
 if(audience==='individual')return [
  {label:'Your name',ar:'اسمك',fields:[
   field('en_first','First name in English','الاسم الأول بالإنجليزية'),field('en_second','Second name in English','الاسم الثاني بالإنجليزية'),field('en_third','Third name in English (optional)','الاسم الثالث بالإنجليزية (اختياري)'),field('en_last','Last name in English','الاسم الأخير بالإنجليزية'),
   field('ar_first','First name in Arabic','الاسم الأول بالعربية'),field('ar_second','Second name in Arabic','الاسم الثاني بالعربية'),field('ar_third','Third name in Arabic (optional)','الاسم الثالث بالعربية (اختياري)'),field('ar_last','Last name in Arabic','الاسم الأخير بالعربية'),
   field('name_language','Name language in unlabelled name boxes','لغة الاسم في الخانات غير المحددة بلغة','select',[['en','English','الإنجليزية'],['ar','Arabic','العربية']]),
  ]},
  {label:'Personal and contact details',ar:'البيانات الشخصية وبيانات التواصل',fields:[
   field('title','Title','اللقب','select',titleOptions),
   field('gender','Gender','الجنس','select',[['male','Male','ذكر'],['female','Female','أنثى']]),field('dob','Date of birth','تاريخ الميلاد','date'),
   field('nationality','Nationality','الجنسية'),field('id_type','ID type','نوع الهوية','select',idOptions),otherId('id_other','id_type'),field('id_number','ID number','رقم الهوية'),field('phone','Phone','الهاتف','tel'),field('mobile','Mobile','الجوال','tel'),field('email','Email','البريد الإلكتروني','email'),
   field('client_number','Client number (if known)','رقم العميل (إن وجد)'),field('account_number','Investment account number (if known)','رقم الحساب الاستثماري (إن وجد)'),
  ]},
  {label:'Correspondence address',ar:'عنوان المراسلة',fields:[...addressFields(),field('also_residence','Also use this as my current residence in Saudi Arabia','استخدمه أيضًا عنوانًا لإقامتي الحالية في السعودية','checkbox')]},
 ];
 if(audience==='corporate')return [
  {label:'Company details',ar:'بيانات الشركة',fields:[field('company_name','Full legal company name','الاسم القانوني الكامل للشركة'),field('inc_country','Country of incorporation','دولة التأسيس'),field('company_id_type','Registration type','نوع تسجيل الشركة','select',[['cr','Commercial registration','سجل تجاري'],['license','Licence','ترخيص'],['other','Other','أخرى']]),field('company_id_number','Registration / licence number','رقم السجل / الترخيص'),field('client_number','Client number (if known)','رقم العميل (إن وجد)'),field('account_number','Investment account number (if known)','رقم الحساب الاستثماري (إن وجد)')]},
  {label:'Company contact details',ar:'بيانات التواصل مع الشركة',fields:[field('phone','Company phone','هاتف الشركة','tel'),field('mobile','Contact mobile','جوال مسؤول التواصل','tel'),field('email','Contact email','البريد الإلكتروني للتواصل','email')]},
  {label:'Registered address',ar:'العنوان المسجل',fields:[...addressFields(),field('also_residence','Also use as the entity’s current residence address','استخدمه أيضًا عنوانًا للإقامة الحالية للكيان','checkbox'),field('also_head','Also use as the principal office address','استخدمه أيضًا عنوانًا للمكتب الرئيسي','checkbox'),field('also_mail','Also use as the correspondence address','استخدمه أيضًا عنوانًا للمراسلة','checkbox')]},
  {label:'Primary authorized signatory',ar:'المفوض الرئيسي بالتوقيع',fields:[field('auth_name','Authorized person’s full name','الاسم الكامل للمفوض'),field('auth_id_type','ID type','نوع الهوية','select',idOptions),otherId('auth_id_other','auth_id_type'),field('auth_id','ID number','رقم الهوية')]},
 ];
 return [];
}
export function cleanShared(audience,profile){
 const clean={};
 profile={...profile};
 for(const [type,detail] of [['id_type','id_other'],['auth_id_type','auth_id_other']])if(profile[type]==='family'){
  profile[type]='other';profile[detail]='بطاقة عائلية / Family ID';
 }
 for(const lang of ['en','ar'])if(!(lang+'_second' in profile)&&profile[lang+'_middle'])profile[lang+'_second']=profile[lang+'_middle'];
 for(const f of sharedGroups(audience).flatMap(g=>g.fields)){
  if(!sharedFieldVisible(f,profile))continue;
  const v=profile?.[f.id];
  if(f.type==='checkbox'){if(typeof v==='boolean')clean[f.id]=v;}
  else if(typeof v==='string'&&v.length<=2000&&(hasValue(v)||sharedCountryIds(audience).includes(f.id))&&(!f.options||f.options.some(o=>o[0]===v)))clean[f.id]=v;
 }
 for(const lang of ['en','ar']){const middle=[clean[lang+'_second'],clean[lang+'_third']].filter(Boolean).join(' ');if(middle)clean[lang+'_middle']=middle;}
 return clean;
}
const joined=(...parts)=>parts.filter(hasValue).map(s=>s.trim()).filter(Boolean).join(' ');
const idLabel=(value,arabic,other)=>value==='other'?(other||''):idOptions.find(o=>o[0]===value)?.[arabic?2:1]||'';

// Map by meaning, never by matching words such as "Name". Extra client rows,
// controllers, witnesses, bank/custodian accounts and signatures are independent.
export function sharedCandidates(doc,profile,values,audience){
 if(!['individual','corporate'].includes(audience)||(doc.group!=='shared'&&doc.group!==audience))return {};
 const p=profile||{},out={};
 const copy=(id,value)=>{out[id]=value||'';};
 const fullEn=joined(p.en_first,p.en_middle,p.en_last),fullAr=joined(p.ar_first,p.ar_middle,p.ar_last);
 const name=audience==='individual'?(p.name_language==='ar'?fullAr||fullEn:fullEn||fullAr):p.company_name||'';
 const address=joined(p.building,p.street,p.district,p.city,p.postal,p.additional,p.country);
 if(doc.workflow==='subscription'){
  for(const f of doc.fields){if(f.sharedKey)copy(f.id,p[f.sharedKey]);}
  copy('client_account',p.account_number||p.client_number);
  copy('english_name',audience==='individual'?fullEn:(!/\p{Script=Arabic}/u.test(p.company_name||'')?p.company_name:''));
  if(audience==='individual'){
   const preferred=p.name_language||(p.ar_first?'ar':'en'),language=p[preferred+'_first']?preferred:p.ar_first?'ar':'en';
   for(const [key,part] of [['first_name','first'],['second_name','second'],['third_name','third'],['family_name','last']])copy(key,p[language+'_'+part]);
  }
 }
 if(doc.id==='subscription-form'&&!doc.workflow){
  const corporate=audience==='corporate',arabicCompany=/\p{Script=Arabic}/u.test(p.company_name||'');
  copy('ar_name',corporate?(arabicCompany?p.company_name:''):fullAr);
  copy('en_name',corporate?(!arabicCompany?p.company_name:''):fullEn);
  copy('client_account',p.account_number||p.client_number);
  for(const key of ['phone','mobile','postal','city','country'])copy(key,p[key]);
  copy('applicant_name',corporate?p.auth_name:name);
  if(!corporate){
   copy('id_number',p.id_number);
   copy('id_type',p.id_type==='family'?'other':p.id_type);
   const title=titleOptions.find(o=>o[0]===p.title)?.slice(1);
   copy('en_title',title?.[0]);copy('ar_title',title?.[1]);
  }
 }
 if(doc.id==='signature-form'){
  copy('client_name',name);copy('client_number',p.client_number);copy('account_number',p.account_number);
  const self=audience==='individual'&&values.signer_role==='client',auth=audience==='corporate'&&values.signer_role==='authorized';
  copy('signer_name',self?name:auth?p.auth_name:'');copy('id_number',self?p.id_number:auth?p.auth_id:'');
  copy('id_type',self?idLabel(p.id_type,p.name_language==='ar',p.id_other):auth?idLabel(p.auth_id_type,/\p{Script=Arabic}/u.test(p.auth_name||''),p.auth_id_other):'');
 }
 if(doc.id==='terms-and-conditions'){copy('terms_name_0',name);copy('authorization_name_0',name);}
 if(doc.id==='kyc-individual'){
  copy('name_1',name);copy('risk_client_name',name);
  for(const key of ['title','gender','dob','id_type','id_other','id_number','phone','mobile','email','building','street','postal','country'])copy(key,p[key]);
  copy('city',joined(p.city,p.district));copy('postal_additional',p.additional);
 }
 if(doc.id==='fatca-crs-individual'){
  for(const key of ['en_first','en_second','en_third','en_middle','en_last','ar_first','ar_second','ar_third','ar_middle','ar_last','title','gender','dob'])copy(key,p[key]);
  // The original tax form prints an Other box instead of Dr./Eng. boxes.
  if(['dr','eng'].includes(p.title))copy('title','other');
  for(const key of ['building','street','district','city','postal','country']){copy('mail_'+key,p[key]);copy('sa_'+key,p.also_residence?p[key]:'');}
  copy('signer_en',values.capacity==='holder'?fullEn:'');copy('signer_ar',values.capacity==='holder'?fullAr:'');
  copy('staff_account_holder',name);
 }
 if(doc.id==='kyc-corporate'){
  copy('company',name);copy('risk_client_name',name);copy('inc_country',p.inc_country);
  for(const key of ['building','street','district','city','postal','additional','phone','mobile','email','auth_name','auth_id_type','auth_id'])copy(key,p[key]);
  // Do not invent a checkbox where the official company PDF has no Other option.
  if(p.auth_id_type==='other')copy('auth_id_type','');
  copy('address',address);copy('business_phone',p.phone);copy('contact_address',p.also_mail?address:'');
 }
 if(doc.id==='fatca-crs-corporate'){
  copy('legal_name',name);copy('inc_country',p.inc_country);copy('signer_0_name',p.auth_name);
  for(const prefix of ['residence','head'])for(const key of ['building','street','district','city','postal','country'])copy(`${prefix}_${key}`,p[prefix==='head'?'also_head':'also_residence']?(key==='postal'?joined(p.postal,p.additional):p[key]):'');
 }
 if(doc.custom)for(const f of doc.fields){
  const key=f.shared?.[audience];
  if(key)copy(f.id,key==='full_name'?name:key==='full_name_en'?fullEn:key==='full_name_ar'?fullAr:key==='full_address'?address:p[key]);
 }
 return out;
}
export function reconcileShared(doc,record,profile,audience){
 const next={...record,values:{...record.values},shared:{},overrides:[...(record.overrides||[])]};
 if(record.countryDefaults)next.countryDefaults={...record.countryDefaults};
 const countries=countryFields(doc);
 for(const [id,value]of Object.entries(sharedCandidates(doc,profile,next.values,audience))){
  if(next.overrides.includes(id))continue;
  const old=record.shared?.[id],current=next.values[id];
  if(hasValue(current)&&current!==old&&current!==value&&current!==record.countryDefaults?.[id])continue;
  const country=countries.find(f=>f.id===id),blankCountry=country?.sharedKey&&profile?.[country.sharedKey]===''&&(!country.whenShared||profile[country.whenShared]);
  if(hasValue(value)||blankCountry){next.values[id]=value;next.shared[id]=value;if(next.countryDefaults)delete next.countryDefaults[id];}
  else if(old!==undefined&&current===old)delete next.values[id];
 }
 if(doc.id==='fatca-crs-individual')next.values=nameParts(next.values,false);
 return next;
}
