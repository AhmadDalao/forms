import {personNameGroups,normalizePersonNames,splitPersonName,joinPersonName} from './person-names.js';
import {nameParts} from './names.js';
import {hasValue} from './schema.js';
import {countryFields} from './countries.js';
import {idOptions,titleOptions} from './identity-options.js';

const field=(id,label,ar,type='text',options=null)=>({id,label,ar,type,options});
const addressFields=()=>[
 field('short_address','Short address','العنوان المختصر'),field('building','Building number','رقم المبنى'),field('street','Street','الشارع'),field('district','District','الحي'),
 field('city','City','المدينة'),field('postal','Postal code','الرمز البريدي'),field('additional','Additional number','الرقم الإضافي'),field('country','Country','الدولة'),
];
const otherId=(id,dependsOn)=>({...field(id,'Specify other ID type','حدد نوع الهوية الأخرى'),dependsOn,when:['other']});
const familyIdDetail='بطاقة عائلية / Family ID';
export const sharedFieldVisible=(field,profile)=>!field.when||field.when.includes(profile?.[field.dependsOn]);
function addressRoles(audience){return {label:'Address details',ar:'تفاصيل العناوين',fields:[{...field('address_primary_role','Primary address source','مصدر العنوان الرئيسي','select',[['mail','Mailing','المراسلة'],['residence','Residence','الإقامة'],['registered','Registered','المسجل'],['head','Head office','المقر الرئيسي']]),hidden:true,sync:true},...['mail','residence',...(audience==='corporate'?['registered','head']:[])].flatMap(role=>addressFields().map(f=>({...f,id:role+'_'+f.id,label:({mail:'Mailing',residence:'Residence',registered:'Registered',head:'Head office'})[role]+': '+f.label,ar:({mail:'المراسلة',residence:'الإقامة',registered:'المسجل',head:'المقر الرئيسي'})[role]+': '+f.ar}))),...(audience==='corporate'?[field('registered_address_text','Registered address (original text)','العنوان المسجل (النص الأصلي)'),field('mail_address_text','Mailing address (original text)','عنوان المراسلة (النص الأصلي)')]:[])]};}
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
  {label:'Correspondence address',ar:'عنوان المراسلة',fields:[...addressFields(),field('also_residence','Also use this as my current residence in Saudi Arabia','استخدمه أيضًا عنوانًا لإقامتي الحالية في السعودية','checkbox')]},addressRoles(audience),
 ];
 if(audience==='corporate')return [
  {label:'Company details',ar:'بيانات الشركة',fields:[field('company_name','Full legal company name','الاسم القانوني الكامل للشركة'),field('company_name_ar','Company name in Arabic','اسم الشركة بالعربية'),field('company_name_en','Company name in English','اسم الشركة بالإنجليزية'),field('inc_country','Country of incorporation','دولة التأسيس'),field('company_id_type','Registration type','نوع تسجيل الشركة','select',[['cr','Commercial registration','سجل تجاري'],['license','Licence','ترخيص'],['other','Other','أخرى']]),field('company_id_number','Registration / licence number','رقم السجل / الترخيص'),field('client_number','Client number (if known)','رقم العميل (إن وجد)'),field('account_number','Investment account number (if known)','رقم الحساب الاستثماري (إن وجد)')]},
  {label:'Company contact details',ar:'بيانات التواصل مع الشركة',fields:[field('phone','Company phone','هاتف الشركة','tel'),field('mobile','Contact mobile','جوال مسؤول التواصل','tel'),field('email','Contact email','البريد الإلكتروني للتواصل','email')]},
  {label:'Registered address',ar:'العنوان المسجل',fields:[...addressFields(),field('also_residence','Also use as the entity’s current residence address','استخدمه أيضًا عنوانًا للإقامة الحالية للكيان','checkbox'),field('also_head','Also use as the principal office address','استخدمه أيضًا عنوانًا للمكتب الرئيسي','checkbox'),field('also_mail','Also use as the correspondence address','استخدمه أيضًا عنوانًا للمراسلة','checkbox')]},
  {label:'Primary authorized signatory',ar:'المفوض الرئيسي بالتوقيع',fields:[{...field('auth_name','Authorized person’s full name','الاسم الكامل للمفوض'),hidden:true},...['first','second','third','last'].map((part,i)=>({...field('auth_'+part,['First name','Second name','Third name (optional)','Family name'][i],['الاسم الأول','الاسم الثاني','الاسم الثالث (اختياري)','اسم العائلة'][i]),namePart:true})),field('auth_id_type','ID type','نوع الهوية','select',idOptions),otherId('auth_id_other','auth_id_type'),field('auth_id','ID number','رقم الهوية')]},addressRoles(audience),
 ];
 return [];
}
export function cleanShared(audience,profile){
 const clean={};
 profile={...profile};
 const authKeys=['first','second','third','last'].map(part=>'auth_'+part);
 if(audience==='corporate'&&!authKeys.some(key=>key in profile)&&profile.auth_name){const parts=splitPersonName(profile.auth_name);for(const part of ['first','second','third','last'])profile['auth_'+part]=parts[part];}
 if(audience==='corporate'&&authKeys.some(key=>key in profile))profile.auth_name=joinPersonName(authKeys.map(key=>profile[key]));
 for(const [type,detail] of [['id_type','id_other'],['auth_id_type','auth_id_other']])if(profile[type]==='family'){
  profile[type]='other';profile[detail]=familyIdDetail;
 }
 for(const lang of ['en','ar'])if(!(lang+'_second' in profile)&&profile[lang+'_middle'])profile[lang+'_second']=profile[lang+'_middle'];
 // Earlier language-neutral subscription drafts duplicated the English row
 // into Arabic storage. Recover only an exact duplicate; never translate names.
 const parts=['first','second','third','last'],arabic=joinPersonName(parts.map(k=>profile['ar_'+k])),english=joinPersonName(parts.map(k=>profile['en_'+k]));
 if(arabic&&arabic===english&&parts.every(k=>(profile['ar_'+k]||'')===(profile['en_'+k]||''))&&/[A-Za-z]/.test(arabic)&&! /\p{Script=Arabic}/u.test(arabic)){
  for(const part of [...parts,'middle'])profile['ar_'+part]='';
  if(profile.name_language==='ar')profile.name_language='en';
 }
 for(const f of sharedGroups(audience).flatMap(g=>g.fields)){
  if(!sharedFieldVisible(f,profile))continue;
  const v=profile?.[f.id];
  if(f.type==='checkbox'){if(typeof v==='boolean')clean[f.id]=v;}
  else if(typeof v==='string'&&v.length<=2000&&(!f.options||v===''||f.options.some(o=>o[0]===v)))clean[f.id]=v;
 }
 for(const lang of ['en','ar']){const middle=[clean[lang+'_second'],clean[lang+'_third']].filter(Boolean).join(' ');if(middle)clean[lang+'_middle']=middle;}
 return clean;
}
const joined=(...parts)=>parts.filter(hasValue).map(s=>s.trim()).filter(Boolean).join(' ');
const addressKeys=['short_address','building','street','district','city','postal','additional','country'];
const own=(p,key)=>Object.hasOwn(p,key);
const idLabel=(value,arabic,other)=>value==='other'?(other||''):idOptions.find(o=>o[0]===value)?.[arabic?2:1]||'';
const idValue=value=>idOptions.find(o=>o.some(label=>label.toLowerCase()===value.trim().toLowerCase()))?.[0];

