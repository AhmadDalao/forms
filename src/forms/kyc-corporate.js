import {document,section,text,choice,option as o} from '../schema.js';
import {accountType,correspondence,investment,portfolio,custodian,risk} from './kyc-shared.js';
const d=document('kyc-corporate','Corporate KYC','اعرف عميلك — شركات','corporate','Company, ownership and investment information.','بيانات الشركة والملكية والاستثمار.',7,[7]);
let s=section(d,'company','Company details','بيانات الشركة',1);accountType(d,s,true);
const rows=[['company','Company name','اسم الشركة',133,130,350],['legal_entity','Legal entity','الكيان القانوني',155,115,340],['unified','Unified number','الرقم الموحد',177,150,290],['cr','Commercial registration number (or similar)','رقم السجل التجاري (أو ما يماثله)',199,231,182],['incorporation','Date of incorporation / commencement','تاريخ التأسيس أو بدء النشاط',221,261,122,'date'],['expiry','Registration expiry date','تاريخ انتهاء السجل',243,133,310,'date'],['address','Registered address','العنوان المسجل',266,153,278],['building','Building number','رقم المبنى',288,125,325],['street','Street name','الشارع',310,125,325],['district','District','الحي',332,110,350],['city','City','المدينة',354,100,360],['postal','Postal code','الرمز البريدي',376,125,318],['additional','Additional number','الرقم الإضافي',398,135,295],['registration_country','Country of registration','دولة التسجيل',420,166,249],['inc_country','Country of incorporation','دولة التأسيس',442,168,242],['business','Main business','النشاط الرئيسي',464,137,286],['employees','Number of employees','عدد الموظفين',486,164,256],['capital','Paid-up capital','رأس المال المدفوع',508,137,274],['turnover','Annual turnover','حجم الأعمال السنوي',531,145,275],['phone','Phone including extension','الهاتف مع التحويلة',553,164,200],['website','Website (if any)','الموقع الإلكتروني (إن وجد)',575,167,226]];
for(const [id,en,ar,y,x,w,type]of rows)text(d,s,id,en,ar,[x,y-5,w,19],{fontSize:9,...(type?{type}:id==='phone'?{type:'tel'}:{})});
correspondence(d,s,true);
s=section(d,'contacts','Contact, banking & ownership','التواصل والبنك والملكية',2);
for(const [id,en,ar,y]of [['contact_name','Contact name','اسم مسؤول التواصل',97],['business_phone','Business phone','هاتف العمل',119],['email','Email','البريد الإلكتروني',141],['mobile','Mobile number','الجوال',163],['contact_address','Correspondence address','عنوان المراسلة',185],['bank','Bank name','اسم البنك',230],['bank_owner','Bank account owner','اسم صاحب الحساب البنكي',251],['bank_account','Main bank account number','رقم الحساب البنكي الرئيسي',273]])text(d,s,id,en,ar,[167,y,210,17],{fontSize:9,...(id==='email'?{type:'email'}:['business_phone','mobile'].includes(id)?{type:'tel'}:{})});
for(const [id,en,ar,x,w]of [['branch','Bank branch','فرع البنك',80,56],['bank_country','Bank country','دولة البنك',249,60],['bank_currency','Account currency','عملة الحساب',399,64]])text(d,s,id,en,ar,[x,294,w,17],{fontSize:8});
choice(d,s,'listed','Is the company publicly listed in the Saudi market?','هل الشركة مدرجة في السوق السعودي؟',[o('yes','Yes','نعم',[172,359,9,11]),o('no','No','لا',[92,359,9,11])]);
text(d,s,'owners','Natural persons owning or controlling 25% or more','الأشخاص الطبيعيون المالكون أو المسيطرون على ٢٥٪ أو أكثر',[61,391,320,68],{multiline:true,fontSize:10});
text(d,s,'directors','All directors and senior executives','جميع أعضاء مجلس الإدارة وكبار التنفيذيين',[61,474,320,69],{multiline:true,fontSize:10});
text(d,s,'financial_info','Other financial information','معلومات مالية أخرى',[61,557,320,69],{multiline:true,fontSize:10});
s=section(d,'authorized','Authorized person & custodian','المفوض وأمين الحفظ',3);
text(d,s,'auth_name','Authorized person’s name','اسم المفوض',[231,94,186,18]);
text(d,s,'auth_relationship','Relationship to client / company','العلاقة بالعميل أو الشركة',[237,116,159,18]);
text(d,s,'auth_nationality','Nationality','الجنسية',[135,139,320,17]);
choice(d,s,'auth_id_type','ID type','نوع الهوية',[o('family','Family ID','هوية عائلية',[141.9,164.8,7.7,8]),o('national','National ID','هوية وطنية',[248.9,164.8,7.7,8]),o('passport','Passport','جواز سفر',[350.1,164.8,7.7,8]),o('residence','Residence ID','هوية مقيم',[455.9,164.8,7.7,8])]);
text(d,s,'auth_id','ID number','رقم الهوية',[100,178,162,23],{cells:12,maxLength:12,fontSize:9});
text(d,s,'auth_issue_place','Place of issue','مكان الإصدار',[395,183,108,17]);
text(d,s,'auth_issue_date','Date of issue','تاريخ الإصدار',[123,205,100,17],{type:'date',dateParts:[[123,205,30,17],[159,205,22,17],[188,205,34,17]],fontSize:8});
text(d,s,'auth_expiry','Expiry date','تاريخ الانتهاء',[402,205,98,17],{type:'date',dateParts:[[402,205,26,17],[435,205,21,17],[463,205,36,17]],fontSize:8});
text(d,s,'auth_address','Building number and street','رقم المبنى والشارع',[160,247,235,18]);
for(const [id,en,ar,x,y,w]of [['auth_city','City','المدينة',99,269,117],['auth_district','District','الحي',361,269,115],['auth_postal','Postal code','الرمز البريدي',115,291,98],['auth_unit','Unit number','رقم الوحدة',365,291,120],['auth_additional','Additional number','الرقم الإضافي',149,313,266],['auth_pob','P.O. box (clients outside KSA)','صندوق البريد (خارج المملكة)',216,335,129],['auth_phone','Other phone','هاتف آخر',132,357,101],['auth_mobile','Mobile','الجوال',365,357,122],['auth_email','Email','البريد الإلكتروني',102,379,313]])text(d,s,id,en,ar,[x,y,w,18],{fontSize:9,...(id==='auth_email'?{type:'email'}:['auth_phone','auth_mobile'].includes(id)?{type:'tel'}:{})});
custodian(d,s,3,true);investment(d,true);portfolio(d,true);risk(d);

// The official authorized-person ID row contains eleven digit boxes.
{
 const f=d.fields.find(f=>f.id==='auth_id');
 const edges=[95.66,109.58,123.5,137.3,151.22,165.02,178.82,192.62,206.45,220.13,233.93,247.25];
 Object.assign(f,{cells:11,maxLength:11,rect:[96,180,151,20],charRects:edges.slice(0,-1).map((x,i)=>[x+.5,180,edges[i+1]-x-1,20])});
}
for(const [id,rect] of [
 ['contact_name',[160,93,212,14]],['business_phone',[160,115,212,14]],['email',[160,137,212,14]],
 ['mobile',[160,159,212,14]],['contact_address',[160,181,212,14]],
 ['bank',[165,226,225,14]],['bank_owner',[165,247.6,225,14]],['bank_account',[165,269.2,225,14]],
 // Use the clear writing space between labels, not just the short dotted guide.
 ['branch',[61,292,101,14]],['bank_country',[210,292,106,14]],['bank_currency',[369,292,123,14]],
])d.fields.find(f=>f.id===id).rect=rect;
