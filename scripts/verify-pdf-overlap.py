"""Find actual answer/signature ink over printed content or another answer.

Run after current-pdf-audit.mjs. Uses 144 dpi masks from embedded transparent
answer images; pair with current-pdf-audit-verify.py for checkboxes, content and
bounds, and visual inspection for printed template typography.
"""
from pathlib import Path
import json,sys,math
from pypdf import PdfReader
from pypdf.generic import ContentStream
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
import numpy as np
if len(sys.argv)!=2:
 raise SystemExit('Usage: python3 scripts/verify-pdf-overlap.py PDF_AUDIT_OUTPUT')
OUT=Path(sys.argv[1]);scale=2
records=json.loads((OUT/'records.json').read_text());schemas={d['id']:d for d in json.loads((OUT/'schema.json').read_text())}
if not records or not schemas:raise SystemExit('Generate PDF audit samples before checking overlap.')
report={'scale':scale,'images':0,'signature_images':0,'pages':0,'collision_candidates':[],'outside_page':[],'transform_errors':[],'files':0}
report['generation_errors']=[{'document':r['doc'],'sample':r['sample'],'error':r['error']} for r in records if r.get('error')]
def mul(a,b):
 return (a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])
def operations(page,reader,newnames):
 matrix=(1,0,0,1,0,0);stack=[]
 for operands,op in ContentStream(page.get_contents(),reader).operations:
  if op==b'q':stack.append(matrix)
  elif op==b'Q':matrix=stack.pop()
  elif op==b'cm':matrix=mul(matrix,tuple(map(float,operands)))
  elif op==b'Do' and operands[0] in newnames:yield operands[0],matrix
for name,doc in schemas.items():
 original=PdfReader(OUT/(name+'-original.pdf'));render=pdfium.PdfDocument(OUT/(name+'-original.pdf'))
 papers=[np.asarray(p.render(scale=scale).to_pil().convert('RGB')) for p in render]
 for record in [r for r in records if r['doc']==name and not r.get('error')]:
  reader=PdfReader(OUT/record['file']);report['files']+=1
  for pi,page in enumerate(reader.pages):
   paper=papers[pi];h,w=paper.shape[:2];filledmask=np.zeros((h,w),bool);oldink=paper.max(axis=2)<210
   # Generation removes these original dotted guides before drawing an answer.
   for field in doc['fields']:
    if field['page']!=pi+1 or not record['values'].get(field['id']):continue
    for x,y,fw,fh in field.get('placeholderRects',[]):
     oldink[max(0,int(y*scale)-2):min(h,math.ceil((y+fh)*scale)+2),max(0,int(x*scale)-2):min(w,math.ceil((x+fw)*scale)+2)]=False
   ox=original.pages[pi]['/Resources'].get('/XObject',{});ox=ox.get_object() if hasattr(ox,'get_object') else ox
   nx=page['/Resources'].get('/XObject',{});nx=nx.get_object() if hasattr(nx,'get_object') else nx
   newnames={k for k in set(nx)-set(ox) if nx[k].get_object().get('/Subtype')=='/Image'}
   report['pages']+=1
   for key,m in operations(page,reader,newnames):
    a,b,c,d,e,f=m
    if abs(b)>1e-5 or abs(c)>1e-5 or a<=0 or d<=0:
     report['transform_errors'].append([name,record['sample'],pi+1,str(key),m]);continue
    image=nx[key].get_object();alpha=image['/SMask'].get_object();raw=np.frombuffer(alpha.get_data(),np.uint8).reshape(int(alpha['/Height']),int(alpha['/Width']))
    x0=round(e*scale);y0=round((float(page.mediabox.height)-f-d)*scale);iw=round(a*scale);ih=round(d*scale)
    ink=np.asarray(Image.fromarray(raw).resize((iw,ih),Image.Resampling.BILINEAR))>160
    if x0<0 or y0<0 or x0+iw>w or y0+ih>h:
     report['outside_page'].append([name,record['sample'],pi+1,str(key)]);continue
    local_old=oldink[y0:y0+ih,x0:x0+iw];local_new=filledmask[y0:y0+ih,x0:x0+iw]
    overlap_paper=ink&local_old;overlap_answers=ink&local_new
    report['images']+=1;report['signature_images']+=int((image['/Width'],image['/Height'])==(180,60))
    if overlap_paper.sum()>0 or overlap_answers.sum()>0:
     candidate={'document':name,'sample':record['sample'],'page':pi+1,'image':str(key),'rect':[e,float(page.mediabox.height)-f-d,a,d],'printed_ink_pixels':int(overlap_paper.sum()),'other_answer_pixels':int(overlap_answers.sum())}
     for label,mask in [('printed',overlap_paper),('answers',overlap_answers)]:
      ys,xs=np.nonzero(mask)
      if len(xs):candidate[label+'_bounds']=[int(xs.min()+x0),int(ys.min()+y0),int(xs.max()+x0),int(ys.max()+y0)]
     report['collision_candidates'].append(candidate)
    filledmask[y0:y0+ih,x0:x0+iw]|=ink
 print(name,'checked',flush=True)
 render.close()
report['passed']=report['images']>0 and not any(report[k] for k in ['collision_candidates','outside_page','transform_errors','generation_errors'])
placement=OUT/'verification.json'
if placement.is_file():
 counts=json.loads(placement.read_text())['counts']
 report['expected_image_placements']=counts['text_rectangles']+counts['signature_rectangles']
 report['complete_image_coverage']=report['images']==report['expected_image_placements']
 report['passed']=report['passed'] and report['complete_image_coverage']
(OUT/'ink-overlap.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in report.items()}))
raise SystemExit(0 if report['passed'] else 1)
