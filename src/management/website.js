import {e,when} from '../portal/api.js';
import './website.css';

export async function showWebsiteSettings({language,shell,api,onError,isCurrent}){
 let saved=(await api('website_settings')).website,draft=saved.national_address,busy=false,conflict=false,message='';
 const t=(en,ar)=>language()==='ar'?ar:en;
 function update(){
  if(!isCurrent())return;
  const form=document.querySelector('#website-settings-form');if(!form)return;
  form.querySelector('textarea').disabled=busy;
  const button=form.querySelector('[type=submit]');button.disabled=busy||conflict||draft===saved.national_address;
  button.textContent=busy?t('Saving…','جارٍ الحفظ…'):t('Save address','حفظ العنوان');
  form.querySelector('[data-address-status]').textContent=message?t(...message):'';
  form.querySelector('[data-address-reload]').hidden=!conflict;
 }
 function render(){
  if(!isCurrent())return;
  shell(`<main class="client-management website-settings"><div class="admin-heading"><div><h1>${t('Website settings','إعدادات الموقع')}</h1><p class="client-muted">${t('Update the national address displayed across the website.','حدّث العنوان الوطني الظاهر في جميع صفحات الموقع.')}</p></div></div><section class="admin-card"><form id="website-settings-form"><label for="website-national-address">${t('Itqan Capital · National address','العنوان الوطني لإتقان كابيتال')}</label><p id="website-address-help" class="client-muted">${t('Use a new line for each part of the address. Saving updates the website footer; addresses printed in PDF forms are managed separately.','اكتب كل جزء من العنوان في سطر مستقل. يُحدّث الحفظ تذييل الموقع؛ تُعدّل العناوين المطبوعة في نماذج PDF بشكل منفصل.')}</p><textarea id="website-national-address" name="national_address" dir="auto" rows="6" maxlength="1000" required aria-describedby="website-address-help">${e(draft)}</textarea>${saved.updated_at?`<p class="client-muted">${t('Last saved','آخر حفظ')}: <bdi>${e(when(saved.updated_at,language()))}</bdi> · <bdi>${e(saved.updated_by)}</bdi></p>`:''}<div class="actions"><button type="submit" class="primary">${t('Save address','حفظ العنوان')}</button><button type="button" data-address-reload hidden>${t('Reload saved address','إعادة تحميل العنوان المحفوظ')}</button></div><p data-address-status role="status" aria-live="polite"></p></form></section></main>`,{view:'website'});
  const form=document.querySelector('#website-settings-form');
  form.querySelector('textarea').oninput=event=>{draft=event.target.value;if(!conflict)message='';update();};
  form.onsubmit=save;
  form.querySelector('[data-address-reload]').onclick=async()=>{
   try{const result=await api('website_settings');if(!isCurrent())return;saved=result.website;draft=saved.national_address;conflict=false;message='';render();}
   catch(error){if(!onError(error)){message=['Could not reload the address. Try again.','تعذّر تحميل العنوان. حاول مجددًا.'];update();}}
  };
  update();
 }
 async function save(event){
  event.preventDefault();if(busy||conflict||draft===saved.national_address)return;
  busy=true;message='';update();
  try{
   const result=await api('website_settings_save',{national_address:draft,revision:saved.revision});
   saved=result.website;draft=saved.national_address;message=['Address saved. The website footer is updated.','تم حفظ العنوان وتحديث تذييل الموقع.'];
  }catch(error){
   if(onError(error))return;
   conflict=error.status===409;
   message=conflict?['Another window changed the address. Reload the saved address before editing again.','تغيّر العنوان في نافذة أخرى. أعد تحميل العنوان المحفوظ قبل تعديله مجددًا.']:
    error.message==='website_address_invalid'?['Enter an address of 1–8 lines, up to 1,000 characters.','أدخل عنوانًا من سطر إلى ٨ أسطر، بحد أقصى ١٠٠٠ حرف.']:
    error.status===403?['Only the superadmin can save this setting. Refresh and sign in again.','المشرف الرئيسي وحده يستطيع حفظ هذا الإعداد. حدّث الصفحة وسجّل الدخول مجددًا.']:
    ['Could not confirm the save. Your text is kept; try saving again.','تعذّر تأكيد الحفظ. احتُفظ بالنص؛ حاول الحفظ مجددًا.'];
  }finally{busy=false;render();}
 }
 render();return {render};
}
