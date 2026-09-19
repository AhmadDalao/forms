import {document,section,text,choice,option as o} from '../schema.js';
const d=document('fatca-crs-individual','Individual tax residency','الإقامة الضريبية للأفراد','individual','FATCA / CRS self-certification and tax details.','الإقرار الذاتي وبيانات فاتكا والإقامة الضريبية.',4,[2,3]);
let s=section(d,'identity','Identity & addresses','الهوية والعناوين',1,'Use full names. The original asks for separate Arabic and English names.','أدخل الأسماء كاملة، وبالعربية والإنجليزية في الخانات المخصصة.');
choice(d,s,'title','Title','اللقب',[o('mr','Mr','السيد',[426.2,131.8,8,9]),o('mrs','Mrs','السيدة',[371.8,131.8,8,9]),o('miss','Miss','الآنسة',[297.3,131.8,8,9]),o('other','Other','آخر',[232.1,131.8,8,9])]);
for(const [key,en,ar,x]of [['first','First name','الاسم الأول',369],['middle','Middle name','الاسم الأوسط',280],['last','Last name','اسم العائلة',192]])text(d,s,'ar_'+key,`${en} (Arabic)`,`${ar} (بالعربية)`,[x,154,84,11],{direction:'rtl',fontSize:8,minFontSize:6.5,padding:.5});
for(const [key,en,ar,x]of [['first','First name','الاسم الأول',192],['middle','Middle name','الاسم الأوسط',280],['last','Last name','اسم العائلة',369]])text(d,s,'en_'+key,`${en} (English)`,`${ar} (بالإنجليزية)`,[x,175,84,11],{direction:'ltr',fontSize:8,minFontSize:6.5});
for(const prefix of ['ar','en']){
 const middle=d.fields.find(f=>f.id===prefix+'_middle');Object.assign(middle,{hidden:true,join:[prefix+'_second',prefix+'_third'],minFontSize:4.5});
 text(d,s,prefix+'_second','Second name','الاسم الثاني',null,{uiOnly:true,direction:prefix==='ar'?'rtl':'ltr'});
 text(d,s,prefix+'_third','Third name (optional)','الاسم الثالث (اختياري)',null,{uiOnly:true,optional:true,direction:prefix==='ar'?'rtl':'ltr'});
}
text(d,s,'dob','Date of birth (Gregorian)','تاريخ الميلاد (ميلادي)',[191,187.5,263,19],{type:'date',cells:8,charRects:[[191,188,31,18],[224,188,31,18],[257,188,31,18],[290,188,21,18],[313,188,42,18],[357,188,31,18],[390,188,31,18],[423,188,31,18]]});
choice(d,s,'gender','Gender','الجنس',[o('female','Female','أنثى',[264.8,212.5,8,9]),o('male','Male','ذكر',[380.8,212.5,8,9])]);
text(d,s,'birth_city','Town / city of birth','مدينة الميلاد',[193,227,259,15]);
text(d,s,'birth_country','Country of birth','دولة الميلاد',[193,245,259,15]);
for(const [prefix,en,ar,y]of [['sa','Current Saudi residence','العنوان الحالي في السعودية',262],['outside','Residence outside Saudi Arabia (if any)','الإقامة خارج السعودية (إن وجدت)',293.5],['mail','Mailing address (if different)','العنوان البريدي (إذا اختلف)',325]]){
 for(const [key,le,la,x,dy,w]of [['building','Building','المبنى',250,0,77],['street','Street','الشارع',403,0,39],['district','District','الحي',245,8,66],['postal','Postal code','الرمز البريدي',391,8,51],['city','City','المدينة',229,16,53],['country','Country','الدولة',331,16,120]])text(d,s,`${prefix}_${key}`,`${en}: ${le}`,`${ar}: ${la}`,[x,y+dy,w,10],{fontSize:7,minFontSize:6,padding:.5});
}
s=section(d,'residency','Citizenship & tax status','الجنسية والوضع الضريبي',1);
const yn=(id,en,ar,x,y)=>choice(d,s,id,en,ar,[o('yes','Yes','نعم',[x,y,9,9]),o('no','No','لا',[x===266.6?385.6:362.5,y,9,9])]);
yn('us_person','Are you a US person?','هل أنت شخص أمريكي؟',253.2,357.8);
text(d,s,'citizenships','Countries of citizenship (if more than one)','دول الجنسية (عند تعدد الجنسيات)',[193,391,259,21],{fontSize:9});
yn('permanent_residence','Immigrant visa or permanent resident status outside Saudi Arabia?','هل لديك تأشيرة هجرة أو إقامة دائمة خارج السعودية؟',253.2,423.4);
text(d,s,'permanent_details','Country and status of each permanent residency','دولة وحالة كل إقامة دائمة',[193,445,259,20],{fontSize:9});
yn('outside_tax','Tax resident in any country outside Saudi Arabia? (No confirms Saudi Arabia as your sole tax residence.)','هل أنت مقيم ضريبي خارج السعودية؟ (اختيار لا يؤكد أن السعودية إقامتك الضريبية الوحيدة.)',266.6,498.4);
for(const [id,en,ar,y]of [['ssn','US Social Security Number (SSN)','رقم الضمان الاجتماعي الأمريكي',653.2],['itin','US Individual Taxpayer Number (ITIN)','رقم المكلف الفرد الأمريكي',664],['atin','US Pending Adoption TIN (ATIN)','الرقم الضريبي لحالة التبني المعلقة',674.8]])text(d,s,id,en,ar,[201,y,214,9.2],{fontSize:6.5,minFontSize:5.5,padding:.3,cells:9,maxLength:9,charRects:[0,1,2,4,5,7,8,9,10].map(i=>[201+i*19.6,y,18.3,9.2]),placeholderRects:[0,1,2,4,5,7,8,9,10].map(i=>[206.5+i*19.6,y+.5,7.5,8]),help:'Enter 9 digits without spaces or hyphens.',arHelp:'أدخل ٩ أرقام دون مسافات أو شرطات.'});
s=section(d,'tax','Tax residence countries','دول الإقامة الضريبية',2,'Complete if you declared tax residency outside Saudi Arabia. The source provides three rows. A: no TIN issued; B: unable to obtain one (explain); C: no TIN required.','أكمل عند الإقامة الضريبية خارج السعودية. يتضمن الأصل ثلاثة صفوف. A: لا تصدر الدولة رقمًا؛ B: تعذّر الحصول عليه (وضّح)؛ C: الرقم غير مطلوب.');
for(let i=0;i<3;i++){
 const y=137.4+i*14.95;
 text(d,s,`tax_country_${i}`,`Country ${i+1}`,`الدولة ${i+1}`,[53.85,y,80,13],{fontSize:8,minFontSize:6.5,mirrorRects:[[470,y,98,13]]});
 text(d,s,`tax_tin_${i}`,`Country ${i+1}: TIN`,`الدولة ${i+1}: الرقم الضريبي`,[137,y,85,13],{fontSize:8,minFontSize:6.5,mirrorRects:[[402,y,64,13]]});
 text(d,s,`tax_reason_${i}`,`Country ${i+1}: no-TIN reason`,`الدولة ${i+1}: سبب عدم وجود الرقم`,[227,y,81,13],{type:'select',selectOptions:[['A','A — Country does not issue TINs','A — الدولة لا تصدر أرقامًا ضريبية'],['B','B — Unable to obtain a TIN','B — تعذّر الحصول على رقم'],['C','C — No TIN required','C — الرقم غير مطلوب']],fontSize:8,mirrorRects:[[313,y,85,13]]});
 text(d,s,`tax_explanation_${i}`,`Country ${i+1}: explain reason B`,`الدولة ${i+1}: توضيح السبب B`,[88,236.4+i*9,99,10],{fontSize:7,minFontSize:6,padding:.5,rtlRect:[455,220.4+i*8.1,99,10]});
}
s=section(d,'signatory','Declaration & signatory','الإقرار والموقع',2,'Read the declaration in the original. Add a signature image if you wish, or sign after downloading.','اقرأ الإقرار في الأصل. أضف صورة توقيع إن رغبت، أو وقّع بعد التنزيل.');
text(d,s,'signer_ar','Signatory name in Arabic','اسم الموقع بالعربية',[198,592,265,14],{direction:'rtl',fontSize:9});
text(d,s,'signer_en','Signatory name in English','اسم الموقع بالإنجليزية',[198,609,265,13],{direction:'ltr',fontSize:9});
choice(d,s,'capacity','Capacity of signatory','صفة الموقع',[o('holder','Account holder','صاحب الحساب',[527.4,654.1,10,10]),o('attorney','Power of attorney','الوكيل',[527.4,667.7,10,10]),o('guardian','Guardian','الوصي',[527.4,681.5,10,10]),o('other','Other — specify below','أخرى — حدد أدناه',[0,0,0,0])]);
text(d,s,'capacity_other','Other capacity','صفة أخرى',[344,709,201,14],{fontSize:8});
text(d,s,'date','Date (Gregorian)','التاريخ (ميلادي)',[133,706,156,18],{type:'date',defaultToday:true,cells:8,charRects:[[91,706,17,18],[110,706,21,18],[133,706,29,18],[164,706,29,18],[195,706,22,18],[219,706,22,18],[243,706,22,18],[267,706,22,18]]});

