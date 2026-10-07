// Complete synthetic PDF audit through the current browser renderer and private PHP calculator.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {docs} from '../src/forms/index.js';
import {sharedCandidates} from '../src/shared-fields.js';
import {signatureSlots} from '../src/signatures.js';
import {fixture} from './workflow-harness.mjs';
const f=await fixture(),out=path.resolve(process.env.QA_OUT||'tmp/pdfs/current-audit-'+Date.now());await fs.mkdir(out,{recursive:true});
const server=await createServer({plugins:[{name:'qa-inline-rules',enforce:'pre',async load(id){if(id.endsWith('/src/subscription/calculations.js'))return (await fs.readFile(id,'utf8')).replace("import rules from '../../public/api/subscription/rules.json' with {type:'json'};",'const rules='+await fs.readFile('public/api/subscription/rules.json','utf8')+';');}}],server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']},proxy:{'/api':f.base}}});await server.listen();
const base=server.resolvedUrls.local[0],browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
const selected=process.env.ONLY_DOCS?.split(','),samples=process.env.ONLY_SAMPLES?.split(',');
const records=selected||samples?JSON.parse(await fs.readFile(out+'/records.json','utf8').catch(()=> '[]')).filter(r=>!((!selected||selected.includes(r.doc))&&(!samples||samples.includes(r.sample)))):[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const cases=['english','arabic','english-long','arabic-long','mixed'];
const arabicDigits=s=>s.replace(/[0-9]/g,n=>'٠١٢٣٤٥٦٧٨٩'[n]);
function answer(field,sample,index){
 const id=field.id,w=field.rect?.[2]||200,ar=sample==='arabic'||sample==='arabic-long',long=sample.includes('long'),mixed=sample==='mixed';
 const enparts=long?['Abdulrahman','Mohammed','Abdullah','Alotaibi']:['Omar','Ali','Hassan','Al Ali'],arparts=long?['عبدالرحمن','محمد','عبدالله','العتيبي']:['أحمد','علي','محمد','العلي'];
 const part=id.match(/(?:^|_)(first|second|third|last|family)(?:_name)?$/),native=id.startsWith('ar_')||field.direction==='rtl'?arparts:id.startsWith('en_')||field.direction==='ltr'?enparts:ar?arparts:enparts;
 if(part&&part[1]==='third'&&mixed)return '';
 if(part)return native[{first:0,second:1,third:2,last:3,family:3}[part[1]]];
 if(field.type==='choice')return field.multiple?field.options.filter((_,j)=>(j+index)%2===0).map(o=>o.value):field.options[index%field.options.length].value;
 if(field.type==='select')return field.selectOptions[index%field.selectOptions.length][0];
 if(field.type==='cards')return field.options[index%field.options.length].value;
 if(field.type==='signature')return index%2?'electronic':'manual';
 if(field.type==='date')return ['1987-02-09','1995-12-31','2001-01-01','2030-11-27','2026-09-20'][index%5];
 const digits=ar?arabicDigits:s=>s;
 if(field.cells){if(field.stripDots)return ['123ABC','456DEF','789GHI','ABC123','DEF456'][index%5]+'01234LE682';return digits('00123456789012345678901234567890'.slice(index%5,index%5+field.cells));}
 if(id==='units')return ['10','١٠','123456','999999999','20'][index%5];
 if(field.numeric||/^(ideal_|current_)/.test(id))return digits(String(/^(ideal_|current_)/.test(id)?20:index+2));
 if(/email/.test(id))return long?'m.alotaibi+qa@example.com':'omar@example.com';
 if(/website/.test(id))return 'https://example.com';
 if(/iban/.test(id))return 'SA0380000000608010167519';
 if(/giin/.test(id))return '123ABC01234LE682';
 if(/phone|mobile|fax/.test(id))return digits('+966551234567');
 if(/postal|additional|unit|dependents|^cr$|unified|_id$|id_number|bank_account|client_account/.test(id))return digits(w<40?'02':w<120?'001234':'0001234567');
 if(/(^years|_ratio|_transactions|^employees$|^capital$|^turnover$)/.test(id))return digits(w<80?'12':'12000');
 if(/title_other/.test(id))return ar?'د.':'Dr';
 if(/id_other|rep_type|id_type/.test(id))return ar?'هوية أخرى':'Other ID';
 if(/currency/.test(id))return ar?'ريال':'SAR';
 if(/capacity|relationship/.test(id))return ar?'مدير':'Director';
 if(/building/.test(id))return digits('128');
 if(/country/.test(id))return ['Saudi Arabia','المملكة العربية السعودية','United States of America','الولايات المتحدة الأمريكية','United Arab Emirates'][index%5];
 if(/nationality/.test(id))return ar?'سعودي':'Saudi';
 if(/(?:^|_)(city|district|birthplace|branch|place)$/.test(id))return ar?'الرياض':'Riyadh';
 if(/street/.test(id))return ar?'شارع الملك فهد':'King Fahd Road';
 if(/address/.test(id))return long&&w>=150?(ar?'١٢٨ شارع الملك فهد، حي النور، الرياض':'128 King Fahd Road, Al Noor, Riyadh'):(ar?'١٢٨ شارع النور':'128 King Rd');
 if(/ownership/.test(id))return digits('25');
 if(/tin/.test(id))return digits(w<60?'001234':'0012345678');
 if(/sector_other/.test(id))return ar?'تعليم':'IT';
 if(/company|entity|institution/.test(id)&&/name/.test(id))return ar?(long?'شركة النور للتطوير والاستثمار العقاري':'شركة النور'):(long?'Al Noor Real Estate Investment Company':'Al Noor Company');
 if(field.direction==='ltr')return long&&w>=150?enparts.join(' '):w<100?'Omar':'Omar Ali';
 if(field.direction==='rtl')return long&&w>=150?arparts.join(' '):w<100?'أحمد':'أحمد علي';
 if(/name/.test(id))return (ar?arparts:enparts).join(' ');
 if(field.multiline&&w>100&&long)return ar?'عبدالرحمن العتيبي\nشركة النور، الرياض':'Abdulrahman Alotaibi\nAl Noor Company, Riyadh';
 return w<40?(ar?'علي':'Ali'):w<100?(ar?'جدة':'Jeddah'):mixed?'أحمد Ali 12':ar?'أحمد علي':'Omar Ali';
}
try{
 await page.route(base,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>PDF audit</body></html>'}));
 await page.goto(base);await page.evaluate(async()=>{window.qa={...(await import('/src/pdf.js')),docs:(await import('/src/forms/index.js')).docs,names:await import('/src/person-names.js'),sub:await import('/src/subscription/model.js')};await document.fonts.ready;});
 const signature='data:image/png;base64,'+(await fs.readFile('tests/fixtures/signature.png')).toString('base64');
 await fs.writeFile(out+'/schema.json',JSON.stringify(docs.filter(doc=>!selected||selected.includes(doc.id)).map(doc=>({...doc,signatureSlots:signatureSlots(doc)})),null,2));
 for(const doc of docs.filter(d=>!selected||selected.includes(d.id))){
  const original=await page.evaluate(async id=>Array.from(await qa.original(qa.docs.find(d=>d.id===id))),doc.id);await fs.writeFile(out+'/'+doc.id+'-original.pdf',Buffer.from(original));
  const supplements=doc.fields.filter(field=>['choice','select','cards'].includes(field.type));
  const max=Math.max(0,...supplements.map(field=>(field.options||field.selectOptions).length));
  const plan=[...cases.map((sample,index)=>({sample,index,complete:true})),{sample:'blank',index:0},{sample:'partial',index:0},{sample:'shared',index:0},...Array.from({length:max},(_,index)=>({sample:'options-'+index,index,options:true}))];
  for(const c of plan.filter(c=>!samples||samples.includes(c.sample))){
   const input={};
   for(const field of doc.fields){
    if(field.sum||field.join||field.hidden||field.readOnly)continue;
    if(c.complete||c.options&&supplements.includes(field))input[field.id]=answer(field,c.complete?c.sample:'english',c.index);
   }
   if(c.sample==='partial'){const field=doc.fields.find(field=>field.rect&&['text','email'].includes(field.type)&&!field.hidden&&!field.readOnly);if(field)input[field.id]=answer(field,'english',0);}
   if(c.sample==='shared'){const audience=doc.group==='shared'?'individual':doc.group;Object.assign(input,{signer_role:audience==='corporate'?'authorized':'client',capacity:'holder'});Object.assign(input,sharedCandidates(doc,{en_first:'Omar',en_second:'Ali',en_third:'Hassan',en_last:'Al Ali',ar_first:'أحمد',ar_second:'علي',ar_third:'محمد',ar_last:'العلي',name_language:'ar',nationality:'سعودي',company_name:'شركة النور',company_name_ar:'شركة النور',company_name_en:'Al Noor Company',company_id_number:'4030123456',inc_country:'المملكة العربية السعودية',auth_first:'أحمد',auth_second:'علي',auth_third:'محمد',auth_last:'العلي',auth_name:'أحمد علي محمد العلي',id_type:'national',id_number:'1012345678',email:'shared.profile+qa@example.com',phone:'+966112345678',mobile:'+966551234567',building:'1234',street:'شارع النور',district:'العليا',city:'الرياض',postal:'12345',additional:'6789',country:'المملكة العربية السعودية',also_residence:true,also_head:true,also_mail:true},input,audience));}
   const signed=c.complete&&c.index%2===1,signatures=signed?Object.fromEntries(signatureSlots(doc).map(slot=>[slot.id,signature])):{};
   const result=await page.evaluate(async({id,input,signatures})=>{const doc=qa.docs.find(d=>d.id===id);let values=qa.names.normalizePersonNames(doc,input,{audience:doc.group==='shared'?'individual':doc.group});try{if(qa.sub.isSubscription(doc))values=await qa.sub.canonicalSubscription(doc,values);for(const field of doc.fields)if(field.join||field.sum)values[field.id]=qa.fieldValue(field,values);const bytes=await qa.generate(doc,values,signatures);return {values,bytes:Array.from(bytes)};}catch(error){return {values,error:error.message,fields:error.fields};}},{id:doc.id,input,signatures});
   const name=doc.id+'-'+c.sample,record={doc:doc.id,sample:c.sample,complete:!!c.complete,original:doc.id+'-original.pdf',signatures:Object.keys(signatures),...result};delete record.bytes;
   if(result.bytes){record.file=name+'.pdf';await fs.writeFile(out+'/'+record.file,Buffer.from(result.bytes));}records.push(record);console.log(result.error?'FAIL':'PASS',name,result.fields||'');
   await fs.writeFile(out+'/records.json',JSON.stringify(records,null,2));
  }
 }
 await fs.copyFile('public/pdfs/al-naeem-terms-consent.pdf',out+'/al-naeem-terms-consent.pdf');
 await fs.writeFile(out+'/report.json',JSON.stringify({base,fixture:f.out,records:records.length,errors,failed:records.filter(r=>r.error)},null,2));
 if(errors.length||records.some(record=>record.error))process.exitCode=1;
}finally{await browser.close();await server.close();await f.close();console.log('OUTPUT '+out);}
