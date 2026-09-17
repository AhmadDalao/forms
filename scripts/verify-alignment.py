"""Inspect all 30 real downloads: geometry, ink, transparency and preserved paper."""
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image,ImageChops,ImageDraw
import numpy as np
import json,re,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/os.environ.get('QA_OUT','tmp/pdfs/audit')
schema=json.loads((OUT/'schema.json').read_text())
records=json.loads((OUT/'downloads.json').read_text())
schema=[d for d in schema if any(r['doc']==d['id'] for r in records)]
assert len(records)==len(schema)*5 and not any(r.get('error') for r in records)
counts={'downloads':0,'pages':0,'text_fields':0,'transparent_text_images':0,'unmodified_pages':0}
summaries=[]
for doc in schema:
 name=doc['id'];source=ROOT/f'reference/pdfs/{name}.pdf'
 source_reader=PdfReader(source);original=pdfium.PdfDocument(source)
 source_renders=[p.render(scale=2).to_pil().convert('RGB') for p in original]
 source_text=[''.join(p.extract_text().split()) for p in source_reader.pages]
 active_pages=sorted(set(f['page'] for f in doc['fields']))
 doc_records=[r for r in records if r['doc']==name]
 assert len(doc_records)==5
 for record in doc_records:
  sample=record['sample'];path=OUT/record['file'];values=json.loads(path.with_suffix('.json').read_text())
  filled=pdfium.PdfDocument(path);reader=PdfReader(path)
  assert len(reader.pages)==doc['pages']
  for n,(before_page,after_page) in enumerate(zip(source_reader.pages,reader.pages)):
   assert list(before_page.mediabox)==list(after_page.mediabox),(name,sample,n,'page geometry')
   assert ''.join(after_page.extract_text().split())==source_text[n],(name,sample,n,'source text')
   counts['pages']+=1
   before=source_renders[n];after=filled[n].render(scale=2).to_pil().convert('RGB')
   allowed=Image.new('L',before.size);draw=ImageDraw.Draw(allowed)
   placeholders=Image.new('L',before.size);place_draw=ImageDraw.Draw(placeholders)
   def mark(painter,rect):
    x,y,w,h=rect;painter.rectangle((int(x*2)-1,int(y*2)-1,int((x+w)*2)+1,int((y+h)*2)+1),fill=255)
   for f in [f for f in doc['fields'] if f['page']==n+1]:
    value=values.get(f['id'])
    if f.get('sum'):value=str(sum(int(values[k]) for k in f['sum']))
    if value in [None,'',[]]:continue
    if f['type']=='choice':
     selected=value if isinstance(value,list) else [value]
     for option in f['options']:
      if option['value'] in selected:
       for rect in [option['rect']]+option.get('extraRects',[]):mark(draw,rect)
     continue
    rtl=f.get('direction')=='rtl' or (f.get('direction')!='ltr' and re.search(r'[\u0600-\u06ff]',str(value)))
    primary=f.get('rtlRect',f['rect']) if rtl else f['rect']
    rectangles=f.get('dateParts') or f.get('charRects') or [primary]+f.get('mirrorRects',[])
    for rect in rectangles:
     mark(draw,rect);x,y,w,h=rect;box=tuple(round(v*2) for v in (x,y,x+w,y+h))
     assert ImageChops.difference(before.crop(box),after.crop(box)).getbbox(),(name,sample,f['id'],'missing ink')
    for rect in f.get('placeholderRects',[]):mark(place_draw,rect);mark(draw,rect)
    counts['text_fields']+=1
   diff=ImageChops.difference(before,after).convert('L')
   assert ImageChops.multiply(diff,ImageChops.invert(allowed)).getbbox() is None,(name,sample,n+1,'ink outside mapped spaces')
   a=np.asarray(before,dtype=np.int16);b=np.asarray(after,dtype=np.int16)
   whitening=(b.min(axis=2)>220)&((b-a).max(axis=2)>50)
   assert not np.any(whitening & (np.asarray(placeholders)==0)),(name,sample,n+1,'paper whitened outside a faint placeholder')
   old_x=before_page['/Resources'].get('/XObject',{})
   if hasattr(old_x,'get_object'):old_x=old_x.get_object()
   new_x=after_page['/Resources'].get('/XObject',{})
   if hasattr(new_x,'get_object'):new_x=new_x.get_object()
   for key in set(new_x)-set(old_x):
    image=new_x[key].get_object()
    if image.get('/Subtype')!='/Image':continue
    assert '/SMask' in image,(name,sample,key,'opaque answer image')
    mask=image['/SMask'].get_data();rgb=image.get_data()
    alpha=np.frombuffer(mask,dtype=np.uint8);colors=np.frombuffer(rgb,dtype=np.uint8).reshape(-1,3)
    assert (alpha==0).any(),(name,sample,key,'no transparent background')
    assert np.all(colors[alpha>0].min(axis=1)<100),(name,sample,key,'non-text or white answer pixels')
    assert np.all(np.abs(colors[alpha==255].astype(int)-[20,86,160])<=2),(name,sample,key,'answer ink is not blue')
    counts['transparent_text_images']+=1
   if n+1 in active_pages:
    after.save(OUT/f'{name}-{sample}-p{n+1}.png')
   else:
    assert not diff.getbbox(),(name,sample,n+1,'untouched page changed')
    counts['unmodified_pages']+=1
  counts['downloads']+=1
  print(f'PASS {name}/{sample}: every page and answer checked',flush=True)
 # Two full-size long-answer examples per sheet, for side-by-side visual inspection.
 for n in active_pages:
  left=Image.open(OUT/f'{name}-english-long-p{n}.png');right=Image.open(OUT/f'{name}-arabic-long-p{n}.png')
  sheet=Image.new('RGB',(left.width+right.width+16,max(left.height,right.height)+35),'#e8e8ef')
  d=ImageDraw.Draw(sheet);d.text((10,10),f'{name} / page {n} / ENGLISH',fill='black');d.text((left.width+26,10),'ARABIC',fill='black')
  sheet.paste(left,(0,35));sheet.paste(right,(left.width+16,35));sheet.save(OUT/f'review-{name}-p{n}.png')
 summaries.append({'document':name,'samples':[r['sample'] for r in doc_records],'pages_each':doc['pages']})
report={'checks':counts,'documents':summaries,'result':'pass'}
(OUT/'verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report['checks']))
