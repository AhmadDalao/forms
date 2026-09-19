import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clipEvenOdd, endPath } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { hasValue } from './schema.js';
import { signatureSlots, signaturePlacement, cleanSignatures } from './signatures.js';
import { appRoot } from './routes.js';
import {canonicalSubscription,isSubscription} from './subscription/model.js';
import {formatSubscriptionNumber} from './subscription/calculations.js';
import { assertLayout } from './management/layout.js';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const templates = new Map();
export const templateUrl = doc => doc.pdfUrl || `${appRoot}pdfs/${doc.id}.pdf${doc.pdfVersion?'?v='+encodeURIComponent(doc.pdfVersion):''}`;
export async function original(doc) {
  if (!templates.has(doc.id)) templates.set(doc.id, fetch(templateUrl(doc)).then(async r => { if (!r.ok) throw Error('Could not load the original PDF. Please retry.'); return new Uint8Array(await r.arrayBuffer()); }).catch(e => { templates.delete(doc.id); throw e; }));
  return (await templates.get(doc.id)).slice();
}
export function normalizedDate(value) { const [y,m,d] = value.split('-'); return y && m && d ? `${d}/${m}/${y}` : value; }
export function fieldValue(f, values) {
  if (f.sum) return f.sum.every(key => hasValue(values[key])) ? String(f.sum.reduce((n,key) => n + Number(values[key]), 0)) : '';
  return values[f.id];
}
const isRtl=(f,value)=>f.direction==='rtl'||(f.direction!=='ltr'&&/[\u0600-\u06ff]/.test(f.direction==='auto'?(value.match(/\p{L}/u)?.[0]||value):value));
function linesFor(ctx, value, width, multiline) {
  if (!multiline) return [value.replace(/\n/g,' ')];
  const lines=[];
  for (const paragraph of value.split('\n')) {
    let line='';
    for (const word of paragraph.split(/\s+/)) {
      const next=line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { lines.push(line); line=word; } else line=next;
    }
    lines.push(line);
  }
  return lines;
}
export function textImage(value, width, height, f={}) {
  const scale=300/72, pad=f.padding??1.0;
  const canvas=document.createElement('canvas'); canvas.width=Math.ceil(width*scale); canvas.height=Math.ceil(height*scale);
  const ctx=canvas.getContext('2d');
  const scratch=document.createElement('canvas'), ink=scratch.getContext('2d',{willReadFrequently:true});
  const rtl=isRtl(f,value), right=f.align==='right'||(f.align!=='left'&&rtl);
  const align=f.align==='center'?'center':right?'right':'left';
  let size=Math.min(f.fontSize||10, height*.72);
  const min=Math.min(f.minFontSize||7,size);
  for (;;) {
    ink.font=`400 ${size}px "Noto Sans Arabic", Arial`;
    const lines=linesFor(ink,value,width-pad*2,f.multiline), leading=size*1.45;
    const widest=Math.max(...lines.map(line=>ink.measureText(line).width));
    if(widest<=width-pad*2 && (lines.length-1)*leading<=height-pad*2){
      // Browser text bounds can omit bidi runs or Arabic marks. Render with
      // ample margins, then use the actual ink bounds for fitting/alignment.
      const margin=size*2;
      scratch.width=Math.ceil((width+margin*2)*scale);
      scratch.height=Math.ceil(((lines.length-1)*leading+margin*2)*scale);
      ink.scale(scale,scale);ink.font=`400 ${size}px "Noto Sans Arabic", Arial`;
      ink.direction=rtl?'rtl':'ltr';ink.textAlign=align;ink.fillStyle='#1456a0';
      const anchor=align==='center'?margin+width/2:right?margin+width:margin;
      lines.forEach((line,i)=>ink.fillText(line,anchor,margin+i*leading));
      const pixels=ink.getImageData(0,0,scratch.width,scratch.height).data;
      let left=scratch.width,top=scratch.height,bottom=-1,last=-1;
      for(let y=0;y<scratch.height;y++)for(let x=0;x<scratch.width;x++){
        if(!pixels[(y*scratch.width+x)*4+3])continue;
        left=Math.min(left,x);last=Math.max(last,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(last<0)return {data:canvas.toDataURL('image/png')};
      const w=last-left+1,h=bottom-top+1;
      if(w<=(width-pad*2)*scale && h<=(height-pad*2)*scale){
        const x=align==='center'?(canvas.width-w)/2:right?canvas.width-pad*scale-w:pad*scale;
        ctx.drawImage(scratch,left,top,w,h,Math.round(x),Math.round((canvas.height-h)/2),w,h);
        return {data:canvas.toDataURL('image/png')};
      }
    }
    if(size<=min+.01)return {error:true};
    size=Math.max(min,size-.35);
  }
}
export async function generate(doc, values, signatures = {}) {
  if(doc.custom)assertLayout(doc);
  if(isSubscription(doc)){values=await canonicalSubscription(doc,values);if(values.signature_mode!=='electronic')signatures={};}
  await document.fonts.load('10px "Noto Sans Arabic"','العربية English');
  await document.fonts.ready;
  const pdf=await PDFDocument.load(await original(doc),{updateMetadata:false});
  const errors=[];
  // Imported widget forms are printed as static blue overlays, like the existing forms.
  // Flatten only the imported document's original widgets before adding answers.
  if(doc.importedWidgets)pdf.getForm().flatten({updateFieldAppearances:false});
  // Clip only faint input placeholders from the original artwork. Never paint
  // white rectangles over the paper; borders and other content remain intact.
  for (const [index,page] of pdf.getPages().entries()) {
    const placeholders=doc.fields.filter(f=>f.page===index+1&&f.placeholderRects&&hasValue(fieldValue(f,values)))
      .flatMap(f=>f.cells?f.placeholderRects.slice(0,[...String(values[f.id])].length):f.placeholderRects);
    if(!placeholders.length)continue;
    const height=page.getHeight();
    const start=pdf.context.register(pdf.context.contentStream([
      pushGraphicsState(),rectangle(0,0,page.getWidth(),height),
      ...placeholders.map(([x,y,w,h])=>rectangle(x,height-y-h,w,h)),clipEvenOdd(),endPath(),
    ]));
    const end=pdf.context.register(pdf.context.contentStream([popGraphicsState()]));
    page.node.normalize();
    page.node.wrapContentStreams(start,end);
  }
  for(const f of doc.fields) {
    if(isSubscription(doc)&&(!f.rect||f.staticPdf))continue;
    const rawValue=fieldValue(f,values);
    const value=isSubscription(doc)&&(f.money||f.numeric)?formatSubscriptionNumber(rawValue):rawValue;
    if(!hasValue(value)) continue;
    const page=pdf.getPage(f.page-1), ph=page.getHeight();
    if(f.type==='choice') {
      const selected=Array.isArray(value)?value:[value];
      for(const opt of f.options.filter(o=>selected.includes(o.value))) {
        for(const rect of [opt.rect,...(opt.extraRects||[])]) {
          const [x,y,w,h]=rect;
          if(!w||!h)continue;
          const thickness=Math.min(1.15,Math.min(w,h)*.12);
          page.drawLine({start:{x:x+w*.2,y:ph-y-h*.52},end:{x:x+w*.43,y:ph-y-h*.76},thickness,color:rgb(20/255,86/255,160/255)});
          page.drawLine({start:{x:x+w*.43,y:ph-y-h*.76},end:{x:x+w*.84,y:ph-y-h*.22},thickness,color:rgb(20/255,86/255,160/255)});
        }
      }
      continue;
    }
    const segments=[];
    if(f.dateParts) {
      const [y,m,d]=String(value).split('-');
      const parts=f.dateOrder==='ymd'?[y,m,d]:[d,m,y];
      f.dateParts.forEach((r,i)=>segments.push([parts[i],r]));
    } else if(f.cells) {
      const str=f.type==='date'?normalizedDate(String(value)).replaceAll('/',''):f.stripDots?String(value).replaceAll('.',''):String(value);
      if([...str].length>f.cells) { errors.push(f.id); continue; }
      [...str].forEach((char,i)=>segments.push([char,f.charRects?.[i]||[f.rect[0]+i*f.rect[2]/f.cells,f.rect[1],f.rect[2]/f.cells,f.rect[3]]]));
    } else {
      const primary=f.rtlRect&&isRtl(f,String(value))?f.rtlRect:f.rect;
      for(const rect of [primary,...(f.mirrorRects||[])])segments.push([f.type==='date'?normalizedDate(String(value)):String(value),rect]);
    }
    for(const [str,[x,y,w,h]] of segments) {
      const rendered=textImage(str||'',w,h,{...f,align:f.cells||f.dateParts?'center':f.align});
      if(rendered.error) { errors.push(f.id); continue; }
      const png=await pdf.embedPng(rendered.data);
      page.drawImage(png,{x,y:ph-y-h,width:w,height:h});
    }
  }
  if(errors.length) { const e=Error('Some answers do not fit. Shorten the highlighted fields.'); e.fields=[...new Set(errors)]; throw e; }
  const images = cleanSignatures(doc, signatures);
  for (const slot of signatureSlots(doc)) {
    if (!images[slot.id]) continue;
    const image = await pdf.embedPng(images[slot.id]);
    const page = pdf.getPage(slot.page - 1), place = signaturePlacement(slot, image.width, image.height);
    page.drawImage(image, { ...place, y: page.getHeight() - place.y - place.height });
  }
  return new Uint8Array(await pdf.save());
}
export async function loadPreview(bytes) { return pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise; }
export async function renderPage(pdf, number, canvas, width=780) {
  const page=await pdf.getPage(number);
  const base=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:Math.min(2,window.devicePixelRatio||1)*width/base.width});
  canvas.width=Math.round(viewport.width); canvas.height=Math.round(viewport.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
}
