// Derived paper totals travel with the answers, not only the painted PDF.
export function withAnswerTotals(fields, input) {
 const values={...input};
 for(const field of fields)if(field.sum){
  const parts=field.sum.map(id=>values[id]);
  values[field.id]=parts.every(v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v)))
   ?String(parts.reduce((sum,v)=>sum+Number(v),0)):'';
 }
 return values;
}
