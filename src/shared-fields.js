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
  {label:'Primary authorized signatory',ar:'المفوض الرئيسي بالتوقيع',fields:[{...field('auth_name','Authorized person’s full name','الاسم الكامل للمفوض'),hidden:true},...['first','second','third','last'].map((part,i)=>({...field('auth_'+part,['First name','Second name','Third name (optional)','Family name'][i],['الاسم الأول','الاسم الثاني','الاسم الثالث (اختياري)','اسم العائلة'][i]),namePart:true})),field('auth_id_type','ID type','نوع الهوية','select',idOptions),otherId('auth_id_other','auth_id_type'),field('auth_id','ID number','رقم الهوية')]},
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
  profile[type]='other';profile[detail]='بطاقة عائلية / Family ID';
 }
 for(const lang of ['en','ar'])if(!(lang+'_second' in profile)&&profile[lang+'_middle'])profile[lang+'_second']=profile[lang+'_middle'];
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
const idLabel=(value,arabic,other)=>value==='other'?(other||''):idOptions.find(o=>o[0]===value)?.[arabic?2:1]||'';

// Only audited primary-customer fields are bidirectional. A combined address,
// a bank owner, a witness or another signer's name is not a source of identity.
function sharedBindings(doc,values,profile,audience,canonical=false){
 if(!['individual','corporate'].includes(audience)||(doc.group!=='shared'&&doc.group!==audience))return {};
 const bindings={},individual=audience==='individual',p=profile||{};
 const bind=(id,key)=>{bindings[id]=[key];};
 const same=ids=>ids.forEach(id=>bind(id,id));
 const autoLanguage=parts=>{
  if(canonical)return p.name_language||(p.ar_first?'ar':'en');
  const full=joinPersonName(parts);
  return /\p{Script=Arabic}/u.test(full)?'ar':full?'en':p.name_language||(p.ar_first?'ar':'en');
 };
 const names=new Map();
 const name=(id,language='auto')=>names.set(id,language);
 if(doc.workflow==='subscription'){
  for(const f of doc.fields)if(f.sharedKey&&f.id!=='auth_name')bind(f.id,f.sharedKey);
  if(individual){
   const ids=['first_name','second_name','third_name','family_name'];
   const language=autoLanguage(ids.map(id=>values[id]));
   ids.forEach((id,index)=>bind(id,language+'_'+['first','second','third','last'][index]));
   name('english_name','en');
  }else name('auth_name','auth');
 }
 if(doc.id==='signature-form'){
  if(individual)name('client_name');else bind('client_name','company_name');
  same(['client_number','account_number']);
  if(individual&&values.signer_role==='client'){name('signer_name');bind('id_number','id_number');}
  if(!individual&&values.signer_role==='authorized'){name('signer_name','auth');bind('id_number','auth_id');}
 }
 if(doc.id==='terms-and-conditions')for(const id of ['terms_name_0','authorization_name_0']){if(individual)name(id);else bind(id,'company_name');}
 if(doc.id==='kyc-individual'){
  name('name');name('risk_client_name');
  same(['title','gender','dob','nationality','id_type','id_other','id_number','phone','mobile','email','building','street','postal','country']);
  bind('postal_additional','additional');
 }
 if(doc.id==='fatca-crs-individual'){
  same(['en_first','en_second','en_third','en_last','ar_first','ar_second','ar_third','ar_last','title','gender','dob']);
  for(const key of ['building','street','district','city','postal','country']){
   bind('mail_'+key,key);if(p.also_residence)bind('sa_'+key,key);
  }
  if(values.capacity==='holder'){name('signer_en','en');name('signer_ar','ar');}
  name('staff_account_holder');
 }
 if(doc.id==='kyc-corporate'){
  bind('company','company_name');bind('risk_client_name','company_name');bind('cr','company_id_number');
  same(['inc_country','building','street','district','city','postal','additional','phone','mobile','email','auth_id_type','auth_id']);
  bind('business_phone','phone');name('auth_name','auth');
 }
 if(doc.id==='fatca-crs-corporate'){
  bind('legal_name','company_name');bind('inc_country','inc_country');name('signer_0_name','auth');
  for(const prefix of ['residence','head'])if(p[prefix==='head'?'also_head':'also_residence'])for(const key of ['building','street','district','city','country'])bind(prefix+'_'+key,key);
 }
 if(doc.custom)for(const f of doc.fields){
  const key=f.shared?.[audience];
  if(key&&!['full_name','full_name_en','full_name_ar','full_address'].includes(key))bind(f.id,key);
 }
 for(const group of personNameGroups(doc,audience)){
  if(!names.has(group.id))continue;
  const requested=names.get(group.id),language=requested==='auto'?autoLanguage(group.partIds.map(id=>values[id])):requested;
  const keys=['first','second','third','last'].map(part=>language+'_'+part);
  group.partIds.forEach((id,index)=>bind(id,keys[index]));
  for(const target of group.targets)bindings[target.id]=target.join.map(id=>keys[group.partIds.indexOf(id)]);
 }
 return bindings;
}

