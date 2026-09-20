const partKeys=['first','second','third','last'];
const partLabels=[['First name','الاسم الأول'],['Second name','الاسم الثاني'],['Third name (optional)','الاسم الثالث (اختياري)'],['Family name','اسم العائلة']];
const has=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const clean=value=>typeof value==='string'?value.trim():'';

// Splitting never translates or drops words. A compound suffix stays together
// in the family-name input; the user can correct the semantic boundaries.
export function splitPersonName(full){
 const words=clean(full).split(/\s+/u).filter(Boolean);
 if(words.length<2)return {first:words[0]||'',second:'',third:'',last:''};
 if(words.length===2)return {first:words[0],second:'',third:'',last:words[1]};
 if(words.length===3)return {first:words[0],second:words[1],third:'',last:words[2]};
 return {first:words[0],second:words[1],third:words[2],last:words.slice(3).join(' ')};
}
export function joinPersonName(parts){
 return (Array.isArray(parts)?parts:partKeys.map(key=>parts?.[key])).map(clean).filter(Boolean).join(' ');
}

const one=(id,options={})=>({id,targets:[id],...options});
const definitions={
 'signature-form':[one('client_name',{audience:'individual'}),one('signer_name')],
 'subscription-form':[one('english_name',{prefix:'en',language:'en'}),one('applicant_name')],
 'subscription-company':[one('auth_name'),one('applicant_name')],
 'terms-and-conditions':['terms','authorization'].flatMap(prefix=>Array.from({length:3},(_,i)=>one(`${prefix}_name_${i}`,{audience:'individual'}))),
 'fatca-crs-individual':[one('signer_ar',{language:'ar'}),one('signer_en',{language:'en'}),one('staff_account_holder')],
 'fatca-crs-corporate':[...Array.from({length:5},(_,i)=>one(`person_${i}_name`)),one('signer_0_name'),one('signer_1_name')],
 'kyc-individual':[{id:'name',targets:['name_1','name_2'],prefix:'name',split:true},one('representative_name'),one('risk_client_name')],
 'kyc-corporate':[one('contact_name'),one('auth_name')],
};

// Existing four-part subscription and FATCA identity rows stay unchanged.
// These groups replace only audited, single-person full-name controls.
export function applyPersonNameFields(documents){
 for(const doc of documents){
  const specs=definitions[doc.id];if(!specs||doc.custom)continue;
  doc.personNameGroups??=[];
  for(const spec of specs){
   if(doc.personNameGroups.some(group=>group.id===spec.id))continue;
   const targets=spec.targets.map(id=>doc.fields.find(field=>field.id===id));
   if(targets.some(field=>!field))continue;
   const original=targets[0],section=doc.sections.find(section=>section.fields.includes(original));
   if(!section||targets.some(field=>!section.fields.includes(field)))continue;
   const language=spec.language||'auto',partIds=partKeys.map(key=>`${spec.prefix||spec.id}_${key}`);
   if(partIds.some(id=>doc.fields.some(field=>field.id===id)))throw Error(`Duplicate person-name part in ${doc.id}/${spec.id}`);
   const group={id:spec.id,targets:targets.map((field,index)=>({id:field.id,join:spec.split?partIds.slice(index*2,index*2+2):[...partIds]})),partIds,label:original.label,ar:original.ar,language,required:targets.some(field=>field.required===true),optional:targets.every(field=>field.optional===true),...(spec.audience?{audience:spec.audience}:{}),...(original.context?{context:original.context}:{} )};
   const parts=partIds.map((id,index)=>({id,label:partLabels[index][0],ar:partLabels[index][1],type:'text',page:original.page,rect:null,uiOnly:true,direction:language==='en'?'ltr':language==='ar'?'rtl':'auto',personNameGroup:group.id,personNamePart:partKeys[index],...(group.optional||index===2?{optional:true}:{}),...(spec.audience?{joinAudience:spec.audience}:{})}));
   for(const target of group.targets){
    const field=doc.fields.find(field=>field.id===target.id);
    Object.assign(field,{join:[...target.join],personNameDerived:true,personNameGroup:group.id,...(spec.audience?{joinAudience:spec.audience}:{hidden:true})});
   }
   doc.fields.splice(doc.fields.indexOf(original)+1,0,...parts);
   section.fields.splice(section.fields.indexOf(original)+1,0,...parts);
   for(const paperGroup of section.paperGroups||[])paperGroup.fields=paperGroup.fields.flatMap(id=>{
    if(id===original.id)return [...(spec.audience?[id]:[]),...partIds];
    return spec.targets.includes(id)&&!spec.audience?[]:[id];
   });
   doc.personNameGroups.push(group);
  }
 }
 return documents;
}

export function personNameGroups(doc,audience=doc?.group){
 return (doc?.personNameGroups||[]).filter(group=>!group.audience||group.audience===audience);
}
export function personNameFieldVisible(field,audience){
 if(!field||field.hidden)return false;
 if(field.joinAudience&&field.joinAudience!==audience)return Boolean(field.personNameDerived);
 return !field.personNameDerived;
}
export function normalizePersonNames(doc,values,{audience=doc?.group,migrate=true}={}){
 const next={...values};
 for(const group of personNameGroups(doc,audience)){
  let present=group.partIds.some(id=>has(next,id));
  if(!present&&migrate){
   const full=joinPersonName(group.targets.map(target=>next[target.id]));
   // An absent legacy name must not manufacture four answered/empty controls.
   if(full){const parts=splitPersonName(full);group.partIds.forEach((id,index)=>next[id]=parts[partKeys[index]]);present=true;}
  }
  if(present)for(const target of group.targets)next[target.id]=joinPersonName(target.join.map(id=>next[id]));
 }
 for(const field of doc.fields||[])if(field.join&&!field.personNameDerived&&field.join.some(id=>has(next,id)))next[field.id]=joinPersonName(field.join.map(id=>next[id]));
 return next;
}
