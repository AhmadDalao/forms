import {notificationBell,mountNotificationBell} from './portal/notification-bell.js';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/latin-400.css';
import './style.css';
import {siteHeader} from './branding.js';
import {authChangeKey,api as portalApi,errorText as portalError,setLanguage as setPortalLanguage,language as portalLanguage} from './portal/api.js';
import {submitForm} from './portal/submit.js';
import {reviewEnabled,formSaveLabel,toolModeNotice} from './portal/workflow.js';
import {signingNotice,showSigningGuide} from './portal/signing.js';
import {formSession as client,checkAccountAccess} from './portal/access.js';
import {createSubscriptionEditor} from './subscription/editor.js';
import {docs as builtInDocs} from './forms/index.js';
import {loadCatalogue} from './management/catalogue.js';
const {docs, cards:managedCards}=await loadCatalogue(builtInDocs);
import {catalogueFor} from './catalogue.js';
import {hasValue} from './schema.js';
import {appRoot,audience,visibleIn} from './routes.js';
import {createDraftStore,DRAFT_PREFIX} from './drafts.js';
import {createSharedSync} from './shared-sync.js';
import {personNameFieldVisible,personNameGroups} from './person-names.js';
import {parseNumber} from './numbers.js';
import {signatureSlots,sectionSignatureSlots,prepareSignature,submissionSigningState,requiredSignatureSlots} from './signatures.js';
import {generate,original,loadPreview,renderPage,templateUrl,fieldValue} from './pdf.js';

const app=document.querySelector('#app');
const pageParams=new URLSearchParams(location.search),revisionId=pageParams.get('submission');
const drafts=createDraftStore(docs,undefined,audience,client.user?.id,revisionId);
let sharedReady=false;
const sharedSync=client.user&&audience?createSharedSync({account:client.user.id,audience,drafts,api:(action,body,options={})=>portalApi(action,body,{...options,token:client.csrf}),onChange:()=>{if(sharedReady)sharedProfileChanged();},onStatus:()=>{if(sharedReady)sharedStatus();}}):null;
await sharedSync?.start();
const initializeShared=!sharedSync||sharedSync.state.canInitialize;
if(initializeShared&&client.user&&audience==='individual'&&Object.keys(drafts.profile).every(key=>key==='country')){
 const parts=client.user.name.trim().split(/\s+/),first=parts.shift(),last=parts.length?parts.pop():'',second=parts.shift()||'',third=parts.join(' '),language=/\p{Script=Arabic}/u.test(client.user.name)?'ar':'en';
 drafts.setShared({...drafts.profile,[language+'_first']:first,[language+'_second']:second,[language+'_third']:third,[language+'_last']:last,name_language:language,mobile:client.user.phone,...(client.user.email?{email:client.user.email}:{})});
}
let stopHeaderNotifications=()=>{};
let subscriptionEditor=null;
let manualGuideShown=false;
const signingState=()=>submissionSigningState(current,values,signatures,drafts.get(current.id).signatureModes);
function manualSigningGuide(force=false,downloaded=false){
 if(!reviewEnabled()||!signingState().manual||(!force&&manualGuideShown))return;
 manualGuideShown=true;showSigningGuide({doc:current,lang,onDownload:!downloaded&&pdfBytes?download:null});
}
let lang=['en','ar'].includes(pageParams.get('lang'))?pageParams.get('lang'):drafts.preferences.lang||portalLanguage();
if(initializeShared){drafts.initializeSharedCountries(lang);sharedSync?.change(drafts.profile);}
let current=null,step=0,values={},signatures={},signatureMessages={},pageNumber=1,pdf=null,pdfBytes=null,review=false,busy=false,errors=[],generation=0,downloadFile=null,previewVisible=false;

