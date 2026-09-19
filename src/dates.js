export const today=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

// Only document-completion dates opt in. Saved revisions and deliberate blanks
// retain the client's answers; viewing a form must not rewrite its history.
export function defaultDates(doc,record,date=today()){
 const values={...record.values};
 if(record.revision)return values;
 for(const field of doc.fields){
  if(field.type==='date'&&field.defaultToday&&!(field.id in values)&&!record.overrides?.includes(field.id))values[field.id]=date;
 }
 return values;
}
