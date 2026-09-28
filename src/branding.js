import {appRoot} from './routes.js';
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
