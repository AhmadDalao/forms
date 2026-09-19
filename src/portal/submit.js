import {api,e,session,errorText} from './api.js';
import {appRoot} from '../routes.js';
import {submissionSigningState} from '../signatures.js';
import {showSigningGuide} from './signing.js';
import './submit.css';
import {workflowState,formSaveLabel} from './workflow.js';
export async function submitForm({doc,values,bytes,profile,audience,lang,user,signatures={},signatureModes={},revision=null,onSaved=()=>{}}){
 const workflow=workflowState(),reviewRequired=workflow.review_enabled;
 const signing=submissionSigningState(doc,values,signatures,signatureModes);
 if(reviewRequired&&!signing.ready){showSigningGuide({doc,lang,manual:signing.manual});return;}
 const t=(en,ar)=>lang==='ar'?ar:en;
 const dialog=document.createElement('dialog');dialog.className='submission-dialog';
 document.body.append(dialog);dialog.dir=lang==='ar'?'rtl':'ltr';let sending=false,closed=false,finished=false;const requestKey=crypto.randomUUID();let expected=revision?.expectedCurrent??null;
 const close=()=>{if(!sending){closed=true;dialog.close();dialog.remove();if(finished&&revision)location.href=appRoot+'my-applications/';}};
 dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
 if(!user){
  const next=audience==='corporate'?'companies':'individuals';
  dialog.innerHTML=`<h2>${reviewRequired?t('Sign in to submit','سجّل الدخول لإرسال النموذج'):t('Sign in to save','سجّل الدخول لحفظ النموذج')}</h2><p>${t('Your draft stays saved while you sign in or create an account.','تبقى مسودتك محفوظة أثناء تسجيل الدخول أو إنشاء حساب.')}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><a class="button primary" href="${appRoot}login/?next=${next}&resume=1&lang=${lang}">${t('Sign in / Register','دخول / إنشاء حساب')}</a></div>`;
  dialog.querySelector('[data-close]').onclick=close;dialog.showModal();return;
 }
 dialog.innerHTML=`<h2>${reviewRequired?t('Submit this form','إرسال النموذج'):t('Save this form','حفظ النموذج')}</h2><p><b>${e(t(doc.title,doc.ar))}</b></p><p>${reviewRequired?t('This sends the reviewed PDF and entered details to Itqan Capital under your account.','سيتم إرسال ملف PDF الذي راجعته والبيانات المدخلة إلى إتقان كابيتال ضمن حسابك.'):t('Save this PDF and entered details to your account. Management can view them; no approval is needed and signing is optional.','احفظ ملف PDF والبيانات المدخلة في حسابك. يمكن للإدارة عرضها؛ لا تحتاج إلى موافقة والتوقيع اختياري.')}</p><p>${e(user.name)} · <bdi>${e(user.phone)}</bdi></p><p>${t('You can download a copy anytime from My applications.','يمكنك تنزيل نسخة في أي وقت من طلباتي.')}</p><p data-version-note></p><p data-message role="status"></p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><button class="button primary" data-confirm>${formSaveLabel(lang)}</button></div>`;
 dialog.querySelector('[data-close]').onclick=close;dialog.showModal();
 const confirm=dialog.querySelector('[data-confirm]');confirm.disabled=true;
 try{
  const {submissions}=await api('submissions'),current=submissions.find(s=>s.doc_id===doc.id&&s.audience===audience&&!s.archived_at);
  if(closed)return;
  if(workflowState().revision!==workflow.revision)throw Error('workflow_conflict');
  if(revision&&(current?.id??null)!==revision.expectedCurrent)throw Error('version_conflict');
  expected=current?.id??null;
  dialog.querySelector('[data-version-note]').textContent=current?t(`This becomes version ${current.version+1}. Version ${current.version} stays in your archive.`,`ستُحفظ كنسخة ${current.version+1}. تبقى النسخة ${current.version} في الأرشيف.`):t('Your first version will be saved in your account.','ستُحفظ النسخة الأولى في حسابك.');
  confirm.disabled=false;
 }catch(error){if(!closed){const note=dialog.querySelector('[data-message]');note.textContent=errorText(error,lang);const link=document.createElement('a');link.href=appRoot+'my-applications/';link.textContent=t('Open my applications','فتح طلباتي');note.append(' ',link);}return;}
 dialog.querySelector('[data-confirm]').onclick=async()=>{
  if(sending)return;sending=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  const status=dialog.querySelector('[data-message]');status.textContent=reviewRequired?t('Submitting…','جارٍ الإرسال…'):t('Saving…','جارٍ الحفظ…');status.className='';
  try{
   const fresh=await session();if(!fresh.user)throw Error('login_required');if(fresh.user.id!==user.id)throw Error('account_changed');
   if(fresh.workflow.revision!==workflow.revision)throw Error('workflow_conflict');
   if(fresh.user.account_type!==audience)throw Error('account_type_restricted');
   const form=new FormData();form.set('pdf',new Blob([bytes],{type:'application/pdf'}),doc.id+'.pdf');
   form.set('metadata',JSON.stringify({workflowRevision:workflow.revision,account:user.id,document:doc.id,audience,requestKey,values,profile:revision?.profile||profile,signatures,signatureModes,expectedCurrent:expected,editedFrom:revision?.sourceId??null}));
   const result=await api('submit',form);onSaved(result.submission);finished=true;
   dialog.innerHTML=`<span class="submitted-mark">✓</span><h2>${reviewRequired?t('Form submitted','تم إرسال النموذج'):t('Form saved','تم حفظ النموذج')}</h2><p>${reviewRequired?t('Your form is under review. You will receive the decision in My applications. Earlier versions remain in your archive.','نموذجك قيد المراجعة. سيظهر القرار في طلباتي. تبقى النسخ السابقة في الأرشيف.'):t('Your form is saved in My applications without management review. Earlier versions remain in your archive.','حُفظ نموذجك في طلباتي دون مراجعة إدارية. تبقى النسخ السابقة في الأرشيف.')}</p><p class="submission-reference">${t('Reference','المرجع')}: ${e(result.submission.id.slice(0,8).toUpperCase())}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Continue','متابعة')}</button><a class="button primary" href="${appRoot}my-applications/">${t('My applications','طلباتي')}</a></div>`;
   dialog.querySelector('[data-close]').onclick=close;
  }catch(error){status.textContent=errorText(error,lang);status.className='error';if(['login_required','password_change_required'].includes(error.message)){const a=document.createElement('a');a.href=appRoot+(error.message==='login_required'?'login/':'my-applications/');a.textContent=t('Open my applications','فتح طلباتي');status.append(' ',a);}}
  finally{sending=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
}
