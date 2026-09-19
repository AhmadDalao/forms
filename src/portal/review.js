import {api,e,errorText,when} from './api.js';
import {appRoot} from '../routes.js';
import './review.css';
export const reviewLabels={pending:['Under review','قيد المراجعة'],signature_required:['Signature required','التوقيع مطلوب'],approved:['Approved','مقبول'],rejected:['Rejected','مرفوض']};
const signatureLabels={electronic:['Electronic signature added','أُضيف توقيع إلكتروني'],unsigned:['Not signed yet','لم يُوقّع بعد'],uploaded:['Signed PDF uploaded — check signature','PDF موقّع مرفوع — تحقّق من التوقيع'],unknown:['Signature not verified','لم يُتحقّق من التوقيع']};
export const reasonLabels={missing_details:['Missing details','بيانات ناقصة'],incorrect_data:['Incorrect data','بيانات غير صحيحة'],other:['Other','أخرى']};
const label=(map,key,lang)=>map[key]?.[lang==='ar'?1:0]||'';
export function reviewBadge(s,lang,{decision=false}={}){const archived=s.archived_at&&!decision,status=archived?'archived':s.review_status||s.status||'pending';return `<span class="review-badge review-${e(status)}">${archived?(lang==='ar'?'مؤرشفة':'Archived'):label(reviewLabels,status,lang)}</span>`;}
export function signatureBadge(s,lang){
 const state=(s.review_status||s.status)==='signature_required'?'unsigned':Object.hasOwn(signatureLabels,s.signature_state)?s.signature_state:'unknown';
 return `<span class="signature-state signature-${state}" data-signature-state="${state}">${label(signatureLabels,state,lang)}</span>`;
}
export function reviewReason(s,lang,{decision=false}={}){
 if(s.archived_at&&!decision)return '';
 const status=s.review_status||s.status;
 if(status==='signature_required')return s.reason_text?`<div class="review-reason review-reason-signature"><p dir="auto">${e(s.reason_text)}</p></div>`:'';
 return status==='rejected'?`<div class="review-reason"><b>${label(reasonLabels,s.reason_code,lang)}</b>${s.reason_text?`<p dir="auto">${e(s.reason_text)}</p>`:''}</div>`:'';
}
export function reviewSummary(s,lang,options){return reviewBadge(s,lang,options)+reviewReason(s,lang,options);}
export function mountReview(node,s,{admin,lang,token,onReviewed}={}){
 const t=(en,ar)=>lang==='ar'?ar:en;
 function render(){
  const approved=s.review_status==='approved';
  const statusNote=s.archived_at?t('This version has been replaced and is kept in the client’s history. It is no longer awaiting review.','استُبدلت هذه النسخة وحُفظت في سجل العميل. لم تعد بانتظار المراجعة.'):s.reviewed_at?`${admin?`${t('By','بواسطة')} <bdi>${e(s.reviewed_by)}</bdi> · `:''}${e(when(s.reviewed_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')}`:t('Your submission is waiting for management review.','طلبك بانتظار مراجعة الإدارة.');
  node.innerHTML=`<section class="submission-review"><h3>${t('Application status','حالة الطلب')}</h3>${reviewBadge(s,lang)}<div class="review-signature-state">${signatureBadge(s,lang)}</div>${reviewReason(s,lang)}<p class="review-meta">${statusNote}</p>${!admin&&!s.archived_at&&s.review_status==='signature_required'?`<p class="review-signing-remedy">${t('Open My applications to add your electronic signature, or download the form, sign it and upload the complete signed PDF.','افتح صفحة طلباتي لإضافة توقيعك الإلكتروني، أو نزّل النموذج ووقّعه ثم ارفع ملف PDF الموقّع كاملًا.')} <a href="${appRoot}my-applications/">${t('My applications','طلباتي')}</a></p>`:''}${s.review_history?.length?`<details class="review-history"><summary>${t('Decision history','سجل القرارات')} · ${s.review_history.length}</summary><ol>${s.review_history.map(r=>`<li>${reviewSummary(r,lang)}<p class="review-meta">${admin?`${t('By','بواسطة')} <bdi>${e(r.admin_username)}</bdi> · `:''}${e(when(r.created_at,lang))}</p></li>`).join('')}</ol></details>`:''}${admin&&!s.archived_at?`<form class="review-form ${approved?'review-form-locked':''}"><label>${t('Decision','القرار')}<select name="status" required><option value="">${t('Select a decision','اختر القرار')}</option><option value="approved" ${approved?'selected':''}>${approved?t('Approved','مقبول'):t('Approve','قبول')}</option><option value="signature_required">${t('Signature required','التوقيع مطلوب')}</option><option value="rejected">${t('Reject','رفض')}</option></select></label><div data-rejection hidden><label>${t('Reason','سبب الرفض')}<select name="reason_code"><option value="">${t('Select a reason','اختر السبب')}</option>${Object.entries(reasonLabels).map(([key,text])=>`<option value="${key}">${text[lang==='ar'?1:0]}</option>`).join('')}</select></label></div><div data-explanation hidden><label>${t('Details for the client','توضيح للعميل')}<textarea name="reason_text" maxlength="2000" rows="3" dir="auto"></textarea><small data-reason-help>${t('Required for Other. The client will see this text.','مطلوب عند اختيار «أخرى». سيظهر هذا النص للعميل.')}</small></label></div><p class="review-meta">${approved?t('Approval saved. No further action is needed for this version.','تم حفظ الموافقة. لا يلزم اتخاذ إجراء آخر لهذه النسخة.'):t('Saving notifies the client and records your admin username and time. Previous decisions stay in the history.','سيتم إشعار العميل وحفظ اسم حساب المدير ووقت القرار. تبقى القرارات السابقة في السجل.')}</p><p data-review-message role="status" aria-live="polite"></p><button class="portal-button primary" type="submit">${approved?t('Decision saved','تم حفظ القرار'):t('Save decision & notify client','حفظ القرار وإشعار العميل')}</button></form>`:''}</section>`;
  const form=node.querySelector('form');if(!form)return;
  if(approved){form.querySelectorAll('button,select,textarea').forEach(el=>el.disabled=true);return;}
  let requestKey=crypto.randomUUID(),busy=false;
  const update=()=>{const rejected=form.elements.status.value==='rejected',signatureRequired=form.elements.status.value==='signature_required';form.querySelector('[data-rejection]').hidden=!rejected;form.querySelector('[data-explanation]').hidden=!rejected&&!signatureRequired;form.elements.reason_code.required=rejected;form.elements.reason_text.required=rejected&&form.elements.reason_code.value==='other';form.querySelector('[data-reason-help]').textContent=signatureRequired?t('Optional. Tell the client which signature is missing.','اختياري. وضّح للعميل التوقيع الناقص.'):t('Required for Other. The client will see this text.','مطلوب عند اختيار «أخرى». سيظهر هذا النص للعميل.');};
  form.addEventListener('input',()=>{requestKey=crypto.randomUUID();update();});form.elements.status.onchange=update;form.elements.reason_code.onchange=update;
  form.onsubmit=async ev=>{
   ev.preventDefault();if(busy)return;busy=true;
   const values=Object.fromEntries(new FormData(form)),payload={id:s.id,status:values.status,reason_code:values.status==='rejected'?values.reason_code:'',reason_text:['rejected','signature_required'].includes(values.status)?values.reason_text:'',expectedReview:s.review_revision,requestKey};
   form.querySelectorAll('button,select,textarea').forEach(x=>x.disabled=true);
   const message=form.querySelector('[data-review-message]');message.textContent=t('Saving…','جارٍ الحفظ…');
   try{
    const result=await api('admin_review',payload,{token:token()});Object.assign(s,result.review);render();
    const notice=document.createElement('p');notice.className='review-success';notice.setAttribute('role','status');notice.textContent=t('Decision saved. The client has an in-app notification.','تم حفظ القرار وإضافة إشعار في حساب العميل.');node.prepend(notice);
    Promise.resolve(onReviewed?.()).catch(()=>{});
   }catch(err){message.textContent=errorText(err,lang);}
   finally{busy=false;if(form.isConnected)form.querySelectorAll('button,select,textarea').forEach(x=>x.disabled=false);}
  };
 }
 render();
}
