import json, sys, subprocess, math, re
from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageFont

report_path=Path(sys.argv[1]); data=json.loads(report_path.read_text()); out=report_path.parent/'pdf-check'; out.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
identity=(1,0,0,1,0,0)
def compose(c,m):
 a,b,c1,d,e,f=c; A,B,C,D,E,F=m
 return (a*A+c1*B,b*A+d*B,a*C+c1*D,b*C+d*D,a*E+c1*F+e,b*E+d*F+f)
results=[]
for sample in data['pdfs']:
 filled=PdfReader(sample['filled']); original=PdfReader(sample['original']); assert len(filled.pages)==len(original.pages)
 key=sample['lang']+'-'+sample['doc']; drawings={}; renders={}
 for number in sorted({field['page'] for field in sample['fields']}):
  page=filled.pages[number-1]; before={key for key in original.pages[number-1].images.keys() if isinstance(key,str)}; added={key for key in page.images.keys() if isinstance(key,str)}-before; ctm=identity; stack=[]; drawings[number]=[]
  for args,op in page.get_contents().operations:
   if op==b'q':stack.append(ctm)
   elif op==b'Q':ctm=stack.pop()
   elif op==b'cm':ctm=compose(ctm,tuple(float(v) for v in args))
   elif op==b'Do' and args[0] in added:drawings[number].append((ctm,page.images[args[0]].image))
  prefix=out/(key+'-p'+str(number)); subprocess.run(['pdftoppm','-f',str(number),'-l',str(number),'-singlefile','-scale-to','1600','-png',sample['filled'],str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);renders[number]=Image.open(str(prefix)+'.png').convert('RGB')
 crops=[]; checks=[]
 for field in sample['fields']:
  page=filled.pages[field['page']-1]; ph=float(page.mediabox.height); pw=float(page.mediabox.width); rtl=field.get('direction')=='rtl' or field.get('direction')!='ltr' and re.search(r'[\u0600-\u06ff]',field['value'])
  rect=field.get('rtlRect') if rtl and field.get('rtlRect') else field['rect'];x,y,w,h=rect
  found=[(ctm,img) for ctm,img in drawings[field['page']] if max(abs(ctm[i]-value) for i,value in [(0,w),(3,h),(4,x),(5,ph-y-h)])<0.02]
  assert len(found)==1,(key,field['id'],'Missing unique name image at exact PDF field rectangle',rect)
  ctm,img=found[0];assert img.mode=='RGBA';
  assert all(abs(r-20)<=2 and abs(g-86)<=2 and abs(b-160)<=2 for r,g,b,a in img.getdata() if a==255),'Name ink must be blue'
  bbox=img.getchannel('A').getbbox();assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<img.width and bbox[3]<img.height,(key,field['id'],'Clipped or empty name text',bbox,img.size)
  render=renders[field['page']];sx=render.width/pw;sy=render.height/ph
  crop=render.crop((max(0,math.floor((x-7)*sx)),max(0,math.floor((y-7)*sy)),min(render.width,math.ceil((x+w+7)*sx)),min(render.height,math.ceil((y+h+7)*sy))))
  if crop.width<850:crop=crop.resize((min(850,crop.width*2),int(crop.height*min(850/crop.width,2))))
  crops.append((field,crop));checks.append({'field':field['id'],'value':field['value'],'page':field['page'],'rect':rect,'ink_bounds_px':bbox,'image_size':img.size,'inside_field':True})
 height=sum(max(crop.height,40)+52 for _,crop in crops)+30;sheet=Image.new('RGB',(1000,height),'#f3f2f7');draw=ImageDraw.Draw(sheet);top=15
 for field,crop in crops:
  draw.text((15,top),key+' / '+field['id'],font=font,fill='#30263b');top+=30;sheet.paste(crop,(15,top));top+=max(crop.height,40)+22
 sheet.save(out/(key+'-names.png'));results.append({'doc':sample['doc'],'lang':sample['lang'],'fields':checks,'sheet':str(out/(key+'-names.png'))})
 print('PASS',key,len(checks),'name overlays at exact field rectangles with unclipped alpha ink')
summary={'passed':True,'pdfs':len(results),'name_fields':sum(len(r['fields']) for r in results),'results':results};(out/'report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print('REPORT',out/'report.json')
