"""Pixel, content, transparency and full-page evidence for current-pdf-audit.mjs."""
from pathlib import Path
import json,re,sys
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image,ImageChops,ImageDraw
import numpy as np
OUT=Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/pdfs/current-audit-20260920')
schema=json.loads((OUT/'schema.json').read_text());records=json.loads((OUT/'records.json').read_text());failures=[]
counts=dict(pdfs=0,pages=0,text_rectangles=0,choice_rectangles=0,signature_rectangles=0,transparent_images=0,unchanged_pages=0)
visual=[];coverage={}
def mark(draw,r,scale=2):
 x,y,w,h=r
 if w>0 and h>0:draw.rectangle((int(x*scale)-2,int(y*scale)-2,int((x+w)*scale)+2,int((y+h)*scale)+2),fill=255)
def occupied(a,b,rect):
 x,y,w,h=rect;box=tuple(round(v*2) for v in (x,y,x+w,y+h))
 return w<=0 or h<=0 or ImageChops.difference(a.crop(box),b.crop(box)).getbbox() is not None
for doc in schema:
 name=doc['id'];orig=OUT/(name+'-original.pdf');src=PdfReader(orig);pdf=pdfium.PdfDocument(orig)
 before=[page.render(scale=2).to_pil().convert('RGB') for page in pdf]
 selected=[r for r in records if r['doc']==name];covered=set();choices=set();sig=set()
 for record in selected:
  if record.get('error'):failures.append([name,record['sample'],'generation',record['error'],record.get('fields')]);continue
  sample=record['sample'];values=record['values'];reader=PdfReader(OUT/record['file']);filled=pdfium.PdfDocument(OUT/record['file']);counts['pdfs']+=1
  if len(reader.pages)!=doc['pages']:failures.append([name,sample,'page count']);continue
  for i,(old,new) in enumerate(zip(src.pages,reader.pages)):
   counts['pages']+=1
   if list(old.mediabox)!=list(new.mediabox):failures.append([name,sample,i+1,'geometry'])
   if ''.join(old.extract_text().split())!=''.join(new.extract_text().split()):failures.append([name,sample,i+1,'original text changed'])
   a=before[i];b=filled[i].render(scale=2).to_pil().convert('RGB');mask=Image.new('L',a.size);draw=ImageDraw.Draw(mask);placeholder=Image.new('L',a.size);pd=ImageDraw.Draw(placeholder);active=False
   for field in doc['fields']:
    if field.get('uiOnly') or field.get('staticPdf') or field['page']!=i+1:continue
    v=values.get(field['id'])
    if v in [None,'',[]]:continue
    if field['type']=='choice':
     for option in field['options']:
      if option['value'] not in (v if isinstance(v,list) else [v]):continue
      for rect in [option['rect']]+option.get('extraRects',[]):
       if rect[2]<=0 or rect[3]<=0:continue
       mark(draw,rect);active=True;counts['choice_rectangles']+=1
       if not occupied(a,b,rect):failures.append([name,sample,field['id'],option['value'],'missing choice ink'])
      choices.add((field['id'],str(option['value'])))
     covered.add(field['id']);continue
    if not field.get('rect'):continue
    rtl=field.get('direction')=='rtl' or field.get('direction')!='ltr' and bool(re.search(r'[\u0600-\u06ff]',str(v)))
    if field.get('rectDirectionFrom'):
     source=' '.join(str(values.get(key,'') or '') for key in field['rectDirectionFrom']);first=next((char for char in source if char.isalpha()),'');rtl=bool(re.search(r'[\u0600-\u06ff]',first))
    rect=field.get('rtlRect',field['rect']) if rtl else field['rect']
    rects=field.get('dateParts') or field.get('charRects') or [rect]+field.get('mirrorRects',[])
    if field.get('cells'):
     string=str(v).replace('.','') if field.get('stripDots') else str(v)
     if field['type']=='date':y,m,d=string.split('-');string=d+m+y
     if field.get('charRects'):rects=field['charRects'][:len(string)]
     else:x,y,w,h=rect;rects=[[x+k*w/field['cells'],y,w/field['cells'],h] for k in range(len(string))]
    for rect in rects:
     mark(draw,rect);active=True;counts['text_rectangles']+=1
     if not occupied(a,b,rect):failures.append([name,sample,field['id'],'missing text ink',rect])
    for rect in field.get('placeholderRects',[]):mark(draw,rect);mark(pd,rect)
    covered.add(field['id'])
   for slot in doc['signatureSlots']:
    if slot['page']==i+1 and slot['id'] in record['signatures']:
     mark(draw,slot['rect']);counts['signature_rectangles']+=1;active=True;sig.add(slot['id'])
     if not occupied(a,b,slot['rect']):failures.append([name,sample,slot['id'],'signature missing'])
   diff=ImageChops.difference(a,b).convert('L');outside=ImageChops.multiply(diff,ImageChops.invert(mask))
   if outside.getbbox():failures.append([name,sample,i+1,'ink outside mapped spaces',outside.getbbox()]);outside.save(OUT/(name+'-'+sample+'-outside-'+str(i+1)+'.png'))
   aa=np.asarray(a,dtype=np.int16);bb=np.asarray(b,dtype=np.int16);whitening=(bb.min(axis=2)>220)&((bb-aa).max(axis=2)>50)
   if np.any(whitening&(np.asarray(placeholder)==0)):failures.append([name,sample,i+1,'paper whitened outside placeholders'])
   ox=old['/Resources'].get('/XObject',{});nx=new['/Resources'].get('/XObject',{});ox=ox.get_object() if hasattr(ox,'get_object') else ox;nx=nx.get_object() if hasattr(nx,'get_object') else nx
   for key in set(nx)-set(ox):
    image=nx[key].get_object()
    if image.get('/Subtype')!='/Image':continue
    if '/SMask' not in image:failures.append([name,sample,i+1,key,'opaque new image']);continue
    alpha=np.frombuffer(image['/SMask'].get_data(),dtype=np.uint8);colors=np.frombuffer(image.get_data(),dtype=np.uint8).reshape(-1,3)
    if not (alpha==0).any():failures.append([name,sample,i+1,key,'no transparent background'])
    if np.any(colors[alpha>0].min(axis=1)>150):failures.append([name,sample,i+1,key,'white image pixels'])
    if (image.get('/Width'),image.get('/Height'))!=(180,60) and np.any(np.abs(colors[alpha==255].astype(int)-[20,86,160])>2):failures.append([name,sample,i+1,key,'answer ink not blue'])
    if (image.get('/Width'),image.get('/Height'))!=(180,60):
     mat=alpha.reshape(image['/Height'],image['/Width'])
     if np.any(mat[0]) or np.any(mat[-1]) or np.any(mat[:,0]) or np.any(mat[:,-1]):failures.append([name,sample,i+1,key,'text touches/clips image boundary'])
    counts['transparent_images']+=1
   if not diff.getbbox():counts['unchanged_pages']+=1
   if active and sample in ['english-long','arabic-long']:
    fn=name+'-'+sample+'-p'+str(i+1)+'.png';b.save(OUT/fn);visual.append((name,sample,i+1,fn))
  print('CHECK',name,sample,flush=True)
 expected={field['id'] for field in doc['fields'] if not field.get('uiOnly') and not field.get('staticPdf') and (field.get('rect') or field['type']=='choice')}
 expectedchoices={(field['id'],str(o['value'])) for field in doc['fields'] if field['type']=='choice' for o in field['options']}
 coverage[name]={'mapped_fields':len(expected),'covered_fields':len(covered),'uncovered_fields':sorted(expected-covered),'choice_options':len(expectedchoices),'covered_choice_options':len(choices),'uncovered_choices':sorted(expectedchoices-choices),'signature_slots':len(doc['signatureSlots']),'covered_signatures':len(sig),'samples':len(selected),'complete_success':sum(r.get('complete') and not r.get('error') for r in selected)}
 pdf.close()
