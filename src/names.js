// Preserve legacy three-part names while collecting second and third separately.
export function nameParts(values,migrate=true){
 const next={...values};
 for(const language of ['en','ar']){
  const second=language+'_second',third=language+'_third',middle=language+'_middle';
  if(migrate&&!(second in next)&&!(third in next)&&next[middle])next[second]=next[middle];
  if(!migrate||second in next||third in next)next[middle]=[next[second],next[third]].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()).join(' ');
 }
 return next;
}
