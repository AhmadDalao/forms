import {api,session,e,errorText} from './api.js';
import {canUseAudience} from '../routes.js';
import {workflowState} from './workflow.js';
import './upload.css';
export async function uploadCompleted({documentId,lang='ar',onSaved=()=>{}}){
 const replacement=null,t=(en,ar)=>lang==='ar'?ar:en;let user;
 const {docs}=await import('../forms/index.js'),{loadCatalogue}=await import('../management/catalogue.js'),{catalogueFor}=await import('../catalogue.js');
 const [catalogue,{submissions,user:freshUser}]=await Promise.all([loadCatalogue(docs),api('submissions')]);
 user=freshUser;if(!user)throw Error('login_required');const initialWorkflow={...workflowState()},accountId=user.id;if(replacement&&!canUseAudience(user,replacement.audience))throw Error('account_type_restricted');
 let requiresReview=false;
 const dialog=document.createElement('dialog');dialog.className='portal-upload';dialog.dir=lang==='ar'?'rtl':'ltr';document.body.append(dialog);
 dialog.innerHTML=`<h2>${requiresReview?(replacement?t('Upload a signed replacement','رفع نسخة بديلة موقّعة'):t('Upload signed form','رفع النموذج الموقّع')):(replacement?t('Upload a replacement','رفع نسخة بديلة'):t('Upload form','رفع نموذج'))}</h2><p>${requiresReview?t('Upload the entire completed and signed PDF, including all pages. A standalone signature image is not a signed form.','ارفع ملف PDF الكامل بعد تعبئته وتوقيعه، بجميع صفحاته. صورة التوقيع وحدها ليست نموذجًا موقّعًا.'):t('Upload the complete PDF, including every page. Its contents will be available as an uploaded document.','ارفع ملف PDF كاملًا بجميع صفحاته. سيظهر الملف ضمن مستنداتك المرفوعة.')}</p><form><input type="hidden" name="audience" value="${user.account_type}"><p class="account-type-summary">${t('Account type','نوع الحساب')}: <strong>${user.account_type==='corporate'?t('Company','شركة'):t('Individual','فرد')}</strong></p><label>${t('Document','المستند')}<select name="document"></select></label><p class="replacement-note" data-version-note></p><label>PDF · 20 MB<input name="pdf" type="file" accept="application/pdf" required></label>${true?`<label class="portal-check"><input type="checkbox" name="signedConfirmed"><span>${t('I confirm that this is the complete form and it has been signed.','أؤكد أن هذا هو النموذج الكامل وقد تم توقيعه.')}</span></label>`:''}<p role="status" aria-live="polite"></p><div class="account-actions"><button type="button" data-close class="portal-button">${t('Cancel','إلغاء')}</button><button class="portal-button primary">${requiresReview?t('Submit signed PDF','إرسال ملف PDF الموقّع'):t('Submit form','إرسال النموذج')}</button></div></form>`;
 const form=dialog.querySelector('form');let expected=null;
 const note=()=>{
  const current=submissions.find(s=>s.doc_id===form.elements.document.value&&s.audience===form.elements.audience.value&&!s.archived_at);
  expected=current?.id??null;
  requiresReview=current?.submission_mode==='review'&&current.review_status==='signature_required';
  form.elements.signedConfirmed.required=requiresReview;
  dialog.querySelector('h2').textContent=requiresReview?t('Upload signed form','رفع النموذج الموقّع'):t('Upload form','رفع نموذج');
  form.querySelector('button.primary').textContent=requiresReview?t('Submit signed PDF','إرسال ملف PDF الموقّع'):t('Submit form','إرسال النموذج');
  dialog.querySelector('[data-version-note]').textContent=current?t(`This updates your submitted form.`,`سيتم تحديث نموذجك المرسل.`):t('Your first version of this document will be saved.','ستُحفظ النسخة الأولى من هذا المستند.');
 };
 const fill=()=>{form.elements.document.innerHTML=catalogueFor(catalogue.docs,form.elements.audience.value,catalogue.cards).map(d=>`<option value="${e(d.id)}">${d.number}. ${e(t(d.title,d.ar))}</option>`).join('');note();};
 if(replacement)form.elements.audience.value=replacement.audience;
 fill();
 if(replacement||documentId){
  form.elements.document.value=replacement?.doc_id||documentId;
  if(!form.elements.document.value){dialog.remove();throw Error('document_unavailable');}
  form.elements.document.disabled=true;
  note();
 }
 form.elements.audience.onchange=fill;form.elements.document.onchange=note;
 let busy=false;const close=()=>{if(!busy){dialog.close();dialog.remove();}};dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});dialog.showModal();
 const requestKey=crypto.randomUUID();form.onsubmit=async ev=>{
  ev.preventDefault();if(busy||!form.reportValidity())return;const file=form.elements.pdf.files[0];
  if(file.size>20971520){dialog.querySelector('[role="status"]').textContent=errorText(Error('request_large'),lang);return;}
  busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const fresh=await session();if(fresh.user?.id!==accountId)throw Error('account_changed');if(workflowState().revision!==initialWorkflow.revision)throw Error('workflow_conflict');if(fresh.user.account_type!==form.elements.audience.value)throw Error('account_type_restricted');
   const upload=new FormData();upload.set('pdf',file);upload.set('metadata',JSON.stringify({account:accountId,document:form.elements.document.value,audience:form.elements.audience.value,requestKey,source:'upload',signedConfirmed:!!form.elements.signedConfirmed?.checked,expectedCurrent:expected,workflowRevision:initialWorkflow.revision}));
   const receipt=await api('submit',upload);busy=false;close();await onSaved(receipt.submission);
  }catch(err){dialog.querySelector('[role="status"]').textContent=errorText(err,lang);}
  finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
}
