import {api,e,session,errorText} from './api.js';
import {appRoot} from '../routes.js';
import './submit.css';
import {workflowState} from './workflow.js';
import {withAnswerTotals} from '../answer-totals.js';

// A single click after preview sends the form. The same key and expected version
// are kept on retry, including when the first response was lost after committing.
export async function submitForm({doc,values,bytes,profile,audience,lang,user,signatures={},signatureModes={},revision=null,onSaved=()=>{}}){
 values=withAnswerTotals(doc.fields,values);
 if(document.querySelector('.submission-dialog'))return;
 const workflow=workflowState(),t=(en,ar)=>lang==='ar'?ar:en;
 const dialog=document.createElement('dialog');dialog.className='submission-dialog';dialog.dir=lang==='ar'?'rtl':'ltr';
 document.body.append(dialog);
 let sending=false,closed=false,finished=false,initialized=false,expected=revision?.expectedCurrent??null;
 const requestKey=crypto.randomUUID();
 const close=()=>{if(sending)return;closed=true;dialog.close();dialog.remove();if(finished&&revision)location.href=appRoot+'my-applications/';};
 dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
 if(!user){
  dialog.innerHTML=`<h2>${t('Sign in to submit','سجّل الدخول لإرسال النموذج')}</h2><p>${t('Your draft stays saved while you sign in.','تبقى مسودتك محفوظة أثناء تسجيل الدخول.')}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><a class="button primary" href="${appRoot}login/?next=${audience==='corporate'?'companies':'individuals'}&resume=1&lang=${lang}">${t('Sign in','تسجيل الدخول')}</a></div>`;
  dialog.querySelector('[data-close]').onclick=close;dialog.showModal();return;
 }
 dialog.innerHTML=`<h2>${t('Submitting your form','جارٍ إرسال النموذج')}</h2><p><b>${e(t(doc.title,doc.ar))}</b></p><p data-message role="status" aria-live="polite"></p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><button class="button primary" data-retry hidden>${t('Retry','إعادة المحاولة')}</button></div>`;
 dialog.querySelector('[data-close]').onclick=close;dialog.showModal();
 async function send(){
  if(sending||closed||finished)return;sending=true;
  dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  const status=dialog.querySelector('[data-message]');status.className='';status.textContent=t('Sending PDF and details…','جارٍ إرسال المستند والبيانات…');
  try{
   const fresh=await session();if(!fresh.user)throw Error('login_required');if(fresh.user.id!==user.id)throw Error('account_changed');
   if(fresh.workflow.revision!==workflow.revision)throw Error('workflow_conflict');
   if(fresh.user.account_type!==audience)throw Error('account_type_restricted');
   if(!initialized){
    const {submissions}=await api('submissions'),current=submissions.find(s=>s.doc_id===doc.id&&s.audience===audience&&!s.archived_at);
    if(revision&&(current?.id??null)!==revision.expectedCurrent)throw Error('version_conflict');
    expected=current?.id??null;initialized=true;
   }
   const form=new FormData();form.set('pdf',new Blob([bytes],{type:'application/pdf'}),doc.id+'.pdf');
   form.set('metadata',JSON.stringify({submissionMode:'direct',workflowRevision:workflow.revision,account:user.id,document:doc.id,audience,requestKey,values,profile:revision?.profile||profile,signatures,signatureModes,expectedCurrent:expected,editedFrom:revision?.sourceId??null}));
   const result=await api('submit',form);finished=true;onSaved(result.submission);
   dialog.innerHTML=`<span class="submitted-mark">✓</span><h2>${t('Form received','تم استلام النموذج')}</h2><p>${t('Your form has been sent to Itqan Capital. You can view, download or update it in My applications. Previous versions stay in your archive.','تم إرسال نموذجك إلى إتقان كابيتال. يمكنك عرضه أو تنزيله أو تحديثه من طلباتي. تبقى النسخ السابقة في الأرشيف.')}</p><p class="submission-reference">${t('Reference','المرجع')}: ${e(result.submission.id.slice(0,8).toUpperCase())}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Continue','متابعة')}</button><a class="button primary" href="${appRoot}my-applications/">${t('My applications','طلباتي')}</a></div>`;
   dialog.querySelector('[data-close]').onclick=close;
  }catch(error){
   status.textContent=errorText(error,lang);status.className='error';
   const blocked=['login_required','password_change_required','account_changed','account_type_restricted','version_conflict','workflow_conflict'].includes(error.message);
   dialog.querySelector('[data-retry]').hidden=blocked;
   if(blocked){const a=document.createElement('a');a.href=appRoot+'my-applications/';a.textContent=t('Open my applications','فتح طلباتي');status.append(' ',a);}
  }finally{sending=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 dialog.querySelector('[data-retry]').onclick=send;
 await send();
}
