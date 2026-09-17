import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/latin-400.css';
import './style.css';
import {docs as builtInDocs} from './forms/index.js';
import {loadCatalogue} from './management/catalogue.js';
const {docs, cards:managedCards}=await loadCatalogue(builtInDocs);
import {catalogueFor} from './catalogue.js';
import {hasValue} from './schema.js';
import {appRoot,audience,visibleIn} from './routes.js';
import {createDraftStore,DRAFT_PREFIX} from './drafts.js';
import {sharedGroups,sharedCandidates} from './shared-fields.js';
import {parseNumber} from './numbers.js';
import {signatureSlots,prepareSignature} from './signatures.js';
import {generate,original,loadPreview,renderPage,templateUrl,fieldValue} from './pdf.js';

const app=document.querySelector('#app');
const drafts=createDraftStore(docs,undefined,audience);
let sharedPanelOpen=false;
let lang=drafts.preferences.lang||(navigator.language.startsWith('ar')?'ar':'en');
let current=null,step=0,values={},signatures={},signatureTarget='',signaturePanelOpen=false,signatureMessage='',pageNumber=1,pdf=null,pdfBytes=null,review=false,busy=false,errors=[],generation=0,downloadFile=null,previewVisible=false;

const t=(en,ar)=>lang==='ar'?(ar||en):(en||ar);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',arrow:'<path d="m9 5 7 7-7 7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',back:'<path d="m15 5-7 7 7 7"/>',check:'<path d="m5 12 4 4L19 6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'})[name]||''}</svg>`;
function bilingual(en,ar,inline=false){
 const bits=[en?`<bdi lang="en" dir="ltr">${e(en)}</bdi>`:'',ar?`<bdi lang="ar" dir="rtl">${e(ar)}</bdi>`:''].filter(Boolean);
 if(lang==='ar'&&bits.length===2)bits.reverse();
 return `<span class="bilingual ${inline?'inline':''}">${bits.join(inline?'<span class="language-divider" aria-hidden="true"> / </span>':'')}</span>`;
}
function sharedHTML(){
 if(!audience)return '';
 const profile=drafts.profile,folder=t(audience==='individual'?'Individuals':'Companies',audience==='individual'?'الأفراد':'الشركات');
 return `<details id="shared-fields-panel" class="shared-fields-panel" ${sharedPanelOpen?'open':''}>
 <summary><span><b>${t('Shared document fields','الحقول المشتركة للمستندات')}</b><small>${t('Fill once, reuse in this folder','عبّئ مرة واحدة واستخدمها في هذا المجلد')} · ${folder}</small></span></summary>
 <div class="shared-fields-content"><p>${t('Matching fields fill automatically in this folder only. Edits inside a form stay specific to that form. Additional clients, witnesses and controlling persons remain separate.','تُعبّأ الحقول المتطابقة تلقائيًا في هذا المجلد فقط. التعديلات داخل النموذج تخص ذلك النموذج وحده. تبقى بيانات العملاء الإضافيين والشهود والأشخاص المسيطرين منفصلة.')}</p>
 <form id="shared-fields-form" novalidate>${sharedGroups(audience).map(group=>`<section class="paper-group"><h3>${e(t(group.label,group.ar))}</h3><div class="field-grid">${group.fields.map(f=>{
  const v=profile[f.id]??(f.id==='name_language'?'en':'');
  if(f.type==='checkbox')return `<div class="field wide"><label class="shared-address-option"><input id="shared-${f.id}" data-shared-key="${f.id}" type="checkbox" ${v?'checked':''}><span>${e(t(f.label,f.ar))}</span></label></div>`;
  const control=f.type==='select'?`<select id="shared-${f.id}" data-shared-key="${f.id}"><option value="">${t('Select…','اختر…')}</option>${f.options.map(([id,en,ar])=>`<option value="${id}" ${id===v?'selected':''}>${e(t(en,ar))}</option>`).join('')}</select>`:`<input id="shared-${f.id}" data-shared-key="${f.id}" type="${f.type}" value="${e(v)}" dir="${f.id.startsWith('ar_')?'rtl':f.id.startsWith('en_')||['date','email','tel'].includes(f.type)?'ltr':'auto'}" autocomplete="off" spellcheck="false" maxlength="2000">`;
  return `<div class="field"><label for="shared-${f.id}">${e(t(f.label,f.ar))}</label>${control}</div>`;
 }).join('')}</div></section>`).join('')}</form>
 <div class="shared-actions"><span data-save-status>${saveLabel()}</span>${current?`<button class="button secondary" id="fill-shared-blanks">${t('Fill empty fields in this form','تعبئة الحقول الفارغة في هذا النموذج')}</button>`:''}<button class="ghost" id="clear-shared">${t('Clear shared fields','مسح الحقول المشتركة')}</button></div></div></details>
 <dialog id="clear-shared-dialog"><h2>${t('Clear shared fields?','مسح الحقول المشتركة؟')}</h2><p>${t('Removes this folder’s shared details and their automatically copied answers. Your individual edits and the other folder are kept.','يحذف بيانات هذا المجلد المشتركة والإجابات المنسوخة منها تلقائيًا. يُحتفظ بتعديلاتك الخاصة بكل نموذج وبالمجلد الآخر.')}</p><div class="dialog-actions"><button class="button secondary" id="keep-shared">${t('Keep details','الاحتفاظ بالبيانات')}</button><button class="button primary" id="confirm-clear-shared">${t('Clear shared fields','مسح الحقول المشتركة')}</button></div></dialog>`;
}
function refreshAfterShared(typing=false){
 const wasReview=review;
 clearDownload();pdfBytes=null;errors=[];review=false;
 if(wasReview||!typing){generation++;paintVersion++;if(pdf){pdf.loadingTask.destroy();pdf=null;}}
 if(current){values={...drafts.get(current.id).values};signatures={...drafts.get(current.id).signatures};}
 if(!typing){render();if(current)showOriginal();return;}
 // Keep shared inputs mounted: email inputs cannot restore a caret with
 // setSelectionRange, and replacing any active input also interrupts IME/date entry.
 if(current){
  if(wasReview){
   previewVisible=false;
   document.querySelector('#document-preview').hidden=true;
   document.querySelector('.editor-layout').classList.remove('with-preview');
   const toggle=document.querySelector('#toggle-preview');
   toggle.setAttribute('aria-expanded','false');
   toggle.innerHTML=icon('eye',17)+t('Show document','عرض المستند');
  }
  document.querySelector('#fields-content').innerHTML=editingSectionHTML();
  document.querySelector('.download-from-step').innerHTML=downloadSectionHTML();
  bindSectionControls();bindSharedHints();
  document.querySelectorAll('[data-step]').forEach(b=>{const active=Number(b.dataset.step)===step;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'step':'false');});
  document.querySelector('#review-tab').classList.remove('active');
  document.querySelector('#answered-count').textContent=`${current.fields.filter(f=>!f.sum&&hasValue(values[f.id])).length} ${t('answers entered','إجابة مُدخلة')}`;
  showStatus('');
 }else{
  document.querySelectorAll('[data-doc]').forEach(button=>{
   const d=docs.find(d=>d.id===button.dataset.doc);
   button.querySelector('small').textContent=`${d.pages} ${t(d.pages===1?'page':'pages',d.pages===1?'صفحة':'صفحات')}${drafts.has(d.id)?` · ${t('Saved draft — continue','مسودة محفوظة — متابعة')}`:''}`;
  });
 }
 storageStatus();
}
function bindShared(){
 const panel=document.querySelector('#shared-fields-panel');if(!panel)return;
 panel.ontoggle=()=>{sharedPanelOpen=panel.open;};
 document.querySelector('#shared-fields-form').onsubmit=ev=>ev.preventDefault();
 document.querySelector('#shared-fields-form').oninput=ev=>{
  const key=ev.target.dataset.sharedKey;if(!key)return;
  sharedPanelOpen=true;
  drafts.setShared({...drafts.profile,[key]:ev.target.type==='checkbox'?ev.target.checked:ev.target.value});refreshAfterShared(true);
 };
 document.querySelector('#clear-shared').onclick=()=>document.querySelector('#clear-shared-dialog').showModal();
 document.querySelector('#keep-shared').onclick=()=>document.querySelector('#clear-shared-dialog').close();
 document.querySelector('#confirm-clear-shared').onclick=()=>{drafts.setShared({});refreshAfterShared();};
 document.querySelector('#fill-shared-blanks')?.addEventListener('click',()=>{drafts.fillSharedBlanks(current.id);refreshAfterShared();});
}
function sharedHint(id){
 if(!current)return '';
 const candidate=sharedCandidates(current,drafts.profile,values,audience)[id];
 if(!hasValue(candidate))return '';
 const r=drafts.get(current.id);
 return r.shared[id]===values[id]&&!r.overrides.includes(id)?`<small class="shared-hint">${t('From shared document fields','من الحقول المشتركة للمستندات')}</small>`:`<button class="shared-hint ghost" type="button" data-shared-use="${id}">${t('Use shared value','استخدام القيمة المشتركة')}</button>`;
}
function bindSharedHints(){document.querySelectorAll('[data-shared-use]').forEach(button=>button.onclick=()=>{if(busy)return;drafts.useShared(current.id,button.dataset.sharedUse);refreshAfterShared();});}
function updateSharedHints(){document.querySelectorAll('[data-shared-hint]').forEach(el=>el.innerHTML=sharedHint(el.dataset.sharedHint));bindSharedHints();}
function bindClearChoices(){document.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{delete values[button.dataset.clear];clearDownload();pdfBytes=null;saveDraft(button.dataset.clear);renderEditor();});}

