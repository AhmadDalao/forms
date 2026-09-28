import {api} from './api.js';
import './notification-bell.css';
export const bellIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
export function notificationBell(lang){const label=lang==='ar'?'الإشعارات':'Notifications';return `<button type="button" class="notification-bell" data-notification-bell aria-label="${label}" title="${label}">${bellIcon}<span data-unread-count hidden></span></button>`;}
export function updateNotificationBell(node,count,lang){if(!node)return;count=Math.max(0,Number(count)||0);const label=lang==='ar'?'الإشعارات':'Notifications';node.setAttribute('aria-label',label+(count?lang==='ar'?`، ${count} غير مقروءة`:`, ${count} unread`:''));const badge=node.querySelector('[data-unread-count]');badge.textContent=count>99?'99+':String(count);badge.hidden=!count;}
export function mountNotificationBell(node,{lang,userId}){
 if(!node)return ()=>{};let stopped=false,busy=false;
 const refresh=async()=>{if(stopped||busy||document.hidden)return;busy=true;try{const data=await api('notifications');if(!stopped&&node.isConnected)updateNotificationBell(node,data.unread,lang);}catch{/* The notifications page offers retry through reload. */}finally{busy=false;}};
 let closeDialog=()=>{};
 node.onclick=async()=>{
  const {mountNotifications}=await import('./notifications.js');if(stopped)return;
  closeDialog();const dialog=document.createElement('dialog');dialog.className='notification-dialog';dialog.dir=lang==='ar'?'rtl':'ltr';dialog.innerHTML=`<button type="button" data-close>${lang==='ar'?'إغلاق':'Close'}</button><div data-items></div>`;document.body.append(dialog);dialog.showModal();
  const stop=mountNotifications(dialog.querySelector('[data-items]'),{lang,userId,onStatuses:()=>{},onUnread:count=>updateNotificationBell(node,count,lang)});
  closeDialog=()=>{stop();dialog.close();dialog.remove();};dialog.querySelector('[data-close]').onclick=closeDialog;dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
 };
 const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);refresh();
 return ()=>{closeDialog();stopped=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
}
