import {api,e,errorText,when} from './api.js';
import {reviewLabels,reasonLabels} from './review.js';
import {appRoot} from '../routes.js';

export function mountNotifications(node,{lang,userId,onUnread=()=>{}}){
 const t=(en,ar)=>lang==='ar'?ar:en;
 let stopped=false,busy=false,cursor=null,unread=0,loaded=false,snapshot='',revision=0;
 const items=new Map(),reads=new Set();
 const message=text=>{const status=node.querySelector('[data-notification-message]');if(status)status.textContent=text;};
 const sessionError=err=>{if(err.status!==401)return false;location.href=appRoot+'login/?lang='+lang;return true;};
 const accept=data=>{if(data.user_id===userId)return true;location.reload();return false;};
 function itemHTML(n){
  const status=reviewLabels[n.status]?.[lang==='ar'?1:0]||t('Form update','تحديث النموذج');
  const reason=n.reason_text||reasonLabels[n.reason_code]?.[lang==='ar'?1:0]||'';
  return `<article class="notification-item ${n.read_at?'':'is-unread'}" data-notification="${n.id}"><div class="notification-item-head"><strong>${e(status)}</strong>${n.read_at?'':`<span class="notification-new">${t('New','جديد')}</span>`}</div><h3>${e(t(n.title,n.ar))}</h3>${reason?`<p class="notification-reason" dir="auto">${e(reason)}</p>`:''}<div class="notification-item-foot"><div><time datetime="${e(n.created_at)}" title="${t('Riyadh time','بتوقيت الرياض')}">${e(when(n.created_at,lang))}</time>${n.archived_at||n.superseded?`<span class="notification-previous">${t('Earlier update','تحديث سابق')}</span>`:''}</div><button type="button" data-notification-preview="${e(n.submission_id)}" data-event="${n.id}">${t('View form','عرض النموذج')}<span aria-hidden="true">${lang==='ar'?'←':'→'}</span></button></div></article>`;
 }
 function render(){
  const focused=document.activeElement?.closest('[data-event]')?.dataset.event;
  node.innerHTML=`<section class="account-notifications">${items.size?[...items.values()].sort((a,b)=>b.id-a.id).map(itemHTML).join(''):`<div class="notification-empty" data-notification-empty><span aria-hidden="true">✓</span><p>${t('No notifications yet','لا توجد إشعارات حتى الآن')}</p></div>`}${cursor?`<button type="button" class="notification-more" data-notification-more>${t('Load more','عرض المزيد')}</button>`:''}</section><p class="notification-message" data-notification-message role="status" aria-live="polite"></p>`;
  onUnread(unread);
  node.querySelectorAll('[data-notification-preview]').forEach(button=>button.onclick=async()=>{
   if(button.disabled)return;button.disabled=true;message('');
   const id=Number(button.dataset.event),notification=items.get(id);
   // Opening the notification acknowledges it; PDF loading remains independent.
   if(!notification.read_at){
    revision++;reads.add(id);
    api('notification_read',{id}).then(()=>{
     if(stopped)return;revision++;notification.read_at=new Date().toISOString();unread=Math.max(0,unread-1);snapshot='';onUnread(unread);
     const item=button.closest('[data-notification]');item?.classList.remove('is-unread');item?.querySelector('.notification-new')?.remove();
    }).catch(err=>{if(!stopped&&!sessionError(err))message(errorText(err,lang));}).finally(()=>reads.delete(id));
   }
   try{const {previewSubmission}=await import('./preview.js');if(!stopped)await previewSubmission(button.dataset.notificationPreview,{lang});}
   catch(err){if(!stopped&&!sessionError(err))message(errorText(err,lang));}
   finally{if(!stopped)button.disabled=false;}
  });
  node.querySelector('[data-notification-more]')?.addEventListener('click',()=>refresh(true));
  if(focused)node.querySelector(`[data-event="${focused}"]`)?.focus({preventScroll:true});
 }
 async function refresh(more=false){
  if(stopped||busy||reads.size||document.hidden)return;busy=true;const requestRevision=revision;
  const button=node.querySelector('[data-notification-more]');if(button)button.disabled=true;
  try{
   const data=await api('notifications',undefined,{params:more?{before:cursor}:{}});if(stopped||!accept(data)||requestRevision!==revision)return;
   const next=JSON.stringify(data),hasNew=loaded&&data.unread>unread;
   if(!loaded||more||snapshot!==next){data.notifications.forEach(n=>items.set(n.id,n));if(!loaded||more)cursor=data.next_cursor;unread=data.unread;if(!more)snapshot=next;render();if(hasNew)message(t('New notification received.','لديك إشعار جديد.'));}
   loaded=true;
  }catch(err){
   if(stopped||sessionError(err))return;
   if(!loaded)node.innerHTML=`<div class="notification-empty"><p>${t('Could not load notifications','تعذّر تحميل الإشعارات')}</p><button type="button" data-notification-retry>${t('Try again','إعادة المحاولة')}</button></div><p class="notification-message" data-notification-message role="status" aria-live="polite"></p>`;
   else message(errorText(err,lang));
   node.querySelector('[data-notification-retry]')?.addEventListener('click',()=>refresh());
  }finally{busy=false;node.removeAttribute('aria-busy');const moreButton=node.querySelector('[data-notification-more]');if(moreButton)moreButton.disabled=false;}
 }
 const poll=()=>refresh();
 const timer=setInterval(poll,30000);window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);refresh();
 return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);};
}
