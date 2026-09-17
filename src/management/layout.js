// PDF points from the top left. Touching borders are allowed; shared answer areas are not.
export function layoutConflicts(doc){
 const boxes=[...(doc.fields||[]).flatMap(f=>f.type==='choice'?(f.options||[]).map((o,i)=>({id:f.id,option:i,page:f.page,rect:o.rect})):[{id:f.id,page:f.page,rect:f.rect}]),...(doc.signatures||doc.signatureSlots||[]).map(f=>({id:f.id,page:f.page,rect:f.rect}))].filter(b=>b.rect);
 const conflicts=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];if(a.page!==b.page)continue;
  const width=Math.min(a.rect[0]+a.rect[2],b.rect[0]+b.rect[2])-Math.max(a.rect[0],b.rect[0]);
  const height=Math.min(a.rect[1]+a.rect[3],b.rect[1]+b.rect[3])-Math.max(a.rect[1],b.rect[1]);
  if(width>.5&&height>.5)conflicts.push({page:a.page,first:a.id,second:b.id});
 }
 return conflicts;
}
export function assertLayout(doc){
 const conflicts=layoutConflicts(doc);if(!conflicts.length)return;
 const error=Error(`Answer areas overlap on page ${conflicts[0].page}. Move or resize the highlighted fields before generating a PDF.`);
 error.fields=[...new Set(conflicts.flatMap(c=>[c.first,c.second]))];error.layout=true;throw error;
}
