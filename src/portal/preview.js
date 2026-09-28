import {api,endpoint,e,errorText,when} from './api.js';
import {loadPreview,renderPage} from '../pdf.js';
import {mountReview} from './review.js';
import {reviewEnabled} from './workflow.js';
import {signSubmittedForm,signatureEditUrl} from './sign-submission.js';
import {appRoot} from '../routes.js';
import './submitted-details.css';
let activePreview=null;
export async function previewSubmission(id,{admin=false,lang='en',token,onReviewed,onSigned=()=>location.reload(),onError=()=>false}={}){
 if(activePreview?.id===id&&activePreview.admin===admin){activePreview.dialog.focus();return;}
 activePreview?.close();
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');dialog.className='portal-preview';dialog.dir=lang==='ar'?'rtl':'ltr';document.body.append(dialog);
 dialog.innerHTML=`<div class="portal-preview-head"><h2>${t('Submitted document','المستند المرسل')}</h2><button type="button" data-close aria-label="${t('Close','إغلاق')}">×</button></div><div class="portal-preview-body"><p role="status">${t('Loading…','جارٍ التحميل…')}</p></div>`;
 let pdf=null,closed=false,loading=false,download=null;
 const disposePDF=()=>{pdf?.loadingTask.destroy().catch(()=>{});pdf=null;};
 const close=()=>{closed=true;download?.abort();disposePDF();dialog.close();dialog.remove();if(activePreview?.dialog===dialog)activePreview=null;};
 activePreview={id,admin,dialog,close};dialog.tabIndex=-1;
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});dialog.showModal();
 async function load(){
 if(loading||closed)return;loading=true;disposePDF();
 dialog.querySelector('.portal-preview-body').innerHTML=`<p role="status">${t('Loading…','جارٍ التحميل…')}</p>`;
 dialog.setAttribute('aria-busy','true');
 try{
  const [{submission:s},{renderSubmissionDetails}]=await Promise.all([
   api(admin?'admin_detail':'detail',undefined,{params:{id}}),import('./submitted-details.js'),
  ]);if(closed)return;
  dialog.querySelector('.portal-preview-body').innerHTML=`<h3>${e(t(s.title,s.ar))}</h3><p class="version-badge">${t('Version','النسخة')} ${s.version} · ${s.archived_at?t('Archived','مؤرشفة'):t('Current','الحالية')}${s.restored_from?' · '+t('Restored from an earlier version','مستعادة من نسخة سابقة'):''}</p><p>${e(when(s.created_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')} · ${t(s.audience==='individual'?'Individual':'Company',s.audience==='individual'?'فرد':'شركة')}</p><a class="portal-button" href="${endpoint(admin?'admin_pdf':'pdf',{id})}">${t('Download PDF','تنزيل PDF')}</a>${s.archived_at&&s.current_id?`<button type="button" class="portal-button" data-current-version>${t('Open current version','فتح النسخة الحالية')}</button>`:''}<div data-submission-review></div><details class="portal-answer-details" open><summary>${t('Submitted details','البيانات المرسلة')}</summary>${renderSubmissionDetails(s,lang)}</details><div class="portal-pdf-pages"></div><p data-preview-status role="status">${t('Preparing preview…','جارٍ إعداد المعاينة…')}</p>`;
  dialog.querySelector('[data-current-version]')?.addEventListener('click',()=>{close();previewSubmission(s.current_id,{admin,lang,token,onReviewed,onSigned,onError});});
  mountReview(dialog.querySelector('[data-submission-review]'),s,{admin,lang,token,onReviewed,onSigned});
  if(!admin&&s.can_replace&&(s.review_status==='signature_required'||s.signature_state==='unsigned'||(!reviewEnabled()&&s.signature_state==='unknown'))){
   const required=reviewEnabled(),actions=document.createElement('div');actions.className='account-actions';
   actions.innerHTML=`${s.can_sign_electronically?(s.source==='online'?`<a class="portal-button primary" href="${signatureEditUrl(s,lang)}">${required?t('Add electronic signature','إضافة توقيع إلكتروني'):t('Add signature (optional)','إضافة توقيع (اختياري)')}</a>`:`<button type="button" class="portal-button primary" data-sign-submission>${required?t('Add electronic signature','إضافة توقيع إلكتروني'):t('Add signature (optional)','إضافة توقيع (اختياري)')}</button>`):''}<a class="portal-button" href="${appRoot}account/?${new URLSearchParams({upload:s.doc_id,lang})}">${reviewEnabled()?t('Upload signed form','رفع النموذج الموقّع'):t('Upload replacement','رفع نسخة بديلة')}</a>`;
   dialog.querySelector('[data-submission-review]').append(actions);
   actions.querySelector('[data-sign-submission]')?.addEventListener('click',()=>{close();signSubmittedForm(id,{lang,onSaved:onSigned});});
  }
  download=new AbortController();const timeout=setTimeout(()=>download?.abort(),60000);let bytes;
  try{
   const res=await fetch(endpoint(admin?'admin_pdf':'pdf',{id}),{credentials:'same-origin',cache:'no-store',signal:download.signal});
   if(!res.ok)throw Object.assign(Error(res.status===401?'login_required':res.status===404?'not_found':'connection_failed'),{status:res.status});
   bytes=new Uint8Array(await res.arrayBuffer());
  }finally{clearTimeout(timeout);download=null;}
  const loaded=await loadPreview(bytes);if(closed){await loaded.loadingTask.destroy();return;}pdf=loaded;
  const pages=dialog.querySelector('.portal-pdf-pages'),width=Math.min(1000,pages.clientWidth||1000);
  for(let i=1;i<=pdf.numPages;i++){if(closed)return;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',t('Page ','صفحة ')+i);pages.append(canvas);await renderPage(pdf,i,canvas,width);}
  if(!closed)dialog.querySelector('[data-preview-status]').textContent='';
 }catch(err){
  if(closed)return;
  if(err.status===401){close();if(!onError(err))location.href=appRoot+(admin?'management/':'login/?lang='+lang);return;}
  const status=dialog.querySelector('.portal-preview-body [role="status"]');status.textContent=errorText(err,lang);
  const retry=document.createElement('button');retry.type='button';retry.className='portal-button';retry.dataset.previewRetry='';retry.textContent=t('Try again','إعادة المحاولة');retry.onclick=load;status.after(retry);
 }finally{loading=false;if(!closed)dialog.removeAttribute('aria-busy');}
 }
 await load();
}
