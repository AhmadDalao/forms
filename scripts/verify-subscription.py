"""Verify downloaded answers stay inside blank cells and never cover printed ink."""
from pathlib import Path
import json,os
import numpy as np
import pypdfium2 as pdfium
from pypdf import PdfReader
import pdfplumber
ROOT=Path(os.environ.get('QA_OUT','tmp/subscription/audit'))
records=json.loads((ROOT/'results.json').read_text());report=[]
for record in records:
 source_path=Path('public/pdfs')/('subscription-company.pdf' if record['audience']=='corporate' else 'subscription-individual.pdf')
 source=pdfium.PdfDocument(source_path);output=pdfium.PdfDocument(ROOT/record['file']);old_reader=PdfReader(source_path);reader=PdfReader(ROOT/record['file'])
 assert len(source)==len(output)==2
 total=overlap=images=0
 for i in range(2):
  original=np.asarray(source[i].render(scale=2).to_pil().convert('RGB'));rendered=output[i].render(scale=2).to_pil().convert('RGB');pixels=np.asarray(rendered)
  assert list(old_reader.pages[i].mediabox)==list(reader.pages[i].mediabox),('Changed page geometry',record['file'],i+1)
  assert ''.join(old_reader.pages[i].extract_text().split())==''.join(reader.pages[i].extract_text().split()),('Changed source text',record['file'],i+1)
  rendered.save(ROOT/(record['file'].replace('.pdf',f'-p{i+1}.png')))
  r,g,b=[pixels[:,:,c].astype(int) for c in range(3)]
  changed=np.abs(pixels.astype(int)-original.astype(int)).max(axis=2)>20
  blue=(r<90)&(g>40)&(g<155)&(b>120)&(b>g+35)&changed
  # Include pale table borders as well as labels: any blue touching them is a defect.
  old_ink=(original.min(axis=2)<245)
  overlaps=blue&old_ink
  overlap+=int(overlaps.sum());total+=int(blue.sum())
  before=old_reader.pages[i]['/Resources'].get('/XObject',{});before=before.get_object() if hasattr(before,'get_object') else before
  after=reader.pages[i]['/Resources'].get('/XObject',{});after=after.get_object() if hasattr(after,'get_object') else after
  for key in set(after)-set(before):
   img=after[key].get_object()
   if img.get('/Subtype')!='/Image':continue
   assert '/SMask' in img,('Opaque overlay',record['file'],key)
   alpha=np.frombuffer(img['/SMask'].get_data(),dtype=np.uint8).reshape(int(img['/Height']),int(img['/Width']))
   assert not any((edge>2).any() for edge in [alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]]),('Clipped ink',record['file'],key)
   images+=1
  # Manual selections leave the entire signature blank, including after uploading once.
  if not record['signature'] and i+1==record['signatureSlots'][0]['page']:
   x,y,w,h=record['signatureSlots'][0]['rect'];assert not blue[int(y*2):int((y+h)*2),int(x*2):int((x+w)*2)].any()
 assert overlap==0,(record['file'],overlap)
 assert total>1000
 report.append({'file':record['file'],'answer_images':images,'blue_pixels':total,'overlap_pixels':overlap})
 for page in reader.pages:assert not any(a.get_object().get('/Subtype')=='/Widget' for a in page.get('/Annots',[]))
 source.close();output.close()
for audience in ['individual','corporate']:
 reader=pdfium.PdfDocument(ROOT/(audience+'-manual-after-upload.pdf'))
 record=next(r for r in records if r['audience']==audience)
 x,y,w,h=record['signatureSlots'][0]['rect'];pixels=np.asarray(reader[1].render(scale=2).to_pil().convert('RGB'))
 area=pixels[int(y*2):int((y+h)*2),int(x*2):int((x+w)*2)].astype(int)
 assert not ((area[:,:,0]<90)&(area[:,:,1]>40)&(area[:,:,2]>area[:,:,1]+35)).any(),'Manual still contains a signature'
 reader.close()
(ROOT/'render-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pdfs':len(report),'pages':len(report)*2,'answer_images':sum(r['answer_images'] for r in report),'overlap_pixels':sum(r['overlap_pixels'] for r in report),'manual_signature_checks':'passed'},indent=2))