export function sharedEdit(doc,values,profile,audience,editedField,{seedMissing=true}={}){
 if(!editedField)return {};
 const keys=sharedBindings(doc,values,profile,audience)[editedField];
 // Derived full names and combined address boxes have no lossless inverse.
 if(keys?.length!==1||(values[editedField]!==undefined&&typeof values[editedField]!=='string'))return {};
 const key=keys[0],value=values[editedField]??'',patch={[key]:value};
 const field=sharedGroups(audience).flatMap(group=>group.fields).find(field=>field.id===key);
 if(!field||(field.options&&value!==''&&!field.options.some(option=>option[0]===value)))return {};
 const group=personNameGroups(doc,audience).find(group=>group.partIds.includes(editedField));
 const primary=doc.workflow==='subscription'&&doc.group==='individual'?['first_name','second_name','third_name','family_name']:null;
 if(/^(en|ar)_(first|second|third|last)$/.test(key)){
  if(group?.language==='auto'||primary?.includes(editedField)||!profile?.name_language)patch.name_language=key.slice(0,2);
 }
 const parts=group?.partIds||(primary?.includes(editedField)?primary:null);
 if(seedMissing&&parts&&/^(en|ar|auth)_(first|second|third|last)$/.test(key)){
  const language=key.split('_')[0];
  parts.forEach((id,index)=>{
   const sibling=language+'_'+['first','second','third','last'][index];
   if(!Object.hasOwn(profile||{},sibling)&&typeof values[id]==='string')patch[sibling]=values[id];
  });
 }
 return patch;
}

// Map by meaning, never by matching words such as "Name". Extra client rows,
// controllers, witnesses, bank/custodian accounts and signatures are independent.
export function sharedCandidates(doc,profile,values,audience){
 if(!['individual','corporate'].includes(audience)||(doc.group!=='shared'&&doc.group!==audience))return {};
 const p=profile||{},out={};
 const copy=(id,value)=>{out[id]=value||'';};
 const partsFor=language=>[p[language+'_first'],...((language+'_second' in p||language+'_third' in p)?[p[language+'_second'],p[language+'_third']]:[p[language+'_middle'],'']),p[language+'_last']].map(value=>value||'');
 const enParts=partsFor('en'),arParts=partsFor('ar'),authParts=partsFor('auth');
 const fullEn=joinPersonName(enParts),fullAr=joinPersonName(arParts);
 const present=language=>['first','second','third','last','middle'].some(part=>Object.hasOwn(p,language+'_'+part));
 const name=audience==='individual'?(p.name_language==='ar'?(present('ar')?fullAr:fullEn):(present('en')?fullEn:fullAr)):p.company_name||'';
 const address=joined(p.building,p.street,p.district,p.city,p.postal,p.additional,p.country);
 if(doc.workflow==='subscription'){
  for(const f of doc.fields){if(f.sharedKey)copy(f.id,p[f.sharedKey]);}
  copy('client_account',p.account_number||p.client_number);
  copy('english_name',audience==='individual'?fullEn:(!/\p{Script=Arabic}/u.test(p.company_name||'')?p.company_name:''));
  if(audience==='individual'){
   const preferred=p.name_language||(present('ar')?'ar':'en'),language=present(preferred)?preferred:present('ar')?'ar':'en';
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
  for(const key of ['title','gender','dob','nationality','id_type','id_other','id_number','phone','mobile','email','building','street','postal','country'])copy(key,p[key]);
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
  copy('company',name);copy('risk_client_name',name);copy('inc_country',p.inc_country);copy('cr',p.company_id_number);
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
 for(const group of personNameGroups(doc,audience)){
  if(!group.targets.some(target=>Object.hasOwn(out,target.id)))continue;
  const full=joinPersonName(group.targets.map(target=>out[target.id]));
  const sources=group.language==='en'?[[fullEn,enParts]]:group.language==='ar'?[[fullAr,arParts]]:audience==='corporate'?[[joinPersonName(authParts),authParts]]:p.name_language==='ar'?[[fullAr,arParts],[fullEn,enParts]]:[[fullEn,enParts],[fullAr,arParts]];
  const exact=full&&sources.find(([name])=>name===full)?.[1];
  const parts=exact||Object.values(splitPersonName(full));
  group.partIds.forEach((id,index)=>copy(id,parts[index]));
  for(const target of group.targets)copy(target.id,joinPersonName(target.join.map(id=>out[id])));
 }
 return out;
}
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
