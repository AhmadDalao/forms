import {appRoot} from '../routes.js';
export function runtimeDocument(record){
 const fields=record.fields||[],signatures=record.signatures||[];
 return {...record,custom:true,pdfUrl:`${appRoot}api/management.php?action=document&id=${encodeURIComponent(record.id)}&v=${record.pdfVersion}`,fields,
  signing:[...new Set(signatures.map(s=>s.page))],signatureSlots:signatures,
  sections:Array.from({length:record.pages},(_,i)=>({id:'page_'+(i+1),title:'Page '+(i+1),ar:'الصفحة '+(i+1),page:i+1,fields:fields.filter(f=>f.page===i+1)})).filter(s=>s.fields.length||signatures.some(f=>f.page===s.page)),
 };
}
export async function loadCatalogue(builtin){
 try{
  const response=await fetch(`${appRoot}api/management.php?action=catalogue`,{cache:'no-store',signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw Error('Catalogue unavailable');
  const data=await response.json();if(!data.documents?.length)return {docs:builtin,cards:null};
  if(!data.documents.some(d=>d.id==='subscription-company')){
   const company=builtin.find(d=>d.id==='subscription-company');
   if(company){data.documents.push({...company,builtin:true});data.orders.corporate=(data.orders.corporate||[]).map(id=>id==='subscription-form'?company.id:id);}
  }
  const cards=data.documents.map(r=>{
   const old=builtin.find(d=>d.id===r.id);
   const migrated=old?.workflow==='subscription'&&r.group==='shared';
   const doc=old?{...old,title:migrated?old.title:r.title,ar:migrated?old.ar:r.ar,description:r.description,arDescription:r.arDescription}:r.builtin?{...r}:runtimeDocument(r);
   return {...doc,order:Object.fromEntries(['individual','corporate'].map(a=>[a,(data.orders[a]||[]).indexOf(r.id)+1]))};
  });
  return {docs:cards.filter(d=>!d.downloadOnly),cards};
 }catch{return {docs:builtin,cards:null};}
}
