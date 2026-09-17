"""Check the new page-3 fields/signature without changing any original artwork."""
import json, os
from pathlib import Path
import numpy as np
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw

root=Path(os.environ.get('QA_OUT','tmp/pdfs/staff-section'))
report=json.loads((root/'report.json').read_text())
schema=json.loads((root/'schema.json').read_text())
fields=[f for f in schema['doc']['fields'] if f['page']==3]
slot=next(s for s in schema['slots'] if s['id']=='relationship_manager')
original=PdfReader('reference/pdfs/fatca-crs-individual.pdf')
source=pdfium.PdfDocument('reference/pdfs/fatca-crs-individual.pdf')
renders=[np.array(p.render(scale=2).to_pil().convert('RGB')).astype(np.int16) for p in source]
def mask(rects,shape):
 result=np.zeros(shape,dtype=bool)
 for x,y,w,h in rects:
  result[int(y*2)-1:int((y+h)*2)+2,int(x*2)-1:int((x+w)*2)+2]=True
 return result
rects=[r for f in fields for r in f.get('charRects',[f['rect']])]
text_mask=mask(rects,renders[2].shape[:2])
signature_mask=mask([slot['rect']],renders[2].shape[:2])
crops=[]
for entry in report['results']:
 name=entry['browser']+'-'+entry['sample']
 signed=PdfReader(root/(name+'-signed.pdf'))
 unsigned=PdfReader(root/(name+'-unsigned.pdf'))
 sr=pdfium.PdfDocument(root/(name+'-signed.pdf'))
 ur=pdfium.PdfDocument(root/(name+'-unsigned.pdf'))
 for i in range(4):
  for pdf in [signed,unsigned]:
   assert pdf.pages[i].mediabox==original.pages[i].mediabox
   assert ''.join(pdf.pages[i].extract_text().split())==''.join(original.pages[i].extract_text().split())
  actual=np.array(sr[i].render(scale=2).to_pil().convert('RGB')).astype(np.int16)
  before=np.array(ur[i].render(scale=2).to_pil().convert('RGB')).astype(np.int16)
  if i!=2:
   assert np.array_equal(actual,renders[i]) and np.array_equal(before,renders[i]),(name,i,'unrelated page changed')
   continue
  ink=np.max(np.abs(before-renders[i]),axis=2)>2
  sig=np.max(np.abs(actual-before),axis=2)>2
  assert not ink[~text_mask].any(),(name,'text outside fields')
  assert not sig[~signature_mask].any(),(name,'signature outside box')
  assert sig.sum()>25,(name,'missing signature')
  for rect in rects:
   assert ink[mask([rect],ink.shape)].sum()>6,(name,rect,'missing answer')
  assert not np.any((renders[i].min(axis=2)<200)&(actual.min(axis=2)>245)),(name,'whiteout')
  for obj in unsigned.pages[i].images:
   pixels=np.array(obj.image.convert('RGBA'))
   assert pixels[:,:,3].min()==0,(name,'opaque text background')
   solid=pixels[pixels[:,:,3]==255,:3]
   assert len(solid)>0 and np.max(np.abs(solid.astype(int)-[20,86,160]))<=1,(name,'wrong answer ink')
   if obj.image.width==1417: # Full-name image: guard against partly clipped bidi runs.
    xs=np.where(pixels[:,:,3]>0)[1]
    assert (xs.max()-xs.min()+1)/(300/72)>=entry['holderWidth']*.9,(name,'name partly missing')
  crops.append((name,Image.fromarray(actual.astype('uint8')).crop((64,142,1188,390))))
  if entry['browser']=='chrome' and entry['sample']=='arabic-long':
   Image.fromarray(actual.astype('uint8')).save(root/'filled-page3.png')
 print('PASS',name)
for browser in {r['browser'] for r in report['results']}:
 partial=pdfium.PdfDocument(root/(browser+'-customer-only.pdf'))
 assert np.array_equal(np.array(partial[2].render(scale=2).to_pil().convert('RGB')).astype(np.int16),renders[2]),'Unfilled staff section changed'
sheet=Image.new('RGB',(1144,280*len(crops)),'#eeeeee')
draw=ImageDraw.Draw(sheet)
for i,(name,crop) in enumerate(crops):
 draw.text((10,i*280+4),name,fill='black');sheet.paste(crop,(10,i*280+24))
sheet.save(root/'review-all.png')
result={'cases':len(report['results']),'pages_checked':len(report['results'])*4,'new_text_fields':len(fields),'cif_boxes':15,'changes_confined_to_mappings':True,'transparent_blue_text':True,'original_artwork_preserved':True,'unused_staff_section_unchanged':True}
(root/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
