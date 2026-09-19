import {api,e,errorText,when} from './api.js';
import './review.css';
export const reviewLabels={pending:['Under review','قيد المراجعة'],approved:['Approved','مقبول'],rejected:['Rejected','مرفوض']};
export const reasonLabels={missing_details:['Missing details','بيانات ناقصة'],incorrect_data:['Incorrect data','بيانات غير صحيحة'],other:['Other','أخرى']};
const label=(map,key,lang)=>map[key]?.[lang==='ar'?1:0]||'';
export function reviewBadge(s,lang){const status=s.review_status||s.status||'pending';return `<span class="review-badge review-${e(status)}">${label(reviewLabels,status,lang)}</span>`;}
export function reviewReason(s,lang){return (s.review_status||s.status)==='rejected'?`<div class="review-reason"><b>${label(reasonLabels,s.reason_code,lang)}</b>${s.reason_text?`<p dir="auto">${e(s.reason_text)}</p>`:''}</div>`:'';}
export function reviewSummary(s,lang){return reviewBadge(s,lang)+reviewReason(s,lang);}
export function mountReview(node,s,{admin,lang,token,onReviewed}={}){
 const t=(en,ar)=>lang==='ar'?ar:en;
 function render(){
  node.innerHTML=`<section class="submission-review"><h3>${t('Application status','حالة الطلب')}</h3>${reviewSummary(s,lang)}${s.reviewed_at?`<p class="review-meta">${admin?`${t('By','بواسطة')} <bdi>${e(s.reviewed_by)}</bdi> · `:''}${e(when(s.reviewed_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')}</p>`:`<p class="review-meta">${t('Your submission is waiting for management review.','طلبك بانتظار مراجعة الإدارة.')}</p>`}${s.review_history?.length?`<details class="review-history"><summary>${t('Decision history','سجل القرارات')} · ${s.review_history.length}</summary><ol>${s.review_history.map(r=>`<li>${reviewSummary(r,lang)}<p class="review-meta">${admin?`${t('By','بواسطة')} <bdi>${e(r.admin_username)}</bdi> · `:''}${e(when(r.created_at,lang))}</p></li>`).join('')}</ol></details>`:''}${admin&&!s.archived_at?`<form class="review-form"><label>${t('Decision','القرار')}<select name="status" required><option value="">${t('Select a decision','اختر القرار')}</option><option value="approved">${t('Approve','قبول')}</option><option value="rejected">${t('Reject','رفض')}</option></select></label><div data-rejection hidden><label>${t('Reason','سبب الرفض')}<select name="reason_code"><option value="">${t('Select a reason','اختر السبب')}</option>${Object.entries(reasonLabels).map(([key,text])=>`<option value="${key}">${text[lang==='ar'?1:0]}</option>`).join('')}</select></label><label>${t('Details for the client','توضيح للعميل')}<textarea name="reason_text" maxlength="2000" rows="3" dir="auto"></textarea><small>${t('Required for Other. The client will see this text.','مطلوب عند اختيار «أخرى». سيظهر هذا النص للعميل.')}</small></label></div><p class="review-meta">${t('Saving notifies the client and records your admin username and time. Previous decisions stay in the history.','سيتم إشعار العميل وحفظ اسم حساب المدير ووقت القرار. تبقى القرارات السابقة في السجل.')}</p><p data-review-message role="status" aria-live="polite"></p><button class="portal-button primary" type="submit">${t('Save decision & notify client','حفظ القرار وإشعار العميل')}</button></form>`:admin?`<p class="review-meta">${t('Archived version — open the current version to review it.','نسخة مؤرشفة — افتح النسخة الحالية لمراجعتها.')}</p>`:''}</section>`;
  const form=node.querySelector('form');if(!form)return;
  let requestKey=crypto.randomUUID(),busy=false;
  const update=()=>{const rejected=form.elements.status.value==='rejected';form.querySelector('[data-rejection]').hidden=!rejected;form.elements.reason_code.required=rejected;form.elements.reason_text.required=rejected&&form.elements.reason_code.value==='other';};
  form.addEventListener('input',()=>{requestKey=crypto.randomUUID();update();});form.elements.status.onchange=update;form.elements.reason_code.onchange=update;
  form.onsubmit=async ev=>{
   ev.preventDefault();if(busy)return;busy=true;
   const values=Object.fromEntries(new FormData(form)),payload={id:s.id,status:values.status,reason_code:values.status==='rejected'?values.reason_code:'',reason_text:values.status==='rejected'?values.reason_text:'',expectedReview:s.review_revision,requestKey};
   form.querySelectorAll('button,select,textarea').forEach(x=>x.disabled=true);
   const message=form.querySelector('[data-review-message]');message.textContent=t('Saving…','جارٍ الحفظ…');
   try{
    const result=await api('admin_review',payload,{token:token()});Object.assign(s,result.review);render();
    const notice=document.createElement('p');notice.className='review-success';notice.setAttribute('role','status');notice.textContent=t('Decision saved. The client has an in-app notification.','تم حفظ القرار وإضافة إشعار في حساب العميل.');node.prepend(notice);
    Promise.resolve(onReviewed?.()).catch(()=>{});
   }catch(err){message.textContent=errorText(err,lang);}
   finally{busy=false;form.querySelectorAll('button,select,textarea').forEach(x=>x.disabled=false);}
  };
 }
 render();
}