function header(){return `<header class="header"><a href="${appRoot}" class="brand" data-home><span class="brand-symbol">${icon('file',23)}</span><span><b>${t('ITQAN CAPITAL','إتقان كابيتال')}</b><small>${t('CLIENT FORMS','نماذج العملاء')}</small></span></a><button class="language ghost" id="language" lang="${lang==='en'?'ar':'en'}">${lang==='en'?'العربية':'English'}</button></header>`;}
function saveLabel(){return drafts.available?t('Saved on this browser','محفوظ في هذا المتصفح'):t('Not saved — browser storage is unavailable','لم يتم الحفظ — تخزين المتصفح غير متاح');}
function footer(){return `<footer>${icon('lock',15)} <span data-storage-note>${drafts.available?t('Drafts are saved on this browser so you can return later. Use Clear form or Clear all saved forms to remove them.','تُحفظ المسودات في هذا المتصفح لتعود إليها لاحقًا. استخدم «مسح النموذج» أو «مسح جميع النماذج المحفوظة» لحذفها.'):t('Browser saving is unavailable. Keep this tab open or download your PDF before leaving.','الحفظ في المتصفح غير متاح. أبقِ الصفحة مفتوحة أو نزّل المستند قبل المغادرة.')}</span></footer>`;}
function storageStatus(){document.querySelectorAll('[data-save-status]').forEach(el=>{el.textContent=saveLabel();el.classList.toggle('save-failed',!drafts.available);});document.querySelector('footer')?.replaceWith(document.createRange().createContextualFragment(footer()));}
function saveDraft(editedField=null){if(current){drafts.save(current.id,values,step,signatures,editedField);values={...drafts.get(current.id).values};}storageStatus();}
function blankLink(d,classes='button secondary'){return `<a class="${classes}" data-blank="${d.id}" href="${templateUrl(d)}" download="${d.id}-blank.pdf">${icon('download',16)}${t('Download blank','تنزيل النموذج الفارغ')}</a>`;}
function setLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';}
function bindCommon(){document.querySelector('#language').onclick=()=>{lang=lang==='en'?'ar':'en';signatureMessage='';drafts.setPreferences({lang});render();};document.querySelector('[data-home]').onclick=ev=>{ev.preventDefault();home();};}
function home(){clearDownload();generation++;if(current)saveDraft();drafts.setPreferences({active:null});current=null;review=false;pdfBytes=null;errors=[];paintVersion++;if(pdf){pdf.loadingTask.destroy();pdf=null;}render();window.scrollTo(0,0);}
function render(){setLanguage();if(!current){renderHome();return;}renderEditor();}
function cardHTML(d){
 const body=`<span class="card-number" aria-label="${t('Document','المستند')} ${d.number}">${d.number}</span><span class="card-body">${d.group==='shared'?`<span class="shared-badge">${t('Shared document','مستند مشترك')}</span>`:''}<b>${e(t(d.title,d.ar))}</b><span>${e(t(d.description,d.arDescription))}</span><small>${d.pages} ${t(d.pages===1?'page':'pages',d.pages===1?'صفحة':'صفحات')}${!d.downloadOnly&&drafts.has(d.id)?` · ${t('Saved draft — continue','مسودة محفوظة — متابعة')}`:''}</small></span><span class="card-arrow">${icon(d.downloadOnly?'download':'arrow',18)}</span>`;
 const open=d.downloadOnly?`<a class="card-open" data-download-doc="${d.id}" href="${templateUrl(d)}" download="${d.id}.pdf">${body}</a>`:`<button class="card-open" data-doc="${d.id}">${body}</button>`;
 return `<article class="doc-card" data-card="${d.id}" data-number="${d.number}">${open}<div class="card-actions">${!d.downloadOnly&&drafts.hasLegacy(d.id)?`<button class="ghost restore-legacy" data-restore-legacy="${d.id}">${t('Restore previous draft to this folder','استعادة المسودة السابقة في هذا المجلد')}</button>`:''}${d.downloadOnly?`<a class="blank-link" data-blank="${d.id}" href="${templateUrl(d)}" download="${d.id}.pdf">${icon('download',16)}${t('Download PDF','تنزيل PDF')}</a>`:blankLink(d,'blank-link')}</div></article>`;
}
function renderHome(){
 if(!audience){
  app.innerHTML=header()+`<main class="home"><div class="intro"><span class="eyebrow">${t('DOCUMENT CENTRE','مركز المستندات')}</span><h1>${t('Client forms','نماذج العملاء')}</h1><p>${t('Please use the form link provided to you.','يرجى استخدام رابط النماذج المرسل إليك.')}</p></div></main>`;
  bindCommon();return;
 }
 app.innerHTML=header()+`<main class="home"><div class="intro"><span class="eyebrow">${t('DOCUMENT CENTRE','مركز المستندات')}</span><h1>${audience?t(audience==='individual'?'Individual forms':'Company forms',audience==='individual'?'نماذج الأفراد':'نماذج الشركات'):t('Your forms. Ready to sign.','نماذجك، جاهزة للتوقيع.')}</h1><p>${t('Choose a document, fill in your details, then download your PDF.','اختر المستند، أدخل بياناتك، ثم نزّل ملفك بصيغة PDF.')}</p><div class="flow"><span><b>1</b>${t('Choose','اختر')}</span><i></i><span><b>2</b>${t('Fill & review','عبّئ وراجع')}</span><i></i><span><b>3</b>${t('Download & sign','نزّل ووقّع')}</span></div></div><div class="saved-controls"><span data-save-status>${saveLabel()}</span><button class="ghost" id="clear-all">${t('Clear all saved forms','مسح جميع النماذج المحفوظة')}</button></div>${sharedHTML()}<div class="catalogue"><div class="cards">${catalogueFor(docs,audience,managedCards).map(cardHTML).join('')}</div></div><aside class="home-note">${icon('file',22)}<div><b>${t('Original documents. Your details.','المستندات الأصلية، ببياناتك.')}</b><p>${t('The original layout is preserved. Add an optional signature image, or leave the signing spaces blank for signing after download.','يُحفظ تنسيق المستند الأصلي. أضف صورة توقيع اختياريًا، أو اترك أماكن التوقيع فارغة للتوقيع بعد التنزيل.')}</p></div></aside></main>`+footer()+`<dialog id="clear-all-dialog"><h2>${t('Clear all saved forms?','مسح جميع النماذج المحفوظة؟')}</h2><p>${t('This removes shared fields, drafts and signatures in this folder only. The other folder is kept. Download any PDFs you want to keep first.','ستُحذف الحقول المشتركة والمسودات والتوقيعات في هذا المجلد فقط. يُحتفظ بالمجلد الآخر. نزّل المستندات التي تريد الاحتفاظ بها أولًا.')}</p><div class="dialog-actions"><button class="button secondary" id="clear-all-cancel">${t('Keep drafts','الاحتفاظ بالمسودات')}</button><button class="button primary" id="clear-all-confirm">${t('Clear all','مسح الكل')}</button></div></dialog>`;
 bindCommon();bindShared();document.querySelectorAll('[data-restore-legacy]').forEach(button=>button.onclick=()=>{drafts.restoreLegacy(button.dataset.restoreLegacy);selectDoc(button.dataset.restoreLegacy);});document.querySelector('#clear-all').onclick=()=>document.querySelector('#clear-all-dialog').showModal();document.querySelector('#clear-all-cancel').onclick=()=>document.querySelector('#clear-all-dialog').close();document.querySelector('#clear-all-confirm').onclick=()=>{drafts.clearAll();render();};document.querySelectorAll('[data-doc]').forEach(btn=>btn.onclick=()=>selectDoc(btn.dataset.doc));
}
async function selectDoc(id){if(!docs.some(d=>d.id===id&&visibleIn(d,audience)))return;previewVisible=false;clearDownload();paintVersion++;if(pdf)pdf.loadingTask.destroy();current=docs.find(d=>d.id===id);values={...drafts.get(id).values};signatures={...drafts.get(id).signatures};signatureTarget=signatureSlots(current).length===1?signatureSlots(current)[0].id:'';signaturePanelOpen=Object.keys(signatures).length>0;signatureMessage='';step=drafts.has(id)?drafts.get(id).step:0;pageNumber=current.sections[step].page;drafts.setPreferences({active:id,lang});review=false;pdfBytes=null;errors=[];pdf=null;render();window.scrollTo(0,0);await showOriginal();}
async function showOriginal(){if(!current||!previewVisible)return;const g=++generation,d=current;try{const loaded=await loadPreview(await original(d));if(g!==generation){loaded.loadingTask.destroy();return;}if(pdf)pdf.loadingTask.destroy();pdf=loaded;await paint();}catch(err){if(g===generation)showStatus(t('Unable to load the PDF. Check your connection and retry.','تعذّر تحميل المستند. تحقق من اتصالك وأعد المحاولة.'),true);}}
function signatureHTML(){
 const slots=signatureSlots(current),count=Object.keys(signatures).length;
 return `<details id="signature-panel" class="signature-panel" ${signaturePanelOpen?'open':''}>
  <summary>${t('Signature image (optional)','صورة التوقيع (اختياري)')}${count?` <span class="signature-count">${count} ${t('added','مضافة')}</span>`:''}</summary>
  <div class="signature-content">
   <p>${t('Choose a signing box, then upload that person’s signature. Only the chosen box receives it.','اختر خانة التوقيع، ثم أضف صورة توقيع صاحبها. ستُضاف الصورة إلى الخانة المختارة فقط.')}</p>
   <label for="signature-target">${t('Signing box','خانة التوقيع')}</label>
   <select id="signature-target"><option value="">${t('Choose a signing box…','اختر خانة التوقيع…')}</option>${slots.map(slot=>`<option value="${slot.id}" ${slot.id===signatureTarget?'selected':''}>${e(t(slot.label,slot.ar))} · ${t('Page','صفحة')} ${slot.page}</option>`).join('')}</select>
   <input id="signature-file" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden aria-label="${t('Upload signature image','تحميل صورة التوقيع')}">
   <button type="button" class="button secondary" id="signature-choose" ${!signatureTarget?'disabled':''}>${signatures[signatureTarget]?t('Replace signature image','استبدال صورة التوقيع'):t('Upload signature image','تحميل صورة التوقيع')}</button>
   <small>${t('PNG or JPG, up to 5 MB. Use a cropped signature on a white or transparent background. White backgrounds are removed.','PNG أو JPG، حتى ٥ ميغابايت. استخدم صورة مقتصة للتوقيع بخلفية بيضاء أو شفافة. تُزال الخلفية البيضاء.')}</small>
   <p class="signature-feedback" role="status" aria-live="polite">${e(signatureMessage)}</p>
   ${slots.filter(slot=>signatures[slot.id]).map(slot=>`<div class="signature-item"><img src="${signatures[slot.id]}" alt="${e(t('Uploaded signature','صورة التوقيع المضافة'))}"><b>${e(t(slot.label,slot.ar))} · ${t('Page','صفحة')} ${slot.page}</b><div><button class="ghost" data-signature-preview="${slot.id}">${t('Preview on PDF','معاينة في المستند')}</button><button class="ghost" data-signature-remove="${slot.id}">${t('Remove','إزالة')}</button></div></div>`).join('')}
   <small>${t('Signature images are saved with this form in this browser. Clear form removes them.','تُحفظ صور التوقيع مع هذا النموذج في هذا المتصفح. يحذفها خيار «مسح النموذج».')}</small>
  </div></details>`;
}
function bindSignatures(){
 document.querySelector('#signature-panel').ontoggle=ev=>{signaturePanelOpen=ev.target.open;};
 document.querySelector('#signature-target').onchange=ev=>{
  signatureTarget=ev.target.value;signatureMessage='';
  document.querySelector('#signature-choose').disabled=busy||!signatureTarget;
  document.querySelector('#signature-choose').textContent=signatures[signatureTarget]?t('Replace signature image','استبدال صورة التوقيع'):t('Upload signature image','تحميل صورة التوقيع');
  document.querySelector('.signature-feedback').textContent='';
 };
 document.querySelector('#signature-choose').onclick=()=>document.querySelector('#signature-file').click();
 document.querySelector('#signature-file').onchange=uploadSignature;
 document.querySelectorAll('[data-signature-remove]').forEach(button=>button.onclick=()=>{
  if(busy)return;const slot=signatureSlots(current).find(s=>s.id===button.dataset.signatureRemove);
  delete signatures[slot.id];signatureMessage=t('Signature removed.','تمت إزالة التوقيع.');signatureChanged(slot.page);
 });
 document.querySelectorAll('[data-signature-preview]').forEach(button=>button.onclick=()=>makeReview(false,signatureSlots(current).find(s=>s.id===button.dataset.signaturePreview).page));
}
function signatureChanged(page){
 clearDownload();pdfBytes=null;review=false;pageNumber=page;signaturePanelOpen=true;paintVersion++;
 if(pdf){pdf.loadingTask.destroy();pdf=null;}
 saveDraft();renderEditor();showOriginal();
}
async function uploadSignature(ev){
 const file=ev.target.files?.[0],slot=signatureSlots(current).find(s=>s.id===signatureTarget);
 ev.target.value='';if(!file||!slot||busy)return;
 const token=++generation;busy=true;setBusy(true);
 document.querySelector('.signature-feedback').textContent=t('Preparing signature…','جارٍ تجهيز التوقيع…');
 try{
  const image=await prepareSignature(file);if(token!==generation)return;
  signatures[slot.id]=image;signatureMessage=t('Image added. Select “Preview on PDF” below to check its placement.','تمت إضافة الصورة. اختر «معاينة في المستند» أدناه للتحقق من موضعها.');
  signatureChanged(slot.page);
 }catch(error){
  if(token!==generation)return;
  const messages={
   size:['Use a cropped image under 5 MB (up to 24 megapixels).','استخدم صورة مقتصة أقل من ٥ ميغابايت (حتى ٢٤ ميغابكسل).'],
   type:['Choose a PNG or JPG signature image.','اختر صورة توقيع بصيغة PNG أو JPG.'],
   decode:['This image could not be opened. Try another PNG or JPG.','تعذّر فتح الصورة. جرّب صورة PNG أو JPG أخرى.'],
   blank:['No signature was found. Choose an image with visible pen strokes.','لم يظهر توقيع في الصورة. اختر صورة يظهر فيها التوقيع بوضوح.'],
   background:['Use a cropped signature on a white or transparent background.','استخدم صورة مقتصة للتوقيع بخلفية بيضاء أو شفافة.'],
  };
  signatureMessage=t(...(messages[error.message]||messages.decode));document.querySelector('.signature-feedback').textContent=signatureMessage;
 }finally{busy=false;setBusy(false);}
}
function fieldHTML(f){
 const value=fieldValue(f,values);
 const label=`<span class="field-label">${e(t(f.label,f.ar))}</span>`;
 const wide=f.wide??(f.multiline||f.label.length>100||(f.type==='choice'&&(f.options.length>3||f.options.some(o=>o.label.length>55||o.ar?.length>65))));
 const context=f.context?`<span class="field-context">${e(t(f.context[0],f.context[1]))}</span>`:'';
 if(f.sum)return `<div class="field computed" data-field="${f.id}"><span>${label}</span><strong>${e(value||'—')}</strong></div>`;
 let input='';
 if(f.type==='choice')input=`<div class="options ${f.options.some(o=>o.label.length>100)?'long-options':''}">${f.options.map(o=>`<div class="option-row"><label class="option"><input type="${f.multiple?'checkbox':'radio'}" name="${f.id}" value="${e(o.value)}" ${f.multiple?(value||[]).includes(o.value)?'checked':'':value===o.value?'checked':''}><span>${bilingual(o.label,o.ar,true)}</span></label>${(f.optionFields?.[o.value]||[]).map(id=>`<div class="option-detail">${fieldHTML(current.fields.find(f=>f.id===id))}</div>`).join('')}</div>`).join('')}</div><button type="button" class="clear-choice" data-clear="${f.id}">${t('Clear selection','مسح الاختيار')}</button>`;
 else if(f.type==='select')input=`<select id="f-${f.id}" name="${f.id}"><option value="">${t('Select…','اختر…')}</option>${f.selectOptions.map(([v,en,ar])=>`<option value="${v}" ${value===v?'selected':''}>${e([en,ar].filter(Boolean).join(' / '))}</option>`).join('')}</select>`;
 else if(f.multiline)input=`<textarea id="f-${f.id}" name="${f.id}" rows="3" dir="auto" spellcheck="false" ${f.maxLength?`maxlength="${f.maxLength}"`:''}>${e(value)}</textarea>`;
 else input=`<input id="f-${f.id}" name="${f.id}" type="${['date','email','tel'].includes(f.type)?f.type:'text'}" value="${e(value)}" dir="${f.direction||(['date','email','tel'].includes(f.type)?'ltr':'auto')}" ${f.maxLength?`maxlength="${f.maxLength}"`:''} ${f.numeric?'inputmode="decimal"':''} autocomplete="off" spellcheck="false">`;
 return `<${f.type==='choice'?'fieldset':'div'} class="field ${wide?'wide':''} ${f.type==='choice'?'choice':''} ${errors.includes(f.id)?'invalid':''}" data-field="${f.id}">${f.type==='choice'?`<legend>${context}${label}</legend>`:`<label for="f-${f.id}">${context}${label}</label>`}${input}<div data-shared-hint="${f.id}">${sharedHint(f.id)}</div>${f.help?`<small class="field-help">${e(t(f.help,f.arHelp))}</small>`:''}${errors.includes(f.id)?`<p class="field-error">${t('This answer is too long for its space in the PDF. Please shorten it.','هذه الإجابة أطول من المساحة المتاحة في المستند. يرجى اختصارها.')}</p>`:''}</${f.type==='choice'?'fieldset':'div'}>`;
}
function fieldsHTML(section){
 const embedded=new Set(section.fields.flatMap(f=>Object.values(f.optionFields||{}).flat()));
 const fields=section.fields.filter(f=>!embedded.has(f.id));
 if(!section.paperGroups)return `<div class="field-grid">${fields.map(fieldHTML).join('')}</div>`;
 return section.paperGroups.map(group=>`<section class="paper-group">${group.title?`<h3>${e(t(group.title,group.ar))}</h3>`:''}<div class="field-grid ${group.paired?'paired-grid':''}">${group.fields.filter(id=>!embedded.has(id)).map(id=>fieldHTML(section.fields.find(f=>f.id===id))).join('')}</div></section>`).join('');
}
function editingSectionHTML(){const s=current.sections[step];return `<div class="section-heading"><span class="eyebrow">${t('SECTION','القسم')} ${step+1} / ${current.sections.length}</span><h2>${e(t(s.title,s.ar))}</h2>${s.note?`<p>${e(t(s.note,s.arNote||s.note))}</p>`:''}${(s.paperNotes||[]).map(([en,ar])=>`<p class="paper-note">${e(t(en,ar))}</p>`).join('')}</div><form id="fields" novalidate>${fieldsHTML(s)}</form>${s.signatureSlot?`<button type="button" class="button secondary" data-section-signature="${s.signatureSlot}" style="margin-top:24px">${t(current.id==='subscription-form'?'Add / manage applicant signature':'Add / manage representative signature',current.id==='subscription-form'?'إضافة / إدارة توقيع مقدم الطلب':'إضافة / إدارة توقيع الممثل')}</button>`:''}<div class="section-actions"><button class="button secondary" id="previous" ${step===0?'disabled':''}>${t('Back','السابق')}</button><button class="button primary" id="next">${step===current.sections.length-1?t('Review PDF','مراجعة المستند'):t('Continue','متابعة')}${icon('arrow',16)}</button></div>`;}
function downloadSectionHTML(){return `<button class="button secondary full-width" id="download-section">${icon('download',17)}${t('Download with current answers','تنزيل بالإجابات الحالية')}</button>`;}
function bindSectionControls(){
 document.querySelector('[data-section-signature]')?.addEventListener('click',ev=>{if(busy)return;signatureTarget=ev.currentTarget.dataset.sectionSignature;signaturePanelOpen=true;renderEditor();document.querySelector('#signature-panel').scrollIntoView({behavior:'smooth',block:'start'});});
 document.querySelector('#download-section')?.addEventListener('click',()=>makeReview(true));
 if(!review){document.querySelector('#previous').onclick=()=>goStep(step-1);document.querySelector('#next').onclick=()=>step===current.sections.length-1?makeReview():goStep(step+1);document.querySelector('#fields').oninput=onInput;document.querySelector('#fields').onsubmit=ev=>ev.preventDefault();bindClearChoices();}
 else {document.querySelector('#download').onclick=download;document.querySelector('#edit-again').onclick=()=>goStep(0);document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>goStep(Number(b.dataset.jump)));}
}
function renderEditor(){
 const active=current.fields.filter(f=>!f.sum), completed=active.filter(f=>hasValue(values[f.id])).length;
 app.innerHTML=header()+`<main class="workspace"><div class="document-heading"><button class="back-link ghost" id="back-home">${icon('back',17)}${t('All forms','كل النماذج')}</button><div class="document-title"><div><span class="eyebrow">${current.pages} ${t('PAGE DOCUMENT','صفحات')}</span><h1>${e(t(current.title,current.ar))}</h1></div><div class="document-actions"><button class="button secondary" id="toggle-preview" aria-expanded="${previewVisible}" aria-controls="document-preview">${icon('eye',17)}${previewVisible?t('Hide document','إخفاء المستند'):t('Show document','عرض المستند')}</button>${blankLink(current)}<button class="button primary" id="download-now" ${busy?'disabled':''}>${icon('download',17)}${t('Download PDF','تنزيل PDF')}</button></div></div><div id="download-result" class="download-result" role="status" aria-live="polite" hidden></div><div id="status" class="status" role="status" aria-live="polite"></div></div><div class="editor-layout ${previewVisible?'with-preview':''}"><div class="form-panel"><nav class="sections" aria-label="${t('Form sections','أقسام النموذج')}">${current.sections.map((x,i)=>`<button class="section-tab ${i===step&&!review?'active':''}" data-step="${i}" aria-current="${i===step&&!review?'step':'false'}"><span>${i+1}</span>${e(t(x.title,x.ar))}</button>`).join('')}<button class="section-tab ${review?'active':''}" id="review-tab"><span>${icon('check',13)}</span>${t('Review','المراجعة')}</button></nav>${sharedHTML()}${signatureHTML()}<div id="fields-content">${review?reviewHTML(active,completed):editingSectionHTML()}</div><div class="download-from-step">${!review?downloadSectionHTML():''}</div><div class="form-bottom"><div><span id="answered-count">${completed} ${t('answers entered','إجابة مُدخلة')}</span><small data-save-status>${saveLabel()}</small></div><button class="ghost" id="reset">${t('Clear form','مسح النموذج')}</button></div></div><aside class="preview-panel" id="document-preview" ${previewVisible?'':'hidden'}><div class="preview-toolbar"><div><span class="preview-dot ${review?'ready':''}"></span><b>${review?t('Your completed PDF','المستند بعد التعبئة'):t('Original document','المستند الأصلي')}</b></div><span class="page-controls"><button class="icon-button" id="page-prev" aria-label="${t('Previous page','الصفحة السابقة')}">${icon('back',16)}</button><span id="page-label">${pageNumber} / ${current.pages}</span><button class="icon-button" id="page-next" aria-label="${t('Next page','الصفحة التالية')}">${icon('arrow',16)}</button></span></div><div class="paper-wrap"><canvas id="pdf-canvas" aria-label="${t('PDF page preview','معاينة صفحة المستند')}"></canvas><div id="loading" class="loading">${t('Loading document…','جارٍ تحميل المستند…')}</div></div><p class="preview-caption">${review?t('This preview is the exact PDF you will download.','هذه المعاينة هي نفس ملف PDF الذي ستنزّله.'):t('Your answers are added when you select Review PDF.','تُضاف إجاباتك عند اختيار «مراجعة المستند».')}</p></aside></div></main>`+footer()+`<dialog id="reset-dialog"><h2>${t('Clear this form?','مسح هذا النموذج؟')}</h2><p>${t('This removes this form’s answers, signature images and saved draft from this browser.','ستُحذف إجابات هذا النموذج وصور التوقيع ومسودته المحفوظة من هذا المتصفح.')}</p><div class="dialog-actions"><button class="button secondary" id="reset-cancel">${t('Keep editing','متابعة التعبئة')}</button><button class="button primary" id="reset-confirm">${t('Clear answers','مسح الإجابات')}</button></div></dialog>`;
 bindCommon();bindShared();document.querySelector('#back-home').onclick=home;
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>goStep(Number(b.dataset.step)));
 document.querySelector('#review-tab').onclick=()=>makeReview();
 document.querySelector('#download-now').onclick=()=>makeReview(true);
 document.querySelector('#toggle-preview').onclick=()=>{previewVisible=!previewVisible;renderEditor();if(previewVisible&&!pdf)showOriginal();};
 document.querySelector('#page-prev').onclick=()=>changePage(-1);document.querySelector('#page-next').onclick=()=>changePage(1);
 document.querySelector('#reset').onclick=()=>document.querySelector('#reset-dialog').showModal();document.querySelector('#reset-cancel').onclick=()=>document.querySelector('#reset-dialog').close();document.querySelector('#reset-confirm').onclick=()=>{clearDownload();generation++;paintVersion++;values={};signatures={};signatureMessage='';drafts.clear(current.id);review=false;pdfBytes=null;step=0;pageNumber=current.sections[0].page;render();showOriginal();};
 bindSectionControls();
 bindSharedHints();bindSignatures();renderDownloadResult();if(pdf)paint();if(busy)setBusy(true);
}
function reviewHTML(active,completed){const blank=active.length-completed;const totals=['ideal','current'].map(key=>{const fs=active.filter(f=>f.total===key);if(!fs.some(f=>hasValue(values[f.id])))return '';const entries=fs.filter(f=>hasValue(values[f.id])).map(f=>parseNumber(values[f.id]));if(entries.some(v=>v===null||v<0||v>100))return `<p class="warning">${t('Enter percentages between 0 and 100 for the','أدخل نسبًا من ٠ إلى ١٠٠ في')} ${t(key==='ideal'?'ideal portfolio.':'current portfolio.',key==='ideal'?'المحفظة المثالية.':'المحفظة الحالية.')}</p>`;const sum=Math.round(entries.reduce((a,b)=>a+b,0)*100)/100;return Math.abs(sum-100)<.01?'':`<p class="warning">${t(key==='ideal'?'Ideal portfolio':'Current portfolio',key==='ideal'?'المحفظة المثالية':'المحفظة الحالية')}: ${sum}%. ${t('The printed form asks for a total of 100%.','يتطلب النموذج أن يكون المجموع ١٠٠٪.')}</p>`;}).join('');return `<div class="section-heading"><span class="eyebrow">${t('FINAL STEP','الخطوة الأخيرة')}</span><h2>${t('Review, then make it yours.','راجع المستند ثم نزّله.')}</h2><p>${t('Check your details in the PDF before downloading.','تحقق من بياناتك في المستند قبل التنزيل.')}</p></div><div class="review-summary"><span class="summary-icon">${icon('check',25)}</span><div><strong>${completed} ${t('answers added','إجابة مضافة')}</strong><p>${current.pages} ${t('original pages preserved','صفحات أصلية محفوظة')}</p></div></div>${blank?`<div class="notice"><b>${blank} ${t('fields left blank','حقلًا فارغًا')}</b><p>${t('Leave any fields that do not apply to you blank. All entered answers are included in your download.','اترك الحقول التي لا تنطبق عليك فارغة. ستظهر جميع الإجابات المُدخلة في الملف الذي تنزّله.')}</p></div>`:''}${totals}<div class="review-sections">${current.sections.map((s,i)=>{const fs=s.fields.filter(f=>!f.sum);return `<button data-jump="${i}"><span>${e(t(s.title,s.ar))}</span><small>${fs.filter(f=>hasValue(values[f.id])).length}/${fs.length}</small>${icon('arrow',14)}</button>`;}).join('')}</div><div class="sign-note">${icon('file',20)}<p>${t('Optional signature images can be added above. Any unsigned spaces can be signed after downloading. Signing pages:','يمكن إضافة صور التوقيع اختياريًا أعلاه، أو توقيع الخانات الفارغة بعد التنزيل. صفحات التوقيع:')} <b>${current.signing.join(', ')}</b>. ${current.custom||current.sections.some(s=>s.id==='staff')?'':t('Company-use sections remain blank.','تُترك أقسام استخدام الشركة فارغة.')}</p></div><button id="download" class="button primary download-button" ${pdfBytes?'':'disabled'}>${icon('download',20)}${t('Download PDF','تنزيل PDF')}</button><button id="edit-again" class="button secondary full-width">${t('Back to editing','العودة للتعبئة')}</button>`;}
function onInput(ev){const target=ev.target,f=current.fields.find(f=>f.id===target.name);if(!f)return;clearDownload();if(f.multiple&&f.type==='choice')values[f.id]=Array.from(document.querySelectorAll(`input[name="${f.id}"]:checked`),el=>el.value);else values[f.id]=target.value;pdfBytes=null;errors=errors.filter(id=>id!==f.id);saveDraft(f.id);if(f.type==='choice'){document.querySelector('#fields').innerHTML=fieldsHTML(current.sections[step]);bindSharedHints();bindClearChoices();}else updateSharedHints();for(const f of current.sections[step].fields){const wrapper=document.querySelector(`[data-field="${f.id}"]`);if(f.sum&&wrapper)wrapper.querySelector('strong').textContent=fieldValue(f,values)||'—';}document.querySelector('#answered-count').textContent=`${current.fields.filter(f=>!f.sum&&hasValue(values[f.id])).length} ${t('answers entered','إجابة مُدخلة')}`;}
function goStep(i){if(busy||i<0||i>=current.sections.length)return;const wasReview=review;review=false;if(wasReview){previewVisible=false;paintVersion++;if(pdf){pdf.loadingTask.destroy();pdf=null;}}step=i;saveDraft();pageNumber=current.sections[i].page;render();document.querySelector('.form-panel').scrollIntoView({behavior:'smooth',block:'start'});if(wasReview)showOriginal();}
function showStatus(msg,error=false){const el=document.querySelector('#status');if(el){el.textContent=msg;el.className=error?'status error':'status';}}
async function makeReview(downloadNow=false,previewPage=null){
 if(busy)return;
 if(downloadNow&&review&&pdfBytes){download();return;}
 busy=true;const token=++generation,doc=current,snapshot=structuredClone(values),signatureSnapshot={...signatures};saveDraft();
 showStatus(t('Preparing your PDF…','جارٍ إعداد المستند…'));setBusy(true);
 try{
  const filled=doc.fields.some(f=>hasValue(fieldValue(f,snapshot)))||Object.keys(signatureSnapshot).length>0;
  const bytes=filled?await generate(doc,snapshot,signatureSnapshot):await original(doc);
  if(token!==generation)return;
  if(downloadNow){savePDF(bytes,`${doc.id}-${filled?'filled':'blank'}.pdf`);if(!pdf)showOriginal();showStatus(t('Your PDF is ready. Use Save PDF above if it did not save automatically.','ملفك جاهز. استخدم «حفظ PDF» أعلاه إذا لم يُحفظ تلقائيًا.'));return;}
  const loaded=await loadPreview(bytes);
  if(token!==generation){loaded.loadingTask.destroy();return;}
  if(pdf)pdf.loadingTask.destroy();pdf=loaded;pdfBytes=bytes;review=true;previewVisible=true;pageNumber=previewPage||doc.sections[step].page;errors=[];render();document.querySelector('.workspace').scrollIntoView({behavior:'smooth'});
 }catch(err){
  if(import.meta.env.DEV)console.error(err);if(token!==generation)return;
  if(err.fields){errors=err.fields;step=doc.sections.findIndex(s=>s.fields.some(f=>errors.includes(f.id)));pageNumber=doc.sections[step].page;saveDraft();review=false;render();document.querySelector('.invalid')?.scrollIntoView({behavior:'smooth',block:'center'});}
  const message=err.fields?t('An answer does not fit. Shorten the highlighted field and try again.','إحدى الإجابات لا تتسع في المستند. اختصر الحقل المحدد ثم أعد المحاولة.'):t('Could not prepare the PDF. Check your connection, then retry. Your answers are still here.','تعذّر إعداد المستند. تحقق من اتصالك ثم أعد المحاولة. إجاباتك لا تزال محفوظة هنا.');
  showStatus(message,true);
  if(downloadNow){
   clearDownload();const result=document.querySelector('#download-result');result.hidden=false;
   result.innerHTML=`<div><b>${t('PDF could not be prepared','تعذّر إعداد PDF')}</b><p>${e(message)}</p></div><button id="retry-download" class="button secondary">${t('Try again','أعد المحاولة')}</button>`;
   document.querySelector('#retry-download').onclick=()=>makeReview(true);
   if(!err.fields)result.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
 }finally{busy=false;setBusy(false);}
}
function setBusy(value){document.querySelectorAll('#next,#review-tab,#download,#download-now,#download-section,#toggle-preview,#fields input,#fields textarea,#fields select,[data-clear],#signature-panel button,#signature-panel input,#signature-panel select,#shared-fields-panel input,#shared-fields-panel select,#shared-fields-panel button,[data-shared-use]').forEach(b=>b.disabled=value);const upload=document.querySelector('#signature-choose');if(upload)upload.disabled=value||!signatureTarget;}
let paintVersion=0;
async function paint(){const version=++paintVersion;if(!pdf||!previewVisible)return;const canvas=document.querySelector('#pdf-canvas');if(!canvas)return;const temporary=document.createElement('canvas');try{await renderPage(pdf,pageNumber,temporary,750);if(version!==paintVersion)return;canvas.width=temporary.width;canvas.height=temporary.height;canvas.getContext('2d').drawImage(temporary,0,0);document.querySelector('#loading')?.setAttribute('hidden','');}catch(err){if(version===paintVersion)showStatus(t('Preview unavailable. Try opening the original or reviewing again.','المعاينة غير متاحة. أعد فتح الأصل أو مراجعة المستند.'),true);}}
function changePage(delta){pageNumber=Math.max(1,Math.min(current.pages,pageNumber+delta));document.querySelector('#page-label').textContent=`${pageNumber} / ${current.pages}`;paint();}
function clearDownload(){
 if(downloadFile){URL.revokeObjectURL(downloadFile.url);downloadFile=null;}
 const result=document.querySelector('#download-result');if(result){result.replaceChildren();result.hidden=true;}
}
function renderDownloadResult(){
 const result=document.querySelector('#download-result');if(!result||!downloadFile)return;
 result.hidden=false;
 result.innerHTML=`<div><b>${t('Your PDF is ready','ملفك جاهز')}</b><p>${t('Check your Downloads folder. If the file did not save, choose Save PDF below.','تحقق من مجلد التنزيلات. إذا لم يُحفظ الملف، اختر «حفظ PDF» أدناه.')}</p><small dir="ltr">${e(downloadFile.name)}</small></div><div class="download-result-actions"><a id="save-prepared-pdf" class="button primary" href="${downloadFile.url}" download="${e(downloadFile.name)}">${icon('download',17)}${t('Save PDF','حفظ PDF')}</a><button id="preview-prepared-pdf" class="button secondary">${icon('eye',17)}${t('Preview PDF','معاينة PDF')}</button></div>`;
 document.querySelector('#preview-prepared-pdf').onclick=async()=>{await makeReview();if(review)document.querySelector('.preview-panel')?.scrollIntoView({behavior:'smooth',block:'start'});};
}
function savePDF(bytes,name){
 clearDownload();
 downloadFile={url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),name};
 renderDownloadResult();
 // Keep a real, attached link available for a direct user click when a browser
 // blocks automatic downloads. Its URL stays valid until the answers change.
 document.querySelector('#save-prepared-pdf').click();
 document.querySelector('#download-result').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function download(){if(pdfBytes)savePDF(pdfBytes,`${current.id}-filled.pdf`);}
window.addEventListener('beforeunload',ev=>{if(!drafts.available&&(Object.keys(drafts.profile).length||docs.some(d=>drafts.has(d.id)))){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('storage',ev=>{
 if(ev.key!==null&&!ev.key.startsWith(drafts.prefix)&&!['signature-form','terms-and-conditions'].some(id=>ev.key===DRAFT_PREFIX+id))return;
 drafts.refresh();
 if(current&&(ev.key===null||ev.key===drafts.prefix+current.id||ev.key===drafts.prefix+'shared-fields')){
  clearDownload();generation++;paintVersion++;values={...drafts.get(current.id).values};signatures={...drafts.get(current.id).signatures};signatureMessage='';step=drafts.get(current.id).step;pageNumber=current.sections[step].page;review=false;pdfBytes=null;errors=[];render();showOriginal();
 }else if(!current)render();
});
const resume=docs.find(d=>d.id===drafts.preferences.active&&drafts.has(d.id)&&visibleIn(d,audience));
if(resume)selectDoc(resume.id);else render();

if(import.meta.env.DEV)window.__forms={docs,generate,signatureSlots,prepareSignature};
