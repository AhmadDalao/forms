// Wording transcribed from the supplied PDFs. Answer IDs and PDF coordinates stay stable.
export function applyPaperCopy(docs){
 const D=id=>docs.find(d=>d.id===id);
 let d;
 const F=(id,label,ar,extra={})=>{const f=d.fields.find(f=>f.id===id);if(!f)throw Error(`Unknown paper field ${d.id}/${id}`);Object.assign(f,{label,ar,...extra});return f;};
 const O=(id,rows)=>{const f=d.fields.find(f=>f.id===id);for(const [value,label,ar]of rows){const o=f.options.find(o=>o.value===value);if(!o)throw Error(`Unknown paper option ${id}/${value}`);Object.assign(o,{label,ar});}};
 const S=(id,title,ar)=>Object.assign(d.sections.find(s=>s.id===id),{title,ar});
 const G=(section,...groups)=>{
  const s=d.sections.find(s=>s.id===section);s.paperGroups=groups.map(([title,ar,ids,paired=false])=>({title,ar,fields:typeof ids==='string'?ids.split(' '):ids,paired}));
  const ids=s.paperGroups.flatMap(g=>g.fields);
  if(ids.length!==s.fields.length||new Set(ids).size!==ids.length||s.fields.some(f=>!ids.includes(f.id)))throw Error(`Incomplete paper layout ${d.id}/${section}`);
 };
 const range=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+i);

 d=D('signature-form');Object.assign(d,{title:'Signature Form',ar:'نموذج توقيع'});
 for(const row of [['date','Date','التاريخ'],['client_number','Client Number','رقم العميل'],['client_name','Client Name','اسم العميل'],['account_number','Account Number','رقم الحساب'],['signer_role','Client / Authorized','العميل / المفوض'],['signer_name','Name','الاسم'],['id_number','ID Number','رقم الهوية'],['id_type','Type of ID','نوع الهوية'],['signing_mode','Signature instructions','تعليمات التوقيع'],['signing_limits','Signature instructions','تعليمات التوقيع']])F(...row);
 O('signer_role',[['client','Client','العميل'],['authorized','Authorized','المفوض']]);
 O('signing_mode',[['joint','Joint','مشترك'],['individual','individual','منفرد']]);
 G('client',['','', 'date client_number client_name account_number']);
 G('signatory',['','', 'signer_role signer_name id_number id_type signing_mode signing_limits']);

 d=D('terms-and-conditions');Object.assign(d,{title:'General Terms and Conditions',ar:'شروط وأحكام عامة'});
 F('terms_consent','Do you confirm your desire not to receive any confirmations or account statements except on request basis?','هل تؤكد عدم رغبتك في استلام أي مراسلات أو إشعارات أو كشوف الحساب إلا عند الطلب؟');
 F('authorization_consent','Do you confirm your request and consent to Receive required services via Telephone & Fax','هل تؤكد رغبتك في الحصول على خدمة التعامل عن طريق الهاتف والفاكس؟');
 S('terms','General Terms and Conditions','شروط وأحكام عامة');S('authorization','Authorization Via Tel & Fax','تفويض قبول التعليمات بالهاتف والفاكس');
 for(const prefix of ['terms','authorization'])for(let i=0;i<3;i++)F(`${prefix}_name_${i}`,prefix==='terms'?'Client Name':'Customer Name','اسم العميل',{context:[`Row ${i+1}`,`الصف ${i+1}`]});

 for(const corporate of [false,true]){
  d=D(corporate?'kyc-corporate':'kyc-individual');
  Object.assign(d,{title:corporate?'Investor Information (Corporate)':'Investor Information (Individuals)',ar:corporate?'معلومات المستثمر (الشركات)':'معلومات المستثمر (أفراد)'});
  F('account_type',d.title,d.ar,{wide:true});O('account_type',[['new','New Account','حساب جديد'],['additional','Additional account','حساب إضافي'],['update','Update Information','تحديث بيانات']]);
  for(const id of ['statement_frequency','statement_delivery'])F(id,'Correspondence / Statement','الإشعارات وكشوف الحساب',{wide:true});
  O('statement_frequency',[['request','Upon Request','عند الطلب'],['monthly','Monthly','شهري'],['daily','Daily','يومي'],['transaction','Per Transaction','عند كل عملية']]);
  O('statement_delivery',[['fax','Fax','فاكس'],['mail','Mail','بريد'],['sms','SMS','رسالة قصيرة'],['email','E-mail','البريد الإلكتروني']]);
  for(const row of [['bank','Bank Name','اسم البنك'],['branch','Branch','الفرع'],['bank_country','Country','الدولة'],['bank_currency','Currency','عملة الحساب']])F(...row);
  S('investment','Investment Information Form','نموذج معلومات الاستثمار');
  F('experience','How do you describe your investment Knowledge and Experience?','كيف تصنف معرفتك وخبراتك الاستثمارية؟',{wide:true});
  F('risk_appetite','Risk Appetite','قدرتك على تحمل المخاطر',{wide:true});
  for(const id of ['experience','risk_appetite'])O(id,[['extensive','Extensive','عالية'],['good','Good','متوسطة'],['limited','Limited','منخفضة']]);
  for(const row of [
   ['years_investing','Number of Years of Investment in Securities','عدد سنوات الاستثمار في أسواق الأوراق المالية'],
   ['previous_products','Products Previously Invested In','المنتجات التي سبق الاستثمار فيها'],
   ['loan_ratio','Loan to Invested Money Ratio','نسبة القروض من الأموال المستثمرة'],
   ['margin_transactions','Margin Transactions Over the Past Five Years','صفقات التمويل بالهامش خلال السنوات الخمس السابقة'],
   ['overseas_transactions','Securities Transactions Outside the Kingdom Over the Past Five Years','صفقات الأوراق المالية خارج المملكة خلال السنوات الخمس السابقة'],
   ['overseas_countries','If Securities Transactions Were Executed Outside the Kingdom Over the Past Five Years, Which Countries Were These Transactions Executed?','إذا كان قد تم تنفيذ صفقات أوراق مالية خارج المملكة خلال السنوات الخمس السابقة، ما هي الدول التي تم تنفيذ تلك الصفقات فيها؟'],
   ['objectives','General Investment objectives','الأهداف الاستثمارية العامة'],
   ['objectives_other','Other (Please specify)','غيرها (يرجى التحديد)'],
   ['restrictions','Do You have any Investment restrictions?','هل لديك قيود استثمارية؟'],
   ['currencies','Preferred Investment Currency','ما الأصول الاستثمارية المفضلة للعميل؟'],
   ['other_currency','Please Specify Other Foreign Currencies','يرجى التحديد العملات الأجنبية'],
   ['horizon',corporate?'The Period during which the customer expects to recover the invested money:':'The Period during which the Client expects to recover the invested money','المدة التي يتوقع العميل خلالها استرداد الأموال المستثمرة'],
   ['custodian_account','Account No','رقم الحساب'],['custodian_name','Custodian Name','اسم أمين الحفظ'],['custodian_address','Custodian Address','عنوان أمين الحفظ'],
  ])F(...row);
  O('objectives',[
   ['capital','Protection of capital','حماية رأس المال'],['income','Realization Income','تحقيق الدخل'],['balanced','Balanced','موازنة'],['growth','Growth of Capital','نمو رأس المال'],['retirement','Create Savings for Retirement','تكوين مدخرات للتقاعد'],['project','Project Finance','تمويل مشروع'],['asset',corporate?'Buying an asset':'Buying an asset (for example: a real estate, or a vehicle)',corporate?'شراء أصل':'شراء أصل (على سبيل المثال: عقار أو مركبة)']]);
  F('currencies','Preferred Investment Currency','ما الأصول الاستثمارية المفضلة للعميل؟',{wide:true,help:'(Please tick as many as required)',arHelp:'(يمكنك اختيار أكثر من فئة)'});
  O('currencies',[['sar','Assets in Saudi Riyal','أصول بالريال السعودي'],['other','Assets in Other Foreign Currencies','أصول بعملات أجنبية أخرى']]);
  O('horizon',[['short','Short Term (less than a year)','مدة قصيرة المدى (أقل من سنة)'],['mid','Mid Term (1 to 5 years)','مدة متوسطة المدى (من سنة إلى خمس سنوات)'],['long','Long Term (More Than 5 years)','مدة طويلة المدى (أكثر من خمس سنوات)']]);
  const portfolioTypes=[['deposits','Deposits/Murabah','ودائع ومرابحات'],['debt','Debit Instruments','أدوات دين'],['equity','Equity','أسهم'],['funds','Investment Fund','صناديق استثمارية'],['property','Real estate','عقارات'],['derivatives','Derivatives contracts','عقود مشتقات'],['alternative','Alternative Investments','استثمارات بديلة']];
  for(const [id,en,ar]of portfolioTypes)for(const prefix of ['ideal','current'])F(`${prefix}_${id}`,en,ar,{context:prefix==='ideal'?['Ideal Client Portfolio','المحفظة المثالية للعميل']:['Current Client Portfolio','المحفظة الحالية للعميل']});
  for(const [id,en,ar]of [['certificates','Certificates','الشهادات'],['dividends','Dividends or any other income','حصص الأرباح أو أي دخل آخر'],['proceeds','Sales proceed','حصيلة البيع']]){
   F('send_'+id,en,ar,{context:['Where would you like to send the following:','أين ترغب بإرسال الآتي:']});
   O('send_'+id,[['client',corporate?'Customer':'Client','العميل'],['custodian','Custodian','أمين الحفظ']]);
   F('instructions_'+id,`Other Parties: Specify any instructions issued by the ${corporate?'customer':'Client'} regarding the party.`, 'جهات أخرى: تحديد أي تعليمات صادرة عن العميل بشأن الجهة',{context:[en,ar]});
  }
  const investmentFields=d.sections.find(s=>s.id==='investment').fields.map(f=>f.id);
  G('investment', ['Investment Knowledge and Experience','المعرفة والخبرات الاستثمارية',investmentFields.filter(id=>!['objectives','objectives_other','restrictions'].includes(id))],['General Investment objectives','الأهداف الاستثمارية العامة','objectives objectives_other'],['Investment restrictions','القيود الاستثمارية','restrictions']);
  const portfolioRows=portfolioTypes.flatMap(([id])=>['ideal_'+id,'current_'+id]);
  const custodianGroups=[['Custodian information','معلومات أمين الحفظ','custodian_account custodian_name custodian_address'],['Where would you like to send the following:','أين ترغب بإرسال الآتي:', 'send_certificates instructions_certificates send_dividends instructions_dividends send_proceeds instructions_proceeds']];
  G('portfolio',['Preferred Investment Currency','ما الأصول الاستثمارية المفضلة للعميل؟','currencies other_currency'],['','', 'horizon'],[corporate?"Client’s current portfolio information":"Client’s portfolio information",corporate?'معلومات المحافظ الاستثمارية الحالية للعميل':'معلومات عن المحافظ الاستثمارية للعميل',portfolioRows,true],...(!corporate?custodianGroups:[]));
  S('suitability','Risk Assessment Suitability','استبيان تقييم المخاطر / الملائمة');
  const riskRows=[
   ['risk_experience','1. What is Your level of experience with investment products?','1. ما هو مدى خبرتك في مجال المنتجات الاستثمارية؟',[
    ['No Investment experience (1 Point)','لا يوجد أي خبرة استثمارية (نقطة واحدة)'],['Little Investment experience (2 Points)','خبرة استثمارية قليلة (نقطتان)'],['High Investment experience (3 Points)','خبرة عالية في الاستثمار (3 نقاط)']]],
   ['risk_age','2. What is your age?','2. كم هو عمرك؟',[
    ['Over 65 (1 Point)','فوق 65 (نقطة واحدة)'],['between 51-65 (2 Points)','بين 51-65 (نقطتان)'],['Between 35-50 (3 Points)','بين 35-50 (3 نقاط)'],['Younger Than 35 (4 Points)','أقل من 35 (4 نقاط)']]],
   ['risk_reaction','3. What will be your reaction if your investment suddenly drops in value?','3. ماهي ردة فعلك إذا هبطت قيمة استثمارك فجأة؟',[
    ['Sell it to Prevent further Losses (1 Point)','بيعها لتفادي أي خسارة مستقبلية (نقطة واحدة)'],['Partially sell it to prevent losses (2 Points)','بيع جزء منها لتفادي الخسائر (نقطتان)'],['I would hold the investment (3 Points)','أحافظ عليها (3 نقاط)'],['Buy more if it was attractive at a higher price, it looks even better at its current price (4 Points)','شراء المزيد إذا كان الاستثمار مغري على الأسعار المرتفعة ويظهر بأنه أفضل على سعره الحالي (4 نقاط)']]],
   ['risk_duration','4. For how long do you think you are going to keep your investment ?','4. ما هي المدة التي ستبقى فيها على استثمارك؟',[
    ['Less Than 1 Year (1 Point)','أقل من سنة (نقطة واحدة)'],['Between 1 and 2 years (2 Points)','بين 1-2 سنة (نقطتان)'],['Between 2 and 3 years (3 Points)','بين 2-3 سنوات (3 نقاط)'],['More Than 3 Years (4 Points)','أكثر من 3 سنوات (4 نقاط)']]],
   ['risk_capital','5. What percentage of your total capital (excluding property and other non-financial investment) would you use for this investment?','5. كم أي نسبة رأس المال التي سوف تستعملها لهذا الاستثمار (من إجمالي رأس المال باستثناء العقارات والاستثمارات غير النقدية) ؟',[
    ['Less Than 25% (1 point)','أقل من 25% (نقطة واحدة)'],['Between 26% and 50% (2 points)','بين 26% - 50% (نقطتان)'],['Between 51% and 75% (3 points)','بين 51% - 75% (3 نقاط)'],['More Than 75% (4 points)','أكثر من 75% (4 نقاط)']]],
  ];
  for(const [id,en,ar,options]of riskRows){F(id,en,ar,{wide:true});O(id,options.map(([en,ar],i)=>[String(i+1),en,ar]));}
  F('risk_total','Result (Number of Points)=','النتيجة (عدد النقاط) =');
  F('desired_funds','(funds / portfolios of:','(صناديق / محافظ:',{context:['the client desires to invest in:','يرغب العميل الاستثمار في']});F('risk_client_name','Client Name','اسم العميل');
  if(corporate){
   S('company',d.title,d.ar);
   for(const row of [
    ['company','Company Name','الاسم'],['legal_entity','Legal entity','الكيان القانوني'],['unified','The Unified Number','الرقم الموحد للمنشأة'],['cr','Commercial Registration Number (Or Similar)','رقم السجل التجاري (أو ما يماثله)'],['incorporation','Date of Incorporation or Commencement of Operation','تاريخ التأسيس أو ممارسة النشاط'],['expiry','Date of Expiry','تاريخ الانتهاء'],['address','Registered Address','العنوان المسجل'],['building','Building No','رقم المبنى'],['street','Street Name','اسم الشارع'],['district','District','الحي'],['city','City','المدينة'],['postal','Zip Code','الرمز البريدي'],['additional','Additional No','الرقم الإضافي'],['registration_country','Country of Registration','بلد التسجيل'],['inc_country','Country of Incorporation','دولة ممارسة النشاط'],['business','Main Business','النشاط الرئيسي'],['employees','Number Of Employee','عدد الموظفين'],['capital','Paid-Up Capital','رأس المال المدفوع'],['turnover','Annual Turnover','حجم الأعمال السنوية'],['phone','Phone (Including Ext.)','هاتف (بالإضافة للتحويلة)'],['website','Website Address (If any)','الموقع الإلكتروني (إن وجد)'],
    ['contact_name','Name of Contact','اسم ضابط الاتصال'],['business_phone','Business Phone','الهاتف'],['email','Email','البريد الإلكتروني'],['mobile','Mobile Number','الجوال'],['contact_address','Address for correspondence','عنوان المراسلة'],['bank_owner','Account Owner Name','اسم مالك الحساب'],['bank_account','Main Account','رقم الحساب الرئيسي'],['listed','Is the Company a publicly listed in the Saudi Market ?','هل الشركة مدرجة في السوق السعودي؟'],['owners','Names Of Natural persons who own or control 25% or more of the shares','أسماء الأشخاص الطبيعيين المالكين أو المسيطرين على 25% أو أكثر من الحصص'],['directors','Name of all directors and senior executives','أسماء جميع المديرين وكبار الإداريين'],['financial_info',"Any other financial information on the client’s financial situation",'أي معلومات مالية أخرى عن الوضع المالي للعميل'],
    ['auth_name','Name of the authorized Person on the account','اسم المفوض على الحساب'],['auth_relationship','His/her Relationship with the client/company','علاقته بالعميل/الشركة'],['auth_nationality','Nationality','الجنسية'],['auth_id_type','ID Type','نوع الهوية'],['auth_id','ID No','رقم الهوية'],['auth_issue_place','Place of Issue','مكان الإصدار'],['auth_issue_date','Date of Issue','تاريخ الإصدار'],['auth_expiry','Expiry Date','تاريخ الانتهاء'],['auth_address','Building No. & Street','رقم المبنى والشارع'],['auth_city','City','المدينة'],['auth_district','District','اسم الحي'],['auth_postal','Zip Code','الرمز البريدي'],['auth_unit','Unit No','رقم الوحدة'],['auth_additional','Extended Code','الرقم الإضافي'],['auth_pob','POB (For Client Outside KSA only)','صندوق البريدي (للعملاء خارج المملكة فقط)'],['auth_phone','Other Phone','هاتف آخر'],['auth_mobile','Mobile','الجوال'],['auth_email','E-mail','البريد الإلكتروني'],
   ])F(...row);
   O('auth_id_type',[['family','Family ID','هوية عائلية'],['national','National ID','هوية وطنية'],['passport','Passport','جواز سفر'],['residence','Residence','إقامة']]);
   G('company',['','',d.sections.find(s=>s.id==='company').fields.filter(f=>!f.id.startsWith('statement_')).map(f=>f.id)],['Correspondence / Statement','الإشعارات وكشوف الحساب','statement_frequency statement_delivery']);
   G('contacts',['Contact Information','معلومات الاتصال','contact_name business_phone email mobile contact_address'],["Client’s Banking Information",'معلومات الحساب البنكي','bank bank_owner bank_account branch bank_country bank_currency'],['General Information','معلومات عامة','listed owners directors financial_info']);
   G('authorized',['Names of Persons duly authorized on the account','أسماء الأشخاص المفوضين بإدارة الحساب','auth_name auth_relationship auth_nationality auth_id_type auth_id auth_issue_place auth_issue_date auth_expiry'],['Correspondence address for the authorized person','عنوان المراسلة للمفوض','auth_address auth_city auth_district auth_postal auth_unit auth_additional auth_pob auth_phone auth_mobile auth_email'],...custodianGroups);
  }else{
   S('identity',d.title,d.ar);
   for(const row of [
    ['title','Title','لقب المستثمر'],['title_other','Other','أخرى'],['gender','Gender','الجنس'],['name_1','Name','الاسم الرباعي'],['name_2','Name','الاسم الرباعي'],['dob','Date of Birth','تاريخ الميلاد'],['id_type','Type Of ID','نوع الهوية'],['id_other','Other','أخرى'],['id_number','ID Number','رقم الهوية'],['id_expiry','Expiry Date','تاريخ الانتهاء'],['issue_place','Place of Issue','مكان الإصدار'],['nationality','Nationality','الجنسية'],['marital','Marital Status','الحالة الاجتماعية'],['dependents','Number of Dependents','عدد أفراد الأسرة'],['education','Educational Level','المستوى التعليمي'],['income_sources','Income Source','مصادر الدخل'],['building','Building','رقم المبنى'],['street','Street Name','اسم الشارع'],['city','City & District','المدينة والحي'],['postal','Zip code','الرمز البريدي'],['postal_additional','Zip code','الرمز البريدي'],['email','Email','البريد الإلكتروني'],['language','Language of Correspondence','لغة المراسلة'],['country','Country of residence','دولة الإقامة'],['phone','Phone','الهاتف'],['mobile','Mobile','الجوال'],
    ['annual_income','The approximate annual income (In SAR)','الدخل السنوي التقريبي (بالريال السعودي)'],['net_worth','Approximate Net Worth (Excluding Current residence) – In SAR','صافي الثروة التقريبي (باستثناء المنزل) – بالريال السعودي'],['sector','Sector','قطاع'],['sector_other','Other','أخرى'],['employer',"Employer’s Name",'اسم جهة العمل'],['employer_address',"Employer’s Address",'عنوان جهة العمل'],['employer_phone',"Employer’s Phone Number",'هاتف جهة العمل'],['job','Job Title','مسمى الوظيفة'],['years_employed','Years Employment','مدة الخدمة'],['iban','IBAN Number','رقم الحساب المصرفي الدولي'],
    ['financial_work','Has The Client worked in the financial sector during the past five years? (this Includes, for example: working for capital market institutions, banks, finance companies, insurance companies)','هل سبق للعميل العمل في القطاع المالي خلال السنوات الخمس السابقة (يشمل ذلك على سبيل المثال: العمل لدى مؤسسات السوق المالية، البنوك، شركات التمويل، شركات التأمين)؟'],['financial_experience','Does the Client have any other practical experience? related to the financial sector?','هل للعميل أي خبرات عملية أخرى ذات صلة بالقطاع المالي؟'],
    ['listed_association','Does the client a director or have a close association with a board of directors’ member, an audit committee member, or a senior executive a listed company?','هل العميل عضو أو ذو علاقة بعضو مجلس إدارة أو لجنة مراجعة أو أحد كبار التنفيذيين في شركة مدرجة؟'],['listed_company','If Yes, Mention The company name.','إذا كان الجواب نعم يرجى ذكر اسم الشركة'],['public_role','Is the client entrusted with prominent public functions in the kingdom or a foreign country, senior management positions, or a position in an international organization?','هل العميل مكلف بمهمات عليا في المملكة أو في دولة أجنبية أو مناصب إدارة عليا أو وظيفة في إحدى المنظمات الدولية؟'],['related_public_role','Does The client have a relationship (by blood or marriage up to the second degree), or have association with a person entrusted with a prominent public function in the kingdom or a foreign country, senior management positions, or a position in an international organization?','هل للعميل صلة قرابة (بعلاقة الدم أو الزواج وصولاً إلى الدرجة الثانية) أو يعد مقرباً من شخص مكلف بمهمات عليا في المملكة أو في دولة أجنبية أو مناصب إدارة عليا أو وظيفة في إحدى المنظمات الدولية؟'],['beneficial_owner','Are you the sole and final owner and beneficiary of the investment account or business relationship?','هل أنت المالك والمستفيد الحقيقي والنهائي والوحيد للحساب الاستثماري أو علاقة العمل؟'],['beneficiary_identity','The identity of the beneficial owner of the account or business relationship (if the answer to above questions I no)','هوية المستفيد الحقيقي من الحساب أو علاقة العمل (في حال الإجابة عن السؤال أعلاه بلا)'],['bank_beneficiary','Is the bank account you entered in the box assigned to the account opening file in your name and are you the owner and the real and final beneficiary and only?','هل الحساب البنكي الذي قمت بإدخاله في الخانة المخصصة له بملف فتح الحساب باسمك وهل أنت المالك والمستفيد الحقيقي والنهائي والوحيد له؟'],['other_finance','Any other financial information on the investor’s financial situation:','أي معلومات أخرى عن الوضع المالي للمستثمر'],['other_finance_2','Any other financial information on the investor’s financial situation:','أي معلومات أخرى عن الوضع المالي للمستثمر'],['special_case','Information for special case','معلومات الحالات الخاصة'],['representative_name','Name','الاسم'],['rep_id','ID No','رقمها'],['rep_type','ID Type','نوع الهوية'],['rep_expiry','Date of Expiry','تاريخ الانتهاء'],['rep_issue','Date of Issue','تاريخ الإصدار'],['rep_phone','Tel No','رقم الهاتف'],['rep_place','Place of Issue','مكان الإصدار'],['rep_fax','Fax No','رقم الفاكس'],['certificates','Professional Certificates','الشهادات المهنية'],
   ])F(...row);
   for(const [id,n]of [['name_1',1],['name_2',2],['postal',1],['postal_additional',2],['other_finance',1],['other_finance_2',2]])d.fields.find(f=>f.id===id).context=[`Box ${n}`,`الخانة ${n}`];
   O('title',[['mr','Mr.','السيد'],['mrs','Mrs.','السيدة'],['miss','Miss','الآنسة'],['dr','Dr.','الدكتور'],['eng','Eng.','المهندس'],['other','Other','أخرى']]);
   O('id_type',[['national','National ID','أحوال مدنية'],['passport','Passport','جواز سفر'],['residence','ResidenceID','هوية مقيم'],['family','Family Registration','بطاقة عائلة'],['other','Other','أخرى']]);
   O('education',[['primary','Primary','ابتدائي'],['intermediate','Intermediate','متوسط'],['high','High School','ثانوي'],['diploma','Diploma','دبلوم'],['bachelor','Bachelor','جامعي'],['postgraduate','Postgraduate','دراسات عليا']]);
   O('income_sources',[['employment','employment','وظيفة'],['business','Business','تجارة'],['property','Real Estate','عقارات'],['inheritance','Inheritance','إرث'],['stock','Stock','أسهم'],['other','Other','أخرى']]);
   O('language',[['en','English',''],['ar','','عربي']]);
   O('sector',[['government','Government','حكومي'],['private','Private','خاص'],['self','Self- Employment','أعمال خاصة'],['other','Other','أخرى']]);
   for(const id of ['annual_income','net_worth'])O(id,[['100000','100,000 Or less','100,000 أو أقل'],['300000','300,000-100,001',''],['600000','600,000 – 300,001',''],['1500000','1,500,000 – 600,001',''],['5000000','5,000,000 – 1,500,001',''],['10000000','10,000,000 – 5,000,001',''],['50000000','50,000,000 – 10,000,001',''],['more','More Than 50,000,000','أكثر من 50,000,000']]);
   O('special_case',[['guardian','Court Appointed Guardian','قيم لناقص الأهلية'],['witness','Illiterate and Blind Witness','شاهد للأمي والكفيف'],['heirs','Inheritors Agent','وكيل الورثة'],['veiled','Veiled Woman Witness','معرف المحجبة'],['minor','Father / Guardian of a Minor','ولي / وصي للقاصر']]);
   G('identity',['','', 'account_type title title_other gender'],['','', 'name_1 name_2 dob'],['Type Of ID','نوع الهوية','id_type id_other id_number id_expiry issue_place nationality'],['Marital Status','الحالة الاجتماعية','marital dependents'],['Educational Level','المستوى التعليمي','education'],['Correspondence Address','عنوان المراسلة','building street city postal postal_additional email language country phone mobile'],['Income Source','مصادر الدخل','income_sources'],['Correspondence / Statement','الإشعارات وكشوف الحساب','statement_frequency statement_delivery']);
   G('finances',['','', 'annual_income net_worth'],['Employment Related Information','معلومات عن جهة العمل','sector sector_other employer employer_address employer_phone job years_employed'],["Client’s Banking Information",'معلومات الحساب البنكي','bank iban',true],['','', 'branch bank_country bank_currency'],["Client’s Professional Experiences in The Financial Sector",'الخبرات العملية في القطاع المالي','financial_work financial_experience']);
   G('disclosures',['General Information','معلومات عامة','listed_association listed_company public_role related_public_role beneficial_owner beneficiary_identity bank_beneficiary other_finance other_finance_2'],['Information for special case','معلومات الحالات الخاصة','special_case representative_name rep_id rep_type rep_expiry rep_issue rep_phone rep_place rep_fax']);
  }
 }

 d=D('fatca-crs-individual');
 Object.assign(d,{title:'INTERNATIONAL TAX TRANSPARENCY — Self-Certification & Declaration Form (FATCA & CRS) – INDIVIDUAL',ar:'الشفافية الضريبية الدولية — نموذج شهادة إقرار ذاتي (قانون الامتثال الضريبي للحسابات الأجنبية ومعيار الإبلاغ المشترك) – الأفراد'});
 S('identity','Section A – Customer/Account Holder Information','القسم أ - معلومات العميل / صاحب الحساب');
 F('title','Title','اللقب');O('title',[['mr','Mr.','السيد'],['mrs','Mrs.','السيدة'],['miss','Miss.','الآنسة'],['other','Other','آخر']]);
 const nameParts=[['first','First name','الاسم الأول'],['second','Second name','الاسم الثاني'],['third','Third name (optional)','الاسم الثالث (اختياري)'],['last','Family name','اسم العائلة'],['middle','Second and third names (PDF)','الاسمان الثاني والثالث (PDF)']];
 for(const prefix of ['ar','en'])for(const [id,en,ar]of nameParts)F(prefix+'_'+id,en,ar);
 for(const row of [['dob','Date of Birth: (Gregorian/Western)','تاريخ الميلاد: (الميلادي)'],['gender','Gender','الجنس'],['birth_city','Town or City of Birth','مدينة أو مكان الميلاد'],['birth_country','Country of Birth','بلد الميلاد']])F(...row);
 const addressNames=[['building','Building #','المبنى'],['street','Street Name','اسم الشارع'],['district','District','المنطقة'],['postal','Postal Code','الرمز البريدي'],['city','City','المدينة'],['country','Country','الدولة']];
 for(const prefix of ['sa','outside','mail'])for(const [id,en,ar]of addressNames)F(prefix+'_'+id,en,ar);
 const addresses=[
  ['Current Residence Address in Saudi Arabia (Wasel)','عنوان الإقامة الحالي في المملكة العربية السعودية (واصل)',addressNames.map(([id])=>'sa_'+id)],
  ['If there is residence address outside Saudi Arabia, please indicate:','إذا كان هناك عنوان إقامة خارج المملكة العربية السعودية، فيرجى توضيحه:',addressNames.map(([id])=>'outside_'+id)],
  ['Mailing Address: (if different from the Current Residence) to be included','العنوان البريدي: (في حال اختلافه عن عنوان العميل)',addressNames.map(([id])=>'mail_'+id)],
 ];
 G('identity',['','', 'title'],['Customer name in Arabic','اسم العميل باللغة العربية','ar_first ar_second ar_third ar_last ar_middle'],['Customer name in English','اسم العميل باللغة الإنجليزية','en_first en_second en_third en_last en_middle'],['','', 'dob gender birth_city birth_country'],...addresses);
 for(const group of d.sections.find(s=>s.id==='identity').paperGroups)if(group.fields.includes('en_first')||group.fields.includes('ar_first'))group.nameRow=true;
 for(const row of [
  ['us_person','Are you a US person?','هل أنت شخص من الولايات المتحدة الأمريكية؟'],
  ['citizenships','If more than one citizenship, please indicate each country of citizenship','في حالة وجود أكثر من جنسية، يرجى الإشارة إلى كل دولة لتلك الجنسيات'],
  ['permanent_residence','Do you have an immigrant visa or permanent resident status in a country other than Saudi Arabia','هل لديك تأشيرة هجرة أو إقامة دائمة في بلد آخر غير المملكة العربية السعودية'],
  ['permanent_details','If yes, please indicate the state of each permanent residency','إذا كانت الإجابة بنعم، يرجى توضيح الحالة لكل إقامة دائمة'],
  ['outside_tax','Are you a Tax Resident of any country or countries outside of Saudi Arabia?','هل أنت مقيم ضريبي في أي دولة أو دول خارج المملكة العربية السعودية؟'],
  ['ssn','A Social Security Number (SSN)','رقم الضمان الاجتماعي (SSN)'],['itin','An Individual Taxpayer Identification Number (ITIN)','رقم تعريف المكلف الفرد (ITIN)'],['atin','A Taxpayer Identification Number for Pending US Adoptions (ATIN)','رقم تعريف ضريبي لحالات التبني المعلقة في الولايات المتحدة (ATIN)'],
 ])F(...row);
 Object.assign(d.fields.find(f=>f.id==='us_person'),{help:'If yes, please complete section B',arHelp:'إذا كانت الإجابة بنعم، يرجى إكمال القسم ب'});
 Object.assign(d.fields.find(f=>f.id==='outside_tax'),{help:'By selecting ‘No’, I confirm that Saudi Arabia is my sole residency for tax purposes. If Yes, please complete section C',arHelp:'باختيار "لا"، أؤكد أن المملكة العربية السعودية هي إقامتي الوحيدة للأغراض الضريبية. في حال الإجابة بـ (نعم) الرجاء إكمال القسم ج'});
 G('residency',['Section A – Customer/Account Holder Information','القسم أ - معلومات العميل / صاحب الحساب','us_person citizenships permanent_residence permanent_details outside_tax'],['Section B – USA Tax Residents','القسم ب – الإقامة الضريبية في الولايات المتحدة الأمريكية','ssn itin atin']);
 S('tax','Section C – Tax Residency Information','القسم ج - معلومات الإقامة الضريبية');
 Object.assign(d.sections.find(s=>s.id==='tax'),{note:'',arNote:'',paperNotes:[
  ['Please specify your Country (ies)/Jurisdiction(s) of Residence for Tax Purposes including Taxpayer Identification number.','الرجاء تحديد دولة (دول)/الولاية القضائية (الولايات القضائية) الإقامة لأغراض ضريبية بما فيه رقم التعريف الضريبي.'],
  ['If TIN is not available please choose one of the following reasons:','في حال عدم وجود رقم التعريف الضريبي، الرجاء اختيار أحد الأسباب التالية:'],
  ['A. The country/jurisdiction where the Account Holder is resident does not issue TINs to its residents','أ. لا تصدر الدولة/ الولاية القضائية المقيم فيها صاحب الحساب أرقام تعريف ضريبية للمقيمين فيها'],
  ['B. The Account Holder is otherwise unable to obtain a TIN or equivalent number (Please explain why you are unable to obtain a TIN if you have selected this reason).','ب. أو خلاف ذلك، يتعذر على صاحب الحساب الحصول على رقم تعريف ضريبي أو رقم معادل له (يرجى توضيح سبب عدم قدرتك على الحصول على رقم تعريف ضريبي إذا اخترت هذا السبب).'],
  ['C. No TIN is required. (Note. Only select this reason if the domestic law of the relevant jurisdiction does not require the collection of the TIN issued by such jurisdiction)','ج. ليس مطلوباً الحصول على رقم تعريف ضريبي. (ملاحظة. حدد هذا السبب فقط إذا كان القانون المحلي للولاية القضائية ذات الصلة لا يتطلب الحصول على رقم تعريف ضريبي صادر عن تلك الولاية القضائية)'],
 ]});
 const taxGroups=[];
 for(let i=0;i<3;i++){
  F('tax_country_'+i,'Country/jurisdiction','البلد/ الولاية القضائية');
  F('tax_tin_'+i,'Taxpayer Identification Number (TIN) or Functional Equivalent','رقم التعريف الضريبي أو ما يعادله وظيفياً');
  F('tax_reason_'+i,'If no TIN available enter Reason A, B or C','في حالة عدم وجود رقم التعريف الضريبي، الرجاء اختيار أحد الأسباب أ، ب أو ج',{selectOptions:[['A','A','أ'],['B','B','ب'],['C','C','ج']]});
  F('tax_explanation_'+i,'Please explain why you are unable to obtain a TIN if you have selected this reason','يرجى توضيح سبب عدم قدرتك على الحصول على رقم تعريف ضريبي إذا اخترت هذا السبب',{context:[`Country${i+1}`,`البلد ${i+1}`]});
  taxGroups.push([String(i+1),'', [`tax_country_${i}`,`tax_tin_${i}`,`tax_reason_${i}`]]);
 }
 G('tax',...taxGroups,['B. The Account Holder is otherwise unable to obtain a TIN or equivalent number','ب. أو خلاف ذلك، يتعذر على صاحب الحساب الحصول على رقم تعريف ضريبي أو رقم معادل له',range('tax_explanation_',3)]);
 S('signatory','Section D – Declaration and Signature','القسم د - الإقرار والتوقيع');
 F('signer_ar','Name of Signatory in Arabic','اسم الموقع باللغة العربية');F('signer_en','Name of Signatory in English','اسم الموقع باللغة الإنجليزية');
 F('capacity','Capacity of Signatory: (Please tick 1 box only)','صفة الموقع: (الرجاء وضع إشارة في مربع واحد فقط)');
 O('capacity',[['holder','Account Holder','صاحب الحساب'],['attorney','Power of Attorney','الوكيل'],['guardian','Guardian','الوصي'],['other','Other (Please specify below)','أخرى (يرجى التحديد أدناه)']]);
 F('capacity_other','Other (Please specify below)','أخرى (يرجى التحديد أدناه)');F('date','Date (Gregorian)','التاريخ الميلادي');

 // This original is English-only. Arabic labels below translate the interface;
 // selectable options retain the original English wording, as does the PDF.
 d=D('fatca-crs-corporate');
 Object.assign(d,{title:'International Tax Self-Certification Form (For ENTITIES)',ar:'نموذج الإقرار الذاتي الضريبي الدولي (للكيانات)'});
 for(const f of d.fields)if(f.options)for(const o of f.options)o.ar='';
 S('entity','Part 1: Account Holder information','الجزء الأول: معلومات صاحب الحساب');
 F('legal_name','A. Full Legal name of the Entity','أ. الاسم القانوني الكامل للكيان');F('inc_city','City','المدينة');F('inc_country','Country','الدولة');
 const addressCols=[['building','Building Number','رقم المبنى'],['street','Street Name','اسم الشارع'],['district','District','الحي'],['city','City','المدينة'],['postal','Postal Code and additional number (if any)','الرمز البريدي والرقم الإضافي (إن وجد)'],['country','Country','الدولة']];
 for(const prefix of ['residence','head'])for(const [id,label,ar]of addressCols)F(prefix+'_'+id,label,ar);
 G('entity',['','', 'legal_name'],['B. Country of Incorporation or Organization','ب. دولة التأسيس أو التنظيم','inc_city inc_country'],['C. Current Residence Address','ج. عنوان الإقامة الحالي',addressCols.map(([id])=>'residence_'+id)],['D. Address of corporate Head Office (complete only if different from Section C)','د. عنوان المقر الرئيسي للشركة (يُعبّأ فقط إذا اختلف عن القسم ج)',addressCols.map(([id])=>'head_'+id)]);
 S('tax','Part 2: Tax Residence Information','الجزء الثاني: معلومات الإقامة الضريبية');
 for(let i=0;i<3;i++){
  F('tax_country_'+i,'Country/Jurisdiction of tax residence','دولة أو ولاية الإقامة الضريبية');F('tax_tin_'+i,'Tax Identification Number (TIN)','رقم التعريف الضريبي');F('tax_reason_'+i,'If no TIN available type the reason','إذا لم يتوفر رقم تعريف ضريبي، اكتب السبب',{wide:false});
 }
 G('tax',...Array.from({length:3},(_,i)=>[String(i+1),'',[`tax_country_${i}`,`tax_tin_${i}`,`tax_reason_${i}`]]));
 S('fatca','FATCA QUESTIONNAIRE','استبيان فاتكا');
 F('fatca_class','Part 3: FATCA Classification (only tick one classification where applicable)','الجزء الثالث: تصنيف فاتكا (اختر تصنيفًا واحدًا فقط حيثما ينطبق)',{wide:true,optionFields:{'1':['us_tin'],'3':['giin_3'],'4':['giin_4'],'5':['giin_5']}});
 const fatca=[
  'Are you a Specified US Person?',
  'Are you a US Person who is not a Specified US Person?',
  'Are you a KSA Financial Institution or a Financial Institution organized in a country with an intergovernmental agreement with the US regarding FATCA?',
  'Are you a Participating Non-US Financial Institution?',
  'Are you a Registered Deemed-Compliant Non-US Financial Institution?',
  'Are you a Certified Deemed-Compliant Non-US Financial Institution?',
  'Are you a Non-Participating Non-US Financial Institution?',
  'Are you an Exempt Beneficial Owner?',
  'Are you an Excepted Non-Financial Non-US Entity? (This classification is also commonly known as an Excepted NFFE)',
  'Are you an Active Non-Financial Non-US Entity? (This classification is also commonly known as an Active NFFE)',
  'Are you a Passive Non-Financial Non-US Entity? (This classification is also commonly known as an Passive NFFE) (if you have ticked this question, please complete Addendum 1)',
 ];
 O('fatca_class',fatca.map((label,i)=>[String(i+1),`${i+1}. ${label}`,'']));
 F('us_tin','US TIN','رقم التعريف الضريبي الأمريكي');for(const i of [3,4,5])F('giin_'+i,'GIIN','رقم تعريف الوسيط العالمي');
 S('crs','CRS QUESTIONNAIRE','استبيان معيار الإبلاغ المشترك');
 F('crs_class','Part 4: CRS Classification (only tick one classification where applicable)','الجزء الرابع: تصنيف معيار الإبلاغ المشترك (اختر تصنيفًا واحدًا فقط حيثما ينطبق)',{wide:true,optionFields:{'15':['exchange']}});
 const crs=[
  'Are you Financial Institution- Investment Entity located in a Non-Participating Country /Jurisdiction and managed by another Financial Institution (if you have ticked this question, please complete Addendum 1)',
  'Are you an Financial Institution- Other Investment Entity?',
  'Are you a Financial Institution - Depository Institution, Custodial Institution or Specified Insurance Company?',
  'Are you an Active NFE – A corporation that is publicly traded or a Related Entity of a publicly traded corporation? (please provide the name of the securities market in which the corporation is traded)',
  'Are you an Active NFE – A Governmental Entity or Central Bank?',
  'Are you an Active NFE – An International Organization?',
  'Are you an Active NFE Other than 15 through 17 above?',
  'Are you a Passive NFE ? (if you have ticked this question, please complete Addendum 1)',
 ];
 O('crs_class',crs.map((label,i)=>[String(i+12),`${i+12}. ${label}`,'']));F('exchange','please provide the name of the securities market in which the corporation is traded','يرجى ذكر اسم سوق الأوراق المالية الذي تُتداول فيه الشركة');
 S('controllers','Addendum 1: Controlling Persons of Investment Entity and Passive NFEs/NFFEs','الملحق الأول: الأشخاص المسيطرون على الكيان الاستثماري والكيانات غير المالية السلبية');
 const cols=[['name','Name of Controlling Person','اسم الشخص المسيطر'],['address','Address of Controlling Person','عنوان الشخص المسيطر'],['dob','Date of Birth (dd/mm/yyyy) (where applicable)','تاريخ الميلاد (يوم/شهر/سنة) (حيثما ينطبق)'],['birthplace','Place of birth (City and Country)','مكان الميلاد (المدينة والدولة)'],['nationality','Nationality of the Controlling Person','جنسية الشخص المسيطر'],['country','Country of tax residency (If you multi tax residency please use multiple lines)','دولة الإقامة الضريبية (إذا تعددت دول الإقامة الضريبية، استخدم عدة أسطر)'],['ownership','Percentage Ownership held by Controlling Person','نسبة الملكية التي يملكها الشخص المسيطر'],['tin','TIN of Controlling Person (If a TIN is unavailable please provide the appropriate reason A, B or C where indicated below)','رقم التعريف الضريبي للشخص المسيطر (إذا لم يتوفر، اذكر السبب المناسب A أو B أو C في الموضع المحدد أدناه)']];
 for(let i=0;i<5;i++)for(const [id,label,ar]of cols)F(`person_${i}_${id}`,label,ar,{wide:false});
 G('controllers',...Array.from({length:5},(_,i)=>[String(i+1),'',cols.map(([id])=>`person_${i}_${id}`)]));
 for(let i=0;i<2;i++){
  F(`signer_${i}_name`,'Name','الاسم');F(`signer_${i}_capacity`,'Capacity of Signatory (i.e. account-holder or power of attorney)','صفة الموقع (أي صاحب الحساب أو الوكيل بموجب توكيل)');
 }
 F('date','Date','التاريخ');
 G('signatories',['1','', 'signer_0_name signer_0_capacity'],['2','', 'signer_1_name signer_1_capacity'],['','', 'date']);
}
