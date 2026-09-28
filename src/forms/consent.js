import {document,section,text} from '../schema.js';
const d=document('al-naeem-terms-consent','Terms and Conditions Consent Form for Al Naeem Real Estate Fund','نموذج الموافقة على الشروط والأحكام لصندوق النعيم العقاري','shared','Investor declaration and signature.','إقرار المستثمر وتوقيعه.',1,[1]);
const s=section(d,'investor','Investor declaration and signature','إقرار المستثمر والتوقيع',1,
 'I/we have read the fund terms, conditions and appendices, understood and agreed to them, and received a copy after signing.',
 'لقد قمت / قمنا بقراءة الشروط والأحكام والملاحق الخاصة بالصندوق وفهم ما جاء فيها والموافقة عليها، كما جرى الحصول على نسخة منها بعد التوقيع عليها.');
text(d,s,'investor_name','Investor name','اسم المستثمر',[305,248,234,54],{wide:true});
text(d,s,'date','Date','التاريخ',[55,337,485,25],{type:'date',defaultToday:true});
d.signatureSlots=[{id:'investor',label:'Investor signature',ar:'توقيع المستثمر',section:'investor',page:1,rect:[55,248,234,54]}];
