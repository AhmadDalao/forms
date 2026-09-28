import {api} from './api.js';
import './notification-bell.css';
export const bellIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
export function notificationBell(lang){const label=lang==='ar'?'الإشعارات':'Notifications';return `<button type="button" class="notification-bell" data-notification-bell aria-label="${label}" title="${label}" aria-haspopup="dialog" aria-expanded="false">${bellIcon}<span data-unread-count hidden></span></button>`;}
export function updateNotificationBell(node,count,lang){if(!node)return;count=Math.max(0,Number(count)||0);const label=lang==='ar'?'الإشعارات':'Notifications';node.setAttribute('aria-label',label+(count?lang==='ar'?`، ${count} غير مقروءة`:`, ${count} unread`:''));const badge=node.querySelector('[data-unread-count]');badge.textContent=count>99?'99+':String(count);badge.hidden=!count;}
export function mountNotificationBell(node,{lang,userId}){
 if(!node)return ()=>{};
 const t=(en,ar)=>lang==='ar'?ar:en;let stopped=false,busy=false,dialog=null,closeDialog=()=>{};
 const refresh=async()=>{if(stopped||busy||document.hidden||dialog)return;busy=true;try{const data=await api('notifications');if(!stopped&&node.isConnected){if(data.user_id!==userId){location.reload();return;}updateNotificationBell(node,data.unread,lang);}}catch{/* Opening the panel offers retry. */}finally{busy=false;}};
 node.onclick=()=>{
  if(dialog||stopped)return;
  const panel=document.createElement('dialog');dialog=panel;panel.className='notification-dialog';panel.dir=lang==='ar'?'rtl':'ltr';panel.setAttribute('aria-labelledby','notifications-title');
  panel.innerHTML=`<div class="notification-header"><h2 id="notifications-title">${t('Notifications','الإشعارات')}<span data-panel-unread hidden></span></h2><button type="button" data-close aria-label="${t('Close','إغلاق')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div data-items aria-busy="true"><p class="notification-loading" role="status">${t('Loading notifications…','جارٍ تحميل الإشعارات…')}</p></div>`;
  let dispose=()=>{},closed=false;
  closeDialog=()=>{if(closed)return;closed=true;dispose();panel.close();panel.remove();dialog=null;node.setAttribute('aria-expanded','false');if(!stopped&&node.isConnected)node.focus({preventScroll:true});};
  panel.querySelector('[data-close]').onclick=closeDialog;panel.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  document.body.append(panel);node.setAttribute('aria-expanded','true');panel.showModal();
  const load=async()=>{try{
   const {mountNotifications}=await import('./notifications.js');if(closed||stopped)return;
   dispose=mountNotifications(panel.querySelector('[data-items]'),{lang,userId,onUnread:count=>{updateNotificationBell(node,count,lang);const badge=panel.querySelector('[data-panel-unread]');badge.textContent=t(`${count} new`,`${count} جديد`);badge.hidden=!count;}});
  }catch{if(closed||stopped)return;const body=panel.querySelector('[data-items]');body.removeAttribute('aria-busy');body.innerHTML=`<div class="notification-empty"><p>${t('Could not load notifications','تعذّر تحميل الإشعارات')}</p><button type="button" data-notification-retry>${t('Try again','إعادة المحاولة')}</button></div>`;body.querySelector('button').onclick=load;}};
  load();
 };
 const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);refresh();
 return ()=>{stopped=true;closeDialog();node.onclick=null;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
}
