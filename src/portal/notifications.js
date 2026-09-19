import {api,e,errorText,when} from './api.js';
import {previewSubmission} from './preview.js';
import {reviewSummary} from './review.js';

// Refresh only status/notification elements so profile edits and open PDFs stay intact.
export function mountNotifications(node,{lang,userId,onStatuses,onUnread=()=>{}}){
 const t=(en,ar)=>lang==='ar'?ar:en;
 let stopped=false,busy=false,cursor=null,unread=0,first=true,snapshot='',items=new Map();
 function render(){
  onUnread(unread);
  const open=node.querySelector('details')?.open??(location.hash==='#notifications'||unread>0);
  node.innerHTML=`<details class="account-notifications" ${open?'open':''}><summary>${t('Notifications','الإشعارات')}${unread?`<span class="notification-count">${unread} ${t('new','جديد')}</span>`:''}</summary>${items.size?[...items.values()].sort((a,b)=>b.id-a.id).map(n=>`<article class="notification-item ${n.read_at?'':'is-unread'}" data-notification="${n.id}">${reviewSummary(n,lang,{decision:true})}<h3>${e(t(n.title,n.ar))}</h3><p class="review-meta">${t('Version','النسخة')} ${n.version} · ${e(when(n.created_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')}${n.archived_at?' · '+t('Archived version','نسخة مؤرشفة'):''}${n.superseded?' · '+t('Previous decision','قرار سابق'):''}</p><div class="notification-actions"><button class="portal-button" data-notification-preview="${n.submission_id}">${t('View form','عرض النموذج')}</button>${n.read_at?'':`<button class="portal-button" data-notification-read="${n.id}">${t('Mark as read','تحديد كمقروء')}</button>`}</div></article>`).join(''):`<p class="review-meta notification-item">${t('Approval and rejection updates will appear here.','ستظهر هنا تحديثات قبول النماذج أو رفضها.')}</p>`}${cursor?`<button class="portal-button notification-more" data-notification-more>${t('Earlier notifications','الإشعارات السابقة')}</button>`:''}</details><p class="notification-announcement" role="status" aria-live="polite"></p>`;
  if(location.hash==='#notifications'&&first)requestAnimationFrame(()=>node.scrollIntoView({block:'start'}));
  node.querySelectorAll('[data-notification-preview]').forEach(b=>b.onclick=()=>previewSubmission(b.dataset.notificationPreview,{lang}));
  node.querySelectorAll('[data-notification-read]').forEach(b=>b.onclick=async()=>{
   b.disabled=true;
   try{const id=Number(b.dataset.notificationRead);await api('notification_read',{id});items.get(id).read_at=new Date().toISOString();unread=Math.max(0,unread-1);if(!stopped)render();}
   catch(err){if(!stopped){node.querySelector('[role=status]').textContent=errorText(err,lang);b.disabled=false;}}
  });
  node.querySelector('[data-notification-more]')?.addEventListener('click',async ev=>{
   const button=ev.currentTarget;button.disabled=true;
   try{const data=await api('notifications',undefined,{params:{before:cursor}});if(stopped)return;data.notifications.forEach(n=>items.set(n.id,n));cursor=data.next_cursor;unread=data.unread;render();}
   catch(err){if(!stopped){node.querySelector('[role=status]').textContent=errorText(err,lang);button.disabled=false;}}
  });
 }
 async function refresh(){
  if(stopped||busy||document.hidden)return;busy=true;
  try{
   const [data,submissions]=await Promise.all([api('notifications'),api('submissions')]);if(stopped)return;
   if(submissions.user.id!==userId){location.reload();return;}
   onStatuses(submissions.submissions);
   const next=JSON.stringify(data),hasNew=!first&&data.unread>unread;
   if(first||snapshot!==next){const initial=first;data.notifications.forEach(n=>items.set(n.id,n));if(initial)cursor=data.next_cursor;unread=data.unread;snapshot=next;render();if(hasNew)node.querySelector('[role=status]').textContent=t('You have a new form review notification.','لديك إشعار جديد بشأن مراجعة نموذج.');}
   first=false;
  }catch(err){if(!stopped&&first)node.innerHTML=`<p class="review-meta" role="status">${e(errorText(err,lang))}</p>`;}
  finally{busy=false;}
 }
 const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);refresh();
 return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
}
