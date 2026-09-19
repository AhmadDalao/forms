import {appRoot,draftStoragePrefix,portalStoragePrefix} from '../routes.js';
import {receiveWorkflow} from './workflow.js';
export const authChangeKey=portalStoragePrefix+'auth-change';
export const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let csrf='';
export const endpoint=(action,params={})=>`${appRoot}api/portal.php?${new URLSearchParams({action,...params})}`;
export async function api(action,body,{token=csrf,params={}}={}){
 const multipart=body instanceof FormData;
 const response=await fetch(endpoint(action,params),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(multipart?60000:15000),headers:body?{'X-CSRF-Token':token,...(multipart?{}:{'Content-Type':'application/json'})}:{},body:body?(multipart?body:JSON.stringify(body)):undefined});
 let data;try{data=await response.json();}catch{throw Error('connection_failed');}
 if(data.workflow)receiveWorkflow(data.workflow);
 if(!response.ok)throw Object.assign(Error(data.error||'server_error'),{status:response.status});
 if(data.csrf)csrf=data.csrf;return data;
}
export const session=()=>api('session');
export const errors={
 signature_image_required:['Add at least one signature image to save a signed copy.','أضف صورة توقيع واحدة على الأقل لحفظ نسخة موقّعة.'],
 workflow_disabled:['Management review is currently switched off. Your saved forms and decision history are kept.','المراجعة الإدارية معطّلة حاليًا. تبقى النماذج المحفوظة وسجل القرارات محفوظة.'],
 workflow_not_required:['This form was saved without review and cannot receive a review decision.','حُفظ هذا النموذج دون مراجعة ولا يمكن اتخاذ قرار مراجعة بشأنه.'],
 workflow_conflict:['The site workflow changed. Close this window and try again to use the current mode. Your details are saved.','تغيّر سير العمل في الموقع. أغلق هذه النافذة وحاول مجددًا لاستخدام الوضع الحالي. بياناتك محفوظة.'],
 workflow_forbidden:['Only the superadmin can change the workflow.','يمكن للمشرف الرئيسي فقط تغيير سير العمل.'],
 workflow_unchanged:['This workflow is already active.','سير العمل هذا مفعّل بالفعل.'],
 electronic_signing_unavailable:['Use Upload signed form for this version. Electronic placement is not available for this PDF.','استخدم رفع النموذج الموقّع لهذه النسخة. إضافة التوقيع الإلكتروني غير متاحة لهذا الملف.'],
 signing_layout_mismatch:['This PDF layout does not match its signature positions. Download it, sign it, and upload the complete signed PDF instead.','تخطيط هذا الملف لا يطابق مواضع التوقيع. نزّله ووقّعه ثم ارفع ملف PDF الموقّع كاملًا.'],
 signature_required:['Sign electronically before submitting, or download the PDF, sign it and upload the signed form from My applications.','وقّع إلكترونيًا قبل الإرسال، أو نزّل ملف PDF ووقّعه ثم ارفع النموذج الموقّع من صفحة طلباتي.'],
 signed_confirmation_required:['Confirm that you have signed the uploaded form before submitting it.','أكّد أنك وقّعت النموذج المرفوع قبل إرساله.'],
 review_reason_required:['Choose a rejection reason and add an explanation when selecting Other.','اختر سبب الرفض واكتب توضيحًا عند اختيار «أخرى».'],
 review_conflict:['This review changed in another window. Close and reopen the document to see the latest decision.','تغيّر القرار في نافذة أخرى. أغلق المستند وأعد فتحه للاطلاع على أحدث قرار.'],
 review_archived:['This version has been archived. Open the current version to review it.','تمت أرشفة هذه النسخة. افتح النسخة الحالية لمراجعتها.'],
 review_locked:['This version has already been approved. Submit a new version if corrections are needed.','تمت الموافقة على هذه النسخة. أرسل نسخة جديدة إذا لزم إجراء تصحيحات.'],
 review_unchanged:['This decision is already saved. Change the decision or its explanation before saving again.','هذا القرار محفوظ بالفعل. غيّر القرار أو توضيحه قبل الحفظ مجددًا.'],
 account_type_invalid:['Select Individual or Company.','اختر فردًا أو شركة.'],
 account_type_forbidden:['Only the superadmin can change a client’s account type.','يمكن للمشرف الرئيسي فقط تغيير نوع حساب العميل.'],
 account_type_restricted:['This form is not available for your account type. Management can change your account type.','هذا النموذج غير متاح لنوع حسابك. يمكن للإدارة تغيير نوع الحساب.'],
 account_type_managed:['Only management can change your account type.','يمكن للإدارة فقط تغيير نوع حسابك.'],
 account_type_conflict:['The account type changed in another window. Reopen this client profile and try again.','تغيّر نوع الحساب في نافذة أخرى. أعد فتح ملف العميل وحاول مجددًا.'],
 version_conflict:['A newer version was saved while you were editing. Your draft is safe. Open My applications to review the latest version before submitting again.','حُفظت نسخة أحدث أثناء تعديلك. مسودتك محفوظة. افتح طلباتي لمراجعة أحدث نسخة قبل الإرسال مجددًا.'],
 signature_invalid:['The signature image could not be saved. Upload a PNG or JPG again.','تعذّر حفظ صورة التوقيع. أعد رفع صورة PNG أو JPG.'],
 phone_invalid:['Enter a Saudi mobile number with 9 digits, starting with 5.','أدخل رقم جوال سعودي من ٩ أرقام يبدأ بـ٥.'],
 password_weak:['Use at least 8 characters (maximum 72 bytes).','استخدم ٨ أحرف على الأقل (بحد أقصى ٧٢ بايت).'],
 password_mismatch:['The passwords do not match.','كلمتا المرور غير متطابقتين.'],
 phone_exists:['This mobile number already has an account. Please sign in.','رقم الجوال مسجل بالفعل. يرجى تسجيل الدخول.'],
 registration_name_invalid:['Enter your first and last name.','أدخل اسمك الأول واسم العائلة.'],
 name_invalid:['Enter your name.','أدخل اسمك.'],
 login_invalid:['The mobile number or password is incorrect.','رقم الجوال أو كلمة المرور غير صحيحة.'],
 current_password_invalid:['Your current password is incorrect.','كلمة المرور الحالية غير صحيحة.'],
 password_different:['Choose a different password from your temporary password.','اختر كلمة مرور مختلفة عن كلمة المرور المؤقتة.'],
 email_invalid:['Check the email address.','تحقق من البريد الإلكتروني.'],
 rate_limited:['Too many attempts. Please wait and try again later.','محاولات كثيرة. يرجى الانتظار ثم إعادة المحاولة.'],
 login_required:['Please sign in again. Your draft is still saved.','يرجى تسجيل الدخول مجددًا. مسودتك محفوظة.'],
 admin_required:['Your management session expired. Please sign in again.','انتهت جلسة الإدارة. يرجى تسجيل الدخول مجددًا.'],
 account_changed:['Your signed-in account changed. Reload before submitting.','تغيّر الحساب المسجل. أعد تحميل الصفحة قبل الإرسال.'],
 password_change_required:['Change your temporary password in My applications first.','غيّر كلمة المرور المؤقتة في طلباتي أولاً.'],
 csrf_invalid:['Your session changed. Refresh the page and try again.','تغيّرت الجلسة. حدّث الصفحة وأعد المحاولة.'],
 form_incomplete:['Complete the required form fields before submitting.','أكمل الحقول المطلوبة قبل إرسال النموذج.'],
 units_invalid:['Enter a valid whole number of units.','أدخل عدد وحدات صحيحًا.'],
 document_unavailable:['This document is no longer available for submission.','هذا المستند لم يعد متاحًا للإرسال.'],
 request_large:['The PDF is too large. The limit is 20 MB.','ملف PDF أكبر من الحد المسموح: ٢٠ ميغابايت.'],
 no_submissions:['This client has no submitted forms yet.','لم يرسل العميل أي نماذج بعد.'],
};
export const errorText=(err,lang='en')=>(errors[err.message]||['Could not complete this request. Please try again.','تعذّر إكمال الطلب. يرجى المحاولة مجددًا.'])[lang==='ar'?1:0];
export function language(){try{return localStorage.getItem(portalStoragePrefix+'language')||(navigator.language.startsWith('ar')?'ar':'en');}catch{return 'en';}}
export function setLanguage(lang){try{localStorage.setItem(portalStoragePrefix+'language',lang);}catch{}}
export function authChanged(){try{localStorage.setItem(authChangeKey,crypto.randomUUID());}catch{}}
export function importGuestDrafts(id,folder){
 const audience=folder==='companies'?'corporate':folder==='individuals'?'individual':null;if(!audience)return;
 try{
  const source=draftStoragePrefix+audience+'.',destination=draftStoragePrefix+'account.'+id+'.'+audience+'.';
  for(const key of Object.keys(localStorage).filter(k=>k.startsWith(source))){if(localStorage.getItem(destination+key.slice(source.length))===null){localStorage.setItem(destination+key.slice(source.length),localStorage.getItem(key));localStorage.removeItem(key);}}
 }catch{/* A blocked browser store must not prevent login. */}
}
export const when=(value,lang='en')=>value?new Intl.DateTimeFormat(lang==='ar'?'ar-SA':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(value)):'—';
