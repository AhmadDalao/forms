import {api,e,session,errorText} from './api.js';
import {appRoot} from '../routes.js';
import './submit.css';
export async function submitForm({doc,values,bytes,profile,audience,lang,user}){
 const t=(en,ar)=>lang==='ar'?ar:en;
 const dialog=document.createElement('dialog');dialog.className='submission-dialog';
 document.body.append(dialog);let sending=false;
 const close=()=>{if(!sending){dialog.close();dialog.remove();}};
 dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
 if(!user){
  const next=audience==='corporate'?'companies':'individuals';
  dialog.innerHTML=`<h2>${t('Sign in to submit','سجّل الدخول لإرسال النموذج')}</h2><p>${t('Your draft stays saved while you sign in or create an account.','تبقى مسودتك محفوظة أثناء تسجيل الدخول أو إنشاء حساب.')}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><a class="button primary" href="${appRoot}login/?next=${next}&resume=1&lang=${lang}">${t('Sign in / Register','دخول / إنشاء حساب')}</a></div>`;
  dialog.querySelector('[data-close]').onclick=close;dialog.showModal();return;
 }
 dialog.innerHTML=`<h2>${t('Submit this form','إرسال النموذج')}</h2><p><b>${e(t(doc.title,doc.ar))}</b></p><p>${t('This sends the reviewed PDF and entered details to Itqan Capital under your account.','سيتم إرسال ملف PDF الذي راجعته والبيانات المدخلة إلى إتقان كابيتال ضمن حسابك.')}</p><p>${e(user.name)} · <bdi>${e(user.phone)}</bdi></p><p>${t('You can download a copy anytime from My account.','يمكنك تنزيل نسخة في أي وقت من حسابي.')}</p><p data-message role="status"></p><div class="dialog-actions"><button class="button secondary" data-close>${t('Back','رجوع')}</button><button class="button primary" data-confirm>${t('Submit form','إرسال النموذج')}</button></div>`;
 dialog.querySelector('[data-close]').onclick=close;dialog.showModal();
 dialog.querySelector('[data-confirm]').onclick=async()=>{
  if(sending)return;sending=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  const status=dialog.querySelector('[data-message]');status.textContent=t('Submitting…','جارٍ الإرسال…');status.className='';
  try{
   const fresh=await session();if(!fresh.user)throw Error('login_required');if(fresh.user.id!==user.id)throw Error('account_changed');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   const requestKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.id+audience+doc.id+hash))),n=>n.toString(16).padStart(2,'0')).join('').slice(0,32);
   const form=new FormData();form.set('pdf',new Blob([bytes],{type:'application/pdf'}),doc.id+'.pdf');
   form.set('metadata',JSON.stringify({account:user.id,document:doc.id,audience,requestKey,values,profile}));
   const result=await api('submit',form);
   dialog.innerHTML=`<span class="submitted-mark">✓</span><h2>${t('Form submitted','تم إرسال النموذج')}</h2><p>${t('Your document is saved in your account.','تم حفظ مستندك في حسابك.')}</p><p class="submission-reference">${t('Reference','المرجع')}: ${e(result.submission.id.slice(0,8).toUpperCase())}</p><div class="dialog-actions"><button class="button secondary" data-close>${t('Continue','متابعة')}</button><a class="button primary" href="${appRoot}account/">${t('My submitted forms','نماذجي المرسلة')}</a></div>`;
   dialog.querySelector('[data-close]').onclick=close;
  }catch(error){status.textContent=errorText(error,lang);status.className='error';if(['login_required','password_change_required'].includes(error.message)){const a=document.createElement('a');a.href=appRoot+(error.message==='login_required'?'login/':'account/');a.textContent=t('Open my account','فتح حسابي');status.append(' ',a);}}
  finally{sending=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
}