# Four full populated pages per contact sheet; every page also retained at 144 dpi.
sheets=[]
for offset in range(0,len(visual),4):
 items=visual[offset:offset+4];cw,ch=1100,1590;sheet=Image.new('RGB',(cw*2,ch*2),'#e8e8ef');draw=ImageDraw.Draw(sheet)
 for j,(name,sample,p,fn) in enumerate(items):
  im=Image.open(OUT/fn);im.thumbnail((cw,ch-35));x=(j%2)*cw;y=(j//2)*ch;draw.text((x+10,y+8),f'{name} / {sample} / {p}',fill='black');sheet.paste(im,(x,y+30))
 fn='contact-'+str(offset//4+1).zfill(2)+'.png';sheet.save(OUT/fn);sheets.append(fn)
report={'counts':counts,'coverage':coverage,'failures':failures,'visual_pages':visual,'contact_sheets':sheets}
(OUT/'verification.json').write_text(json.dumps(report,indent=2));print(json.dumps({'counts':counts,'coverage':coverage,'failures':failures,'sheets':sheets},indent=2))

if failures or any(item['uncovered_fields'] or item['uncovered_choices'] or item['covered_signatures']<item['signature_slots'] or item['complete_success']<5 for item in coverage.values()):
 sys.exit(1)
