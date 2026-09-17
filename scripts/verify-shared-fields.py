"""Verify the actual PDFs downloaded by shared-fields-audit.mjs."""
from pathlib import Path
import json,os,re
import numpy as np
from PIL import Image,ImageDraw,ImageChops
from pypdf import PdfReader
import pypdfium2 as pdfium
out=Path(os.environ.get('QA_OUT','tmp/pdfs/shared-fields'))
schema={d['id']:d for d in json.loads(Path('tmp/pdfs/schema.json').read_text())}
report=json.loads((out/'report.json').read_text())
counts={'downloads':0,'pages':0,'text_fields':0,'transparent_images':0}
for record in report['results']:
 doc=schema[record['doc']];path=out/record['file'];values=json.loads(path.with_suffix('.json').read_text())
 source=Path('reference/pdfs')/(doc['id']+'.pdf')
 a,b=PdfReader(source),PdfReader(path);original,filled=pdfium.PdfDocument(source),pdfium.PdfDocument(path)
 assert len(a.pages)==len(b.pages)==doc['pages']
 for n,(before_page,after_page) in enumerate(zip(a.pages,b.pages)):
  assert list(before_page.mediabox)==list(after_page.mediabox)
  assert ''.join(before_page.extract_text().split())==''.join(after_page.extract_text().split())
  before=original[n].render(scale=2).to_pil().convert('RGB');after=filled[n].render(scale=2).to_pil().convert('RGB')
  allowed=Image.new('L',before.size);draw=ImageDraw.Draw(allowed)
  placeholders=Image.new('L',before.size);place=ImageDraw.Draw(placeholders)
  def mark(painter,rect):
   x,y,w,h=rect;painter.rectangle((int(x*2)-1,int(y*2)-1,int((x+w)*2)+1,int((y+h)*2)+1),fill=255)
  for f in [f for f in doc['fields'] if f['page']==n+1]:
   value=values.get(f['id'])
   if value in [None,'',[]]:continue
   if f['type']=='choice':
    for option in f['options']:
     if option['value'] in (value if isinstance(value,list) else [value]):
      for rect in [option['rect']]+option.get('extraRects',[]):mark(draw,rect)
    continue
   rtl=f.get('direction')=='rtl' or (f.get('direction')!='ltr' and re.search(r'[\u0600-\u06ff]',str(value)))
   rects=f.get('dateParts') or (f['charRects'][:len(str(value))] if f.get('charRects') else None) or [f.get('rtlRect',f['rect']) if rtl else f['rect']]+f.get('mirrorRects',[])
   for rect in rects:
    mark(draw,rect);x,y,w,h=rect;box=tuple(round(v*2) for v in [x,y,x+w,y+h])
    assert ImageChops.difference(before.crop(box),after.crop(box)).getbbox(),(record['file'],f['id'],'missing answer')
   for rect in f.get('placeholderRects',[]):mark(draw,rect);mark(place,rect)
   counts['text_fields']+=1
  diff=ImageChops.difference(before,after).convert('L')
  assert ImageChops.multiply(diff,ImageChops.invert(allowed)).getbbox() is None,(record['file'],n,'ink outside field')
  first=np.asarray(before,dtype=np.int16);last=np.asarray(after,dtype=np.int16)
  assert not np.any((last.min(axis=2)>220)&((last-first).max(axis=2)>50)&(np.asarray(placeholders)==0)),(record['file'],n,'whiteout')
  def objects(page):
   obj=page['/Resources'].get('/XObject',{});return obj.get_object() if hasattr(obj,'get_object') else obj
  old,new=objects(before_page),objects(after_page)
  for key in set(new)-set(old):
   image=new[key].get_object()
   if image.get('/Subtype')!='/Image':continue
   assert '/SMask' in image
   alpha=np.frombuffer(image['/SMask'].get_data(),dtype=np.uint8).reshape(int(image['/Height']),int(image['/Width']))
   color=np.frombuffer(image.get_data(),dtype=np.uint8).reshape(-1,3)
   assert (alpha==0).any();assert np.all(color[alpha.flatten()>0].min(axis=1)<100)
   assert np.all(np.abs(color[alpha.flatten()==255].astype(int)-[20,86,160])<=2)
   assert not any((edge>2).any() for edge in [alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
   counts['transparent_images']+=1
  counts['pages']+=1
  if record['browser']=='chrome' and n==0:after.save(out/(path.stem+'-page1.png'))
 counts['downloads']+=1
(out/'verification.json').write_text(json.dumps({'site':report['site'],'checks':counts,'result':'pass'},indent=2)+'\n')
print('PASS',counts,'original artwork, complete answers, mapped placement and transparent blue ink')
