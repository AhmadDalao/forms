import {appRoot} from './routes.js';
import nationalAddress from '../scripts/pdf-design/national-address.json' with {type:'json'};
import './branding.css';
// Original embedded artwork from the owner's presentation, with no redrawing.
export function brandLockup(lang='ar'){
 return `<span class="brand-lockup"><img class="brand-itqan" src="${appRoot}branding/itqan.png" width="1456" height="552" alt="Itqan Capital · إتقان كابيتال"><strong class="brand-fund-name">${lang==='ar'?'صندوق النعيم العقاري':'Al Naeem Real Estate Fund'}</strong></span>`;
}

// Page-specific actions keep their existing handlers inside one shared header.
export function siteHeader({lang='en',className='',brandHref=null,homeAction=false,navigation='',actions=''}){
 const brand=brandHref?`<a class="site-brand" href="${brandHref}" ${homeAction?'data-home':''}>${brandLockup(lang)}</a>`:`<span class="site-brand">${brandLockup(lang)}</span>`;
 return `<header class="site-header ${className}" dir="${lang==='ar'?'rtl':'ltr'}"><div class="site-header-inner">${brand}<div class="site-header-controls">${navigation}<div class="site-header-actions">${actions}</div></div></div></header>`;
}

export function siteFooter(lang='en'){
 const parts=nationalAddress.text.split(' | '),escape=value=>value.replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
 const lines=[parts[0],parts.slice(1,3).join(' · '),parts.slice(3).join(' · ')];
 return `<footer class="site-footer" dir="${lang==='ar'?'rtl':'ltr'}"><strong>${lang==='ar'?'العنوان الوطني لإتقان كابيتال':'Itqan Capital · National address'}</strong><address lang="en" dir="ltr">${lines.map(line=>`<span>${escape(line)}</span>`).join('')}</address></footer>`;
}
