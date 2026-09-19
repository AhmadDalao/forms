import {loadPreview} from '../pdf.js';
const arabic=/[\u0600-\u06ff]/;
const labelParts=text=>({label:arabic.test(text)?'':text,ar:arabic.test(text)?text:''});
const classify=text=>/e.?mail|بريد/i.test(text)?'email':/phone|mobile|هاتف|جوال/i.test(text)?'tel':/date|تاريخ/i.test(text)?'date':'text';
const signatureLabel=text=>/^(?:signature|التوقيع|توقيع)\s*:?\s*$/i.test(text.normalize('NFKC').replace(/[\u0640\u064b-\u065f]/g,''));
function nearestLabel(items,rect){
 const [x,y,w,h]=rect;
 const ranked=items.filter(i=>i.str.trim()).map(i=>({...i,text:i.str.trim(),score:Math.abs(i.y-(y+h/2))*3+Math.min(Math.abs(i.x+i.w-x),Math.abs(i.x-x-w))})).sort((a,b)=>a.score-b.score),nearest=ranked[0];
 // Signature and name captions can share a row; keep each in its own column.
 if(nearest&&(nearest.x+nearest.w<=x||nearest.x>=x+w)){
  const own=ranked.find(i=>i.x<x+w&&i.x+i.w>x&&Math.abs(i.y-nearest.y)<2);
  if(own)return own.text;
 }
 return nearest?.text||'';
}
// Conservative suggestions only. Printed words, table borders and scans need review.
function blankLines(canvas,viewport,items){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),{data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height,scale=viewport.scale,found=[];
 const dark=(x,y)=>{const n=(y*w+x)*4;return Math.max(data[n],data[n+1],data[n+2])<150&&Math.max(data[n],data[n+1],data[n+2])-Math.min(data[n],data[n+1],data[n+2])<30&&data[n+3]>100;};
 for(let y=20*scale;y<h-10*scale;y+=1){
  let start=-1;
  for(let x=0;x<=w;x++){
   if(x<w&&dark(x,Math.floor(y))){if(start<0)start=x;continue;}
   if(start>=0){const width=x-start;
    if(width>=45*scale&&width<=400*scale){
     const r=[start/scale,y/scale-13,width/scale,12];
     if(!found.some(f=>Math.min(f[0]+f[2],r[0]+r[2])-Math.max(f[0],r[0])>.5&&Math.min(f[1]+f[3],r[1]+r[3])-Math.max(f[1],r[1])>.5)){
      let ink=0;
      for(let sy=Math.max(0,Math.floor(y-12*scale));sy<y-2*scale;sy++)for(let sx=Math.ceil(start+2*scale);sx<x-2*scale;sx++){const n=(sy*w+sx)*4;if(Math.min(data[n],data[n+1],data[n+2])<210)ink++;}
      let thick=0;for(let sx=Math.ceil(start+2*scale);sx<x-2*scale;sx++)if(dark(sx,Math.min(h-1,Math.floor(y+3*scale))))thick++;
      if(ink===0&&thick/width<.1&&!items.some(i=>i.str.trim()&&i.x<r[0]+r[2]&&i.x+i.w>r[0]&&i.bottom>r[1]&&i.top<r[1]+r[3]))found.push(r);
     }
    }start=-1;
   }
  }
 }
 return found.slice(0,80);
}
export async function inspectPDF(file,onProgress=()=>{}){
 if(file.size>20*1024*1024)throw Error('Use a PDF smaller than 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const pdf=await loadPreview(bytes);
 try{
  if(pdf.numPages>50)throw Error('Use a PDF with at most 50 pages.');
  if(pdf.isPureXfa)throw Error('XFA forms need conversion to a standard PDF before importing.');
  const pageSizes=[],fields=[],signatures=[],suggestions=[],groups=new Map();let serial=0,widgets=0;
  for(let number=1;number<=pdf.numPages;number++){
   onProgress(`Reading page ${number} of ${pdf.numPages}…`);
   const page=await pdf.getPage(number),view=page.getViewport({scale:1});
   if(page.rotate!==0||page.userUnit!==1||page.view[0]!==0||page.view[1]!==0)throw Error('This PDF uses rotated or cropped pages. Export it as a standard, unrotated PDF before importing.');
   pageSizes.push([view.width,view.height]);
   const content=await page.getTextContent();const items=content.items.filter(i=>i.str).map(i=>{
    const y=view.height-i.transform[5],height=Math.hypot(i.transform[2],i.transform[3]),font=content.styles[i.fontName];
    // Baselines alone miss glyphs that extend into a proposed answer area.
    return {str:i.str,x:i.transform[4],y,w:i.width,top:y-height*(font?.ascent??1),bottom:y-height*(font?.descent??-.25)};
   });
   const annotations=await page.getAnnotations();
   for(const a of annotations.filter(a=>a.subtype==='Widget')){
    widgets++;
    if(a.fieldType==='Sig')throw Error('PDFs with digital-signature fields require manual preparation. Upload an unsigned, standard PDF.');
    if(a.fieldValue&&a.fieldValue!=='Off'&&a.fieldValue!==false&&(!Array.isArray(a.fieldValue)||a.fieldValue.length))throw Error('Upload a blank PDF; this one already has field answers.');
    if(a.pushButton)continue;
    const vr=a.rect,rect=[Math.min(vr[0],vr[2]),view.height-Math.max(vr[1],vr[3]),Math.abs(vr[2]-vr[0]),Math.abs(vr[3]-vr[1])];
    if(rect[2]<2||rect[3]<2)continue;
    const name=a.alternativeText||a.fieldName||nearestLabel(items,rect),base={id:'field_'+(++serial),page:number,...labelParts(name),rect};
    if(a.checkBox||a.radioButton){
     const groupKey=number+':'+a.fieldName;let f=groups.get(groupKey);
     if(!f){f={...base,type:'choice',rect:null,multiple:!!a.checkBox,options:[]};groups.set(groupKey,f);fields.push(f);}
     const label=nearestLabel(items,rect)||a.buttonValue||a.exportValue||'Option';
     f.options.push({value:'option_'+f.options.length,...labelParts(label),rect});
    }else if(a.fieldType==='Tx')fields.push({...base,type:classify(name),direction:/email|phone|mobile/i.test(name)?'ltr':'auto',multiline:!!a.multiLine,fontSize:10});
    else if(a.fieldType==='Ch')fields.push({...base,type:'select',direction:'auto',fontSize:10,selectOptions:(a.options||[]).map(o=>[o.displayValue,o.displayValue,''])});
   }
   if(!annotations.some(a=>a.subtype==='Widget')){
    const canvas=document.createElement('canvas'),vp=page.getViewport({scale:1.5});canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    for(const rect of blankLines(canvas,vp,items)){const name=nearestLabel(items,rect);suggestions.push({id:'field_'+(++serial),page:number,...labelParts(name),rect,type:signatureLabel(name)?'signature':classify(name),direction:'auto',fontSize:10});}
   }
  }
  for(const suggestion of suggestions){if(suggestion.type==='signature'){const {type,direction,fontSize,...signature}=suggestion;signatures.push(signature);}else fields.push(suggestion);}
  if(fields.length+signatures.length>400)throw Error('This PDF exceeds the 400-field limit.');
  fields.sort((a,b)=>a.page-b.page||(a.rect?.[1]||a.options[0].rect[1])-(b.rect?.[1]||b.options[0].rect[1]));
  return {pageSizes,pages:pdf.numPages,fields,signatures,importedWidgets:widgets>0,detected:fields.length+signatures.length,suggested:suggestions.length};
 }finally{await pdf.loadingTask.destroy();}
}
