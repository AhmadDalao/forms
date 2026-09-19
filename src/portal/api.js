import {appRoot} from '../routes.js';
export const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let csrf='';
export const endpoint=(action,params={})=>`${appRoot}api/portal.php?${new URLSearchParams({action,...params})}`;
export async function api(action,body,{token=csrf,params={}}={}){
 const multipart=body instanceof FormData;
 const response=await fetch(endpoint(action,params),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(multipart?60000:15000),headers:body?{'X-CSRF-Token':token,...(multipart?{}:{'Content-Type':'application/json'})}:{},body:body?(multipart?body:JSON.stringify(body)):undefined});
 let data;try{data=await response.json();}catch{throw Error('connection_failed');}
 if(!response.ok)throw Object.assign(Error(data.error||'server_error'),{status:response.status});
 if(data.csrf)csrf=data.csrf;return data;
}
export const session=()=>api('session');
export const errors={
 phone_invalid:['Enter a Saudi mobile number with 9 digits, starting with 5.','أدخل رقم جوال سعودي من ٩ أرقام يبدأ بـ٥.'],
 password_weak:['Use at least 12 characters (maximum 72 bytes).','استخدم ١٢ حرفًا على الأقل (بحد أقصى ٧٢ بايت).'],
 password_mismatch:['The passwords do not match.','كلمتا المرور غير متطابقتين.'],
 phone_exists:['This mobile number already has an account. Please sign in.','رقم الجوال مسجل بالفعل. يرجى تسجيل الدخول.'],
 name_invalid:['Enter your name.','أدخل اسمك.'],
 login_invalid:['The mobile number or password is incorrect.','رقم الجوال أو كلمة المرور غير صحيحة.'],
 current_password_invalid:['Your current password is incorrect.','كلمة المرور الحالية غير صحيحة.'],
 password_different:['Choose a different password from your temporary password.','اختر كلمة مرور مختلفة عن كلمة المرور المؤقتة.'],
 email_invalid:['Check the email address.','تحقق من البريد الإلكتروني.'],
 rate_limited:['Too many attempts. Please wait and try again later.','محاولات كثيرة. يرجى الانتظار ثم إعادة المحاولة.'],
 login_required:['Please sign in again. Your draft is still saved.','يرجى تسجيل الدخول مجددًا. مسودتك محفوظة.'],
 admin_required:['Your management session expired. Please sign in again.','انتهت جلسة الإدارة. يرجى تسجيل الدخول مجددًا.'],
 account_changed:['Your signed-in account changed. Reload before submitting.','تغيّر الحساب المسجل. أعد تحميل الصفحة قبل الإرسال.'],
 password_change_required:['Change your temporary password in My account first.','غيّر كلمة المرور المؤقتة في حسابي أولاً.'],
 csrf_invalid:['Your session changed. Refresh the page and try again.','تغيّرت الجلسة. حدّث الصفحة وأعد المحاولة.'],
 form_incomplete:['Complete the required form fields before submitting.','أكمل الحقول المطلوبة قبل إرسال النموذج.'],
 units_invalid:['Enter a valid whole number of units.','أدخل عدد وحدات صحيحًا.'],
 document_unavailable:['This document is no longer available for submission.','هذا المستند لم يعد متاحًا للإرسال.'],
 request_large:['The PDF is too large. The limit is 20 MB.','ملف PDF أكبر من الحد المسموح: ٢٠ ميغابايت.'],
 no_submissions:['This client has no submitted forms yet.','لم يرسل العميل أي نماذج بعد.'],
};
export const errorText=(err,lang='en')=>(errors[err.message]||['Could not complete this request. Please try again.','تعذّر إكمال الطلب. يرجى المحاولة مجددًا.'])[lang==='ar'?1:0];
export function language(){try{return localStorage.getItem('itqan.portal.language')||(navigator.language.startsWith('ar')?'ar':'en');}catch{return 'en';}}
export function setLanguage(lang){try{localStorage.setItem('itqan.portal.language',lang);}catch{}}
export function authChanged(){try{localStorage.setItem('itqan.portal.auth-change',crypto.randomUUID());}catch{}}
export function importGuestDrafts(id,folder){
 const audience=folder==='companies'?'corporate':folder==='individuals'?'individual':null;if(!audience)return;
 try{
  const source='itqan.forms.v1.'+audience+'.',destination='itqan.forms.v1.account.'+id+'.'+audience+'.';
  for(const key of Object.keys(localStorage).filter(k=>k.startsWith(source))){if(localStorage.getItem(destination+key.slice(source.length))===null){localStorage.setItem(destination+key.slice(source.length),localStorage.getItem(key));localStorage.removeItem(key);}}
 }catch{/* A blocked browser store must not prevent login. */}
}
export const when=(value,lang='en')=>value?new Intl.DateTimeFormat(lang==='ar'?'ar-SA':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(value)):'—';
