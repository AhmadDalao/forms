import {document,section,text,choice,option as o} from '../schema.js';
const d=document('fatca-crs-corporate','Corporate FATCA / CRS','فاتكا وCRS للشركات','corporate','Entity tax residence and self-certification.','الإقامة الضريبية والإقرار الذاتي للكيانات.',6,[6]);
let s=section(d,'entity','Entity details','بيانات الكيان',1);
text(d,s,'legal_name','Full legal name','الاسم القانوني الكامل',[62,151,246,42],{multiline:true});
text(d,s,'inc_city','City of incorporation','مدينة التأسيس',[342,152,213,20]);
text(d,s,'inc_country','Country of incorporation','دولة التأسيس',[359,174,196,20]);
for(const [prefix,x,en,ar] of [['residence',60,'Current address','العنوان الحالي'],['head',317,'Head office (if different)','المقر الرئيسي (إذا اختلف)']]){
 for(const [key,label,al,y,offset,w] of [['building','Building number','رقم المبنى',232,80,169],['street','Street','الشارع',251,58,191],['district','District','الحي',270,39,210],['city','City','المدينة',290,30,219],['postal','Postal code + additional number','الرمز البريدي والرقم الإضافي',324,0,249],['country','Country','الدولة',342,40,209]])text(d,s,prefix+'_'+key,`${en}: ${label}`,`${ar}: ${al}`,[x+offset,y,w-(prefix==='head'?8:0),17],{fontSize:9});
}
s=section(d,'tax','Tax residences','الإقامة الضريبية',1,'There are three rows in the original. Enter a TIN, or A/B/C and an explanation if needed. For more rows, use the separate sheet requested by the form.','يتضمن الأصل ثلاثة صفوف. أدخل الرقم الضريبي أو السبب A/B/C والتوضيح عند الحاجة. استخدم ورقة منفصلة للحالات الإضافية حسب النموذج.');
for(let i=0;i<3;i++){
 const y=607.5+i*25.6;
 text(d,s,'tax_country_'+i,`Tax residence ${i+1}: country`,`الإقامة الضريبية ${i+1}: الدولة`,[62,y,200,23],{fontSize:9});
 text(d,s,'tax_tin_'+i,`Tax residence ${i+1}: TIN`,`الإقامة الضريبية ${i+1}: الرقم الضريبي`,[272,y,128,23],{fontSize:9});
 text(d,s,'tax_reason_'+i,`Tax residence ${i+1}: no-TIN reason (A/B/C) / explanation`,`الإقامة الضريبية ${i+1}: سبب عدم وجود الرقم / التوضيح`,[406,y,148,23],{fontSize:8,multiline:true});
}
s=section(d,'fatca','FATCA classification','تصنيف فاتكا',3,'Choose the one classification that applies to your entity. Definitions remain in the original document.','اختر تصنيفًا واحدًا ينطبق على الكيان. تُحفظ التعريفات الواردة في المستند الأصلي.');
const fatca=[['Specified US Person','شخص أمريكي محدد',154],['US Person who is not a Specified US Person','شخص أمريكي غير محدد',203],['KSA FI / FI in a FATCA IGA country','مؤسسة مالية سعودية أو في دولة ذات اتفاقية فاتكا',229],['Participating non-US financial institution','مؤسسة مالية غير أمريكية مشاركة',298],['Registered deemed-compliant non-US FI','مؤسسة مالية غير أمريكية مسجلة وممتثلة حكمًا',348],['Certified deemed-compliant non-US FI','مؤسسة مالية غير أمريكية معتمدة وممتثلة حكمًا',398],['Non-participating non-US FI','مؤسسة مالية غير أمريكية غير مشاركة',424],['Exempt beneficial owner','مالك مستفيد معفى',450],['Excepted non-financial non-US entity','كيان غير مالي وغير أمريكي مستثنى',476],['Active non-financial non-US entity','كيان غير مالي وغير أمريكي نشط',510],['Passive non-financial non-US entity','كيان غير مالي وغير أمريكي سلبي',571]];
choice(d,s,'fatca_class','FATCA category (one only)','فئة فاتكا (واحدة فقط)',fatca.map(([en,ar,y],i)=>o(String(i+1),`${i+1}. ${en}`,`${i+1}. ${ar}`,[515.26,[155.74,204.46,230.5,300.01,349.81,399.49,425.53,451.59,477.51,520.35,572.55][i],5.4,6.4])));
text(d,s,'us_tin','US TIN','رقم التعريف الضريبي الأمريكي',[189,174,175,21],{cells:12,maxLength:12,charRects:[[189.02,14.4],[203.9,13.1],[217.49,13.08],[231.05,14.52],[246.05,14.64],[261.17,14.64],[276.29,12.48],[289.25,14.64],[304.37,14.64],[319.49,14.64],[334.61,14.54],[349.63,14.64]].map(([x,w])=>[x,174,w,21])});
for(const [v,y] of [['3',268],['4',318],['5',368]])text(d,s,'giin_'+v,`GIIN — FATCA category ${v}`,`رقم التعريف الوسيط العالمي — فئة فاتكا ${v}`,[186,y,286,22],{maxLength:19,cells:16,stripDots:true,charRects:[185.66,200.78,215.93,231.05,246.05,261.17,289.25,304.37,319.49,334.61,349.63,381.91,397.03,427.15,442.27,457.39].map(x=>[x,y,14.4,22]),fontSize:9,help:'Enter the GIIN with or without its dots (XXXXXX.XXXXX.XX.XXX).',arHelp:'أدخل رقم GIIN مع النقاط أو بدونها (XXXXXX.XXXXX.XX.XXX).'});
s=section(d,'crs','CRS classification','تصنيف CRS',4);
const crs=[['Investment entity in a non-participating jurisdiction, managed by another FI','كيان استثماري في دولة غير مشاركة تديره مؤسسة مالية أخرى',163],['Other investment entity','كيان استثماري آخر',210],['Depository / custodial institution or specified insurance company','مؤسسة إيداع أو حفظ أو شركة تأمين محددة',239],['Publicly traded corporation or related entity','شركة متداولة علنًا أو كيان مرتبط بها',276],['Governmental entity or central bank','كيان حكومي أو بنك مركزي',350],['International organization','منظمة دولية',373],['Other active NFE','كيان غير مالي نشط آخر',410],['Passive NFE','كيان غير مالي سلبي',439]];
choice(d,s,'crs_class','CRS category (one only)','فئة CRS (واحدة فقط)',crs.map(([en,ar,y],i)=>o(String(i+12),`${i+12}. ${en}`,`${i+12}. ${ar}`,[i===7?501.7:519.58,[164.38,203.98,243.58,273.13,352.33,372.13,411.61,437.67][i],5.4,6.4])));
text(d,s,'exchange','Securities market name','اسم سوق الأوراق المالية',[166,315,321,16]);
s=section(d,'controllers','Controlling persons','الأشخاص المسيطرون',5,'Complete this addendum if you chose FATCA 11, CRS 12 or CRS 19. The original provides five rows.','أكمل الملحق عند اختيار فاتكا 11 أو CRS 12 أو CRS 19. يتضمن الأصل خمسة صفوف.');
const cols=[['name','Name','الاسم',62,72],['address','Address','العنوان',140,41],['dob','Date of birth','تاريخ الميلاد',187,34],['birthplace','Place of birth','مكان الميلاد',227,28],['nationality','Nationality','الجنسية',262,33],['country','Tax residence countries','دول الإقامة الضريبية',301,52],['ownership','Ownership %','نسبة الملكية',359,46],['tin','TIN or no-TIN reason','الرقم الضريبي أو سبب عدم وجوده',412,148]];
for(let i=0;i<5;i++)for(const [key,en,ar,x,w] of cols)text(d,s,`person_${i}_${key}`,`Person ${i+1}: ${en}`,`الشخص ${i+1}: ${ar}`,[x,228+i*54,w,49],{multiline:key!=='ownership',fontSize:8,minFontSize:6.5,...(key==='dob'?{type:'date',fontSize:6.2,minFontSize:5.8,padding:.4}:{}),...(key==='ownership'?{numeric:true}:{}),help:key==='ownership'?'Enter a number; the % sign is printed.':undefined,arHelp:'أدخل رقمًا؛ علامة النسبة مطبوعة.'});
s=section(d,'signatories','Declaration & signatories','الإقرار والموقعون',6,'Read the declaration on page 6. Add signature images if you wish, or sign after downloading.','اقرأ الإقرار في الصفحة 6. أضف صور التوقيع إن رغبت، أو وقّع بعد التنزيل.');
for(let i=0;i<2;i++){
 text(d,s,`signer_${i}_name`,`Signatory ${i+1}: name`,`الموقع ${i+1}: الاسم`,[119+i*258,232,193,22]);
 text(d,s,`signer_${i}_capacity`,`Signatory ${i+1}: capacity`,`الموقع ${i+1}: الصفة`,[130+i*245,329,187,19],{fontSize:9});
}
text(d,s,'date','Date','التاريخ',[162,404,134,27],{type:'date',cells:8});

// Ownership numbers sit immediately before the original percent signs.
for(let i=0;i<5;i++)Object.assign(d.fields.find(f=>f.id===`person_${i}_ownership`),{
 rect:[359,254.5+i*53.6,18,12],align:'right',fontSize:8,minFontSize:6.5,
});