s=section(d,'staff','Relationship Manager / Customer Service Representative','مدير العلاقة / ممثل خدمة العملاء',3,
 'For completion by the relationship manager or customer service representative. Leave this section blank if it does not apply. Choose electronic or manual signing for the representative below.',
 'يُعبّأ هذا القسم من قبل مدير العلاقة أو ممثل خدمة العملاء. اتركه فارغًا إذا لم يكن مطلوبًا. اختر التوقيع الإلكتروني أو اليدوي للممثل أدناه.');
s.signatureSlot='relationship_manager';
text(d,s,'staff_account_holder','Account holder full name','الاسم الكامل لصاحب الحساب',[137,102,340,21],{fontSize:10,wide:true,direction:'auto'});
text(d,s,'staff_employee_id','Employee ID','الرقم الوظيفي',[134,153,338,11],{fontSize:8,minFontSize:7,direction:'auto'});
// Fifteen individually ruled cells, measured inside the original borders.
text(d,s,'staff_cif','Customer Information File #','رقم ملف بيانات العميل',[133.34,166.5,336.31,23],{
 cells:15,maxLength:15,direction:'ltr',fontSize:10,
 charRects:[133.34,155.78,178.22,200.69,223.13,245.57,268.01,290.45,313.01,335.47,357.91,380.35,402.79,425.35,447.79].map(x=>[x+.4,166.5,21.4,23]),
 help:'Up to 15 characters, one per printed box. Leading zeros are kept.',arHelp:'حتى ١٥ خانة، حرف أو رقم واحد في كل مربع مطبوع. تُحفظ الأصفار في البداية.',
});

// These bilingual answer rows have a printed divider at x=312.
for(const id of ['birth_city','birth_country','citizenships','permanent_details']){
 const f=d.fields.find(f=>f.id===id),[,y,,h]=f.rect;
 f.rect=[193,y,116,h];f.rtlRect=[315,y,137,h];
}
