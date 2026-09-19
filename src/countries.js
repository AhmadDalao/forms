import {hasValue} from './schema.js';

export const saudiCountry=lang=>lang==='ar'?'المملكة العربية السعودية':'Saudi Arabia';
const shared=(id,key='country',whenShared=null)=>({id,sharedKey:key,...(whenShared?{whenShared}:{})});
const fields={
 'subscription-form':[shared('country')],
 'subscription-company':[shared('country'),shared('inc_country','inc_country')],
 'kyc-individual':[shared('country'),{id:'bank_country'}],
 'kyc-corporate':[{id:'registration_country'},shared('inc_country','inc_country'),{id:'bank_country'}],
 'fatca-crs-individual':[{id:'birth_country'},shared('sa_country','country','also_residence'),shared('mail_country')],
 'fatca-crs-corporate':[shared('inc_country','inc_country'),shared('residence_country','country','also_residence'),shared('head_country','country','also_head'),{id:'tax_country_0'},...Array.from({length:2},(_,i)=>({id:`tax_country_${i+1}`,whenAny:[`tax_tin_${i+1}`,`tax_reason_${i+1}`]})),...Array.from({length:5},(_,i)=>({id:`person_${i}_country`,whenAny:['name','address','dob','birthplace','nationality','ownership','tin'].map(key=>`person_${i}_${key}`)}))],
};
// Explicit meanings only: foreign-only residence sections and nationality are
// not country defaults. Imported fields opt in through their shared mapping.
export function countryFields(doc){
 const known=fields[doc.id]||[];
 const mapped=doc.custom?doc.fields.filter(f=>f.type==='text'&&Object.values(f.shared||{}).some(key=>['country','inc_country'].includes(key))).map(f=>({id:f.id})):[];
 return [...known,...mapped].filter(f=>doc.fields.some(field=>field.id===f.id));
}
export const sharedCountryIds=audience=>audience==='corporate'?['country','inc_country']:audience==='individual'?['country']:[];
export function defaultCountries(doc,record,lang='en'){
 if(record.revision)return record;
 const values={...record.values},countryDefaults={...record.countryDefaults};
 for(const field of countryFields(doc)){
  const id=field.id;
  if(record.overrides?.includes(id)){delete countryDefaults[id];continue;}
  if(countryDefaults[id]!==values[id])delete countryDefaults[id];
  const active=!field.whenAny||field.whenAny.some(key=>hasValue(values[key]));
  if(!active){if(countryDefaults[id]!==undefined){delete values[id];delete countryDefaults[id];}continue;}
  if(!(id in values)){values[id]=saudiCountry(lang);countryDefaults[id]=values[id];}
 }
 return {...record,values,...(record.countryDefaults||Object.keys(countryDefaults).length?{countryDefaults}:{})};
}