// One definition owns both directions. Role-specific addresses inherit the
// original common address until the client deliberately supplies a different one.
export function sharedRules(doc,values={},profile={},audience=doc.group){
 if(!['individual','corporate'].includes(audience)||(doc.group!=='shared'&&doc.group!==audience))return {};
 const rules={},p=profile,individual=audience==='individual';
 const bind=(id,key,config={})=>rules[id]={keys:[key],read:()=>p[key]??'',write:value=>({[key]:value}),...config};
 const same=ids=>ids.forEach(id=>bind(id,id));
 // KYC still authors a Family ID option. The shared/subscription schema keeps
 // its retired value under Other; translate only that exact legacy detail.
 const kycIdentity=(type,detail,hasOther)=>{
  const family=()=>p[type]==='other'&&p[detail]===familyIdDetail;
  bind(type,type,{keys:[type,detail],read:()=>family()?'family':p[type]==='other'&&!hasOther?'':p[type]??'',
   write:value=>value==='family'?{[type]:'other',[detail]:familyIdDetail}:{[type]:value,[detail]:value==='other'&&!family()?p[detail]??'':''}});
  if(rules[detail])Object.assign(rules[detail],{keys:[type,detail],read:()=>family()?'':p[detail]??''});
 };
 const preferred=p.name_language||(p.en_first?'en':p.ar_first?'ar':'en');
 const autoLanguage=parts=>{const value=joinPersonName(parts);return /\p{Script=Arabic}/u.test(value)?'ar':value?'en':preferred;};
 const full=language=>joinPersonName(['first','second','third','last'].map(part=>p[language+'_'+part]??(part==='second'?p[language+'_middle']:'')??''));
 const customerName=()=>individual?(full(preferred)||full(preferred==='ar'?'en':'ar')):(p.company_name_ar||p.company_name||p.company_name_en||'');
 const company=(id,language='auto')=>bind(id,'company_name'+(language==='auto'?'':'_'+language),{
  keys:['company_name_ar','company_name_en','company_name'],
  read:()=>language==='en'?(p.company_name_en??(!/\p{Script=Arabic}/u.test(p.company_name||'')?p.company_name:'')):language==='ar'?(p.company_name_ar??(/\p{Script=Arabic}/u.test(p.company_name||'')?p.company_name:'')):customerName(),
  write:value=>{const lang=language==='auto'?(/\p{Script=Arabic}/u.test(value)?'ar':'en'):language;return {['company_name_'+lang]:value,...(lang==='ar'||!p.company_name_ar?{company_name:value}:{} )};},
 });
 const addressPatch=(key,role,value)=>{
  const scoped=role+'_'+key,source=p.address_primary_role||(individual?'mail':'registered');
  if(role==='head')return {[scoped]:value};
  const patch={[scoped]:value,...(!p.address_primary_role?{address_primary_role:role}:{})};
  if(!own(p,key)||source===role||!p.address_primary_role){patch[key]=value;for(const mirror of ['mail','residence','registered'])if(own(p,mirror+'_'+key)&&p[mirror+'_'+key]===p[key])patch[mirror+'_'+key]=value;}
  return patch;
 };
 const address=(id,key,role)=>{
  const scoped=role+'_'+key;
  bind(id,scoped,{keys:[scoped,key,'address_primary_role'],read:()=>own(p,scoped)?p[scoped]:p[key]??'',write:value=>addressPatch(key,role,value)});
 };
 const composite=(id,keys,read)=>rules[id]={keys,read,write:null};
 const names=new Map(),name=(id,language='auto')=>names.set(id,language);
 if(doc.workflow==='subscription'){
  for(const f of doc.fields)if(f.sharedKey&&!['auth_name','company_name','english_name',...addressKeys].includes(f.id))bind(f.id,f.sharedKey);
  composite('client_account',['account_number','client_number'],()=>p.account_number||p.client_number||'');
  rules.client_account.write=value=>({account_number:value});
  for(const key of addressKeys)address(key,key,'mail');
  if(individual){['first_name','second_name','third_name','family_name'].forEach((id,i)=>bind(id,'ar_'+['first','second','third','last'][i]));name('english_name','en');}
  else{company('company_name','ar');company('english_name','en');name('auth_name','auth');}
 }
 if(doc.id==='signature-form'){
  if(individual)name('client_name');else company('client_name');
  same(['client_number','account_number']);
  const self=individual&&values.signer_role==='client',auth=!individual&&values.signer_role==='authorized';
  if(self||auth){
   name('signer_name',self?'auto':'auth');bind('id_number',self?'id_number':'auth_id');
   const type=self?'id_type':'auth_id_type',detail=self?'id_other':'auth_id_other';
   bind('id_type',type,{keys:[type,detail,'name_language'],read:()=>idLabel(p[type],self?preferred==='ar':/\p{Script=Arabic}/u.test(p.auth_name||''),p[detail]),write:value=>value===''?{[type]:'',[detail]:''}:idValue(value)?{[type]:idValue(value),[detail]:''}:{[type]:'other',[detail]:value}});
  }else for(const id of ['signer_name','id_number','id_type'])composite(id,[],()=> '');
 }
 if(doc.id==='terms-and-conditions')for(const id of ['terms_name_0','authorization_name_0']){if(individual)name(id);else company(id);}
 if(doc.id==='al-naeem-terms-consent'){if(individual)name('investor_name');else company('investor_name');}
 if(doc.id==='kyc-individual'){
  name('name');name('risk_client_name');same(['title','gender','dob','nationality','id_type','id_other','id_number','phone','mobile','email']);
  kycIdentity('id_type','id_other',true);
  for(const key of ['building','street','postal','country'])address(key,key,'mail');
  address('postal_additional','additional','mail');address('address_city','city','mail');address('address_district','district','mail');
  composite('city',['mail_city','mail_district','city','district'],()=>joined(rules.address_city.read(),rules.address_district.read()));
 }
 if(doc.id==='fatca-crs-individual'){
  same(['en_first','en_second','en_third','en_last','ar_first','ar_second','ar_third','ar_last','title','gender','dob']);
  rules.title.read=()=>['dr','eng'].includes(p.title)?'other':p.title||'';
  rules.title.write=value=>value==='other'?{}:{title:value};
  for(const lang of ['ar','en'])rules[lang+'_second'].read=()=>p[lang+'_second']??p[lang+'_middle']??'';
  for(const key of ['building','street','district','city','postal','country']){address('mail_'+key,key,'mail');address('sa_'+key,key,'residence');}
  if(values.capacity==='holder'){name('signer_en','en');name('signer_ar','ar');}
  else{composite('signer_en',[],()=> '');composite('signer_ar',[],()=> '');}
  // Staff complete this section independently. The empty read also retires
  // inherited draft names; reconcileShared preserves manual entries and revisions.
  composite('staff_account_holder',[],()=> '');
 }
 if(doc.id==='kyc-corporate'){
  company('company');company('risk_client_name');bind('cr','company_id_number');same(['inc_country','phone','mobile','email','auth_id_type','auth_id']);
  kycIdentity('auth_id_type','auth_id_other',false);
  for(const key of ['building','street','district','city','postal','additional'])address(key,key,'registered');
  bind('business_phone','phone');name('auth_name','auth');
  composite('address',addressKeys.flatMap(key=>['registered_'+key,key]),()=>p.registered_address_text??joined(...addressKeys.filter(k=>k!=='short_address').map(k=>p['registered_'+k]??p[k])));
  rules.address.keys.push('registered_address_text');rules.address.write=value=>({registered_address_text:value});
  composite('contact_address',addressKeys.flatMap(key=>['mail_'+key,key]),()=>p.mail_address_text??joined(...addressKeys.filter(k=>k!=='short_address').map(k=>p['mail_'+k]??p[k])));
  rules.contact_address.keys.push('mail_address_text');rules.contact_address.write=value=>({mail_address_text:value});
 }
 if(doc.id==='fatca-crs-corporate'){
  company('legal_name','en');bind('inc_country','inc_country');name('signer_0_name','auth');
  for(const prefix of ['residence','head']){
   for(const key of ['building','street','district','city','country']){
    address(prefix+'_'+key,key,prefix);
    if(prefix==='head')rules[prefix+'_'+key].read=()=>p['head_'+key]??(p.also_head?p[key]:'')??'';
   }
   composite(prefix+'_postal',[prefix+'_postal',prefix+'_additional','postal','additional'],()=>own(p,prefix+'_postal')?joined(p[prefix+'_postal'],p[prefix+'_additional']):prefix==='head'&&!p.also_head?'':joined(p.postal,p.additional));
   rules[prefix+'_postal'].write=value=>{
    // This printed box joins two codes. Split only an unambiguous pair of
    // numeric codes; preserve other formats as one complete postal value.
    const pair=value.trim().match(/^([0-9٠-٩۰-۹]{5})\s+([0-9٠-٩۰-۹]{4})$/),postal=pair?.[1]??value,additional=pair?.[2]??'';
    return {...addressPatch('postal',prefix,postal),...addressPatch('additional',prefix,additional)};
   };
  }
 }
 if(doc.custom)for(const f of doc.fields){const key=f.shared?.[audience];if(!key)continue;
  if(['full_name','full_name_en','full_name_ar','full_address'].includes(key))composite(f.id,[],()=>key==='full_name'?customerName():key==='full_name_en'?full('en'):key==='full_name_ar'?full('ar'):joined(...addressKeys.filter(k=>k!=='short_address').map(k=>p[k])));
  else bind(f.id,key);
 }
 for(const group of personNameGroups(doc,audience)){
  if(!names.has(group.id)){
   // Role not selected: clear inherited values only, retain locally entered names.
   if(group.targets.some(target=>rules[target.id]))for(const id of group.partIds)composite(id,[],()=> '');
   continue;
  }
  const requested=names.get(group.id),language=requested==='auto'?preferred:requested;
  group.partIds.forEach((id,index)=>{
   const part=['first','second','third','last'][index];
   bind(id,language+'_'+part,{keys:[language+'_'+part,...(requested==='auto'?['name_language']:[])],read:()=>p[language+'_'+part]??(part==='second'?p[language+'_middle']:'')??'',write:value=>({[(requested==='auto'?autoLanguage(group.partIds.map(id=>values[id])):language)+'_'+part]:value})});
  });
  for(const target of group.targets)composite(target.id,target.join.flatMap(id=>rules[id].keys),()=>joinPersonName(target.join.map(id=>rules[id].read())));
 }
 // A mobile is a useful default for the customer's telephone, but an explicit
 // different number or deliberate blank always wins. Other people's phones,
 // fax numbers and identifiers remain independent.
 for(const id of ['phone','business_phone'])if(rules[id]){
  rules[id].keys=[...new Set([...rules[id].keys,'mobile'])];
  rules[id].read=()=>p.phone??p.mobile??'';
 }
 return rules;
}
function sharedBindings(doc,values,profile,audience){return Object.fromEntries(Object.entries(sharedRules(doc,values,profile,audience)).map(([id,rule])=>[id,rule.keys]));}
export function sharedEdit(doc,values,profile,audience,editedField,{seedMissing=true}={}){
 if(!editedField)return {};
 const rules=sharedRules(doc,values,profile,audience),patch={};
 // Selecting a role also publishes details the client deliberately typed first.
 const roleChange=(doc.id==='signature-form'&&editedField==='signer_role')||(doc.id==='fatca-crs-individual'&&editedField==='capacity');
 const ids=roleChange?Object.keys(rules).filter(id=>id.startsWith('signer_')||doc.id==='signature-form'&&['id_number','id_type'].includes(id)):[editedField];
 for(const id of ids){const rule=rules[id],value=values[id]??'';if(!rule?.write||typeof value!=='string'||roleChange&&!value.trim())continue;Object.assign(patch,rule.write(value));}
 const group=personNameGroups(doc,audience).find(group=>group.partIds.includes(editedField));
 const primary=doc.id==='subscription-form'?['first_name','second_name','third_name','family_name']:null;
 const parts=group?.partIds||(primary?.includes(editedField)?primary:null);
 if(seedMissing&&parts)for(const id of parts){const rule=rules[id];if(!rule?.write||typeof values[id]!=='string')continue;for(const [key,value]of Object.entries(rule.write(values[id])))if(!own(profile||{},key)&&!own(patch,key))patch[key]=value;}
 const nameKey=Object.keys(patch).find(key=>/^(en|ar)_(first|second|third|last)$/.test(key));
 if(nameKey&&(group?.language==='auto'||!profile?.name_language||primary?.includes(editedField)))patch.name_language=nameKey.slice(0,2);
 return patch;
}
export function sharedCandidates(doc,profile,values,audience){const candidates=Object.fromEntries(Object.entries(sharedRules(doc,values,profile,audience)).map(([id,rule])=>[id,rule.read()??'']));return doc.id==='fatca-crs-individual'?nameParts(candidates,false):candidates;}

