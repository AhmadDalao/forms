import {generate,loadPreview,renderPage,templateUrl} from '../pdf.js';
import {prepareSignature,submissionSigningState} from '../signatures.js';
import {signingNotice,showSigningGuide} from '../portal/signing.js';
import {normalizeSubscription,visibleFields,sectionProgress,missingRequired,arabicNameErrors} from './model.js';
import {rules,parseUnits,formatSubscriptionNumber} from './calculations.js';
import {personNameGroups} from '../person-names.js';
import './style.css';
import {reviewEnabled,formSaveLabel,toolModeNotice} from '../portal/workflow.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createSubscriptionEditor({root,doc,drafts,audience,header,footer,bindCommon,home,onDetailsChange=()=>{},submit}){
 const nameGroups=personNameGroups(doc,audience),applicantGroup=nameGroups.find(group=>group.id==='applicant_name');
 const applicantOverride=record=>record.overrides.includes('applicant_name')||applicantGroup?.partIds.some(id=>record.overrides.includes(id));
 let lang='en',record=drafts.get(doc.id),values,signatures={...record.signatures},step=record.step,review=false,busy=false,pdf=null,pdfBytes=null,downloadUrl=null,token=0,paintToken=0,disposed=false,errors=[],message='';
 let applicantEdited=applicantOverride(record),manualGuideShown=false;
 const signingState=()=>submissionSigningState(doc,values,signatures);
 function manualSigningGuide(force=false,downloaded=false){if(!reviewEnabled()||!signingState().manual||(!force&&manualGuideShown))return;manualGuideShown=true;showSigningGuide({doc,lang,onDownload:!downloaded&&pdfBytes?download:null});}
 const t=(en,ar)=>lang==='ar'?ar:en;
 const selectionIds=['subscription_type','payment_method'];
 const normalize=()=>{values=normalizeSubscription(doc,values,{applicantEdited});};
 function refresh(){record=drafts.get(doc.id);values={...record.values};signatures={...record.signatures};step=record.step;applicantEdited=applicantOverride(record);normalize();invalidate();}
 refresh();
 function save(edited=null){normalize();drafts.save(doc.id,values,step,signatures,edited);values={...drafts.get(doc.id).values};normalize();if(edited)onDetailsChange();}
 function invalidate(){token++;paintToken++;review=false;pdfBytes=null;if(pdf){pdf.loadingTask.destroy();pdf=null;}if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}}
 function shownValue(f){
  const value=values[f.id]??'';
  if(f.money)return value?formatSubscriptionNumber(value)+' '+t('SAR','ريال سعودي'):'—';
  if(f.numeric)return formatSubscriptionNumber(value);
  if(f.id==='fund_name')return t('Al Naeem Real Estate Fund',value);
  if(f.id==='currency')return t('Saudi Riyal',value);
  return value;
 }
 function progress(){return doc.sections.map(s=>sectionProgress(doc,s,values,signatures));}
 function nav(){const counts=progress();return `<nav class="subscription-steps" aria-label="${t('Form sections','أقسام النموذج')}">${doc.sections.map((s,i)=>`<button type="button" class="sub-step ${i===step&&!review?'active':''}" data-sub-step="${i}" aria-current="${i===step&&!review?'step':'false'}"><span class="sub-step-number">${i+1}</span><b>${escape(t(s.title,s.ar))}</b><small data-progress="${i}" dir="ltr">${counts[i].completed}/${counts[i].total}</small></button>`).join('')}<button type="button" class="sub-step ${review?'active':''}" data-review><span class="sub-step-number">${doc.sections.length+1}</span><b>${t('Review document','مراجعة المستند')}</b><small>${t('Full PDF','المستند كاملاً')}</small></button></nav>`;}
 function signature(){
  const f=doc.fields.find(f=>f.id==='signature_mode');
  return `<fieldset class="sub-signature field wide"><legend>${t('Signature','التوقيع')}</legend><div class="signature-methods">${f.options.map(o=>`<label class="sub-option ${values.signature_mode===o.value?'selected':''}"><input type="radio" name="signature_mode" value="${o.value}" ${values.signature_mode===o.value?'checked':''}><span>${escape(t(o.label,o.ar))}</span></label>`).join('')}</div>${values.signature_mode==='electronic'?`<div class="sub-upload"><label class="button secondary" for="sub-signature-file">${t('Upload signature image','تحميل صورة التوقيع')}</label><input id="sub-signature-file" type="file" accept="image/png,image/jpeg" hidden><small>${t('PNG or JPG, up to 5 MB.','PNG أو JPG، حتى ٥ ميغابايت.')}</small>${signatures.applicant?`<img src="${signatures.applicant}" alt="${t('Uploaded signature','التوقيع المرفوع')}"><button type="button" class="ghost" data-remove-signature>${t('Remove signature','إزالة التوقيع')}</button>`:''}</div>`:values.signature_mode==='manual'?`<p class="sub-help">${t('The signature area stays empty so you can sign after downloading or printing.','تُترك خانة التوقيع فارغة لتوقّع بعد التنزيل أو الطباعة.')}</p>`:''}${errorFor(f.id)}</fieldset>`;
 }
 function errorFor(id){return errors.includes(id)?`<small class="field-error">${t('Check this field. It is missing, invalid, or too long for the document.','راجع هذا الحقل: القيمة ناقصة أو غير صحيحة أو أطول من المساحة المتاحة في المستند.')}</small>`:'';}
 function field(f){
  const value=values[f.id]??'',label=escape(t(f.label,f.ar));
  if(f.type==='signature')return signature();
  if(f.type==='cards')return `<fieldset class="field sub-choice ${errors.includes(f.id)?'invalid':''}" data-field="${f.id}"><legend>${label}</legend><div class="sub-cards">${f.options.map(o=>`<label class="sub-option bilingual-card ${value===o.value?'selected':''}"><input type="radio" name="${f.id}" value="${o.value}" ${value===o.value?'checked':''}><span><b lang="ar" dir="rtl">${escape(o.ar)}</b><i aria-hidden="true"></i><small lang="en" dir="ltr">${escape(o.label)}</small></span></label>`).join('')}</div>${errorFor(f.id)}</fieldset>`;
  let input;
  if(f.readOnly)input=`<output id="sub-${f.id}" data-computed="${f.id}" class="sub-computed" dir="${f.id==='total_words'?'rtl':'auto'}">${escape(shownValue(f)||'—')}</output>`;
  else if(f.type==='select')input=`<select id="sub-${f.id}" name="${f.id}" ${f.required?'required':''}><option value="">${t('Select…','اختر…')}</option>${f.selectOptions.map(o=>`<option value="${o[0]}" ${o[0]===value?'selected':''}>${escape(t(o[1],o[2]))}</option>`).join('')}</select>`;
  else input=`<input id="sub-${f.id}" name="${f.id}" type="${['date','email','tel'].includes(f.type)?f.type:'text'}" value="${escape(shownValue(f))}" dir="${f.namePart?'rtl':f.direction==='ltr'||f.numeric?'ltr':'auto'}" ${f.namePart?'lang="ar" placeholder="'+t('Enter in Arabic','اكتب بالعربية')+'"':''} ${f.numeric?'inputmode="numeric"':''} ${f.required?'required':''} autocomplete="off" spellcheck="false" maxlength="2000">`;
  return `<div class="field ${f.wide?'wide':''} ${errors.includes(f.id)?'invalid':''}" data-field="${f.id}"><label for="sub-${f.id}">${label}${f.required?'<span class="required-mark"> *</span>':''}</label>${input}${f.id==='units'?`<small class="sub-help">${t('Whole units · SAR 1,000 per unit','وحدات صحيحة · ١٬٠٠٠ ريال سعودي للوحدة')}</small>`:''}${f.id==='applicant_name'?`<small class="sub-help">${t('Filled from your customer details. You can edit how your name appears.','معبّأ من بيانات العميل. يمكنك تعديل طريقة ظهور الاسم.')}</small>`:''}${errorFor(f.id)}</div>`;
 }
 function fields(){
  const section=doc.sections[step],fs=visibleFields(doc,values,section);
  if(fs.some(f=>f.namePart||f.personNameGroup)){
   const primary={id:'full_name',partIds:['first_name','second_name','third_name','family_name'],label:'Customer name in Arabic',ar:'اسم العميل باللغة العربية'},groups=[primary,...nameGroups],rendered=new Set(),chunks=[];let regular=[];
   const flush=()=>{if(regular.length){chunks.push(`<div class="sub-fields">${regular.map(field).join('')}</div>`);regular=[];}};
   for(const f of fs){
    if(f.identityRow){if(rendered.has(f.identityRow))continue;flush();rendered.add(f.identityRow);const ids=doc.identityRows.find(row=>row[0]===f.identityRow),members=ids.map(id=>fs.find(f=>f.id===id)).filter(Boolean);chunks.push(`<div class="identity-row sub-fields" style="--identity-columns:${members.length}">${members.map(field).join('')}</div>`);continue;}
    const group=groups.find(group=>group.partIds.includes(f.id));if(!group){regular.push(f);continue;}
    if(rendered.has(group.id))continue;flush();rendered.add(group.id);
    const parts=group.partIds.map(id=>fs.find(field=>field.id===id)).filter(Boolean);
    chunks.push(`<section class="person-name-group" data-person-name-group="${escape(group.id)}"><h3>${escape(t(group.label,group.ar))}${group.required?'<span class="required-mark"> *</span>':''}</h3><div class="sub-fields name-row-grid">${parts.map(field).join('')}</div>${group.id==='applicant_name'?`<p class="sub-help">${t('Filled from your customer details. You can edit how your name appears.','معبّأ من بيانات العميل. يمكنك تعديل طريقة ظهور الاسم.')}</p>`:''}</section>`);
   }
   flush();return chunks.join('');
  }
  if(section.id!=='subscription')return `<div class="sub-fields">${fs.map(field).join('')}</div>`;
  const choices=`<div class="sub-selections financial-row"><div class="sub-fields sub-selection-grid">${selectionIds.map(id=>field(fs.find(f=>f.id===id))).join('')}</div><div class="sub-selection-actions"><button type="button" class="clear-choice" data-sub-clear>${t('Clear selection','مسح الاختيار')}</button></div></div>`;
  const ids=[['fund_name','currency'],['units','unit_price'],['amount_subscribed','subscription_fee'],['total_amount'],['total_words']];
  return choices+ids.map(group=>`<div class="sub-fields financial-row">${group.map(id=>field(fs.find(f=>f.id===id))).join('')}</div>`).join('');
 }
 function render(nextLang=lang){
  if(disposed)return;lang=nextLang;normalize();
  root.innerHTML=header()+`<main class="workspace subscription-workspace"><button type="button" class="back-link button secondary" id="sub-home"><span aria-hidden="true">${lang==='ar'?'→':'←'}</span>${t('Back to forms','العودة إلى النماذج')}</button><div class="sub-heading"><div><h1>${escape(t(doc.title,doc.ar))}</h1></div><div class="sub-top-actions"><a class="button secondary" href="${templateUrl(doc)}" download="${doc.id}-blank.pdf">${t('Download blank','تنزيل النموذج الفارغ')}</a><button type="button" class="button primary" data-download>${t('Download PDF','تنزيل PDF')}</button></div></div>${nav()}<p id="sub-status" role="status" aria-live="polite" class="status ${message?'error':''}">${escape(message)}</p><div id="sub-download" class="download-result" ${downloadUrl?'':'hidden'}>${downloadUrl?downloadLink():''}</div>${review?`<section class="sub-review"><h2>${t('Your completed document','المستند بعد التعبئة')}</h2><p>${t('Check both pages below. This is the PDF you will download.','راجع الصفحتين أدناه. هذا هو ملف PDF الذي ستنزّله.')}</p><div id="sub-pages">${Array.from({length:doc.pages},(_,i)=>`<figure><figcaption>${t('Page','صفحة')} ${i+1} / ${doc.pages}</figcaption><canvas data-pdf-page="${i+1}" aria-label="${t('Completed document page','صفحة المستند بعد التعبئة')} ${i+1}"></canvas></figure>`).join('')}</div>${reviewEnabled()?signingNotice(signingState(),lang):toolModeNotice(lang)}<div class="section-actions"><button class="button secondary" id="sub-back-review">${t('Previous','السابق')}</button><button class="button ${signingState().ready?'secondary':'primary'}" data-download>${t('Download PDF','تنزيل PDF')}</button><button class="button primary" data-submit ${!reviewEnabled()||signingState().ready?'':'disabled'}>${formSaveLabel(lang)}</button></div></section>`:`<section class="sub-form-panel"><div class="section-heading"><h2>${escape(t(doc.sections[step].title,doc.sections[step].ar))}</h2></div><form id="subscription-fields" novalidate>${fields()}</form><div class="section-actions"><button class="button secondary" id="sub-prev" ${step===0?'disabled':''}>${t('Previous','السابق')}</button><button class="button primary" id="sub-next">${step===doc.sections.length-1?t('Review document','مراجعة المستند'):t('Continue','متابعة')}</button></div></section>`}<div class="form-bottom"><span data-sub-save>${drafts.available?'':t('Browser storage unavailable — download before leaving','التخزين غير متاح — نزّل المستند قبل المغادرة')}</span><button class="ghost" id="sub-reset">${t('Clear form','مسح النموذج')}</button></div></main>`+footer()+`<dialog id="sub-reset-dialog"><h2>${t('Clear this subscription draft?','مسح مسودة الاشتراك؟')}</h2><p>${t('Your shared customer details are kept.','يُحتفظ ببيانات العميل المشتركة.')}</p><div class="dialog-actions"><button class="button secondary" id="sub-cancel-reset">${t('Cancel','إلغاء')}</button><button class="button primary" id="sub-confirm-reset">${t('Clear form','مسح النموذج')}</button></div></dialog>`;
  bindCommon();root.querySelector('#sub-home').onclick=home;
  root.querySelectorAll('[data-sub-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.subStep)));
  root.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>prepare(false));
  root.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>prepare(true));
  root.querySelector('[data-submit]')?.addEventListener('click',()=>{if(!reviewEnabled()||signingState().ready)submit(doc,{...values},pdfBytes,{...signatures});});
  root.querySelector('[data-signing-guide]')?.addEventListener('click',()=>manualSigningGuide(true));
  root.querySelector('#sub-prev')?.addEventListener('click',()=>go(step-1));
  root.querySelector('#sub-next')?.addEventListener('click',()=>step===doc.sections.length-1?prepare(false):go(step+1));
  root.querySelector('#sub-back-review')?.addEventListener('click',()=>go(doc.sections.length-1));
  const form=root.querySelector('#subscription-fields');if(form){form.onsubmit=ev=>ev.preventDefault();form.oninput=input;}
  const units=root.querySelector('#sub-units');
  if(units){
   // Edit plain digits without moving the caret on every keystroke; group on blur.
   units.onfocus=()=>{try{units.value=String(parseUnits(units.value)??'');}catch{}};
   units.onblur=()=>{try{units.value=formatSubscriptionNumber(parseUnits(units.value)??'');}catch{}};
  }
  root.querySelector('[data-sub-clear]')?.addEventListener('click',()=>{if(busy)return;for(const id of selectionIds)values[id]='';errors=errors.filter(id=>!selectionIds.includes(id));changed();render();root.querySelector('.sub-selections input')?.focus();});
  root.querySelector('#sub-signature-file')?.addEventListener('change',upload);
  root.querySelector('[data-remove-signature]')?.addEventListener('click',()=>{if(busy)return;delete signatures.applicant;changed();render();});
  root.querySelector('#sub-reset').onclick=()=>root.querySelector('#sub-reset-dialog').showModal();
  root.querySelector('#sub-cancel-reset').onclick=()=>root.querySelector('#sub-reset-dialog').close();
  root.querySelector('#sub-confirm-reset').onclick=()=>{if(busy)return;drafts.clear(doc.id);drafts.fillSharedBlanks(doc.id);drafts.initializeCountries(doc.id,lang);values={...drafts.get(doc.id).values};signatures={};step=0;applicantEdited=false;errors=[];message='';changed();render();};
  if(pdf&&review)paint();lock();
 }
 function lock(){root.querySelectorAll('[data-sub-step],[data-review],[data-download],[data-submit],#sub-next,#sub-prev,#sub-home,#sub-reset,#subscription-fields input,#subscription-fields select,#subscription-fields button,#language,[data-home]').forEach(el=>{el.disabled=busy||(el.hasAttribute('data-submit')&&(!pdfBytes||(reviewEnabled()&&!signingState().ready)))||(el.id==='sub-prev'&&step===0)||(el.hasAttribute('data-sub-clear')&&!selectionIds.some(id=>values[id]));});}
 function update(){
  normalize();for(const input of root.querySelectorAll('#subscription-fields [name]')){if(input===document.activeElement)continue;const value=values[input.name]??'';if(input.type==='radio')input.checked=input.value===value;else{const field=doc.fields.find(f=>f.id===input.name);const shown=field?shownValue(field):value;if(input.value!==String(shown))input.value=shown;}}for(const f of doc.fields.filter(f=>f.readOnly)){const out=root.querySelector(`[data-computed="${f.id}"]`);if(out)out.textContent=shownValue(f)||'—';}
  progress().forEach((p,i)=>{const node=root.querySelector(`[data-progress="${i}"]`);if(node)node.textContent=p.completed+'/'+p.total;});
  const units=root.querySelector('[data-field="units"]');if(units)units.classList.toggle('invalid',Boolean(values.units&&!values.total_amount));
  const saveStatus=root.querySelector('[data-sub-save]');if(saveStatus)saveStatus.textContent=drafts.available?'':t('Browser storage unavailable — download before leaving','التخزين غير متاح — نزّل المستند قبل المغادرة');
 }
 function changed(id){invalidate();message='';if(id){const group=nameGroups.find(group=>group.partIds.includes(id)),changedIds=group?[...group.partIds,...group.targets.map(target=>target.id)]:[id];errors=errors.filter(error=>!changedIds.includes(error));}save(id);update();const status=root.querySelector('#sub-status');if(status)status.textContent='';const result=root.querySelector('#sub-download');if(result)result.hidden=true;}
 function input(ev){
  if(busy)return;const f=doc.fields.find(f=>f.id===ev.target.name);if(!f||f.readOnly)return;
  values[f.id]=ev.target.value;if(f.id==='applicant_name'||f.personNameGroup==='applicant_name')applicantEdited=true;
  // Inputs remain mounted while typing, including LTR email in the Arabic UI.
  changed(f.id);
  if(['select','cards','signature'].includes(f.type)){if(f.id==='signature_mode'&&values.signature_mode==='manual'){delete signatures.applicant;save();}render();if(f.type==='cards')root.querySelector(`[name="${f.id}"]:checked`)?.focus();}
 }
 function go(index){if(busy||index<0||index>=doc.sections.length)return;invalidate();step=index;message='';save();render();root.querySelector('.subscription-steps').scrollIntoView({behavior:'smooth',block:'start'});}
 async function upload(ev){
  const file=ev.target.files?.[0];ev.target.value='';if(!file||busy)return;busy=true;lock();const id=++token;
  try{const image=await prepareSignature(file);if(disposed||id!==token)return;signatures.applicant=image;changed();}
  catch{message=t('Choose a clear PNG or JPG signature under 5 MB, on a white or transparent background.','اختر صورة توقيع واضحة بصيغة PNG أو JPG أقل من ٥ ميغابايت، بخلفية بيضاء أو شفافة.');}
  finally{busy=false;if(!disposed)render();}
 }
 function downloadLink(){return `<a class="button primary" id="sub-save-pdf" href="${downloadUrl}" download="${doc.id}-filled.pdf">${t('Save PDF','حفظ PDF')}</a><span>${t('Use this link if your browser did not start the download.','استخدم الرابط إذا لم يبدأ التنزيل تلقائيًا.')}</span>`;}
 function download(){if(!pdfBytes)return;if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(new Blob([pdfBytes],{type:'application/pdf'}));const box=root.querySelector('#sub-download');box.hidden=false;box.innerHTML=downloadLink();root.querySelector('#sub-save-pdf').click();manualSigningGuide(false,true);}
 async function prepare(downloadNow){
  if(busy)return;if(pdfBytes&&review){if(downloadNow)download();return;}
  save();errors=downloadNow?[]:visibleErrors(missingRequired(doc,values,signatures));
  const invalidNames=arabicNameErrors(doc,values);
  if(invalidNames.length){errors=invalidNames;step=0;message=t('Enter the first name row in Arabic. Use the English name row for English names.','أدخل صف الاسم الأول باللغة العربية، واستخدم صف الاسم بالإنجليزية للأسماء الإنجليزية.');render();return;}
  // Signatures are optional in direct intake; valid uploaded images are still checked.
  if(errors.length){const index=doc.sections.findIndex(s=>s.fields.some(f=>errors.includes(f.id)));if(index>=0)step=index;message=t('Complete the highlighted required fields before reviewing. You can download your current answers at any time.','أكمل الحقول المطلوبة المحددة قبل المراجعة. يمكنك تنزيل الإجابات الحالية في أي وقت.');render();root.querySelector('.invalid,input[required]:invalid')?.focus();return;}
  busy=true;lock();const id=++token;message='';root.querySelector('#sub-status').textContent=t('Preparing your document…','جارٍ إعداد المستند…');
  try{
   const bytes=await generate(doc,{...values},values.signature_mode==='electronic'?{...signatures}:{});
   if(disposed||id!==token)return;
   pdfBytes=bytes;
   if(downloadNow){download();root.querySelector('#sub-status').textContent=t('Your PDF is ready.','المستند جاهز.');}
   else{const loaded=await loadPreview(bytes);if(disposed||id!==token){loaded.loadingTask.destroy();return;}pdf=loaded;review=true;render();manualSigningGuide();}
  }catch(error){
   if(disposed||id!==token)return;errors=visibleErrors(error.fields||[]);
   const index=doc.sections.findIndex(s=>s.fields.some(f=>errors.includes(f.id)));if(index>=0)step=index;
   message=error.message==='units'?t('Enter a whole number of units from 1 to '+rules.maxUnits+'.','أدخل عدد وحدات صحيحًا من ١ إلى ٩٩٩٬٩٩٩٬٩٩٩.'):error.fields?t('An answer is too long for its space. Check the highlighted field.','إحدى الإجابات أطول من مساحتها. راجع الحقل المحدد.'):t('Could not validate the totals or prepare the PDF. Check your connection and try again; your answers are saved.','تعذّر التحقق من المبالغ أو إعداد المستند. تحقق من الاتصال وأعد المحاولة؛ إجاباتك محفوظة.');render();
  }finally{busy=false;if(!disposed)lock();}
 }
 function visibleErrors(ids){return [...new Set(ids.flatMap(id=>nameGroups.find(group=>group.targets.some(target=>target.id===id))?.partIds||(id==='full_name'?['first_name','second_name','third_name','family_name']:id.endsWith('_label')?[id.slice(0,-6)]:id==='total_words'?['units']:[id])))];}
 async function paint(){const id=++paintToken;try{for(const canvas of root.querySelectorAll('[data-pdf-page]')){if(disposed||id!==paintToken)return;await renderPage(pdf,Number(canvas.dataset.pdfPage),canvas,1000);}}catch{if(!disposed&&id===paintToken){message=t('Preview could not render. Return to the applicant step and try again.','تعذّر عرض المعاينة. عُد إلى صفحة مقدم الطلب وأعد المحاولة.');root.querySelector('#sub-status').textContent=message;}}}
 return {render,save,workflowChanged(){if(review&&!busy)render();},refresh(){const visible=visibleFields(doc,values,doc.sections[step]).map(f=>f.id).join(','),wasReview=review;refresh();if(wasReview||visible!==visibleFields(doc,values,doc.sections[step]).map(f=>f.id).join(','))render();else update();},destroy(){disposed=true;invalidate();},get values(){return {...values};}};
}
