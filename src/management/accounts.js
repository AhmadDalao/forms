import {passwordField,bindPasswordControls} from '../portal/passwords.js';
import {e,errorText,when} from '../portal/api.js';
import './accounts.css';

export function accountPasswordDialog({lang,title,description,username=false,onSave,onDone,onError=()=>false}){
 const t=(en,ar)=>lang==='ar'?ar:en,dialog=document.createElement('dialog');
 dialog.className='staff-password-dialog';dialog.dir=lang==='ar'?'rtl':'ltr';
 dialog.setAttribute('aria-labelledby','staff-password-title');
 dialog.innerHTML=`<h2 id="staff-password-title">${e(title)}</h2><p>${e(description)}</p><form>
 ${username?`<label>${t('Username','اسم المستخدم')}<input name="username" dir="ltr" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" required></label>`:''}
 ${passwordField('password',t('New password','كلمة المرور الجديدة'),'new-password',lang)}
 ${passwordField('confirm',t('Confirm password','تأكيد كلمة المرور'),'new-password',lang)}
 <p role="status" aria-live="polite"></p><div class="actions"><button type="button" data-cancel>${t('Cancel','إلغاء')}</button><button class="primary" type="submit">${t('Save','حفظ')}</button></div></form>`;
 document.body.append(dialog);bindPasswordControls(dialog,lang);let busy=false;
 const close=()=>{if(!busy){dialog.close();dialog.remove();}};
 dialog.querySelector('[data-cancel]').onclick=close;
 dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
 dialog.querySelector('form').onsubmit=async ev=>{
  ev.preventDefault();if(busy)return;
  const data=Object.fromEntries(new FormData(ev.target));
  if(data.password!==data.confirm){dialog.querySelector('[role=status]').textContent=errorText(Error('password_mismatch'),lang);return;}
  busy=true;dialog.setAttribute('aria-busy','true');dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);
  try{await onSave(data);busy=false;close();await onDone?.();}
  catch(error){if(onError(error)){busy=false;close();return;}dialog.querySelector('[role=status]').textContent=errorText(error,lang);}
  finally{busy=false;dialog.removeAttribute('aria-busy');dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
 };
 dialog.showModal();dialog.querySelector('input').focus();
}

export async function showAdministrators({lang,shell,api,onError,notice,isCurrent=()=>true}){
 if(!isCurrent())return;
 const label=(en,ar)=>lang==='ar'?ar:en;
 shell(`<main class="shell staff-accounts" aria-busy="true"><p role="status">${label('Loading administrators…','جارٍ تحميل حسابات الإدارة…')}</p></main>`,{view:'admins'});
 let data;try{data=await api('admins');}catch(error){if(!isCurrent())return;throw error;}
 if(!isCurrent())return;const {accounts}=data;
 const headings=[label('Username','اسم المستخدم'),label('Role','الصلاحية'),label('Created by','أُنشئ بواسطة'),label('Created','تاريخ الإنشاء'),label('Actions','الإجراءات')];
 shell(`<main class="shell staff-accounts"><div class="toolbar"><div><h1>${label('Administrators','حسابات الإدارة')}</h1><p class="muted">${label('Create individual sign-ins for your management team. Only the superadmin can manage these accounts.','أنشئ حساب دخول مستقلًا لكل مسؤول. إدارة هذه الحسابات متاحة للمشرف الرئيسي فقط.')}</p></div><button class="primary" data-create-admin>${label('Create admin','إنشاء حساب مسؤول')}</button></div><section class="panel"><div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headings.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${accounts.map(a=>`<tr><td data-label="${headings[0]}"><bdi>${e(a.username)}</bdi></td><td data-label="${headings[1]}"><span>${a.role==='superadmin'?label('Superadmin','المشرف الرئيسي'):label('Admin','مسؤول')}</span></td><td data-label="${headings[2]}"><bdi>${e(a.created_by||'—')}</bdi></td><td data-label="${headings[3]}"><span>${a.created_at?e(when(a.created_at,lang)):'—'}</span></td><td data-label="${headings[4]}"><span>${a.role==='admin'?`<button data-reset-admin="${e(a.username)}">${label('Reset password','إعادة تعيين كلمة المرور')}</button>`:'—'}</span></td></tr>`).join('')}</tbody></table></div></section></main>`,{view:'admins'});
 const reload=()=>showAdministrators({lang,shell,api,onError,notice,isCurrent});
 document.querySelector('[data-create-admin]').onclick=()=>accountPasswordDialog({lang,username:true,title:label('Create admin','إنشاء حساب مسؤول'),description:label('This account can manage clients and submitted forms. Document editing and account creation stay restricted to the superadmin.','يمكن لهذا الحساب إدارة العملاء والنماذج المرسلة. تعديل المستندات وإنشاء حسابات الإدارة متاحان للمشرف الرئيسي فقط.'),onSave:data=>api('admin_create',data),onError,onDone:async()=>{await reload();notice(label('Admin account created.','تم إنشاء حساب المسؤول.'));}});
 document.querySelectorAll('[data-reset-admin]').forEach(button=>button.onclick=()=>accountPasswordDialog({lang,title:label('Reset admin password','إعادة تعيين كلمة مرور المسؤول'),description:label('Choose a new password for ','اختر كلمة مرور جديدة لحساب ')+button.dataset.resetAdmin+label('. Existing sessions will end.','. ستنتهي الجلسات الحالية.'),onSave:data=>api('admin_password',{...data,username:button.dataset.resetAdmin}),onError,onDone:async()=>{await reload();notice(label('Password updated.','تم تحديث كلمة المرور.'));}}));
}
