import {document,section,text,choice,option as o} from '../schema.js';
import {accountType,correspondence,investment,portfolio,risk} from './kyc-shared.js';
const d=document('kyc-individual','Individual KYC','اعرف عميلك — أفراد','individual','Personal, financial and investment information.','البيانات الشخصية والمالية والاستثمارية.',7,[3,7]);
let s=section(d,'identity','Personal details','البيانات الشخصية',1);
accountType(d,s);
choice(d,s,'title','Title','اللقب',[o('mr','Mr','السيد',[335.8,139.7,11.5,13.5]),o('mrs','Mrs','السيدة',[255.4,138.7,11.5,13.5]),o('miss','Miss','الآنسة',[178.7,138.2,11.5,13.5]),o('dr','Dr','الدكتور',[105.7,139,11.5,13.5]),o('eng','Eng','المهندس',[335.6,160.9,11.5,13.5]),o('other','Other','أخرى',[254.9,162.6,11.5,13.5])]);
text(d,s,'title_other','Other title','لقب آخر',[195.8,160,20.5,13],{fontSize:8});
choice(d,s,'gender','Gender','الجنس',[o('male','Male','ذكر',[549.8,138.8,11.5,13.5]),o('female','Female','أنثى',[453.4,138.7,11.5,13.5])]);
text(d,s,'name_1','Full name — first part','الاسم الرباعي — الجزء الأول',[61,205,143,18]);
text(d,s,'name_2','Full name — remaining parts','الاسم الرباعي — بقية الاسم',[214,205,143,18]);
text(d,s,'dob','Date of birth','تاريخ الميلاد',[383,204,176,20],{type:'date',dateParts:[[379.35,206.22,48.75,13.7],[445.5,206.22,48.75,13.7],[510.75,206.22,48.75,13.7]],dateOrder:'ymd',placeholderRects:[[392,209,23,8],[455.5,209,29,8],[522.5,209,26,8]]});
choice(d,s,'marital','Marital status','الحالة الاجتماعية',[o('single','Single','أعزب',[546.8,246.5,11.5,13.6]),o('married','Married','متزوج',[458.8,245.9,11.5,13.6])]);
text(d,s,'dependents','Number of dependents','عدد أفراد الأسرة',[548.25,262.38,8.5,9.65],{numeric:true,maxLength:2,fontSize:7,minFontSize:6,padding:.4,align:'center'});
choice(d,s,'id_type','Type of ID','نوع الهوية',[o('national','National ID','هوية وطنية',[337.9,246.6,11.5,13.6]),o('passport','Passport','جواز سفر',[181.4,245.8,11.5,13.6]),o('residence','Residence ID','هوية مقيم',[338.1,265.4,11.5,13.6]),o('family','Family registration','بطاقة عائلية',[181,264,11.5,13.6]),o('other','Other','أخرى',[338.1,282.8,11.5,13.6])]);
text(d,s,'id_other','Other ID type','نوع الهوية الآخر',[262,280,34,20],{fontSize:7,minFontSize:5.5,padding:.5,multiline:true,rows:2,wide:false});
text(d,s,'id_number','ID number','رقم الهوية',[63,298,178,18]);
text(d,s,'id_expiry','ID expiry date','تاريخ انتهاء الهوية',[63,321,178,20],{type:'date',dateParts:[[57,325.03,48.75,13.7],[118.85,324.88,48.75,13.7],[182.1,324.88,48.75,13.7]],dateOrder:'ymd',placeholderRects:[[70,328,23,7],[129,328,29,7],[196,328,21,7]]});
text(d,s,'issue_place','Place of issue','مكان الإصدار',[63,342,178,18]);
text(d,s,'nationality','Nationality','الجنسية',[63,364,178,18]);
choice(d,s,'education','Education level','المستوى التعليمي',[['primary','Primary','ابتدائي',323.1],['intermediate','Intermediate','متوسط',345.6],['high','High school','ثانوي',366.7],['diploma','Diploma','دبلوم',388.2],['bachelor','Bachelor','بكالوريوس',406.5],['postgraduate','Postgraduate','دراسات عليا',427.5]].map(([v,en,ar,y])=>o(v,en,ar,[545.2,y,11.5,13.6])));
for(const [id,en,ar,y]of [['building','Building number','رقم المبنى',403],['street','Street','الشارع',425],['city','City / district','المدينة والحي',447],['email','Email','البريد الإلكتروني',489],['country','Country of residence','دولة الإقامة',533],['phone','Phone','الهاتف',555],['mobile','Mobile','الجوال',577]])text(d,s,id,en,ar,[66,y,179,18],{...(id==='email'?{type:'email'}:{}),...(id==='phone'||id==='mobile'?{type:'tel'}:{})});
text(d,s,'postal','Postal code','الرمز البريدي',[66,469,83,17]);text(d,s,'postal_additional','Additional postal number','الرقم الإضافي للعنوان',[157,469,88,17]);
choice(d,s,'language','Correspondence language','لغة المراسلة',[o('en','English','الإنجليزية',[152.2,516,11.5,13.6]),o('ar','Arabic','العربية',[200.3,516.2,11.5,13.6])]);
choice(d,s,'income_sources','Income sources','مصادر الدخل',[['employment','Employment','الوظيفة',470.6],['business','Business','التجارة',492.6],['property','Real estate','العقار',514.6],['inheritance','Inheritance','الإرث',535.6],['stock','Stocks','الأسهم',558],['other','Other','أخرى',580.1]].map(([v,en,ar,y])=>o(v,en,ar,[543.3,y,11.5,13.6])),{multiple:true});
correspondence(d,s);
s=section(d,'finances','Employment & finances','العمل والبيانات المالية',2);
const bands=[['100000','100,000 or less','١٠٠٬٠٠٠ أو أقل',537.4,99],['300000','100,001–300,000','١٠٠٬٠٠١–٣٠٠٬٠٠٠',530.8,120.1],['600000','300,001–600,000','٣٠٠٬٠٠١–٦٠٠٬٠٠٠',407.3,98],['1500000','600,001–1,500,000','٦٠٠٬٠٠١–١٬٥٠٠٬٠٠٠',410.2,120],['5000000','1,500,001–5,000,000','١٬٥٠٠٬٠٠١–٥٬٠٠٠٬٠٠٠',285.6,98.2],['10000000','5,000,001–10,000,000','٥٬٠٠٠٬٠٠١–١٠٬٠٠٠٬٠٠٠',288.8,120],['50000000','10,000,001–50,000,000','١٠٬٠٠٠٬٠٠١–٥٠٬٠٠٠٬٠٠٠',158.1,99.4],['more','More than 50,000,000','أكثر من ٥٠٬٠٠٠٬٠٠٠',169.6,120.6]];
for(const [id,en,ar,dy]of [['annual_income','Approximate annual income (SAR)','الدخل السنوي التقريبي (ريال)',0],['net_worth','Net worth excluding current residence (SAR)','صافي الثروة باستثناء المسكن (ريال)',68.7]])choice(d,s,id,en,ar,bands.map(([v,en,ar,x,y])=>o(v,en,ar,[x,y+dy,11.5,13.5])));
choice(d,s,'sector','Employment sector','قطاع العمل',[o('government','Government','حكومي',[536,248.8,11.5,13.5]),o('private','Private','خاص',[434.8,249,11.5,13.5]),o('self','Self-employed','أعمال خاصة',[343.9,249.4,11.5,13.5]),o('other','Other','آخر',[199.3,249.4,11.5,13.5])]);
text(d,s,'sector_other','Other sector','قطاع آخر',[80,246,47,15],{fontSize:8});
for(const [id,en,ar,y]of [['employer','Employer name','اسم جهة العمل',268],['employer_address','Employer address','عنوان جهة العمل',290],['employer_phone','Employer phone','هاتف جهة العمل',311],['job','Job title','المسمى الوظيفي',333],['years_employed','Years of employment','سنوات الخدمة',355]])text(d,s,id,en,ar,[160,y,210,16],{fontSize:9,...(id==='employer_phone'?{type:'tel'}:{})});
text(d,s,'bank','Bank name','اسم البنك',[197,402,211,17]);text(d,s,'iban','IBAN','رقم الحساب المصرفي الدولي',[195,425,252,19],{direction:'ltr'});
for(const [id,en,ar,x,w]of [['branch','Bank branch','فرع البنك',80,62],['bank_country','Bank country','دولة البنك',262,58],['bank_currency','Account currency','عملة الحساب',411,55]])text(d,s,id,en,ar,[x,449,w,17],{fontSize:8});
choice(d,s,'financial_work','Worked in the financial sector during the last five years?','هل عملت في القطاع المالي خلال السنوات الخمس الماضية؟',[o('yes','Yes','نعم',[57.6,527.3,11.5,13.5],[[543.8,528,11.5,13.5]]),o('no','No','لا',[186.9,527,11.5,13.5],[[415.2,528.1,11.5,13.5]])]);
choice(d,s,'financial_experience','Other practical experience in the financial sector?','هل لديك خبرة عملية أخرى في القطاع المالي؟',[o('yes','Yes','نعم',[57.9,561.7,11.5,13.5],[[546.5,563.2,11.5,13.5]]),o('no','No','لا',[187.9,561.6,11.5,13.5],[[416.3,562.9,11.5,13.5]])]);
s=section(d,'disclosures','Disclosures & special cases','الإفصاحات والحالات الخاصة',3);
const yn=(id,en,ar,y)=>choice(d,s,id,en,ar,[o('yes','Yes','نعم',[59.8,y,11.5,13.5],[[544.2,y+1,11.5,13.5]]),o('no','No','لا',[187.5,y,11.5,13.5],[[415.6,y+1,11.5,13.5]])]);
yn('listed_association','Director or closely associated with a director, audit committee member or senior executive of a listed company?','هل أنت عضو أو مرتبط بعضو مجلس إدارة أو لجنة مراجعة أو مسؤول تنفيذي في شركة مدرجة؟',115.7);
text(d,s,'listed_company','Name of that company','اسم الشركة',[62,143,154,14],{fontSize:8});
yn('public_role','Entrusted with prominent public functions, senior management or an international organization role?','هل أنت مكلف بمهام عامة بارزة أو إدارة عليا أو وظيفة بمنظمة دولية؟',181.2);
yn('related_public_role','Related or closely associated with someone in those roles?','هل تربطك قرابة أو علاقة وثيقة بشخص في تلك المناصب؟',241.2);
yn('beneficial_owner','Are you the sole and final beneficial owner of this account?','هل أنت المالك المستفيد النهائي والوحيد لهذا الحساب؟',270.2);
text(d,s,'beneficiary_identity','Identity of the beneficial owner','هوية المالك المستفيد',[65,307,478,13],{fontSize:8});
yn('bank_beneficiary','Is the bank account in your name, and are you its sole final beneficiary?','هل الحساب البنكي باسمك وأنت المستفيد النهائي والوحيد؟',340.9);
text(d,s,'other_finance','Other financial information — part 1','معلومات مالية أخرى — الجزء الأول',[66,375,238,22],{fontSize:9});
text(d,s,'other_finance_2','Other financial information — continued','معلومات مالية أخرى — تكملة',[321,375,233,22],{fontSize:9});
choice(d,s,'special_case','Special cases (if applicable)','الحالات الخاصة (إن انطبقت)',[o('guardian','Court-appointed guardian','قيّم معيّن من المحكمة',[163.4,436.5,11.5,13.5]),o('witness','Illiterate / blind witness','شاهد للأمي أو الكفيف',[163.4,455.7,11.5,13.5]),o('heirs','Heirs’ agent','وكيل الورثة',[163.4,477.4,11.5,13.5]),o('veiled','Veiled woman witness','معرّف المحجبة',[452.4,434.6,11.5,13.5]),o('minor','Parent / guardian of a minor','ولي أو وصي للقاصر',[452.6,458.1,11.5,13.5])],{multiple:true});
text(d,s,'representative_name','Representative / witness name','اسم الممثل أو الشاهد',[116.3,497.5,386.6,11.4],{fontSize:8,minFontSize:6.5});
for(const [id,en,ar,x,y,w,type]of [['rep_id','ID number','رقم الهوية',116.3,514.3,126.1],['rep_type','ID type','نوع الهوية',377.1,514.3,125.8],['rep_expiry','Expiry date','تاريخ الانتهاء',116.3,531.1,126.1,'date'],['rep_issue','Issue date','تاريخ الإصدار',377.1,531.1,125.8,'date'],['rep_phone','Phone','الهاتف',116.3,547.9,126.1],['rep_place','Place of issue','مكان الإصدار',377.1,547.9,125.8],['rep_fax','Fax','الفاكس',377.1,564.7,125.8]])text(d,s,id,en,ar,[x,y,w,11.4],{fontSize:8,minFontSize:6.5,...(type?{type}:['rep_phone','rep_fax'].includes(id)?{type:'tel'}:{})});
investment(d);portfolio(d);risk(d);