export function reconcileShared(doc,record,profile,audience,{changed=[],preserveMissing=false}={}){
 if(record.revision)return {...record,values:normalizePersonNames(doc,record.values,{audience})};
 const next={...record,values:{...record.values},shared:{},overrides:[...(record.overrides||[])]};
 if(record.countryDefaults)next.countryDefaults={...record.countryDefaults};
 const countries=countryFields(doc);
 const bindings=sharedBindings(doc,next.values,profile,audience,true);
 for(const [id,value]of Object.entries(sharedCandidates(doc,profile,next.values,audience))){
  const linked=bindings[id]?.some(key=>changed.includes(key))||(changed.includes('name_language')&&bindings[id]?.some(key=>/^(en|ar)_(first|second|third|last)$/.test(key)));
  if(linked)next.overrides=next.overrides.filter(key=>key!==id);
  if(next.overrides.includes(id))continue;
  const old=record.shared?.[id],current=next.values[id];
  // Another tab may have saved a new common field before this tab's account
  // synchronizer has adopted its pending journal. Keep that field meanwhile.
  if(preserveMissing&&old!==undefined&&bindings[id]?.every(key=>!Object.hasOwn(profile||{},key))){next.shared[id]=old;continue;}
  if(!linked&&hasValue(current)&&current!==old&&current!==value&&current!==record.countryDefaults?.[id])continue;
  const country=countries.find(f=>f.id===id),blankCountry=country?.sharedKey&&profile?.[country.sharedKey]===''&&(!country.whenShared||profile[country.whenShared]);
  const explicitBlank=!hasValue(value)&&bindings[id]?.some(key=>Object.hasOwn(profile||{},key));
  if(linked||hasValue(value)||blankCountry||explicitBlank){next.values[id]=value;next.shared[id]=value;if(next.countryDefaults)delete next.countryDefaults[id];}
  else if(old!==undefined&&current===old)delete next.values[id];
 }
 next.values=normalizePersonNames(doc,next.values,{audience});
 if(doc.id==='fatca-crs-individual')next.values=nameParts(next.values,false);
 return next;
}