const t=(en,ar)=>lang==='ar'?(ar||en):(en||ar);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',arrow:'<path d="m9 5 7 7-7 7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',back:'<path d="m15 5-7 7 7 7"/>',check:'<path d="m5 12 4 4L19 6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'})[name]||''}</svg>`;
function bilingual(en,ar,inline=false){
 const bits=[en?`<bdi lang="en" dir="ltr">${e(en)}</bdi>`:'',ar?`<bdi lang="ar" dir="rtl">${e(ar)}</bdi>`:''].filter(Boolean);
 if(lang==='ar'&&bits.length===2)bits.reverse();
 return `<span class="bilingual ${inline?'inline':''}">${bits.join(inline?'<span class="language-divider" aria-hidden="true"> / </span>':'')}</span>`;
}
function sharedStatusHTML(){
 return `<div class="shared-save-summary"><small data-shared-save-status role="status" aria-live="polite">${sharedSaveLabel()}</small></div><div class="shared-sync-notice" data-shared-sync-actions hidden></div>`;
}
function sharedSaveLabel(){
 if(!sharedSync)return saveLabel();
 const status=sharedSync.state.status;
 if(status==='saved')return drafts.available?t('Matching details saved in this browser and your account','البيانات المتطابقة محفوظة في هذا المتصفح وحسابك'):t('Matching details saved to your account — browser storage unavailable','البيانات المتطابقة محفوظة في حسابك — تخزين المتصفح غير متاح');
 if(status==='loading')return t('Loading shared account details…','جارٍ تحميل بيانات الحساب المشتركة…');
 if(status==='saving')return t('Saving shared details to account…','جارٍ حفظ البيانات المشتركة في الحساب…');
 if(status==='conflict')return t('Shared details changed on another device','تغيّرت البيانات المشتركة على جهاز آخر');
 return drafts.available?t('Offline — shared details saved in this browser','غير متصل — البيانات المشتركة محفوظة في هذا المتصفح'):t('Shared details are not saved — keep this tab open','البيانات المشتركة غير محفوظة — أبقِ هذه الصفحة مفتوحة');
}
function sharedStatus(){
 const status=sharedSync?.state.status;
 document.querySelectorAll('[data-shared-save-status]').forEach(node=>{node.textContent=sharedSaveLabel();node.classList.toggle('save-failed',['offline','conflict'].includes(status));});
 const actions=document.querySelector('[data-shared-sync-actions]');if(!actions)return;
 actions.hidden=!['offline','conflict'].includes(status);
 const markup=status==='conflict'?`<p>${t('Choose which shared details to keep. Your saved PDFs and archived versions stay unchanged.','اختر البيانات المشتركة التي تريد الاحتفاظ بها. تبقى ملفات PDF المحفوظة والنسخ المؤرشفة دون تغيير.')}</p><div><button type="button" class="button secondary" data-shared-resolve="remote">${t('Use account details','استخدام بيانات الحساب')}</button><button type="button" class="button secondary" data-shared-resolve="local">${t('Keep my browser details','الاحتفاظ ببيانات هذا المتصفح')}</button></div>`:status==='offline'?`<p>${t('Account saving is unavailable. Retry to save your shared details to your account.','الحفظ في الحساب غير متاح. أعد المحاولة لحفظ بياناتك المشتركة في الحساب.')}</p><button type="button" class="button secondary" data-shared-retry>${t('Retry account save','إعادة محاولة الحفظ في الحساب')}</button>`:'';
 if(actions.innerHTML!==markup)actions.innerHTML=markup;
 const retry=actions.querySelector('[data-shared-retry]');if(retry)retry.onclick=()=>sharedSync.retry();
 actions.querySelectorAll('[data-shared-resolve]').forEach(button=>button.onclick=()=>sharedSync.resolve(button.dataset.sharedResolve));
}
function sharedProfileChanged(){
 if(subscriptionEditor){subscriptionEditor.refresh();sharedStatus();return;}
 if(current){
  const wasReview=review;
  clearDownload();pdfBytes=null;errors=[];review=false;generation++;paintVersion++;
  if(pdf){pdf.loadingTask.destroy();pdf=null;}
  values={...drafts.get(current.id).values};signatures={...drafts.get(current.id).signatures};
  if(wasReview){previewVisible=false;renderEditor();}
  else{updateVisibleAnswers();updateSectionProgress();}
 }else render();
 storageStatus();sharedStatus();
}
function updateVisibleAnswers(){
 // Keep active controls mounted so delayed account saves cannot move the caret.
 document.querySelectorAll('#fields [name]').forEach(input=>{
  if(input===document.activeElement)return;
  const value=values[input.name]??'';
  if(input.type==='radio'||input.type==='checkbox')input.checked=Array.isArray(value)?value.includes(input.value):value===input.value;
  else if(input.value!==String(value))input.value=value;
 });
 const counter=document.querySelector('#answered-count');
 if(counter&&current)counter.textContent=`${answerFields(current.fields).filter(f=>hasValue(values[f.id])).length} ${t('answers entered','إجابة مُدخلة')}`;
}
function syncFormDetails(){sharedSync?.change(drafts.profile);sharedStatus();}
function bindClearChoices(){document.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{delete values[button.dataset.clear];clearDownload();pdfBytes=null;saveDraft(button.dataset.clear);renderEditor();});}

function accountLink(){const next=audience==='individual'?'individuals':audience==='corporate'?'companies':null;return `<a class="site-header-link client-account-link" href="${appRoot}${client.user?'my-applications/':'login/?'+new URLSearchParams({...(next?{next,resume:'1'}:{}),lang})}">${client.user?t('My applications','طلباتي'):t('Sign in / Register','دخول / إنشاء حساب')}</a>`;}
function header(){return siteHeader({lang,className:'header branded-header',brandHref:appRoot,homeAction:true,actions:`${accountLink()}${client.user?notificationBell(lang):''}<button type="button" class="site-header-language" id="language" lang="${lang==='en'?'ar':'en'}">${lang==='en'?'العربية':'English'}</button>`});}
function saveLabel(){return drafts.available?t('Saved on this browser','محفوظ في هذا المتصفح'):t('Not saved — browser storage is unavailable','لم يتم الحفظ — تخزين المتصفح غير متاح');}
function footer(){return `${sharedStatusHTML()}<footer>${icon('lock',15)} <span data-storage-note>${drafts.available?t('Drafts are saved on this browser so you can return later. Use Clear form or Clear all saved forms to remove them.','تُحفظ المسودات في هذا المتصفح لتعود إليها لاحقًا. استخدم «مسح النموذج» أو «مسح جميع النماذج المحفوظة» لحذفها.'):t('Browser saving is unavailable. Keep this tab open or download your PDF before leaving.','الحفظ في المتصفح غير متاح. أبقِ الصفحة مفتوحة أو نزّل المستند قبل المغادرة.')}</span></footer>`;}
function storageStatus(){document.querySelectorAll('[data-save-status]').forEach(el=>{el.textContent=saveLabel();el.classList.toggle('save-failed',!drafts.available);});const note=document.querySelector('[data-storage-note]');if(note){const wrapper=document.createElement('div');wrapper.innerHTML=footer();note.textContent=wrapper.querySelector('[data-storage-note]').textContent;}sharedStatus();}
function saveDraft(editedField=null){if(subscriptionEditor){subscriptionEditor.save(editedField);return;}if(current){drafts.save(current.id,values,step,signatures,editedField);values={...drafts.get(current.id).values};if(editedField)syncFormDetails();}storageStatus();updateSectionProgress();}
function blankLink(d,classes='button secondary'){return `<a class="${classes}" data-blank="${d.id}" href="${templateUrl(d)}" download="${d.id}-blank.pdf">${icon('download',16)}${t('Download blank','تنزيل النموذج الفارغ')}</a>`;}
function setLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';}
function bindCommon(){
 sharedStatus();
 stopHeaderNotifications();stopHeaderNotifications=client.user?mountNotificationBell(document.querySelector('[data-notification-bell]'),{lang,userId:client.user.id}):()=>{};
 const revision=current&&drafts.get(current.id).revision;
 if(revision){
  const banner=document.createElement('aside');banner.className='revision-banner';
  banner.innerHTML=`<div><b>${t('Editing submitted version','تعديل النسخة المرسلة')} ${revision.version}</b><p>${t('Your original stays saved. Review and submit to create a new version.','تبقى النسخة الأصلية محفوظة. راجع المستند وأرسله لإنشاء نسخة جديدة.')}</p>${revision.legacySignatures?`<p>${t('If the original PDF contains a signature, upload it again before resubmitting.','إذا كانت النسخة الأصلية تحتوي على توقيع، أعد رفع صورته قبل الإرسال.')}</p>`:''}</div><a href="${appRoot}my-applications/">${t('Back to my applications','العودة إلى طلباتي')}</a>`;
  document.querySelector('main')?.prepend(banner);
 }
 document.querySelector('#language').onclick=()=>{lang=lang==='en'?'ar':'en';setPortalLanguage(lang);signatureMessages={};drafts.setPreferences({lang});render();};document.querySelector('[data-home]').onclick=ev=>{ev.preventDefault();home();};}
