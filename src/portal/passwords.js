const labels={
 en:['Not entered','Weak','Fair','Good','Strong'],
 ar:['لم تُدخل بعد','ضعيفة','متوسطة','جيدة','قوية']
};

// An advisory estimate, computed locally; it is not an additional signup rule.
export function passwordStrength(value){
 if(!value)return 0;
 const characters=Array.from(value),length=characters.length;
 const normalized=value.normalize('NFKC').toLowerCase().replace(/[٠-٩۰-۹]/g,c=>String((c.charCodeAt(0)-(c<='٩'?0x660:0x6f0))));
 const common=normalized.replace(/[@0!13457$]/g,c=>({'@':'a','0':'o','!':'i','1':'i','3':'e','4':'a','5':'s','7':'t','$':'s'}[c])).replace(/[^\p{L}\p{N}]/gu,'');
 if(length<8||/012345|123456|234567|345678|456789|987654|876543|765432|abcdef|asdfgh|zxcvbn/.test(normalized)||/password|passw[oi]rd|qwerty|letmein|welcome|admin|iloveyou|كلمةالمرور/.test(common)||/^[\p{N}\s]+$/u.test(value)||/^(.+)\1+$/us.test(normalized)||new Set(characters).size<4)return 1;
 const kinds=[/\p{Ll}/u,/\p{Lu}/u,/\p{N}/u,/[^\p{L}\p{N}\s]/u].filter(re=>re.test(value)).length;
 const words=normalized.split(/[\s\-_,.]+/u).filter(w=>Array.from(w).length>=3);
 if((length>=16&&new Set(words).size>=4)||(length>=16&&kinds>=3)||(length>=24&&new Set(characters).size>=10))return 4;
 if(length>=12&&(kinds>=2||new Set(characters).size>=8))return 3;
 if(length>=10||kinds>=3)return 2;
 return 1;
}
export function passwordField(name,label,autocomplete,lang){
 const t=(en,ar)=>lang==='ar'?ar:en,isNew=autocomplete==='new-password',meter=isNew&&name==='password';
 const id='password-'+name;
 return `<label for="${id}">${label}<span class="password-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required ${isNew?'minlength="8" maxlength="72" data-new-password':''} ${meter?`aria-describedby="${id}-help ${id}-strength-label"`:''}><button type="button" class="password-eye" data-eye="${name}" aria-controls="${id}" aria-label="${t('Show password','إظهار كلمة المرور')}" title="${t('Show password','إظهار كلمة المرور')}" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path data-eye-slash hidden d="M3 3 21 21" stroke-width="2.2" stroke-linecap="round"/></svg></button></span></label>${meter?`<div class="password-strength" data-password-strength="${name}" data-score="0"><div class="password-strength-heading"><span>${t('Password strength','قوة كلمة المرور')}</span><span id="${id}-strength-label" data-strength-label role="status" aria-live="polite">${labels[lang][0]}</span></div><div class="password-strength-track" role="meter" aria-label="${t('Estimated password strength','القوة التقديرية لكلمة المرور')}" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" aria-valuetext="${labels[lang][0]}"><span></span></div><p id="${id}-help">${t('At least 8 characters. A longer, unique password or passphrase is stronger.','٨ أحرف على الأقل. اختر كلمة مرور أطول وفريدة أو عبارة مرور.')}</p></div>`:''}`;
}
export function bindPasswordControls(root,lang){
 const t=(en,ar)=>lang==='ar'?ar:en;
 root.querySelectorAll('[data-eye]').forEach(button=>{
  const input=root.querySelector(`[name="${button.dataset.eye}"]`);
  button.onclick=ev=>{
   ev.preventDefault();const show=input.type==='password';input.type=show?'text':'password';
   const label=show?t('Hide password','إخفاء كلمة المرور'):t('Show password','إظهار كلمة المرور');
   button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',label);button.title=label;
   button.querySelector('[data-eye-slash]').toggleAttribute('hidden',!show);
  };
 });
 root.querySelectorAll('[data-new-password]').forEach(input=>{
  const update=()=>{
   const length=Array.from(input.value).length,tooLong=new TextEncoder().encode(input.value).length>72;
   input.setCustomValidity(tooLong?t('This password is too long. Use fewer characters.','كلمة المرور طويلة جدًا. استخدم أحرفًا أقل.'):length>0&&length<8?t('Use at least 8 characters.','استخدم ٨ أحرف على الأقل.'):'');
   const box=root.querySelector(`[data-password-strength="${input.name}"]`);if(!box)return;
   const score=passwordStrength(input.value),label=labels[lang][score],meter=box.querySelector('[role=meter]');
   box.dataset.score=score;meter.setAttribute('aria-valuenow',String(score));meter.setAttribute('aria-valuetext',label);
   const status=box.querySelector('[data-strength-label]');if(status.textContent!==label)status.textContent=label;
  };
  input.addEventListener('input',update);input.addEventListener('change',update);input.addEventListener('focus',update);update();
 });
}
