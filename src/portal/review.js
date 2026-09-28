import {e,when} from './api.js';
import './review.css';
export const reviewLabels={pending:['Under review','قيد المراجعة'],signature_required:['Signature required','التوقيع مطلوب'],approved:['Approved','مقبول'],rejected:['Rejected','مرفوض']};
const signatureLabels={electronic:['Electronic signature added','أُضيف توقيع إلكتروني'],unsigned:['Not signed yet','لم يُوقّع بعد'],uploaded:['Signed PDF uploaded — check signature','PDF موقّع مرفوع — تحقّق من التوقيع'],unknown:['Signature not verified','لم يُتحقّق من التوقيع']};
export const reasonLabels={missing_details:['Missing details','بيانات ناقصة'],incorrect_data:['Incorrect data','بيانات غير صحيحة'],other:['Other','أخرى']};
const label=(map,key,lang)=>map[key]?.[lang==='ar'?1:0]||'';
export const reviewAvailable=s=>s.workflow_enabled!==false&&s.review_required!==false;
export function reviewBadge(s,lang,{decision=false}={}){
 const status=decision?(s.review_status||s.status||'pending'):s.archived_at?'archived':s.presentation_status||(s.submission_mode==='direct'?'received':!reviewAvailable(s)?'saved':s.review_status||'pending');
 const labels={...reviewLabels,received:['Received','تم الاستلام'],saved:['Saved form','نموذج محفوظ'],archived:['Archived','مؤرشفة']};
 return `<span class="review-badge review-${e(status)}">${label(labels,status,lang)}</span>`;
}
export function signatureBadge(s,lang){
 const state=Object.hasOwn(signatureLabels,s.signature_state)?s.signature_state:'unknown';
 return `<span class="signature-state signature-${state}" data-signature-state="${state}">${label(signatureLabels,state,lang)}</span>`;
}
export function reviewReason(s,lang,{decision=false}={}){
 if(!decision&&(s.archived_at||!reviewAvailable(s)))return '';
 const status=s.review_status||s.status;
 if(status==='signature_required')return s.reason_text?`<div class="review-reason review-reason-signature"><p dir="auto">${e(s.reason_text)}</p></div>`:'';
 return status==='rejected'?`<div class="review-reason"><b>${label(reasonLabels,s.reason_code,lang)}</b>${s.reason_text?`<p dir="auto">${e(s.reason_text)}</p>`:''}</div>`:'';
}
export function reviewSummary(s,lang,options){return reviewBadge(s,lang,options)+reviewReason(s,lang,options);}
export function mountReview(node,s,{admin,lang}={}){
 const text=(en,ar)=>lang==='ar'?ar:en;
 node.innerHTML=`<section class="submission-review"><h3>${text('Application details','تفاصيل الطلب')}</h3>${reviewBadge(s,lang)}<div class="review-signature-state">${signatureBadge(s,lang)}</div><p class="review-meta">${s.archived_at?text('This earlier version is preserved in the account history.','هذه النسخة السابقة محفوظة في سجل الحساب.'):text('View, download or update this form through the forms page.','يمكن عرض هذا النموذج أو تنزيله أو تحديثه من صفحة النماذج.')}</p>${s.review_history?.length?`<details class="review-history"><summary>${text('Previous decisions','القرارات السابقة')} · ${s.review_history.length}</summary><ol>${s.review_history.map(r=>`<li>${reviewSummary(r,lang,{decision:true})}<p class="review-meta">${admin?`${text('By','بواسطة')} <bdi>${e(r.admin_username)}</bdi> · `:''}${e(when(r.created_at,lang))}</p></li>`).join('')}</ol></details>`:''}</section>`;
}
