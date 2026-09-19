import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {docs} from '../src/forms/index.js';
import {calculateSubscription} from '../src/subscription/calculations.js';
const base='http://127.0.0.1:8184',out='tmp/subscription/audit';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const records=[],failures=[];
const scenarios=[
 {name:'english',lang:'en',units:'10',first:'Ahmad',second:'Mohammed',third:'',last:'Al Ali',company:'Al Noor Investment Company',country:'United States of America',street:'King Fahd Road',city:'Riyadh',signature:false},
 {name:'arabic',lang:'ar',units:'١٠',first:'أحمد',second:'محمد',third:'عبدالله',last:'العلي',company:'شركة النور للاستثمار العقاري',country:'المملكة العربية السعودية',street:'شارع الملك فهد بن عبدالعزيز',city:'الرياض',signature:true},
 {name:'long-mixed',lang:'en',units:'123456',first:'Abdulrahman',second:'Mohammed Abdullah',third:'Ibrahim',last:'Al Abdulaziz Al Qahtani',company:'Al Noor Real Estate Investment and Development Company Limited',country:'United States of America',street:'123 King Abdullah bin Abdulaziz Boulevard',city:'Al Madinah Al Munawwarah',signature:true},
 {name:'shared',lang:'ar',units:'2',first:'محمد',second:'أحمد',third:'',last:'القحطاني',company:'شركة آفاق للتطوير العقاري',country:'المملكة العربية السعودية',street:'طريق الملك عبدالله',city:'جدة',signature:false,shared:true},
 {name:'maximum',lang:'ar',units:'999999999',first:'عبدالله',second:'عبدالرحمن',third:'محمد',last:'عبدالعزيز',company:'شركة الاختبار للاستثمار',country:'Saudi Arabia',street:'شارع الاختبار Test 123',city:'الخبر',signature:true},
];
try{
 for(const corporate of [false,true])for(const scenario of scenarios){
  const audience=corporate?'corporate':'individual',folder=corporate?'companies':'individuals',docId=corporate?'subscription-company':'subscription-form',doc=docs.find(d=>d.id===docId);
  const context=await browser.newContext({viewport:scenario.name==='shared'?{width:390,height:844}:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
  await page.goto(base+'/'+folder+'/');
  const profile=scenario.shared?{...(corporate?{company_name:scenario.company,inc_country:scenario.country,company_id_type:'cr',company_id_number:'4030123456',auth_name:[scenario.first,scenario.second,scenario.last].join(' '),auth_id:'1000012345'}:{ar_first:scenario.first,ar_second:scenario.second,ar_last:scenario.last,name_language:'ar',nationality:scenario.country,id_type:'national',id_number:'1000012345'}),email:'first.last+test@example.com',mobile:'+966551234567',short_address:'RABC1234',building:'1234',street:scenario.street,additional:'5678',district:'العليا',postal:'12345',city:scenario.city,country:'المملكة العربية السعودية'}:{};
  await page.evaluate(({audience,profile,lang})=>{localStorage.setItem('itqan.forms.v1.'+audience+'.preferences',JSON.stringify({lang}));localStorage.setItem('itqan.forms.v1.'+audience+'.shared-fields',JSON.stringify(profile));},{audience,profile,lang:scenario.lang});await page.reload();
  assert.equal(await page.locator('[data-doc="'+(corporate?'subscription-form':'subscription-company')+'"]').count(),0);
  const blankPromise=page.waitForEvent('download');await page.locator(`[data-blank="${docId}"]`).click();const blank=await blankPromise;assert.equal(await blank.failure(),null);await blank.saveAs(out+'/'+audience+'-'+scenario.name+'-blank.pdf');
  await page.locator(`[data-doc="${docId}"]`).click();assert.equal(await page.locator('#shared-fields-panel').count(),0);assert.equal(await page.locator('#signature-panel').count(),0);
  if(scenario.shared){assert.equal(await page.locator('[name="'+(corporate?'company_name':'first_name')+'"]').count(),0);assert.ok((await page.locator('#sub-'+(corporate?'company_name':'first_name')).innerText()).includes(corporate?scenario.company:scenario.first));}
  else{
   if(corporate){await page.locator('[name="company_name"]').fill(scenario.company);await page.locator('[name="inc_country"]').fill(scenario.country);await page.locator('[name="company_id_type"]').selectOption('cr');await page.locator('[name="company_id_number"]').fill('4030123456');await page.locator('[name="auth_name"]').fill([scenario.first,scenario.second,scenario.third,scenario.last].filter(Boolean).join(' '));await page.locator('[name="auth_id"]').fill('1000012345');}
   else{
    for(const [name,value] of Object.entries({first_name:scenario.first,second_name:scenario.second,third_name:scenario.third,family_name:scenario.last,nationality:scenario.country}))await page.locator(`[name="${name}"]`).fill(value);
    assert.equal(await page.locator('[name="id_number"]').count(),0);await page.locator('[name="id_type"]').selectOption('other');await page.locator('[name="id_other"]').fill('old hidden detail');await page.locator('[name="id_type"]').selectOption('passport');assert.equal(await page.locator('[name="id_other"]').count(),0);await page.locator('[name="id_number"]').fill('A001234567');
   }
   await page.locator('[name="client_account"]').fill('0000123456');await page.locator('[name="phone"]').fill('+966112345678');await page.locator('[name="mobile"]').fill('+966551234567');
  }
  await page.locator('#sub-next').click();
  if(!scenario.shared){
   assert.equal(await page.locator('[name="country"]').inputValue(),'المملكة العربية السعودية');
   for(const [name,value] of Object.entries({short_address:'RABC1234',building:'1234',street:scenario.street,additional:'5678',district:'العليا',postal:'12345',city:scenario.city}))await page.locator(`[name="${name}"]`).fill(value);
   await page.locator('[name="email"]').pressSequentially('first.last+test@example.com');assert.equal(await page.locator('[name="email"]').inputValue(),'first.last+test@example.com');
   assert.equal(await page.locator('[name="email"]').getAttribute('dir'),'ltr');
  }
  await page.locator('#sub-next').click();
  assert.equal(await page.locator('[data-sub-clear]').count(),2);
  for(const id of ['unit_price','fund_name','currency','amount_subscribed','subscription_fee','total_amount','total_words'])assert.equal(await page.locator(`input[name="${id}"]`).count(),0);
  await page.locator('[name="subscription_type"][value="additional"]').check();await page.locator('[name="payment_method"][value="cheque"]').check();await page.locator('[name="units"]').fill(scenario.units);
  const calculated=calculateSubscription(scenario.units);assert.equal(await page.locator('[data-computed="total_words"]').innerText(),calculated.total_words);
  const unitBox=await page.locator('[data-field="units"]').boundingBox(),priceBox=await page.locator('[data-field="unit_price"]').boundingBox();assert.ok(Math.abs(unitBox.y-priceBox.y)<2);
  await page.screenshot({path:out+'/'+audience+'-'+scenario.name+'-amounts.png',fullPage:true});
  await page.locator('#sub-next').click();assert.equal(await page.locator('[name="applicant_name"]').inputValue(),[scenario.first,scenario.second,scenario.third,scenario.last].filter(Boolean).join(' '));
  await page.locator('[name="date"]').fill('2026-10-12');
  if(scenario.signature){
   await page.locator('[name="signature_mode"][value="electronic"]').check();
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=110;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,300,110);x.strokeStyle='#1456a0';x.lineWidth=3;x.beginPath();x.moveTo(20,80);x.bezierCurveTo(70,10,90,90,120,30);x.bezierCurveTo(150,0,110,100,170,70);x.lineTo(265,50);x.stroke();return c.toDataURL('image/png').split(',')[1];});
   await page.locator('#sub-signature-file').setInputFiles({name:'signature.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('[data-remove-signature]').waitFor();
  }else assert.equal(await page.locator('#sub-signature-file').count(),0);
  await page.reload();await page.locator('#sub-next').waitFor();assert.equal(await page.locator('[name="date"]').inputValue(),'2026-10-12');if(scenario.signature)assert.equal(await page.locator('[data-remove-signature]').count(),1);
  // The applicant name may be corrected and must survive future steps and reload.
  await page.locator('[name="applicant_name"]').fill([scenario.first,scenario.second,scenario.last].join(' '));
  await page.locator('#sub-next').click();await page.locator('[data-pdf-page="2"]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-pdf-page="2"]').width>400);
  assert.equal(await page.locator('canvas[data-pdf-page]').count(),2);
  const downloaded=page.waitForEvent('download');await page.locator('[data-download]').last().click();const download=await downloaded;assert.equal(await download.failure(),null);const file=audience+'-'+scenario.name+'.pdf';await download.saveAs(out+'/'+file);
  await page.locator('#sub-back-review').click();assert.equal(await page.locator('[name="date"]').inputValue(),'2026-10-12');
  if(scenario.name==='maximum'){
   await page.locator('[name="signature_mode"][value="manual"]').check();assert.equal(await page.locator('#sub-signature-file').count(),0);
   const manual=page.waitForEvent('download');await page.locator('[data-download]').click();await(await manual).saveAs(out+'/'+audience+'-manual-after-upload.pdf');
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  records.push({audience,scenario:scenario.name,file,signature:scenario.signature,units:calculated.units,words:calculated.total_words,fields:doc.fields.filter(f=>f.rect&&!f.staticPdf),signatureSlots:doc.signatureSlots});
  console.log('PASS',audience,scenario.name);await context.close();
 }
 assert.deepEqual(failures,[]);await fs.writeFile(out+'/results.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
