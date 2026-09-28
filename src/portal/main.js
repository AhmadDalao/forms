import {notificationBell,mountNotificationBell} from './notification-bell.js';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import './style.css';
import {passwordField as renderPasswordField,bindPasswordControls} from './passwords.js';
import {siteHeader} from '../branding.js';
import {appRoot,accountFolder} from '../routes.js';
import {authChangeKey,api,session,e,errorText,language,setLanguage,authChanged,importGuestDrafts} from './api.js';
const root=document.querySelector('#app'),params=new URLSearchParams(location.search);
let stopNotifications=()=>{};
let lang=['ar','en'].includes(params.get('lang'))?params.get('lang'):language(),user=null;
const t=(en,ar)=>lang==='ar'?ar:en;
const isRegister=/\/register\/?$/.test(location.pathname),isAccount=/\/(?:account|my-applications)\/?$/.test(location.pathname);
const next=['individuals','companies'].includes(params.get('next'))?params.get('next'):null;
const uploadTarget=/^[a-z0-9_-]{1,100}$/.test(params.get('upload')||'')?params.get('upload'):null;
let pendingUpload=uploadTarget;
const query=new URLSearchParams({...(next?{next}:{}),...(params.get('resume')==='1'?{resume:'1'}:{}),...(uploadTarget?{upload:uploadTarget}:{}),lang});
const accountHref=()=>appRoot+'account/'+(uploadTarget?'?'+new URLSearchParams({upload:uploadTarget,lang}):'');
function header(){return siteHeader({lang,className:'portal-header',brandHref:appRoot,actions:`${user?`<a class="site-header-link applications-link" href="${appRoot}account/" ${isAccount?'aria-current="page"':''}>${t('Profile','الملف الشخصي')}</a>`:''}${user?notificationBell(lang):''}<button type="button" class="site-header-language" id="portal-language" lang="${lang==='ar'?'en':'ar'}">${t('العربية','English')}</button>${user?`<button type="button" class="site-header-signout" id="portal-logout">${t('Sign out','تسجيل الخروج')}</button>`:''}`});}
function shell(content){stopNotifications();document.title=t(isAccount?'Profile · Itqan Capital':isRegister?'Create account · Itqan Capital':'Sign in · Itqan Capital',isAccount?'الملف الشخصي · إتقان كابيتال':isRegister?'إنشاء حساب · إتقان كابيتال':'تسجيل الدخول · إتقان كابيتال');document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body.className=isAccount?'client-portal':'client-portal auth-page';root.innerHTML=header()+content;
 stopNotifications=user?mountNotificationBell(root.querySelector('[data-notification-bell]'),{lang,userId:user.id}):()=>{};
 root.querySelector('#portal-language').onclick=()=>{lang=lang==='ar'?'en':'ar';setLanguage(lang);query.set('lang',lang);if(isAccount)account();else auth();};
 root.querySelector('#portal-logout')?.addEventListener('click',async()=>{try{await api('logout',{});authChanged();location.href=appRoot+'login/?lang='+lang;}catch(err){message(errorText(err,lang));}});
}
function message(value,ok=false){const node=root.querySelector('#portal-message');if(node){node.textContent=value;node.className=ok?'portal-success':'portal-error';}}
function passwordField(name,label,autocomplete='new-password'){return renderPasswordField(name,label,autocomplete,lang);}
function bindEyes(){bindPasswordControls(root,lang);}
function auth(){shell(`<main class="auth-layout"><section class="auth-story"><h1>${t('Al Naeem Real Estate Fund','صندوق النعيم العقاري')}</h1><div class="auth-partners"><figure class="fund-manager"><div><img src="${appRoot}branding/itqan-fund.png" alt="${t('Itqan Capital','إتقان كابيتال')}" width="726" height="275" fetchpriority="high"></div><figcaption>${t('Fund Manager','مدير الصندوق')}</figcaption></figure><div class="fund-partner-row" dir="rtl">${[['wessal-partner','Wessal','وصال','Development Manager','مدير التطوير',357,330],['dinar-partner','Dinar','دينار','Custodian','أمين الحفظ',447,447],['rsm-partner','RSM','آر إس إم','Auditor','مراجع الحسابات',200,200]].map(([file,en,ar,role,arRole,width,height])=>`<figure><div><img src="${appRoot}branding/${file}.png" alt="${e(t(en,ar))}" width="${width}" height="${height}"></div><figcaption>${t(role,arRole)}</figcaption></figure>`).join('')}</div></div></section><section class="auth-panel"><span class="portal-eyebrow">${isRegister?t('GET STARTED','البداية'):t('WELCOME BACK','مرحبًا بعودتك')}</span><h2>${isRegister?t('Create your account','إنشاء حسابك'):t('Sign in','تسجيل الدخول')}</h2><p class="portal-muted">${isRegister?t('Your name and mobile number are all you need.','كل ما تحتاجه اسمك ورقم جوالك.'):t('Continue with your Saudi mobile number.','تابع باستخدام رقم جوالك السعودي.')}</p><form id="auth-form">${isRegister?`<fieldset class="account-type-choice"><legend>${t('Account type','نوع الحساب')}</legend><div><label><input type="radio" name="account_type" value="individual" required><span>${t('Individual','فرد')}</span></label><label><input type="radio" name="account_type" value="corporate" required><span>${t('Company','شركة')}</span></label></div></fieldset><div class="auth-name-row"><label>${t('First name','الاسم الأول')}<input name="first_name" autocomplete="given-name" required maxlength="79" dir="auto"></label><label>${t('Last name','اسم العائلة')}<input name="last_name" autocomplete="family-name" required maxlength="79" dir="auto"></label></div>`:''}<label>${t('Mobile number','رقم الجوال')}<span class="phone-wrap" dir="ltr"><span>+966</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="5XXXXXXXX" required maxlength="20" aria-label="${t('Saudi mobile number','رقم الجوال السعودي')}"></span><small>${t('9 digits, starting with 5.','٩ أرقام تبدأ بـ٥.')}</small></label>${passwordField('password',t('Password','كلمة المرور'),isRegister?'new-password':'current-password')}${isRegister?`${passwordField('confirm',t('Confirm password','تأكيد كلمة المرور'))}`:''}${next&&params.get('resume')==='1'?`<label class="portal-check"><input type="checkbox" name="resume" checked>${t('Continue my current draft from this browser','متابعة مسودتي الحالية من هذا المتصفح')}</label>`:''}<p id="portal-message" role="status" aria-live="polite"></p><button class="portal-button primary wide" type="submit">${isRegister?t('Create account','إنشاء الحساب'):t('Sign in','دخول')}</button></form>${!isRegister?`<p class="portal-help">${t('Forgot your password? Contact Itqan Capital to request a reset.','نسيت كلمة المرور؟ تواصل مع إتقان كابيتال لطلب إعادة تعيينها.')}</p>`:''}<a class="portal-button wide auth-alternate" href="${appRoot}${isRegister?'login':'register'}/?${query}">${isRegister?t('Already registered? Sign in','لديك حساب؟ تسجيل الدخول'):t('New here? Create an account','عميل جديد؟ إنشاء حساب')}</a></section></main><footer class="portal-footer">${t('Itqan Capital · Client portal','إتقان كابيتال · بوابة العملاء')}</footer>`);bindEyes();
 root.querySelector('#auth-form').onsubmit=async ev=>{ev.preventDefault();const form=ev.target,button=form.querySelector('[type="submit"]');if(button.disabled)return;const buttonLabel=button.textContent;button.disabled=true;button.textContent=isRegister?t('Creating account…','جارٍ إنشاء الحساب…'):t('Signing in…','جارٍ تسجيل الدخول…');form.setAttribute('aria-busy','true');message('');try{const f=new FormData(form),result=await api(isRegister?'register':'login',Object.fromEntries(f));const folder=accountFolder(result.user);if(f.has('resume')&&next===folder)importGuestDrafts(result.user.id,folder);authChanged();setLanguage(lang);location.href=uploadTarget||result.user.reset_required?accountHref():appRoot+folder+'/';}catch(err){message(errorText(err,lang));button.disabled=false;button.textContent=buttonLabel;form.removeAttribute('aria-busy');}};
}
async function account({profileOpen=false,initialSession=null}={}){
 try{
  const fresh=initialSession||await session();user=fresh.user;if(!user){location.replace(appRoot+'login/?'+query);return;}
  if(user.reset_required){passwordPage();return;}
  if(pendingUpload){location.replace(appRoot+accountFolder(user)+'/?'+new URLSearchParams({upload:pendingUpload,lang}));return;}
  shell(`<main class="account-shell profile-shell"><div class="account-heading"><div><h1>${t('Profile','الملف الشخصي')}</h1><p class="portal-muted" dir="ltr">${e(user.phone)}</p></div><a class="portal-button" href="${appRoot}${accountFolder(user)}/">${t('Back to forms','العودة إلى النماذج')}</a></div><section class="account-settings"><form id="profile-form"><div class="profile-fields"><label>${t('Name','الاسم')}<input name="name" value="${e(user.name)}" minlength="2" maxlength="160" required dir="auto"></label><label>${t('Email (optional)','البريد الإلكتروني (اختياري)')}<input type="email" name="email" value="${e(user.email)}" dir="ltr" maxlength="254"></label></div><p id="profile-message" role="status" aria-live="polite"></p><div class="profile-actions"><button class="portal-button primary" type="submit">${t('Save profile','حفظ البيانات')}</button><button type="button" class="portal-button" id="change-password">${t('Change password','تغيير كلمة المرور')}</button></div></form></section><p id="portal-message" role="status"></p></main>`);
  root.querySelector('#profile-form').onsubmit=async ev=>{
   ev.preventDefault();const form=ev.target,button=form.querySelector('[type=submit]');if(button.disabled)return;
   const values=Object.fromEntries(new FormData(form)),label=button.textContent;
   form.setAttribute('aria-busy','true');form.querySelectorAll('input,button').forEach(el=>el.disabled=true);button.textContent=t('Saving…','جارٍ الحفظ…');
   root.querySelector('#profile-message').textContent='';
   try{await api('profile',values);await account({profileOpen:true});const status=root.querySelector('#profile-message');if(status){status.className='portal-success';status.textContent=t('Profile saved.','تم حفظ البيانات.');root.querySelector('#profile-form [type=submit]').focus({preventScroll:true});}}
   catch(err){const status=root.querySelector('#profile-message');if(status){status.className='portal-error';status.textContent=errorText(err,lang);}}
   finally{form.removeAttribute('aria-busy');form.querySelectorAll('input,button').forEach(el=>el.disabled=false);button.textContent=label;}
  };
  root.querySelector('#change-password').onclick=()=>passwordPage();
 }catch(err){shell(`<main class="account-shell"><h1>${t('Profile','الملف الشخصي')}</h1><p id="portal-message" role="status"></p><button class="portal-button" id="retry">${t('Try again','إعادة المحاولة')}</button></main>`);message(errorText(err,lang));root.querySelector('#retry').onclick=account;}
}
function passwordPage(){shell(`<main class="password-panel"><span class="portal-eyebrow">${t('ACCOUNT SECURITY','أمان الحساب')}</span><h1>${t('Choose a new password','اختر كلمة مرور جديدة')}</h1><p class="portal-muted">${user.reset_required?t('Your password was reset. Replace the temporary password before continuing.','تمت إعادة تعيين كلمة مرورك. استبدل كلمة المرور المؤقتة قبل المتابعة.'):t('Use a strong password with at least 8 characters.','استخدم كلمة مرور قوية من ٨ أحرف على الأقل.')}</p><form id="password-form">${passwordField('current',user.reset_required?t('Temporary password','كلمة المرور المؤقتة'):t('Current password','كلمة المرور الحالية'),'current-password')}${passwordField('password',t('New password','كلمة المرور الجديدة'))}${passwordField('confirm',t('Confirm new password','تأكيد كلمة المرور الجديدة'))}<p id="portal-message" role="status"></p><button class="portal-button primary wide">${t('Save new password','حفظ كلمة المرور الجديدة')}</button></form>${!user.reset_required?`<button class="portal-button wide" id="password-back">${t('Back to profile','العودة إلى الملف الشخصي')}</button>`:''}</main>`);bindEyes();root.querySelector('#password-back')?.addEventListener('click',account);root.querySelector('#password-form').onsubmit=async ev=>{ev.preventDefault();const b=ev.target.querySelector('[type="submit"]')||ev.target.querySelector('.primary');b.disabled=true;try{await api('password',Object.fromEntries(new FormData(ev.target)));authChanged();await account();message(t('Password updated.','تم تحديث كلمة المرور.'),true);}catch(err){message(errorText(err,lang));b.disabled=false;}};}

try{const s=await session();user=s.user;if(isAccount)await account({initialSession:s});else if(user)location.replace(uploadTarget||user.reset_required?accountHref():appRoot+accountFolder(user)+'/');else auth();}catch(err){auth();message(errorText(err,lang));}

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
window.addEventListener('storage',event=>{if(event.key===authChangeKey)location.reload();});

let checkingType=false;
async function checkType(){
 if(checkingType||document.hidden)return;
 checkingType=true;
 try{const fresh=await session();if(user&&(fresh.user?.id!==user.id||fresh.user?.account_type!==user.account_type))location.reload();}catch{}finally{checkingType=false;}
}
window.addEventListener('focus',checkType);
document.addEventListener('visibilitychange',checkType);
