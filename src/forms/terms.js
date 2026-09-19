import {document,section,text,choice,option as o} from '../schema.js';
const d=document('terms-and-conditions','Terms & conditions','الشروط والأحكام','shared','Account terms and telephone / fax instructions.','شروط الحساب وتفويض التعليمات بالهاتف والفاكس.',13,[11,13]);
for(const [id,page,title,ar,y] of [['terms',11,'Account terms','شروط الحساب',0],['authorization',13,'Telephone & fax authorization','تفويض الهاتف والفاكس',197.4]]){
 const s=section(d,id,title,ar,page,'Read the original terms before making your choices. Signature images are optional.','اقرأ الشروط الأصلية قبل اختيار إجابتك. إضافة صور التوقيع اختيارية.');
 choice(d,s,id+'_consent',page===11?'Do you want confirmations and account statements only upon request?':'Do you request and consent to services via telephone and fax?',page===11?'هل ترغب بعدم استلام التأكيدات أو كشوف الحساب إلا عند الطلب؟':'هل تطلب وتوافق على تلقي الخدمات بالهاتف والفاكس؟',[o('no','No','لا',[274,81.2+y,8.4,12]),o('yes','Yes','نعم',[309.8,81.2+y,8.4,12])]);
 for(let i=0;i<3;i++) text(d,s,id+'_name_'+i,`Client / signer ${i+1} name${i?' (if applicable)':''}`,`اسم العميل / الموقع ${i+1}${i?' (إن وجد)':''}`,[322,(page===11?134:326.5)+i*36.8,205,31]);
 text(d,s,id+'_date','Date','التاريخ',[267,page===11?263.5:456,78,18],{type:'date',defaultToday:true,dateParts:[[267,page===11?264:456.5,20,16],[292,page===11?264:456.5,27,16],[326,page===11?264:456.5,20,16]],fontSize:7,minFontSize:6});
}
