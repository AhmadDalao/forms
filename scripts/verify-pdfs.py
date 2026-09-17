"""Verify synthetic filled PDFs produced by scripts/qa.mjs against the originals."""
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageDraw
import pdfplumber
import json,re
ROOT=Path(__file__).resolve().parents[1]
protected={
 'signature-form':[(1,(49,258,295,524)),(1,(49,535,545,650))],
 'kyc-individual':[(6,(0,0,612,792))],
 'kyc-corporate':[(6,(0,0,612,792))],
 'fatca-crs-individual':[(2,(37,626,335,700))],
 'terms-and-conditions':[(11,(80,133,294,239)),(13,(80,324,294,431))],
}
checks=0
answer_checks=0
for item in json.loads((ROOT/'tmp/pdfs/schema.json').read_text()):
 name=item['id'];a=ROOT/f'reference/pdfs/{name}.pdf';b=ROOT/f'tmp/pdfs/filled-{name}.pdf'
 ra,rb=PdfReader(a),PdfReader(b)
 assert len(ra.pages)==len(rb.pages)==item['pages']
 for i,(pa,pb) in enumerate(zip(ra.pages,rb.pages)):
  assert list(pa.mediabox)==list(pb.mediabox)
  # Overlay operators can change whitespace inferred by text extractors.
  assert ''.join(pa.extract_text().split())==''.join(pb.extract_text().split()),(name,i,'original text changed')
  checks+=1
 original=pdfium.PdfDocument(a);filled=pdfium.PdfDocument(b)
 # The fixture deliberately uses selections that previously suppressed answers.
 # Every filled text field must still add visible ink in its printed space.
 values=json.loads((ROOT/f'tmp/pdfs/filled-{name}.json').read_text())
 rendered={}
 for field in item['fields']:
  if field['type']=='choice' or field.get('sum') or not values.get(field['id']):continue
  n=field['page']-1
  if n not in rendered:
   rendered[n]=(original[n].render(scale=2).to_pil().convert('RGB'),filled[n].render(scale=2).to_pil().convert('RGB'))
  ia,ib=rendered[n]
  rtl=field.get('direction')=='rtl' or (field.get('direction')!='ltr' and re.search(r'[\u0600-\u06ff]',str(values[field['id']])))
  primary=field.get('rtlRect',field['rect']) if rtl else field['rect']
  rectangles=field.get('dateParts') or field.get('charRects') or [primary]+field.get('mirrorRects',[])
  for x,y,w,h in rectangles:
   box=tuple(round(v*2) for v in (x,y,x+w,y+h))
   assert ImageChops.difference(ia.crop(box),ib.crop(box)).getbbox() is not None,(name,field['id'],'entered answer missing from PDF')
  answer_checks+=1
 untouched=set(range(1,item['pages']+1))-set(f['page'] for f in item['fields'])
 for n in untouched:
  ia=original[n-1].render(scale=1).to_pil().convert('RGB');ib=filled[n-1].render(scale=1).to_pil().convert('RGB')
  assert ImageChops.difference(ia,ib).getbbox() is None,(name,n,'untouched page differs')
 for n,box in protected.get(name,[]):
  ia=original[n-1].render(scale=1).to_pil().convert('RGB').crop(box);ib=filled[n-1].render(scale=1).to_pil().convert('RGB').crop(box)
  assert ImageChops.difference(ia,ib).getbbox() is None,(name,n,'signature/staff area differs')
 if name=='kyc-individual':
  a=original[0].render(scale=3).to_pil().convert('RGB');b=filled[0].render(scale=3).to_pil().convert('RGB')
  mask=Image.new('L',a.size,0);draw=ImageDraw.Draw(mask);count=0
  with pdfplumber.open(ROOT/f'reference/pdfs/{name}.pdf') as measured:
   for curve in measured.pages[0].curves:
    if curve['width']<40 or not(200<curve['top']<620) or curve['height']<10:continue
    count+=1;x,y,right,bottom=[curve[k]*3 for k in ['x0','top','x1','bottom']]
    draw.rectangle((x-2,y-2,right+2,bottom+2),fill=255);draw.rectangle((x+4,y+4,right-4,bottom-4),fill=0)
  assert ImageChops.multiply(ImageChops.difference(a,b).convert('L'),mask).getbbox() is None,'A printed KYC border changed'
  print(f'{count} KYC field borders preserved pixel-for-pixel')
 print(name+': original text, page geometry and protected areas preserved')
print(f'PASS: {checks} pages; all {answer_checks} entered text fields render regardless of other selections')
