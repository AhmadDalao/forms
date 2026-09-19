import rules from '../../public/api/subscription/rules.json' with {type:'json'};
export {rules};
export function parseUnits(value) {
 const normalized=String(value??'').trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)));
 if(!normalized)return null;
 if(!/^\d+$/.test(normalized))throw Error('units');
 const units=Number(normalized);
 if(!Number.isSafeInteger(units)||units<1||units>rules.maxUnits)throw Error('units');
 return units;
}
function underThousand(n,attached=false){
 const parts=[],h=Math.floor(n/100),r=n%100;
 if(h)parts.push(h===2&&r===0&&attached?'مائتا':rules.hundreds[h]);
 if(r<10){if(r)parts.push(rules.ones[r]);}
 else if(r<20)parts.push(rules.teens[r-10]);
 else parts.push([rules.ones[r%10],rules.tens[Math.floor(r/10)]].filter(Boolean).join(' و'));
 return parts.join(' و');
}
export function arabicRiyals(amount){
 if(!Number.isSafeInteger(amount)||amount<0)throw Error('amount');
 if(amount===0)return 'صفر ريال سعودي';
 const parts=[];
 for(let scale=rules.scales.length-1;scale>=0;scale--){
  const n=Math.floor(amount/1000**scale)%1000;if(!n)continue;
  if(!scale){parts.push(underThousand(n,true));continue;}
  const [one,two,many]=rules.scales[scale];
  parts.push(n===1?one:n===2?two:`${underThousand(n,true)} ${n%100>=3&&n%100<=10?many:one}`);
 }
 return parts.join(' و')+' ريال سعودي';
}
export function calculateSubscription(value){
 const units=parseUnits(value);
 const fixed={fund_name:rules.fundName,currency:rules.currency,unit_price:String(rules.unitPrice)};
 if(units===null)return {...fixed,units:'',amount_subscribed:'',subscription_fee:'',total_amount:'',total_words:''};
 const investment=units*rules.unitPrice,fee=investment*rules.feePercent/100,total=investment+fee;
 return {...fixed,units:String(units),amount_subscribed:String(investment),subscription_fee:String(fee),total_amount:String(total),total_words:arabicRiyals(total)};
}
