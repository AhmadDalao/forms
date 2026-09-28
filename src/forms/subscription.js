import {document,section,text} from '../schema.js';
import individualLayout from '../subscription/subscription-individual-layout.json' with {type:'json'};
import companyLayout from '../subscription/subscription-company-layout.json' with {type:'json'};
import {appRoot} from '../routes.js';
import {idOptions,titleOptions} from '../identity-options.js';
for(const corporate of [false,true]){
 const id=corporate?'subscription-company':'subscription-form',map=corporate?companyLayout:individualLayout;
 const d=document(id,'Subscription Application for Al Naeem Real Estate Fund ('+(corporate?'Company':'Individual')+')','طلب الإشتراك في صندوق النعيم العقاري '+(corporate?'(للشركات)':'(للأفراد)'),corporate?'corporate':'individual','Customer details and fund subscription.','بيانات العميل والاشتراك في الصندوق.',2,[2]);
 Object.assign(d,{workflow:'subscription',typeName:corporate?'Company':'Individual',pdfVersion:'20260928-sections-3',pdfUrl:appRoot+'pdfs/subscription-'+(corporate?'company':'individual')+'.pdf?v=20260928-sections-3'});
 d.signatureSlots=[{id:'applicant',label:'Applicant signature',ar:'توقيع مقدم الطلب',...map.signature}];
 let s=section(d,'client','Customer details','تفاصيل العميل',1);
 const field=(id,en,ar,config={})=>text(d,s,id,en,ar,map[id]?.rect||null,{...map[id],fontSize:11,minFontSize:7,padding:2,direction:'auto',...config});
 field('client_account','Client / Account No. (fund manager use)','رقم العميل / الحساب (لاستخدام مدير الصندوق)',{optional:true,sharedKey:'account_number'});
 field('title','Title (optional)','الصفة (اختياري)',corporate?{optional:true}:{type:'select',optional:true,sharedKey:'title',selectOptions:titleOptions});
 field('title_label','','',{hidden:true});
 if(corporate){
  field('company_name','Company name in Arabic','اسم الشركة باللغة العربية',{required:true,sharedKey:'company_name_ar',wide:true,direction:'rtl'});
  field('english_name','Company name in English','اسم الشركة باللغة الإنجليزية',{optional:true,wide:true,direction:'ltr',sharedKey:'company_name_en'});
  field('inc_country','Country of incorporation','دولة التأسيس',{required:true,sharedKey:'inc_country'});
  field('company_id_type','Registration type','نوع تسجيل الشركة',{type:'select',required:true,sharedKey:'company_id_type',selectOptions:[['cr','Commercial registration','سجل تجاري'],['license','Licence','ترخيص'],['other','Other','أخرى']]});
  field('company_id_type_label','','',{hidden:true});
  field('company_id_number','Registration / licence number','رقم السجل / الترخيص',{required:true,sharedKey:'company_id_number'});
  field('auth_name','Authorized signatory name','اسم المفوض بالتوقيع',{required:true,sharedKey:'auth_name',wide:true});
  field('auth_id','Authorized signatory ID number','رقم هوية المفوض',{sharedKey:'auth_id'});
 }else{
  for(const [id,en,ar,optional] of [['first_name','First name','الاسم الأول',false],['second_name','Second name','الاسم الثاني',false],['third_name','Third name (optional)','الاسم الثالث (اختياري)',true],['family_name','Family name','اسم العائلة',false]])field(id,en,ar,{required:!optional,optional,namePart:true,direction:'rtl'});
  field('full_name','','',{hidden:true,join:['first_name','second_name','third_name','family_name']});
  field('english_name','Customer name in English','اسم العميل باللغة الإنجليزية',{optional:true,wide:true,direction:'ltr'});
  field('nationality','Nationality','الجنسية',{required:true,sharedKey:'nationality'});
  field('id_type','ID type','نوع الهوية',{type:'select',required:true,sharedKey:'id_type',selectOptions:idOptions});
  field('id_type_label','','',{hidden:true});
  field('id_number','ID number','رقم الهوية',{required:true,sharedKey:'id_number',dependsOn:'id_type',when:['national','residence','passport','other']});
  field('id_other','Specify the identity document','بيان نوع الهوية الأخرى',{required:true,sharedKey:'id_other',dependsOn:'id_type',when:['other']});
 }
 field('phone','Telephone (optional)','الهاتف (اختياري)',{type:'tel',direction:'ltr',optional:true,sharedKey:'phone'});
 field('mobile','Mobile','الجوال',{type:'tel',direction:'ltr',sharedKey:'mobile'});
 s=section(d,'address','Correspondence address (National Address)','عنوان المراسلة (العنوان الوطني)',1);
 for(const [id,en,ar] of [['short_address','Short address','العنوان المختصر'],['building','Building number','رقم المبنى'],['street','Street name','اسم الشارع'],['additional','Additional number','الرقم الفرعي'],['district','District','اسم الحي'],['postal','Postal code','الرمز البريدي'],['city','City','المدينة'],['email','Email','البريد الإلكتروني'],['country','Country','البلد']])field(id,en,ar,{sharedKey:id,...(id==='email'?{type:'email',direction:'ltr'}:{})});
 field('po_box','P.O. Box (if applicable)','صندوق البريد (إن وجد)',{optional:true,direction:'ltr'});
 s=section(d,'subscription','Subscription details','تفاصيل الاشتراك',2);
 field('subscription_type','Subscription type','نوع الاشتراك',{type:'cards',required:true,options:[{value:'new',label:'New Subscription',ar:'طلب جديد'},{value:'additional',label:'Additional Units',ar:'إضافة وحدات'}]});
 field('payment_method','Payment method','طريقة الدفع',{type:'cards',required:true,options:[{value:'transfer',label:'Bank Transfer',ar:'حوالة'},{value:'cheque',label:'Cheque',ar:'شيك'}]});
 for(const id of ['subscription_type_label','payment_method_label'])field(id,'','',{hidden:true});
 for(const [id,en,ar] of [['fund_name','Investment fund name','اسم صندوق الاستثمار'],['currency','Currency','العملة']])field(id,en,ar,{readOnly:true,staticPdf:true});
 field('units','Number of units','عدد الوحدات',{numeric:true,required:true});
 field('unit_price','Unit price','سعر الوحدة',{readOnly:true,money:true,staticPdf:true});
 for(const [id,en,ar] of [['amount_subscribed','Investment amount','مبلغ الاستثمار'],['subscription_fee','Subscription fee (2% of investment)','رسوم الاشتراك (2% من مبلغ الاستثمار)'],['total_amount','Total amount','المبلغ الإجمالي'],['total_words','Total amount in words','المبلغ الإجمالي كتابة']])field(id,en,ar,{readOnly:true,money:id!=='total_words',wide:id==='total_words',multiline:id==='total_words',direction:id==='total_words'?'rtl':'ltr'});
 s=section(d,'applicant','Applicant','مقدم الطلب',2);
 field('applicant_name','Applicant name','اسم مقدم الطلب',{required:true,wide:true});
 field('date','Application date','التاريخ',{type:'date',required:true,direction:'ltr'});
 field('signature_mode','Signature','التوقيع',{type:'signature',options:[{value:'electronic',label:'Electronic signature',ar:'توقيع إلكتروني'},{value:'manual',label:'Manual signature',ar:'توقيع يدوي'}]});
}
