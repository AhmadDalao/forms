import {api,endpoint,e,errorText,when} from './api.js';
import {loadPreview,renderPage} from '../pdf.js';
import {docs} from '../forms/index.js';
export async function previewSubmission(id,{admin=false,lang='en'}={}){
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');dialog.className='portal-preview';dialog.dir=lang==='ar'?'rtl':'ltr';document.body.append(dialog);
 dialog.innerHTML=`<div class="portal-preview-head"><h2>${t('Submitted document','المستند المرسل')}</h2><button type="button" data-close aria-label="${t('Close','إغلاق')}">×</button></div><div class="portal-preview-body"><p role="status">${t('Loading…','جارٍ التحميل…')}</p></div>`;
 let pdf=null,closed=false;
 const close=()=>{closed=true;pdf?.loadingTask.destroy();dialog.close();dialog.remove();};dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});dialog.showModal();
 try{
  const {submission:s}=await api(admin?'admin_detail':'detail',undefined,{params:{id}});if(closed)return;
  const known=docs.find(d=>d.id===s.doc_id),labels=new Map((s.profile.field_definitions||known?.fields||[]).map(f=>[f.id,f]));
  const value=(key,v)=>{const f=labels.get(key);if(f?.selectOptions){const o=f.selectOptions.find(o=>o[0]===v);return o?t(o[1],o[2]):v;}if(f?.options){const selected=Array.isArray(v)?v:[v];return selected.map(x=>{const o=f.options.find(o=>o.value===x);return o?t(o.label,o.ar):x;}).join(' · ');}return Array.isArray(v)?v.join(' · '):v;};
  dialog.querySelector('.portal-preview-body').innerHTML=`<h3>${e(t(s.title,s.ar))}</h3><p>${e(when(s.created_at,lang))} · ${t('Riyadh time','بتوقيت الرياض')} · ${t(s.audience==='individual'?'Individual':'Company',s.audience==='individual'?'فرد':'شركة')}</p><a class="portal-button" href="${endpoint(admin?'admin_pdf':'pdf',{id})}">${t('Download PDF','تنزيل PDF')}</a><details class="portal-answer-details"><summary>${t('Submitted details','البيانات المرسلة')}</summary><dl>${Object.entries(s.answers).filter(([key,v])=>String(v).length&&!labels.get(key)?.hidden).map(([key,v])=>`<div><dt>${e(labels.has(key)?t(labels.get(key).label,labels.get(key).ar):key.replaceAll('_',' '))}</dt><dd dir="auto">${e(value(key,v))}</dd></div>`).join('')}</dl></details><div class="portal-pdf-pages"></div><p data-preview-status role="status">${t('Preparing preview…','جارٍ إعداد المعاينة…')}</p>`;
  const res=await fetch(endpoint(admin?'admin_pdf':'pdf',{id}),{cache:'no-store'});if(!res.ok)throw Error('login_required');
  const loaded=await loadPreview(new Uint8Array(await res.arrayBuffer()));if(closed){loaded.loadingTask.destroy();return;}pdf=loaded;
  for(let i=1;i<=pdf.numPages;i++){if(closed)return;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',t('Page ','صفحة ')+i);dialog.querySelector('.portal-pdf-pages').append(canvas);await renderPage(pdf,i,canvas,1000);}
  if(!closed)dialog.querySelector('[data-preview-status]').textContent='';
 }catch(err){if(!closed)dialog.querySelector('.portal-preview-body [role="status"]').textContent=errorText(err,lang);}
}
