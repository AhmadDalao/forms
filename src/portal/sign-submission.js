import {api,endpoint,e,errorText,session} from './api.js';
import {appRoot} from '../routes.js';
import {reviewEnabled,workflowState} from './workflow.js';
import {prepareSignature,signaturePlacement} from '../signatures.js';
import {loadPreview,renderPage} from '../pdf.js';
import './sign-submission.css';

export const signatureEditUrl=(s,lang)=>`${appRoot}${s.audience==='corporate'?'companies':'individuals'}/?${new URLSearchParams({submission:s.id,sign:'1',...(lang?{lang}:{})})}`;
export async function signSubmittedForm(id,{lang='en',onSaved=()=>{}}={}){
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');
 dialog.className='portal-preview portal-signing';dialog.dir=lang==='ar'?'rtl':'ltr';
 dialog.innerHTML=`<div class="portal-preview-head"><h2>${t('Add electronic signature','إضافة توقيع إلكتروني')}</h2><button type="button" data-close aria-label="${t('Close','إغلاق')}">×</button></div><div class="portal-preview-body"><p role="status">${t('Loading your saved form…','جارٍ تحميل نموذجك المحفوظ…')}</p></div>`;
 document.body.append(dialog);dialog.showModal();
 let closed=false,busy=false,pdf=null,bytes=null,source=null,signing=null,submitted=null,user=null,images={},initialWorkflow=null,requiresReview=true;
 const requestKey=crypto.randomUUID(),body=dialog.querySelector('.portal-preview-body');
 const close=()=>{if(busy)return;closed=true;pdf?.loadingTask.destroy();dialog.close();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
 const status=text=>{const node=body.querySelector('[role=status]');if(node)node.textContent=text;};
 function lock(){
  dialog.querySelectorAll('button,input').forEach(el=>el.disabled=busy);
  const preview=body.querySelector('[data-sign-preview]'),send=body.querySelector('[data-sign-submit]');
  if(preview)preview.disabled=busy||(requiresReview?!signing.requiredSignatureIds.every(id=>images[id]):!Object.keys(images).length);
  if(send)send.disabled=busy||!bytes||!body.querySelector('[name=reviewed]').checked;
 }
 function invalidate(){bytes=null;body.querySelector('[name=reviewed]').checked=false;status(requiresReview?t('Preview the updated signatures before submitting.','عاين التوقيعات المحدّثة قبل الإرسال.'):t('Preview the changes before saving.','عاين التغييرات قبل الحفظ.'));lock();}
 async function paint(data){
  pdf?.loadingTask.destroy();pdf=null;const loaded=await loadPreview(data);if(closed){loaded.loadingTask.destroy();return;}pdf=loaded;
  const pages=body.querySelector('.portal-pdf-pages');pages.replaceChildren();
  for(let i=1;i<=pdf.numPages;i++){
   if(closed)return;const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
   caption.textContent=t('Page ','صفحة ')+i+' / '+pdf.numPages;canvas.setAttribute('aria-label',caption.textContent);figure.append(caption,canvas);pages.append(figure);await renderPage(pdf,i,canvas,1000);
  }
 }
 function checkLayout(document){
  if(document.getPageCount()!==signing.expectedPages)throw Error('signing_layout_mismatch');
  for(const slot of signing.signatureSlots){
   const page=document.getPage(slot.page-1),[x,y,w,h]=slot.rect;
   if(!page||page.getRotation().angle%360!==0||![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>page.getWidth()+1||y+h>page.getHeight()+1)throw Error('signing_layout_mismatch');
  }
 }
 try{
  const current=await session();user=current.user;if(!user)throw Error('login_required');
  const data=await api('signing_details',undefined,{params:{id}});if(closed)return;signing=data.signing;submitted=data.submission;initialWorkflow={...workflowState()};requiresReview=reviewEnabled();
  if(!signing.can_sign_electronically)throw Error('document_unavailable');
  if(submitted.source==='online'){close();location.href=signatureEditUrl(submitted,lang);return;}
  const {PDFDocument}=await import('pdf-lib');if(closed)return;
  const response=await fetch(endpoint('pdf',{id}),{cache:'no-store'});if(!response.ok)throw Error('login_required');source=new Uint8Array(await response.arrayBuffer());
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',source))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==signing.sourceSha256)throw Error('version_conflict');
  checkLayout(await PDFDocument.load(source,{updateMetadata:false}));if(closed)return;
  const slots=signing.signatureSlots.filter(slot=>slot.requiredForSubmission!==false||slot.requireWhenFields?.length);
  body.innerHTML=`<h3>${e(t(submitted.title,submitted.ar))}</h3><p class="signing-instructions">${requiresReview?t('Upload each required signature, preview its position on your submitted PDF, then send the signed version for review. The previous version stays in your archive.','حمّل كل توقيع مطلوب، وعاين موضعه على ملف PDF الذي أرسلته، ثم أرسل النسخة الموقّعة للمراجعة. تبقى النسخة السابقة في الأرشيف.'):t('Add any signatures you want, preview their positions, then save the updated PDF. Signing is optional. The previous version stays in your archive.','أضف التوقيعات التي تريدها، وعاين مواضعها، ثم احفظ ملف PDF المحدّث. التوقيع اختياري. تبقى النسخة السابقة في الأرشيف.')}</p><div class="submitted-signature-fields">${slots.map(slot=>`<section class="submitted-signature-slot" data-slot="${e(slot.id)}"><label>${e(t(slot.label,slot.ar))}${requiresReview&&signing.requiredSignatureIds.includes(slot.id)?' *':` <small>${t('Optional','اختياري')}</small>`}<input type="file" data-sign-file="${e(slot.id)}" accept="image/png,image/jpeg"></label><div data-sign-image></div></section>`).join('')}</div><p class="signing-file-help">${t('PNG or JPG · up to 5 MB per image. Use additional signer fields only when that person signs this form.','PNG أو JPG · حتى ٥ ميغابايت لكل صورة. استخدم حقول الموقعين الإضافيين فقط عند توقيعهم على هذا النموذج.')}</p><button type="button" class="portal-button primary" data-sign-preview>${requiresReview?t('Preview signed PDF','معاينة ملف PDF الموقّع'):t('Preview PDF','معاينة ملف PDF')}</button><p role="status" aria-live="polite"></p><div class="portal-pdf-pages"></div><div class="submitted-signature-actions"><label class="portal-check"><input type="checkbox" name="reviewed"><span>${requiresReview?t('I reviewed the PDF and confirm the required signatures are in the correct places.','راجعت ملف PDF وأؤكد أن التوقيعات المطلوبة في مواضعها الصحيحة.'):t('I reviewed this PDF and any signatures I added.','راجعت ملف PDF وأي توقيعات أضفتها.')}</span></label><div class="account-actions"><button type="button" class="portal-button" data-sign-cancel>${t('Cancel','إلغاء')}</button><button type="button" class="portal-button primary" data-sign-submit>${requiresReview?t('Submit signed form','إرسال النموذج الموقّع'):t('Save form','حفظ النموذج')}</button></div></div>`;
  body.querySelector('[data-sign-cancel]').onclick=close;
  body.querySelector('[name=reviewed]').onchange=lock;
  for(const input of body.querySelectorAll('[data-sign-file]'))input.onchange=async()=>{
   const file=input.files?.[0];input.value='';if(!file||busy)return;busy=true;lock();
   try{
    const image=await prepareSignature(file);if(closed)return;images[input.dataset.signFile]=image;invalidate();
    const box=input.closest('[data-slot]').querySelector('[data-sign-image]');box.innerHTML=`<img src="${image}" alt="${t('Uploaded signature','التوقيع المرفوع')}"><button type="button" class="portal-button" data-sign-remove>${t('Remove','إزالة')}</button>`;
    box.querySelector('button').onclick=()=>{if(busy)return;delete images[input.dataset.signFile];box.replaceChildren();invalidate();};
   }catch{status(errorText(Error('signature_invalid'),lang));}finally{busy=false;lock();}
  };
  body.querySelector('[data-sign-preview]').onclick=async()=>{
   if(busy)return;busy=true;lock();status(t('Preparing your PDF…','جارٍ إعداد ملف PDF…'));
   try{
    const doc=await PDFDocument.load(source,{updateMetadata:false});checkLayout(doc);
    for(const slot of signing.signatureSlots){if(!images[slot.id])continue;const image=await doc.embedPng(images[slot.id]),page=doc.getPage(slot.page-1),p=signaturePlacement(slot,image.width,image.height);page.drawImage(image,{...p,y:page.getHeight()-p.y-p.height});}
    const generated=new Uint8Array(await doc.save());await paint(generated);if(closed)return;bytes=generated;status(requiresReview?t('Review all pages, then confirm and submit below.','راجع جميع الصفحات، ثم أكّد وأرسل أدناه.'):t('Review all pages, then confirm and save below.','راجع جميع الصفحات، ثم أكّد واحفظ أدناه.'));body.querySelector('.portal-pdf-pages').scrollIntoView({behavior:'smooth',block:'start'});
   }catch(err){bytes=null;status(errorText(err,lang));}finally{busy=false;lock();}
  };
  body.querySelector('[data-sign-submit]').onclick=async()=>{
   if(busy||!bytes||!body.querySelector('[name=reviewed]').checked)return;busy=true;lock();status(requiresReview?t('Submitting your signed form…','جارٍ إرسال النموذج الموقّع…'):t('Saving your form…','جارٍ حفظ النموذج…'));
   try{
    const fresh=await session();if(fresh.user?.id!==user.id)throw Error('account_changed');if(workflowState().revision!==initialWorkflow.revision)throw Error('workflow_conflict');if(fresh.user.account_type!==submitted.audience)throw Error('account_type_restricted');
    const upload=new FormData();upload.set('pdf',new Blob([bytes],{type:'application/pdf'}),'signed.pdf');upload.set('metadata',JSON.stringify({account:user.id,sourceId:id,expectedCurrent:signing.expectedCurrent,sourceSha256:signing.sourceSha256,requestKey,signatures:images,workflowRevision:initialWorkflow.revision}));
    await api('sign_submission',upload);busy=false;close();await onSaved({reviewEnabled:requiresReview});
   }catch(err){status(errorText(err,lang));}finally{busy=false;if(!closed)lock();}
  };
  busy=true;lock();await paint(source);busy=false;lock();
 }catch(err){if(!closed){body.innerHTML=`<p role="alert">${e(errorText(err,lang))}</p><a class="portal-button primary" href="${appRoot}my-applications/?${new URLSearchParams({upload:submitted?.doc_id||'',lang})}">${reviewEnabled()?t('Upload signed PDF instead','رفع ملف PDF موقّع'):t('Upload PDF instead','رفع ملف PDF')}</a>`;}}
 finally{busy=false;if(!closed)dialog.querySelector('[data-close]').disabled=false;}
}
