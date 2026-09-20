import {api,endpoint,e,errorText,when} from './api.js';
import {loadPreview,renderPage} from '../pdf.js';
import {mountReview} from './review.js';
import {reviewEnabled} from './workflow.js';
import {signSubmittedForm,signatureEditUrl} from './sign-submission.js';
import {appRoot} from '../routes.js';
import './submitted-details.css';
export async function previewSubmission(id,{admin=false,lang='en',token,onReviewed,onSigned=()=>location.reload()}={}){
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');dialog.className='portal-preview';dialog.dir=lang==='ar'?'rtl':'ltr';document.body.append(dialog);
 dialog.innerHTML=`<div class="portal-preview-head"><h2>${t('Submitted document','المستند المرسل')}</h2><button type="button" data-close aria-label="${t('Close','إغلاق')}">×</button></div><div class="portal-preview-body"><p role="status">${t('Loading…','جارٍ التحميل…')}</p></div>`;
 let pdf=null,closed=false;
 const close=()=>{closed=true;pdf?.loadingTask.destroy();dialog.close();dialog.remove();};dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});dialog.showModal();
 try{
  const [{submission:s},{renderSubmissionDetails}]=await Promise.all([
   api(admin?'admin_detail':'detail',undefined,{params:{id}}),import('./submitted-details.js'),
  ]);if(closed)return;
  dialog.querySelector('.portal-preview-body').innerHTML=`<h3>${e(t(s.title,s.ar))}</h3><p class="version-badge">${t('Version','النسخة')} ${s.version} · ${s.archived_at?t('Archived','مؤرشفة'):t('Current','الحالية')}${s.restored_from?' · '+t('Restored from an earlier version','مستعادة من نسخة سابقة'):''}</p><p>${e(when(s.created_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')} · ${t(s.audience==='individual'?'Individual':'Company',s.audience==='individual'?'فرد':'شركة')}</p><a class="portal-button" href="${endpoint(admin?'admin_pdf':'pdf',{id})}">${t('Download PDF','تنزيل PDF')}</a>${s.archived_at&&s.current_id?`<button type="button" class="portal-button" data-current-version>${t('Open current version','فتح النسخة الحالية')}</button>`:''}<div data-submission-review></div><details class="portal-answer-details" open><summary>${t('Submitted details','البيانات المرسلة')}</summary>${renderSubmissionDetails(s,lang)}</details><div class="portal-pdf-pages"></div><p data-preview-status role="status">${t('Preparing preview…','جارٍ إعداد المعاينة…')}</p>`;
  dialog.querySelector('[data-current-version]')?.addEventListener('click',()=>{close();previewSubmission(s.current_id,{admin,lang,token,onReviewed,onSigned});});
  mountReview(dialog.querySelector('[data-submission-review]'),s,{admin,lang,token,onReviewed,onSigned});
  if(!admin&&s.can_replace&&(s.review_status==='signature_required'||s.signature_state==='unsigned'||(!reviewEnabled()&&s.signature_state==='unknown'))){
   const required=reviewEnabled(),actions=document.createElement('div');actions.className='account-actions';
   actions.innerHTML=`${s.can_sign_electronically?(s.source==='online'?`<a class="portal-button primary" href="${signatureEditUrl(s,lang)}">${required?t('Add electronic signature','إضافة توقيع إلكتروني'):t('Add signature (optional)','إضافة توقيع (اختياري)')}</a>`:`<button type="button" class="portal-button primary" data-sign-submission>${required?t('Add electronic signature','إضافة توقيع إلكتروني'):t('Add signature (optional)','إضافة توقيع (اختياري)')}</button>`):''}<a class="portal-button" href="${appRoot}my-applications/?${new URLSearchParams({upload:s.doc_id,lang})}">${reviewEnabled()?t('Upload signed form','رفع النموذج الموقّع'):t('Upload replacement','رفع نسخة بديلة')}</a>`;
   dialog.querySelector('[data-submission-review]').append(actions);
   actions.querySelector('[data-sign-submission]')?.addEventListener('click',()=>{close();signSubmittedForm(id,{lang,onSaved:onSigned});});
  }
  const res=await fetch(endpoint(admin?'admin_pdf':'pdf',{id}),{cache:'no-store'});if(!res.ok)throw Error('login_required');
  const loaded=await loadPreview(new Uint8Array(await res.arrayBuffer()));if(closed){loaded.loadingTask.destroy();return;}pdf=loaded;
  for(let i=1;i<=pdf.numPages;i++){if(closed)return;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',t('Page ','صفحة ')+i);dialog.querySelector('.portal-pdf-pages').append(canvas);await renderPage(pdf,i,canvas,1000);}
  if(!closed)dialog.querySelector('[data-preview-status]').textContent='';
 }catch(err){if(!closed)dialog.querySelector('.portal-preview-body [role="status"]').textContent=errorText(err,lang);}
}
