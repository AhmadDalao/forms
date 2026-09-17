import {document,section,text,choice,option as o} from '../schema.js';
const d=document('subscription-form','Subscription Form','طلب إشتراك','shared','Client details and fund subscription.','بيانات العميل والاشتراك في الصندوق.',1,[1]);
let s=section(d,'client','Client Details','تفاصيل العميل',1);
const edges=[174.23,193.31,212.4,231.47,250.55,269.63,288.71,307.78,326.87,345.94,365.02,384.1,403.05];
text(d,s,'client_account','Client / Account No.','رقم العميل / الحساب بالشركة',[174.7,176.2,228,15.7],{cells:12,maxLength:12,direction:'ltr',fontSize:9,charRects:edges.slice(0,-1).map((x,i)=>[x+.5,176.2,edges[i+1]-x-1,15.7])});
text(d,s,'ar_title','Title','الصفة',[431.4,208,102,16],{direction:'rtl'});
text(d,s,'ar_name','Client’s Full Name','اسم العميل كاملاً',[52.5,208,369.5,16],{direction:'rtl'});
text(d,s,'en_title','Title','الصفة',[73.2,243.2,103,15.7],{direction:'ltr'});
text(d,s,'en_name','Client’s Full Name','اسم العميل كاملاً',[187,243.2,359.5,15.7],{direction:'ltr'});
text(d,s,'id_number','ID No.','رقم الهوية',[124,273,158,13.5],{fontSize:9});
text(d,s,'nationality','Nationality','الجنسية',[359,273,102,13.5],{fontSize:9});
choice(d,s,'id_type','ID Type','نوع الهوية',[
 o('national','Saudi ID','بطاقة أحوال',[418.15,292.88,10.8,10.8]),o('residence','Iqama','إقامة',[325.03,292.83,10.8,10.8]),o('passport','Passport','جواز سفر',[225,292.83,10.8,10.8]),o('other','Other','أخرى',[131.42,292.83,10.8,10.8]),
]);
choice(d,s,'company_id_type','ID Type','نوع الهوية',[
 o('cr','CR','سجل تجاري',[370.44,325.08,10.8,10.8]),o('license','License','ترخيص',[290.02,324.98,10.8,10.8]),o('other','Other','أخرى',[199.34,324.68,10.8,10.8]),
]);
text(d,s,'company_id_number','Its Number','رقمها',[138,347,384,14],{fontSize:9});
s.paperGroups=[
 {title:'',ar:'',fields:['client_account']},
 {title:'Client details in Arabic',ar:'بيانات العميل باللغة العربية',fields:['ar_title','ar_name']},
 {title:'Client details in English',ar:'بيانات العميل باللغة الإنجليزية',fields:['en_title','en_name']},
 {title:'For Individuals',ar:'للأفراد',fields:['id_number','nationality','id_type']},
 {title:'For Corporates',ar:'للشركات',fields:['company_id_type','company_id_number']},
];
s=section(d,'address','Correspondence Address','عنوان المراسلة',1);
for(const [id,en,ar,rect]of [
 ['pob','P.O Box','صندوق بريد',[311,379.25,185,7.8]],['postal','Postal code','الرمز البريدي',[96,379.25,104,7.8]],
 ['city','City','المدينة',[311,394.25,185,7.8]],['country','Country','البلد',[96,394.25,104,7.8]],
 ['phone','Tel.','الهاتف',[311,409.25,185,7.8]],['mobile','Mobil','الجوال',[96,409.25,104,7.8]],
])text(d,s,id,en,ar,rect,{fontSize:6,minFontSize:5,padding:.15,...(['phone','mobile'].includes(id)?{type:'tel'}:{})});
s.paperGroups=[{title:'',ar:'',fields:['pob','postal','city','country','phone','mobile'],paired:true}];
s=section(d,'subscription','Subscription Details','تفاصيل الاشتراك',1);
choice(d,s,'subscription_type','Subscription Details','تفاصيل الاشتراك',[
 o('new','New subscription','اشتراك جديد',[490.62,441.42,10.8,10.8]),o('additional','Add To exiting','إضافة وحدات',[363.54,442.42,10.8,10.8]),
]);
choice(d,s,'payment_method','Payment Method','طريقة الدفع',[
 o('cheque','Cheque','شيك',[215.45,442.42,10.8,10.8]),o('transfer','Transfer','حوالة',[142.93,442.42,10.8,10.8]),
]);
text(d,s,'fund_name','Fund Name','اسم صندوق الاستثمار',[388,468.5,160,12],{fontSize:8,minFontSize:5.5,padding:.4,mirrorRects:[[175.7,120.2,88,8.7],[305.5,120.2,79,8.7]]});
for(const [id,en,ar,rect]of [
 ['currency','Currency','العملة',[294,468.5,88,12]],['unit_price','Unit Price','سعر الوحدة',[173,468.5,117,12]],['units','No. Of Units','عدد الوحدات',[47,468.5,122,12]],
 ['amount_subscribed','Amount Subscribed','مبلغ الاستثمار',[443.5,504.8,105.5,11.3]],['fee_percent','Sub. Fee %','رسوم الاشتراك %',[360.5,504.8,79,11.3]],['fee_amount','Sub. Fee Amount','مبلغ رسوم الاشتراك',[257,504.8,100,11.3]],['total_amount','Total Amount','المبلغ الإجمالي',[161,504.8,91,11.3]],['total_words','Total Amount (In words)','المبلغ الإجمالي كتابة',[47,504.8,109.5,11.3]],
])text(d,s,id,en,ar,rect,{fontSize:8,minFontSize:5.5,padding:.5,...(!['currency','total_words'].includes(id)?{numeric:true}:{})});
s.paperGroups=[{title:'',ar:'',fields:['subscription_type','payment_method']},{title:'',ar:'',fields:['fund_name','currency','unit_price','units']},{title:'',ar:'',fields:['amount_subscribed','fee_percent','fee_amount','total_amount','total_words']}];
s=section(d,'applicant','Applicant','مقدم الطلب',1);
text(d,s,'applicant_name','Name','اسم مقدم الطلب',[348.5,568.2,103,10.5],{fontSize:8,minFontSize:6,padding:.5});
text(d,s,'date','Date','التاريخ',[351,583.5,96.5,8.5],{type:'date',fontSize:7,minFontSize:5.5,padding:.3,dateParts:[[351,583.5,27,8.5],[382,583.5,32,8.5],[418,583.5,29.5,8.5]]});
s.signatureSlot='applicant';
s=section(d,'staff','For company Use Only','للاستعمال الرسمي فقط',1);
choice(d,s,'signature_verified','Signature Verified','التوقيع مطابق',[o('verified','Signature Verified','التوقيع مطابق',[492.07,621.35,10.8,10.8])],{multiple:true});
for(const [id,en,ar,rect]of [
 ['staff_branch','Branch','الفرع',[336,632.8,161,10]],['staff_date','Date','التاريخ',[101,632.8,115,10]],
 ['staff_manager','A/C Mgr.','مدير الحساب',[336,647.2,161,10]],['staff_entered','Entered by','مدخل الطلب',[336,661.6,161,10]],['staff_approved','Rev. & approved by','مراجع ومعتمد',[336,676,161,10]],
])text(d,s,id,en,ar,rect,{fontSize:7,minFontSize:5.5,padding:.4,...(id==='staff_date'?{type:'date'}:{})});
