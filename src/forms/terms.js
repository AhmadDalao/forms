import {document,section,text} from '../schema.js';

const d=document('terms-and-conditions','Al Naeem Real Estate Fund — Terms and Conditions','الشروط والأحكام لصندوق النعيم العقاري','shared','Approved fund terms and investor declaration.','شروط الصندوق المعتمدة وإقرار المستثمر.',38,[38]);
// Eight introductory pages followed by thirty numbered pages. Distinct IDs
// prevent old account-terms signatures from consenting to this new document.
d.pdfVersion='20261015-approved-terms';
d.pageSizes=Array.from({length:38},()=>[595.32,841.92]);
const s=section(d,'declaration','Investor declaration and signature','إقرار مالكي الوحدات والتوقيع',38,
 'I/we have read the fund terms, conditions and appendices, understood and agreed to them, and received a copy after signing. In witness of this, the investor signs these fund terms and conditions on the date stated below.',
 'لقد قمت / قمنا بقراءة الشروط والأحكام والملاحق الخاصة بالصندوق وفهم ما جاء فيها والموافقة عليها، كما جرى الحصول على نسخة منها بعد التوقيع عليها. وإثباتًا لما تقدم، قام المستثمر بالتوقيع على هذه الشروط والأحكام الخاصة بالصندوق في التاريخ والسنة المذكورين أدناه.');
text(d,s,'investor_name','Investor name','اسم المستثمر',[259.21,188.28,234.01,22.38],{wide:true,fontSize:11,minFontSize:7,padding:1.5});
text(d,s,'date','Date','التاريخ',[259.21,246.94,234.01,21.32],{type:'date',defaultToday:true,fontSize:11,minFontSize:7,padding:1.5});
