import {section,text,choice,option as o} from '../schema.js';
export function accountType(d,s,corporate=false){choice(d,s,'account_type','Request type','نوع الطلب',[o('new','New account','حساب جديد',[corporate?534.7:537.1,corporate?94.6:97,11.5,13.5]),o('additional','Additional account','حساب إضافي',[corporate?394.8:396.1,corporate?94.4:96.8,11.5,13.5]),o('update','Update information','تحديث بيانات',[214,corporate?94.3:96.8,11.5,13.5])]);}
export function correspondence(d,s,corporate=false){
 const xs=corporate?[119.4,239.3,333.9,486.7]:[122,240,331,482];const y=corporate?617:628;
 choice(d,s,'statement_frequency','Statement frequency','دورية كشف الحساب',[['request','Upon request','عند الطلب'],['monthly','Monthly','شهري'],['daily','Daily','يومي'],['transaction','Per transaction','عند كل عملية']].map((a,i)=>o(...a,[xs[i],y,8,10])));
 choice(d,s,'statement_delivery','Statement delivery','وسيلة إرسال الكشف',[['fax','Fax','فاكس'],['mail','Mail','بريد'],['sms','SMS','رسالة نصية'],['email','Email','بريد إلكتروني']].map((a,i)=>o(...a,[xs[i],y+22,8,10])),{multiple:true});
}
export function investment(d,corporate=false){
 const s=section(d,'investment','Investment profile','الملف الاستثماري',4);
 choice(d,s,'experience','Investment knowledge and experience','المعرفة والخبرة الاستثمارية',[o('extensive','Extensive','عالية',[113.4,corporate?132:138,9.8,10]),o('good','Good','متوسطة',[305,corporate?132:138,9.8,10]),o('limited','Limited','منخفضة',[490.8,corporate?132:138,9.8,10])]);
 const rows=corporate?[
 ['years_investing','Years investing in securities','عدد سنوات الاستثمار',158,240,180],['previous_products','Products previously invested in','المنتجات التي سبق الاستثمار فيها',180,200,225],['loan_ratio','Loan to invested money ratio','نسبة القروض إلى الأموال المستثمرة',202,220,177],['margin_transactions','Margin transactions in the last five years','صفقات التمويل بالهامش خلال خمس سنوات',224,244,113],['overseas_transactions','Securities transactions outside KSA in the last five years','الصفقات خارج المملكة خلال خمس سنوات',246,285,72]
 ]:[['years_investing','Years investing in securities','عدد سنوات الاستثمار',160,240,180],['previous_products','Products previously invested in','المنتجات التي سبق الاستثمار فيها',182,200,225],['certificates','Professional certificates','الشهادات المهنية',204,182,265],['loan_ratio','Loan to invested money ratio','نسبة القروض إلى الأموال المستثمرة',226,220,177],['margin_transactions','Margin transactions in the last five years','صفقات التمويل بالهامش خلال خمس سنوات',248,244,113],['overseas_transactions','Securities transactions outside KSA in the last five years','الصفقات خارج المملكة خلال خمس سنوات',270,285,72]];
 for(const [id,en,ar,y,x,w]of rows)text(d,s,id,en,ar,[x,y-4,w,16],{fontSize:9});
 text(d,s,'overseas_countries','Countries where those transactions occurred','الدول التي نُفذت فيها الصفقات',[60,corporate?284:309,490,14],{fontSize:8});
 const riskY=corporate?321:349;
 choice(d,s,'risk_appetite','Risk appetite','القدرة على تحمل المخاطر',[o('extensive','High','عالية',[113.4,riskY,10,10]),o('good','Medium','متوسطة',[299.7,riskY,10,10]),o('limited','Low','منخفضة',[480.7,riskY,10,10])]);
 const ys=corporate?[365,387,409,431,453,475,497]:[393,415,437,459,481,503,525];
 choice(d,s,'objectives','Investment objectives (select all that apply)','الأهداف الاستثمارية (اختر ما ينطبق)',[['capital','Protect capital','حماية رأس المال'],['income','Generate income','تحقيق الدخل'],['balanced','Balanced','متوازنة'],['growth','Grow capital','نمو رأس المال'],['retirement','Retirement savings','ادخار للتقاعد'],['project','Project finance','تمويل مشروع'],['asset','Buy an asset','شراء أصل']].map((a,i)=>o(...a,[301.4,ys[i],10,10])),{multiple:true});
 text(d,s,'objectives_other','Other objectives','أهداف أخرى',[178,corporate?519:543,303,17],{fontSize:9});
 text(d,s,'restrictions','Investment restrictions','القيود الاستثمارية',[59,corporate?577:601,493,30],{multiline:true,fontSize:9});
}
export function portfolio(d,corporate=false){
 const s=section(d,'portfolio','Portfolio & preferences','المحفظة والتفضيلات',5,'If you enter portfolio percentages, each completed column should total 100%.','إذا أدخلت نسب المحفظة، يجب أن يكون مجموع كل عمود مكتمل ١٠٠٪.');
 choice(d,s,'currencies','Preferred investment currencies','عملات الاستثمار المفضلة',[o('sar','Saudi Riyal','الريال السعودي',[corporate?300.9:270.2,corporate?118:115,10,10]),o('other','Other currencies','عملات أخرى',[corporate?300.9:270.2,corporate?140:134,10,10])],{multiple:true});
 text(d,s,'other_currency','Specify other currencies','حدد العملات الأخرى',[241,corporate?162:147,134,16],{fontSize:9});
 choice(d,s,'horizon','Expected investment period','المدة المتوقعة للاستثمار',[['short','Less than 1 year','أقل من سنة'],['mid','1–5 years','من سنة إلى خمس سنوات'],['long','More than 5 years','أكثر من خمس سنوات']].map((a,i)=>o(...a,[266,corporate?217+i*22.1:203+i*18.45,10,10])));
 const types=[['deposits','Deposits / Murabaha','الودائع والمرابحات'],['debt','Debt instruments','أدوات الدين'],['equity','Equities','الأسهم'],['funds','Investment funds','صناديق الاستثمار'],['property','Real estate','العقارات'],['derivatives','Derivatives','المشتقات'],['alternative','Alternative investments','الاستثمارات البديلة']];
 for(const [key,x]of [['ideal',184],['current',310]])for(let i=0;i<types.length;i++){const [id,en,ar]=types[i];text(d,s,`${key}_${id}`,`${key==='ideal'?'Ideal':'Current'} portfolio: ${en} %`,`${key==='ideal'?'المحفظة المثالية':'المحفظة الحالية'}: ${ar} %`,[x,corporate?333+i*22.1:307+i*18.5,111,19],{numeric:true,total:key,align:'center',maxLength:6,fontSize:10});}
 if(!corporate)custodian(d,s,5,false);
}
export function custodian(d,s,page,corporate=false){
 const y=corporate?425:481;
 text(d,s,'custodian_account','Custodian account number','رقم حساب أمين الحفظ',[64,y,corporate?375:348,16]);
 text(d,s,'custodian_name','Custodian name','اسم أمين الحفظ',[64,y+22,corporate?375:348,16]);
 text(d,s,'custodian_address','Custodian address','عنوان أمين الحفظ',[64,y+44,corporate?375:348,16]);
 const rows=[['certificates','Certificates','الشهادات'],['dividends','Dividends / other income','الأرباح والدخل الآخر'],['proceeds','Sale proceeds','حصيلة البيع']];
 for(let i=0;i<3;i++){
  const [id,en,ar]=rows[i],top=(corporate?525:584)+i*22.5;
  choice(d,s,'send_'+id,`Send ${en} to`,`إرسال ${ar} إلى`,[o('client','Client','العميل',[272,top,11,10]),o('custodian','Custodian','أمين الحفظ',[375.6,top,11,10])]);
  text(d,s,'instructions_'+id,`${en}: other party instructions`,`${ar}: تعليمات طرف آخر`,[60,top-3,148,19],{fontSize:8});
 }
}
export function risk(d){
 const s=section(d,'suitability','Risk questionnaire','استبيان المخاطر',7,'Select your own answers. The total uses only the points printed on the form.','اختر إجاباتك بنفسك. يُحسب المجموع من النقاط المطبوعة في النموذج فقط.');
 const questions=[
 ['risk_experience','Experience with investment products','الخبرة في المنتجات الاستثمارية',[['No experience','لا توجد خبرة',109.9],['Little experience','خبرة قليلة',124.7],['High experience','خبرة عالية',139.5]]],
 ['risk_age','Age band (as asked in the original form)','الفئة العمرية (حسب النموذج الأصلي)',[['Over 65','فوق ٦٥',169.5],['51–65','٥١–٦٥',184.4],['35–50','٣٥–٥٠',199.2],['Under 35','أقل من ٣٥',214]]],
 ['risk_reaction','If your investment suddenly drops in value','إذا هبطت قيمة استثمارك فجأة',[['Sell to prevent further losses','أبيع لتفادي المزيد من الخسائر',243.8],['Partially sell','أبيع جزءًا منه',258.9],['Hold the investment','أحتفظ بالاستثمار',273.8],['Buy more at the lower price','أشتري المزيد بالسعر المنخفض',295.9]]],
 ['risk_duration','How long will you keep this investment?','كم ستحتفظ بهذا الاستثمار؟',[['Less than 1 year','أقل من سنة',326.4],['1–2 years','١–٢ سنة',341.3],['2–3 years','٢–٣ سنوات',356.1],['More than 3 years','أكثر من ٣ سنوات',370.9]]],
 ['risk_capital','Share of total capital used for this investment (excluding property and other non-financial investments)','نسبة رأس المال لهذا الاستثمار (باستثناء العقارات والاستثمارات غير المالية)',[['Less than 25%','أقل من ٢٥٪',408.8],['26–50%','٢٦–٥٠٪',423.6],['51–75%','٥١–٧٥٪',438.9],['More than 75%','أكثر من ٧٥٪',453.6]]]
 ];
 for(const [id,en,ar,opts]of questions)choice(d,s,id,en,ar,opts.map(([en,ar,y],i)=>o(String(i+1),en,ar,[305.7,y,11.5,11.5])));
 text(d,s,'risk_total','Total points','مجموع النقاط',[299,472,22,9],{sum:questions.map(q=>q[0]),fontSize:7,minFontSize:6,align:'center'});
 text(d,s,'desired_funds','Funds / portfolios you wish to invest in','الصناديق أو المحافظ التي ترغب بالاستثمار فيها',[270,568,241,16],{fontSize:9});
 text(d,s,'risk_client_name','Client name','اسم العميل',[343,624,200,18]);
}
