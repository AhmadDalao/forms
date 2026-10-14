import nationalAddress from '../scripts/pdf-design/national-address.json' with {type:'json'};

const parts=nationalAddress.text.split(' | ');
export const defaultWebsiteAddress=[parts[0],parts.slice(1,3).join(' · '),parts.slice(3).join(' · ')].join('\n');
let address=defaultWebsiteAddress;
export const websiteAddress=()=>address;
export const addressLanguage=value=>/[\u0600-\u06ff]/u.test(value)?'ar':'en';

// Existing session responses carry this public setting; no extra startup request.
export function receiveWebsiteSettings(website){
 if(typeof website?.national_address!=='string'||!website.national_address.trim())return;
 address=website.national_address;
 if(typeof document==='undefined')return;
 document.querySelectorAll('.site-footer address').forEach(node=>{
  node.lang=addressLanguage(address);node.dir=node.lang==='ar'?'auto':'ltr';
  node.replaceChildren(...address.split('\n').map(line=>{const span=document.createElement('span');span.dir='auto';span.textContent=line;return span;}));
 });
}
