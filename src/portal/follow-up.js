import {api,e,errorText} from './api.js';
import {reviewEnabled} from './workflow.js';
import {appRoot} from '../routes.js';
import {reviewAvailable,reviewReason} from './review.js';

export function followUpMarkup(s,lang){
 if(!reviewAvailable(s)||s.archived_at)return '';
 const t=(en,ar)=>lang==='ar'?ar:en,button=(action,label)=>`<button type="button" data-follow-up="${action}" data-submission="${e(s.id)}">${label}</button>`;
 let actions='';
 if(s.can_replace&&s.review_status==='correction_required')actions=s.source==='upload'?button('upload',t('Upload replacement PDF','رفع ملف PDF بديل')):button('edit',t('Correct and resubmit','تصحيح وإعادة إرسال'));
 if(s.can_replace&&s.review_status==='signature_required')actions=(s.can_sign_electronically?button('sign',t('Add electronic signature','إضافة توقيع إلكتروني')):'')+button('upload',t('Upload signed form','رفع النموذج الموقّع'));
 if(!reviewEnabled()&&!actions)return '';
 return reviewReason(s,lang)+(actions?`<div class="review-followup">${actions}<p role="status"></p></div>`:'');
}

export function bindFollowUps(root,{lang,onSaved=()=>{},beforeOpen=()=>{}}){
 root.querySelectorAll('[data-follow-up]').forEach(button=>button.onclick=async()=>{
  if(button.disabled)return;button.disabled=true;
  try{
   let {submission:s}=await api('detail',undefined,{params:{id:button.dataset.submission}});
   const visited=new Set();
   while(s.archived_at&&s.current_id&&!visited.has(s.current_id)){
    visited.add(s.current_id);({submission:s}=await api('detail',undefined,{params:{id:s.current_id}}));
   }
   const action=button.dataset.followUp,correction=s.review_status==='correction_required',signature=s.review_status==='signature_required';
   const valid=reviewAvailable(s)&&!s.archived_at&&s.can_replace&&(action==='edit'?correction&&s.source==='online':action==='sign'?signature&&s.can_sign_electronically:correction||signature);
   if(!valid){beforeOpen();const {previewSubmission}=await import('./preview.js');await previewSubmission(s.id,{lang});return;}
   if(action==='edit'){location.href=`${appRoot}${s.audience==='corporate'?'companies':'individuals'}/?${new URLSearchParams({submission:s.id,lang})}`;return;}
   beforeOpen();
   if(action==='sign'){const {signSubmittedForm}=await import('./sign-submission.js');await signSubmittedForm(s.id,{lang,onSaved});}
   else {const {uploadCompleted}=await import('./upload.js');await uploadCompleted({documentId:s.doc_id,lang,onSaved});}
  }catch(err){const status=button.closest('.review-followup')?.querySelector('[role=status]');if(status)status.textContent=errorText(err,lang);}
  finally{button.disabled=false;}
 });
}
