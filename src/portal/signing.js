import {appRoot} from '../routes.js';
import {e} from './api.js';
import './submit.css';

export const signedUploadUrl=(doc,lang)=>`${appRoot}my-applications/?${new URLSearchParams({upload:doc.id,lang})}`;

export function signingNotice(state,lang){
 if(state.ready)return '';
 const t=(en,ar)=>lang==='ar'?ar:en;
 return `<aside class="submission-signing-note"><strong>${state.manual?t('Sign before submitting','وقّع النموذج قبل الإرسال'):t('Signature required','التوقيع مطلوب')}</strong><p>${state.manual?t('Download your PDF and sign it, then upload the complete signed form from My applications.','نزّل ملف PDF ووقّعه، ثم ارفع النموذج الموقّع كاملًا من صفحة طلباتي.'):t('Upload the required signature images in the signing steps before submitting online.','حمّل صور التوقيعات المطلوبة في خطوات التوقيع قبل إرسال النموذج إلكترونيًا.')}</p>${state.manual?`<button type="button" class="ghost" data-signing-guide>${t('How to upload my signed form','كيفية رفع النموذج الموقّع')}</button>`:''}</aside>`;
}

export function showSigningGuide({doc,lang,onDownload=null,manual=true}){
 if(document.querySelector('.signing-guide'))return;
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');
 dialog.className='submission-dialog signing-guide';dialog.dir=lang==='ar'?'rtl':'ltr';
 dialog.innerHTML=`<h2>${t('Sign the form before submitting','وقّع النموذج قبل إرساله')}</h2><p>${manual?t('For manual signing, download the PDF, sign it, then choose Upload signed form in My applications and upload the complete signed PDF.','للتوقيع اليدوي، نزّل ملف PDF ووقّعه، ثم اختر «رفع النموذج الموقّع» من صفحة طلباتي وارفع ملف PDF الموقّع كاملًا.'):t('Upload the required signature images in the signing steps before submitting online. You can also download the PDF, sign it manually and upload the signed form from My applications.','حمّل صور التوقيعات المطلوبة في خطوات التوقيع قبل الإرسال الإلكتروني. يمكنك أيضًا تنزيل ملف PDF وتوقيعه يدويًا ثم رفع النموذج الموقّع من صفحة طلباتي.')}</p><div class="dialog-actions"><button type="button" class="button secondary" data-close>${t('Back','رجوع')}</button><a class="button ${onDownload?'secondary':'primary'}" href="${e(signedUploadUrl(doc,lang))}">${t('My applications','طلباتي')}</a>${onDownload?`<button type="button" class="button primary" data-signing-download>${t('Download PDF','تنزيل PDF')}</button>`:''}</div>`;
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelector('[data-signing-download]')?.addEventListener('click',()=>{close();onDownload();});
 document.body.append(dialog);dialog.showModal();
}