function home(){if(revisionId){location.href=appRoot+(audience==='corporate'?'companies/':'individuals/');return;}clearDownload();generation++;if(current)saveDraft();if(subscriptionEditor){subscriptionEditor.destroy();subscriptionEditor=null;}drafts.setPreferences({active:null});current=null;review=false;pdfBytes=null;errors=[];paintVersion++;if(pdf){pdf.loadingTask.destroy();pdf=null;}render();window.scrollTo(0,0);}
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
 app.innerHTML=header()+`<main class="home"><div class="intro"><span class="eyebrow">${t('DOCUMENT CENTRE','مركز المستندات')}</span><h1>${audience?t(audience==='individual'?'Individual forms':'Company forms',audience==='individual'?'نماذج الأفراد':'نماذج الشركات'):t('Your forms. Ready to sign.','نماذجك، جاهزة للتوقيع.')}</h1><p>${t('Choose a document, fill in your details, then download your PDF.','اختر المستند، أدخل بياناتك، ثم نزّل ملفك بصيغة PDF.')}</p><div class="flow"><span><b>1</b>${t('Choose','اختر')}</span><i></i><span><b>2</b>${t('Fill & review','عبّئ وراجع')}</span><i></i><span><b>3</b>${reviewEnabled()?t('Download & sign','نزّل ووقّع'):t('Save or download','احفظ أو نزّل')}</span></div></div><div class="saved-controls"><span data-save-status>${saveLabel()}</span><button class="ghost" id="clear-all">${t('Clear all saved forms','مسح جميع النماذج المحفوظة')}</button></div><div class="catalogue"><div class="cards">${catalogueFor(docs,audience,managedCards).map(cardHTML).join('')}</div></div><aside class="home-note">${icon('file',22)}<div><b>${t('Original documents. Your details.','المستندات الأصلية، ببياناتك.')}</b><p><span data-workflow-home-note>${reviewEnabled()?t('The original layout is preserved. Add electronic signatures to submit online, or download, sign and upload the signed PDF from My applications.','يُحفظ تنسيق المستند الأصلي. أضف التوقيعات الإلكترونية للإرسال المباشر، أو نزّل ملف PDF ووقّعه ثم ارفعه من صفحة طلباتي.'):t('Fill your forms, save a copy to your account, or download them. Signing is optional; management review is switched off.','عبّئ نماذجك واحفظ نسخة في حسابك أو نزّلها. التوقيع اختياري والمراجعة الإدارية معطّلة.')}</span></p></div></aside></main>`+footer()+`<dialog id="clear-all-dialog"><h2>${t('Clear all saved forms?','مسح جميع النماذج المحفوظة؟')}</h2><p>${t('This removes shared fields, drafts and signatures in this folder only. The other folder is kept. Download any PDFs you want to keep first.','ستُحذف الحقول المشتركة والمسودات والتوقيعات في هذا المجلد فقط. يُحتفظ بالمجلد الآخر. نزّل المستندات التي تريد الاحتفاظ بها أولًا.')}</p><div class="dialog-actions"><button class="button secondary" id="clear-all-cancel">${t('Keep drafts','الاحتفاظ بالمسودات')}</button><button class="button primary" id="clear-all-confirm">${t('Clear all','مسح الكل')}</button></div></dialog>`;
 bindCommon();document.querySelectorAll('[data-restore-legacy]').forEach(button=>button.onclick=()=>{drafts.restoreLegacy(button.dataset.restoreLegacy);selectDoc(button.dataset.restoreLegacy);});document.querySelector('#clear-all').onclick=()=>document.querySelector('#clear-all-dialog').showModal();document.querySelector('#clear-all-cancel').onclick=()=>document.querySelector('#clear-all-dialog').close();document.querySelector('#clear-all-confirm').onclick=()=>{drafts.clearAll();sharedSync?.change(drafts.profile);render();};document.querySelectorAll('[data-doc]').forEach(btn=>btn.onclick=()=>selectDoc(btn.dataset.doc));
}
async function selectDoc(id){if(!docs.some(d=>d.id===id&&visibleIn(d,audience)))return;previewVisible=false;clearDownload();paintVersion++;if(pdf)pdf.loadingTask.destroy();current=docs.find(d=>d.id===id);manualGuideShown=false;drafts.initializeDates(id);drafts.initializeCountries(id,lang);values={...drafts.get(id).values};signatures={...drafts.get(id).signatures};signatureMessages={};step=drafts.has(id)?drafts.get(id).step:0;pageNumber=current.sections[step].page;drafts.setPreferences({active:id,lang});review=false;pdfBytes=null;errors=[];pdf=null;render();window.scrollTo(0,0);await showOriginal();}
async function showOriginal(){if(!current||!previewVisible)return;const g=++generation,d=current;try{const loaded=await loadPreview(await original(d));if(g!==generation){loaded.loadingTask.destroy();return;}if(pdf)pdf.loadingTask.destroy();pdf=loaded;await paint();}catch(err){if(g===generation)showStatus(t('Unable to load the PDF. Check your connection and retry.','تعذّر تحميل المستند. تحقق من اتصالك وأعد المحاولة.'),true);}}
function signatureHTML(section){
 const slots=sectionSignatureSlots(current,section),modes=drafts.get(current.id).signatureModes||{};
 if(!slots.length)return '';
 return `<div class="section-signatures">${slots.map(slot=>{
  const mode=modes[slot.id]||'manual',fileId='signature-file-'+slot.id;
  return `<fieldset class="sub-signature field wide" data-signature-slot="${e(slot.id)}"><legend>${e(t(slot.label,slot.ar))}</legend><div class="signature-methods">${[['electronic','Electronic signature','توقيع إلكتروني'],['manual','Manual signature','توقيع يدوي']].map(([value,en,ar])=>`<label class="sub-option ${mode===value?'selected':''}"><input type="radio" name="signature-mode-${e(slot.id)}" data-signature-mode="${e(slot.id)}" value="${value}" ${mode===value?'checked':''}><span>${t(en,ar)}</span></label>`).join('')}</div>${mode==='electronic'?`<div class="sub-upload"><button type="button" class="button secondary" data-signature-choose="${e(slot.id)}">${signatures[slot.id]?t('Replace signature image','استبدال صورة التوقيع'):t('Upload signature image','تحميل صورة التوقيع')}</button><input id="${e(fileId)}" data-signature-file="${e(slot.id)}" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden aria-label="${e(t(slot.label,slot.ar))}"><small>${t('PNG or JPG, up to 5 MB. White backgrounds are removed.','PNG أو JPG، حتى ٥ ميغابايت. تُزال الخلفية البيضاء.')}</small>${signatures[slot.id]?`<img src="${signatures[slot.id]}" alt="${e(t('Uploaded signature','التوقيع المرفوع'))}"><button type="button" class="ghost" data-signature-remove="${e(slot.id)}">${t('Remove signature','إزالة التوقيع')}</button>`:''}</div>`:`<p class="sub-help">${t('The signature area stays empty so you can sign after downloading or printing.','تُترك خانة التوقيع فارغة لتوقّع بعد التنزيل أو الطباعة.')}</p>`}<p class="signature-feedback" data-signature-feedback="${e(slot.id)}" role="status" aria-live="polite">${e(signatureMessages[slot.id]||'')}</p></fieldset>`;
 }).join('')}</div>`;
}
function bindSignatures(){
 document.querySelectorAll('[data-signature-mode]').forEach(input=>input.onchange=()=>{
  if(busy)return;const slot=signatureSlots(current).find(s=>s.id===input.dataset.signatureMode);
  drafts.setSignatureMode(current.id,slot.id,input.value);signatures={...drafts.get(current.id).signatures};delete signatureMessages[slot.id];signatureChanged(slot.page);
  document.querySelector(`[data-signature-mode="${slot.id}"][value="${input.value}"]`)?.focus({preventScroll:true});
 });
 document.querySelectorAll('[data-signature-choose]').forEach(button=>button.onclick=()=>{if(!busy)document.getElementById('signature-file-'+button.dataset.signatureChoose).click();});
 document.querySelectorAll('[data-signature-file]').forEach(input=>input.onchange=uploadSignature);
 document.querySelectorAll('[data-signature-remove]').forEach(button=>button.onclick=()=>{
  if(busy)return;const slot=signatureSlots(current).find(s=>s.id===button.dataset.signatureRemove);
  delete signatures[slot.id];signatureMessages[slot.id]=t('Signature removed. Upload another image or choose manual signature.','تمت إزالة التوقيع. ارفع صورة أخرى أو اختر التوقيع اليدوي.');signatureChanged(slot.page);
 });
}
function signatureChanged(page){
 clearDownload();pdfBytes=null;review=false;pageNumber=page;paintVersion++;
 if(pdf){pdf.loadingTask.destroy();pdf=null;}
 saveDraft();renderEditor();showOriginal();
}
async function uploadSignature(ev){
 const file=ev.target.files?.[0],slot=signatureSlots(current).find(s=>s.id===ev.target.dataset.signatureFile);
 ev.target.value='';if(!file||!slot||busy)return;
 const token=++generation;busy=true;setBusy(true);
 document.querySelector(`[data-signature-feedback="${slot.id}"]`).textContent=t('Preparing signature…','جارٍ تجهيز التوقيع…');
 try{
  const image=await prepareSignature(file);if(token!==generation)return;
  signatures[slot.id]=image;signatureMessages[slot.id]=t('Signature added. Review the PDF to check its placement.','تمت إضافة التوقيع. راجع المستند للتحقق من موضعه.');
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
  signatureMessages[slot.id]=t(...(messages[error.message]||messages.decode));document.querySelector(`[data-signature-feedback="${slot.id}"]`).textContent=signatureMessages[slot.id];
 }finally{busy=false;setBusy(false);}
}
function answerFields(fields){return fields.filter(f=>!f.sum&&personNameFieldVisible(f,audience));}
function fieldHTML(f){
 if(!personNameFieldVisible(f,audience))return '';
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
 return `<${f.type==='choice'?'fieldset':'div'} class="field ${wide?'wide':''} ${f.type==='choice'?'choice':''} ${errors.includes(f.id)?'invalid':''}" data-field="${f.id}">${f.type==='choice'?`<legend>${context}${label}</legend>`:`<label for="f-${f.id}">${context}${label}</label>`}${input}${f.help?`<small class="field-help">${e(t(f.help,f.arHelp))}</small>`:''}${errors.includes(f.id)?`<p class="field-error">${t('This answer is too long for its space in the PDF. Please shorten it.','هذه الإجابة أطول من المساحة المتاحة في المستند. يرجى اختصارها.')}</p>`:''}</${f.type==='choice'?'fieldset':'div'}>`;
}
function fieldsHTML(section){
 const embedded=new Set(section.fields.flatMap(f=>Object.values(f.optionFields||{}).flat()));
 const names=new Map(personNameGroups(current,audience).map(group=>[group.id,group])),rendered=new Set();
 const controls=fields=>fields.filter(f=>personNameFieldVisible(f,audience)&&!embedded.has(f.id)).map(field=>{
  const group=field.personNamePart&&names.get(field.personNameGroup);if(!group)return fieldHTML(field);
  if(rendered.has(group.id))return '';rendered.add(group.id);
  const invalid=group.targets.some(target=>errors.includes(target.id)),context=group.context?`<span class="field-context">${e(t(group.context[0],group.context[1]))}</span>`:'';
  return `<fieldset class="field wide person-name-group ${invalid?'invalid':''}" data-person-name-group="${e(group.id)}"><legend>${context}<span class="field-label">${e(t(group.label,group.ar))}</span></legend><div class="field-grid name-row-grid">${group.partIds.map(id=>fieldHTML(section.fields.find(f=>f.id===id))).join('')}</div>${invalid?`<p class="field-error">${t('This name is too long for its space in the PDF. Please shorten it.','هذا الاسم أطول من المساحة المتاحة في المستند. يرجى اختصاره.')}</p>`:''}</fieldset>`;
 }).join('');
 if(!section.paperGroups)return `<div class="field-grid">${controls(section.fields)}</div>`;
 return section.paperGroups.map(group=>`<section class="paper-group">${group.title?`<h3>${e(t(group.title,group.ar))}</h3>`:''}<div class="field-grid ${group.nameRow?'name-row-grid':group.paired?'paired-grid':''}">${controls(group.fields.map(id=>section.fields.find(f=>f.id===id)))}</div></section>`).join('');
}
function editingSectionHTML(){const s=current.sections[step];return `<div class="section-heading"><span class="eyebrow">${t('SECTION','القسم')} ${step+1} / ${current.sections.length}</span><div class="section-title-row"><h2>${e(t(s.title,s.ar))}</h2></div>${s.note?`<p>${e(t(s.note,s.arNote||s.note))}</p>`:''}${(s.paperNotes||[]).map(([en,ar])=>`<p class="paper-note">${e(t(en,ar))}</p>`).join('')}</div><form id="fields" novalidate>${fieldsHTML(s)}</form>${signatureHTML(s)}<div class="section-actions"><button class="button secondary" id="previous" ${step===0?'disabled':''}>${t('Back','السابق')}</button><button class="button primary" id="next">${step===current.sections.length-1?t('Review PDF','مراجعة المستند'):t('Continue','متابعة')}${icon('arrow',16)}</button></div>`;}
function downloadSectionHTML(){return `<button class="button secondary full-width" id="download-section">${icon('download',17)}${t('Download with current answers','تنزيل بالإجابات الحالية')}</button>`;}
function bindSectionControls(){
 document.querySelector('[data-signing-guide]')?.addEventListener('click',()=>manualSigningGuide(true));
 bindSignatures();

 document.querySelector('#download-section')?.addEventListener('click',()=>makeReview(true));
 if(!review){document.querySelector('#previous').onclick=()=>goStep(step-1);document.querySelector('#next').onclick=()=>step===current.sections.length-1?makeReview():goStep(step+1);document.querySelector('#fields').oninput=onInput;document.querySelector('#fields').onsubmit=ev=>ev.preventDefault();bindClearChoices();}
 else {document.querySelector('#download').onclick=download;document.querySelector('#submit-form').onclick=()=>submitForm({doc:current,values:{...values},bytes:pdfBytes,signatures:{...signatures},signatureModes:{...drafts.get(current.id).signatureModes},revision:drafts.get(current.id).revision,onSaved:s=>drafts.submitted(current.id,s),profile:drafts.profile,audience,lang,user:client.user});document.querySelector('#edit-again').onclick=()=>goStep(0);document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>goStep(Number(b.dataset.jump)));}
}
function sectionProgressHTML(section){
 const fields=answerFields(section.fields);
 if(fields.length)return `<bdi dir="ltr">${fields.filter(f=>hasValue(values[f.id])).length}/${fields.length}</bdi> <span>${t('answered','إجابة')}</span>`;
 const slots=sectionSignatureSlots(current,section),modes=drafts.get(current.id).signatureModes||{};
 if(slots.length){
  const electronic=slots.filter(slot=>modes[slot.id]==='electronic');
  return electronic.some(slot=>!signatures[slot.id])?t('Upload signature','تحميل التوقيع'):electronic.length?t('Signature added','تمت إضافة التوقيع'):t('Manual signing','توقيع يدوي');
 }
 return t('Document page','صفحة المستند');
}
function sectionNavigationHTML(){
 return `<nav class="sections" aria-label="${t('Form sections','أقسام النموذج')}">${current.sections.map((section,i)=>`<button type="button" class="section-tab ${i===step&&!review?'active':''}" data-step="${i}" aria-current="${i===step&&!review?'step':'false'}"><span class="section-number" aria-hidden="true">${i+1}</span><span class="section-copy"><span class="section-label">${e(t(section.title,section.ar))}</span><span class="step-progress" data-step-progress="${i}">${sectionProgressHTML(section)}</span></span></button>`).join('')}<button type="button" class="section-tab ${review?'active':''}" id="review-tab" aria-current="${review?'step':'false'}"><span class="section-number" aria-hidden="true">${current.sections.length+1}</span><span class="section-copy"><span class="section-label">${t('Review','المراجعة')}</span><span class="step-progress">${t('Preview PDF','معاينة المستند')}</span></span></button></nav>`;
}
function updateSectionProgress(){
 if(!current||current.workflow==='subscription')return;
 current.sections.forEach((section,i)=>{const node=document.querySelector(`[data-step-progress="${i}"]`);if(node)node.innerHTML=sectionProgressHTML(section);});
}
function renderEditor(){
 if(current.workflow==='subscription'){
  if(!subscriptionEditor)subscriptionEditor=createSubscriptionEditor({root:app,doc:current,drafts,audience,header,footer,bindCommon,home,submit:(doc,values,bytes,signatures)=>submitForm({doc,values,bytes,signatures,signatureModes:{applicant:values.signature_mode},revision:drafts.get(doc.id).revision,onSaved:s=>drafts.submitted(doc.id,s),profile:drafts.profile,audience,lang,user:client.user}),onDetailsChange:syncFormDetails});
  subscriptionEditor.render(lang);return;
 }
 const active=answerFields(current.fields), completed=active.filter(f=>hasValue(values[f.id])).length;
 app.innerHTML=header()+`<main class="workspace"><div class="document-heading"><button class="back-link button secondary" id="back-home">${icon('back',17)}${t('Back to forms','العودة إلى النماذج')}</button><div class="document-title"><div><span class="eyebrow">${current.pages} ${t('PAGE DOCUMENT','صفحات')}</span><h1>${e(t(current.title,current.ar))}</h1></div><div class="document-actions"><button class="button secondary" id="toggle-preview" aria-expanded="${previewVisible}" aria-controls="document-preview">${icon('eye',17)}${previewVisible?t('Hide document','إخفاء المستند'):t('Show document','عرض المستند')}</button>${blankLink(current)}<button class="button primary" id="download-now" ${busy?'disabled':''}>${icon('download',17)}${t('Download PDF','تنزيل PDF')}</button></div></div><div id="download-result" class="download-result" role="status" aria-live="polite" hidden></div><div id="status" class="status" role="status" aria-live="polite"></div></div><div class="editor-layout ${previewVisible?'with-preview':''}"><div class="form-panel">${sectionNavigationHTML()}<div id="fields-content">${review?reviewHTML(active,completed):editingSectionHTML()}</div><div class="download-from-step">${!review?downloadSectionHTML():''}</div><div class="form-bottom"><div><span id="answered-count">${completed} ${t('answers entered','إجابة مُدخلة')}</span><small data-save-status>${saveLabel()}</small></div><button class="ghost" id="reset">${t('Clear form','مسح النموذج')}</button></div></div><aside class="preview-panel" id="document-preview" ${previewVisible?'':'hidden'}><div class="preview-toolbar"><div><span class="preview-dot ${review?'ready':''}"></span><b>${review?t('Your completed PDF','المستند بعد التعبئة'):t('Original document','المستند الأصلي')}</b></div><span class="page-controls"><button class="icon-button" id="page-prev" aria-label="${t('Previous page','الصفحة السابقة')}">${icon('back',16)}</button><span id="page-label">${pageNumber} / ${current.pages}</span><button class="icon-button" id="page-next" aria-label="${t('Next page','الصفحة التالية')}">${icon('arrow',16)}</button></span></div><div class="paper-wrap"><canvas id="pdf-canvas" aria-label="${t('PDF page preview','معاينة صفحة المستند')}"></canvas><div id="loading" class="loading">${t('Loading document…','جارٍ تحميل المستند…')}</div></div><p class="preview-caption">${review?t('This preview is the exact PDF you will download.','هذه المعاينة هي نفس ملف PDF الذي ستنزّله.'):t('Your answers are added when you select Review PDF.','تُضاف إجاباتك عند اختيار «مراجعة المستند».')}</p></aside></div></main>`+footer()+`<dialog id="reset-dialog"><h2>${t('Clear this form?','مسح هذا النموذج؟')}</h2><p>${t('This removes this form’s answers, signature images and saved draft from this browser.','ستُحذف إجابات هذا النموذج وصور التوقيع ومسودته المحفوظة من هذا المتصفح.')}</p><div class="dialog-actions"><button class="button secondary" id="reset-cancel">${t('Keep editing','متابعة التعبئة')}</button><button class="button primary" id="reset-confirm">${t('Clear answers','مسح الإجابات')}</button></div></dialog>`;
 bindCommon();document.querySelector('#back-home').onclick=home;
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>goStep(Number(b.dataset.step)));
 document.querySelector('#review-tab').onclick=()=>makeReview();
 document.querySelector('#download-now').onclick=()=>makeReview(true);
 document.querySelector('#toggle-preview').onclick=()=>{previewVisible=!previewVisible;renderEditor();if(previewVisible&&!pdf)showOriginal();};
 document.querySelector('#page-prev').onclick=()=>changePage(-1);document.querySelector('#page-next').onclick=()=>changePage(1);
 document.querySelector('#reset').onclick=()=>document.querySelector('#reset-dialog').showModal();document.querySelector('#reset-cancel').onclick=()=>document.querySelector('#reset-dialog').close();document.querySelector('#reset-confirm').onclick=()=>{clearDownload();generation++;paintVersion++;values={};signatures={};signatureMessages={};drafts.clear(current.id);drafts.initializeDates(current.id);drafts.initializeCountries(current.id,lang);values={...drafts.get(current.id).values};review=false;pdfBytes=null;step=0;pageNumber=current.sections[0].page;render();showOriginal();};
 bindSectionControls();
 renderDownloadResult();if(pdf)paint();if(busy)setBusy(true);
}
function reviewHTML(active,completed){const blank=active.length-completed;const totals=['ideal','current'].map(key=>{const fs=active.filter(f=>f.total===key);if(!fs.some(f=>hasValue(values[f.id])))return '';const entries=fs.filter(f=>hasValue(values[f.id])).map(f=>parseNumber(values[f.id]));if(entries.some(v=>v===null||v<0||v>100))return `<p class="warning">${t('Enter percentages between 0 and 100 for the','أدخل نسبًا من ٠ إلى ١٠٠ في')} ${t(key==='ideal'?'ideal portfolio.':'current portfolio.',key==='ideal'?'المحفظة المثالية.':'المحفظة الحالية.')}</p>`;const sum=Math.round(entries.reduce((a,b)=>a+b,0)*100)/100;return Math.abs(sum-100)<.01?'':`<p class="warning">${t(key==='ideal'?'Ideal portfolio':'Current portfolio',key==='ideal'?'المحفظة المثالية':'المحفظة الحالية')}: ${sum}%. ${t('The printed form asks for a total of 100%.','يتطلب النموذج أن يكون المجموع ١٠٠٪.')}</p>`;}).join('');return `<div class="section-heading"><span class="eyebrow">${t('FINAL STEP','الخطوة الأخيرة')}</span><h2>${t('Review, then make it yours.','راجع المستند ثم نزّله.')}</h2><p>${t('Check your details in the PDF before downloading.','تحقق من بياناتك في المستند قبل التنزيل.')}</p></div><div class="review-summary"><span class="summary-icon">${icon('check',25)}</span><div><strong>${completed} ${t('answers added','إجابة مضافة')}</strong><p>${current.pages} ${t('original pages preserved','صفحات أصلية محفوظة')}</p></div></div>${blank?`<div class="notice"><b>${blank} ${t('fields left blank','حقلًا فارغًا')}</b><p>${t('Leave any fields that do not apply to you blank. All entered answers are included in your download.','اترك الحقول التي لا تنطبق عليك فارغة. ستظهر جميع الإجابات المُدخلة في الملف الذي تنزّله.')}</p></div>`:''}${totals}<div class="review-sections">${current.sections.map((s,i)=>{const fs=answerFields(s.fields);return `<button data-jump="${i}"><span>${e(t(s.title,s.ar))}</span><small>${fs.filter(f=>hasValue(values[f.id])).length}/${fs.length}</small>${icon('arrow',14)}</button>`;}).join('')}</div><div class="sign-note">${icon('file',20)}<p>${t('Choose electronic or manual signing in the relevant signing step. Manual signature areas stay blank. Signing pages:','اختر التوقيع الإلكتروني أو اليدوي في خطوة التوقيع الخاصة به. تُترك خانات التوقيع اليدوي فارغة. صفحات التوقيع:')} <b>${current.signing.join(', ')}</b>. ${current.custom||current.sections.some(s=>s.id==='staff')?'':t('Company-use sections remain blank.','تُترك أقسام استخدام الشركة فارغة.')}</p></div>${reviewEnabled()?signingNotice(signingState(),lang):toolModeNotice(lang)}<button id="download" class="button ${signingState().ready?'secondary':'primary'} download-button" ${pdfBytes?'':'disabled'}>${icon('download',20)}${t('Download PDF','تنزيل PDF')}</button><button id="submit-form" class="button primary download-button" ${pdfBytes&&(!reviewEnabled()||signingState().ready)?'':'disabled'}>${formSaveLabel(lang)}</button><button id="edit-again" class="button secondary full-width">${t('Back to editing','العودة للتعبئة')}</button>`;}
function onInput(ev){const target=ev.target,f=current.fields.find(f=>f.id===target.name);if(!f)return;clearDownload();if(f.multiple&&f.type==='choice')values[f.id]=Array.from(document.querySelectorAll(`input[name="${f.id}"]:checked`),el=>el.value);else values[f.id]=target.value;pdfBytes=null;errors=errors.filter(id=>id!==f.id);saveDraft(f.id);updateVisibleAnswers();if(f.type==='choice'){document.querySelector('#fields').innerHTML=fieldsHTML(current.sections[step]);bindClearChoices();}for(const f of current.sections[step].fields){const wrapper=document.querySelector(`[data-field="${f.id}"]`);if(f.sum&&wrapper)wrapper.querySelector('strong').textContent=fieldValue(f,values)||'—';}document.querySelector('#answered-count').textContent=`${answerFields(current.fields).filter(f=>hasValue(values[f.id])).length} ${t('answers entered','إجابة مُدخلة')}`;}
function goStep(i){if(busy||i<0||i>=current.sections.length)return;const wasReview=review;review=false;if(wasReview){previewVisible=false;paintVersion++;if(pdf){pdf.loadingTask.destroy();pdf=null;}}step=i;saveDraft();pageNumber=current.sections[i].page;render();document.querySelector('.form-panel').scrollIntoView({behavior:'smooth',block:'start'});if(wasReview)showOriginal();}
function showStatus(msg,error=false){const el=document.querySelector('#status');if(el){el.textContent=msg;el.className=error?'status error':'status';}}
async function makeReview(downloadNow=false,previewPage=null){
 if(busy)return;
 const missing=signatureSlots(current).filter(slot=>drafts.get(current.id).signatureModes?.[slot.id]==='electronic'&&!signatures[slot.id]);
 if(missing.length){
  for(const slot of missing)signatureMessages[slot.id]=t('Upload a signature image or choose manual signature.','حمّل صورة التوقيع أو اختر التوقيع اليدوي.');
  const index=current.sections.findIndex(s=>sectionSignatureSlots(current,s).some(slot=>slot.id===missing[0].id));
  if(index>=0)goStep(index);
  document.querySelector(`[data-signature-choose="${missing[0].id}"]`)?.focus();return;
 }
 if(downloadNow&&review&&pdfBytes){download();return;}
 busy=true;const token=++generation,doc=current,snapshot=structuredClone(values),signatureSnapshot={...signatures};saveDraft();
 showStatus(t('Preparing your PDF…','جارٍ إعداد المستند…'));setBusy(true);
 try{
  const filled=doc.fields.some(f=>hasValue(fieldValue(f,snapshot)))||Object.keys(signatureSnapshot).length>0;
  const bytes=filled?await generate(doc,snapshot,signatureSnapshot):await original(doc);
  if(token!==generation)return;
  if(downloadNow){savePDF(bytes,`${doc.id}-${filled?'filled':'blank'}.pdf`);manualSigningGuide(false,true);if(!pdf)showOriginal();showStatus(t('Your PDF is ready. Use Save PDF above if it did not save automatically.','ملفك جاهز. استخدم «حفظ PDF» أعلاه إذا لم يُحفظ تلقائيًا.'));return;}
  const loaded=await loadPreview(bytes);
  if(token!==generation){loaded.loadingTask.destroy();return;}
  if(pdf)pdf.loadingTask.destroy();pdf=loaded;pdfBytes=bytes;review=true;previewVisible=true;pageNumber=previewPage||doc.sections[step].page;errors=[];render();document.querySelector('.workspace').scrollIntoView({behavior:'smooth'});manualSigningGuide();
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
function setBusy(value){document.querySelectorAll('#next,#review-tab,#download,#submit-form,#download-now,#download-section,#toggle-preview,#fields input,#fields textarea,#fields select,[data-clear],.section-signatures button,.section-signatures input,#language,[data-step]').forEach(b=>b.disabled=value);const submit=document.querySelector('#submit-form');if(submit)submit.disabled=value||!pdfBytes||(reviewEnabled()&&!signingState().ready);const download=document.querySelector('#download');if(download)download.disabled=value||!pdfBytes;}
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
function download(){if(pdfBytes){savePDF(pdfBytes,`${current.id}-filled.pdf`);manualSigningGuide(false,true);}}
window.addEventListener('beforeunload',ev=>{if(!drafts.available&&(Object.keys(drafts.profile).length||docs.some(d=>drafts.has(d.id)))){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('storage',ev=>{
 if(ev.key===authChangeKey){sharedSync?.dispose();location.reload();return;}
 if(sharedSync&&(ev.key===drafts.basePrefix+'shared-fields'||ev.key?.startsWith(drafts.basePrefix+'shared-sync')))return;
 if(ev.key!==null&&!ev.key.startsWith(drafts.prefix)&&ev.key!==drafts.basePrefix+'shared-fields'&&!['signature-form','terms-and-conditions'].some(id=>ev.key===DRAFT_PREFIX+id))return;
 drafts.refresh({preserveShared:Boolean(sharedSync)});
 if(subscriptionEditor){subscriptionEditor.refresh();return;}
 if(current&&(ev.key===null||ev.key===drafts.prefix+current.id||ev.key===drafts.prefix+'shared-fields')){
  clearDownload();generation++;paintVersion++;values={...drafts.get(current.id).values};signatures={...drafts.get(current.id).signatures};signatureMessages={};step=drafts.get(current.id).step;pageNumber=current.sections[step].page;review=false;pdfBytes=null;errors=[];render();showOriginal();
 }else if(!current)render();
});
let editing=null,editError=null;
if(revisionId){
 try{
  if(!client.user)throw Error('login_required');
  const {submission:s}=await portalApi('detail',undefined,{params:{id:revisionId}});
  editing=docs.find(d=>d.id===s.doc_id&&!d.downloadOnly&&visibleIn(d,audience));
  if(!editing||s.audience!==audience||s.source==='upload')throw Error('document_unavailable');
  drafts.loadSubmission(editing.id,s);
  if(pageParams.get('sign')==='1'){
   if(s.review_status==='signature_required')drafts.beginSignatureRequest(editing.id,s.review_revision);
   const saved=drafts.get(editing.id),required=requiredSignatureSlots(editing,saved.values),first=required.find(slot=>!saved.signatures[slot.id])||required[0];
   if(first){
    for(const slot of required)drafts.setSignatureMode(editing.id,slot.id,'electronic');
    const index=editing.workflow==='subscription'?editing.sections.findIndex(section=>section.id==='applicant'):editing.sections.findIndex(section=>sectionSignatureSlots(editing,section).some(slot=>slot.id===first.id));
    drafts.save(editing.id,{...saved.values,...(editing.workflow==='subscription'?{signature_mode:'electronic'}:{})},Math.max(0,index),saved.signatures);
   }
  }
 }catch(err){editError=err;}
}
sharedReady=true;
const resume=docs.find(d=>d.id===drafts.preferences.active&&drafts.has(d.id)&&visibleIn(d,audience));
if(editError){app.innerHTML=header()+`<main class="workspace"><p role="alert">${e(portalError(editError,lang))}</p><a class="button primary" href="${appRoot}my-applications/">${t('Back to my applications','العودة إلى طلباتي')}</a></main>`;bindCommon();}
else if(editing)selectDoc(editing.id);else if(resume)selectDoc(resume.id);else render();

if(import.meta.env.DEV)window.__forms={docs,generate,signatureSlots,prepareSignature};

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
window.addEventListener('focus',checkAccountAccess);
document.addEventListener('visibilitychange',checkAccountAccess);

window.addEventListener('forms-workflow-change',()=>{
 if(subscriptionEditor){subscriptionEditor.workflowChanged();return;}
 if(current&&review&&!busy)render();
 const note=document.querySelector('[data-workflow-home-note]');if(note)note.textContent=reviewEnabled()?t('Sign electronically to submit, or upload a signed PDF from My applications.','وقّع إلكترونيًا للإرسال أو ارفع ملف PDF الموقّع من طلباتي.'):t('Save or download your forms. Signing is optional; no management review is required.','احفظ نماذجك أو نزّلها. التوقيع اختياري ولا تُطلب مراجعة إدارية.');
});
