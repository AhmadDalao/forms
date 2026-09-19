import {visibleIn} from './routes.js';
const names={
 'subscription-form':[1,'Subscription Application for Al Naeem Real Estate Fund (Individual)','طلب الإشتراك في صندوق النعيم العقاري (للأفراد)'],
 'subscription-company':[1,'Subscription Application for Al Naeem Real Estate Fund (Company)','طلب الإشتراك في صندوق النعيم العقاري (للشركات)'],
 'kyc-individual':[2,'Know Your Customer and Anti-Money Laundering Forms Applicable in Saudi Arabia','النماذج الخاصة بأنظمة "اعرف عميلك" و "مكافحة غسيل الأموال" المعمول بها في المملكة العربية السعودية'],
 'kyc-corporate':[2,'Know Your Customer and Anti-Money Laundering Forms Applicable in Saudi Arabia','النماذج الخاصة بأنظمة "اعرف عميلك" و "مكافحة غسيل الأموال" المعمول بها في المملكة العربية السعودية'],
 'signature-form':[3,'Signature Form','نموذج التوقيع'],
 'fatca-crs-individual':[5,'International Tax Transparency - Self-Certification and Declaration Form (FATCA & CRS)','نموذج الشفافية الضريبية الدولية - نموذج إقرار ذاتي (FATCA وCRS)'],
 'fatca-crs-corporate':[5,'International Tax Transparency - Self-Certification and Declaration Form (FATCA & CRS)','نموذج الشفافية الضريبية الدولية - نموذج إقرار ذاتي (FATCA وCRS)'],
 'terms-and-conditions':[6,'Terms and Conditions for Al Naeem Real Estate Fund','الشروط و الأحكام لصندوق النعيم العقاري'],
};
export function applyCatalogueNames(docs){for(const doc of docs){const [number,title,ar]=names[doc.id];Object.assign(doc,{number,sourceTitle:doc.title,sourceAr:doc.ar,title,ar});if(doc.id==='terms-and-conditions')Object.assign(doc,{description:'Current PDF: Itqan’s general account terms and telephone / fax instructions.',arDescription:'الملف الحالي: شروط إتقان العامة للحساب وتعليمات الهاتف والفاكس.'});}}
const consent={id:'al-naeem-terms-consent',pdfVersion:'8761415c8304',number:4,title:'Terms and Conditions Consent Form for Al Naeem Real Estate Fund',ar:'نموذج الموافقة على الشروط والأحكام لصندوق النعيم العقاري',group:'shared',pages:1,downloadOnly:true,description:'Download the PDF, then complete and sign it.',arDescription:'نزّل ملف PDF، ثم عبّئه ووقّعه.'};
export const catalogueFor=(docs,audience,cards=null)=>(cards||[...docs,consent]).filter(doc=>visibleIn(doc,audience)).sort((a,b)=>(a.order?.[audience]??a.number)-(b.order?.[audience]??b.number)).map((d,i)=>cards?{...d,number:i+1}:d);