// Inset text from the measured rounded borders, including Arabic right edges.
const inputBoxes={"name_1":[52.3,205.32,144,17.7],"name_2":[207,205.32,144,17.7],"id_number":[53.85,300.18,180.45,17.7],"issue_place":[53.85,344.47,180.45,17.7],"nationality":[53.85,366.02,180.45,17.7],"building":[60.2,405.77,180.45,17.7],"street":[60.3,427.72,180.45,17.7],"city":[61.3,448.97,180.45,17.7],"email":[60.6,492.82,180.45,17.7],"country":[59.15,535.77,180.45,17.7],"phone":[58.95,558.57,180.45,17.7],"mobile":[58.55,581.22,181.05,17.7],"postal":[61.85,470.27,82.15,17.7],"postal_additional":[152.95,470.57,88.25,17.7],"other_finance":[58.3,372.79,244.8,28.5],"other_finance_2":[313.1,373.14,244.8,29]};
for(const [id,[x,y,w,h]] of Object.entries(inputBoxes)){d.fields.find(f=>f.id===id).rect=[x+3,y+2,w-6,h-4];}

// Keep writing above the dotted guides and inside the language-specific lines.
for(const [id,rect,rtlRect] of [
 ['listed_company',[56,141,106,12],[381,141,106,12]],
 ['beneficiary_identity',[62,306,106,9.5],[378,302.5,106,12]],
 // Use the clear writing space between labels, not just the short dotted guide.
 ['branch',[61,446.5,116,13]],['bank_country',[223,446.5,105,13]],['bank_currency',[380,446.5,113,13]],
])Object.assign(d.fields.find(f=>f.id===id),{rect,...(rtlRect?{rtlRect,minFontSize:6.5}:{})});
for(const id of ['other_finance','other_finance_2']){
 const f=d.fields.find(f=>f.id===id);f.rect[3]=12.5;f.fontSize=8;f.minFontSize=6.5;f.padding=.6;
}

// The two name boxes form one reading row. Arabic starts in the right box;
// decide the row direction from the whole name so mixed-script chunks cannot collide.
{
 const first=d.fields.find(f=>f.id==='name_1'),last=d.fields.find(f=>f.id==='name_2');
 first.rtlRect=[...last.rect];last.rtlRect=[...first.rect];
 for(const field of [first,last])field.rectDirectionFrom=['name_first','name_second','name_third','name_last','name_1','name_2'];
}
