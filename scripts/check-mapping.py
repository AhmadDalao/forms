"""Flag answer rectangles that overlap actual printed letters, not blank dotted lines."""
import json,os
from pathlib import Path
import pdfplumber
problems=[]
for doc in json.loads(Path(os.environ.get('SCHEMA_PATH','tmp/pdfs/schema.json')).read_text()):
    template=doc.get('pdfUrl',doc['id']+'.pdf').split('?')[0].split('/')[-1]
    with pdfplumber.open('public/pdfs/'+template) as pdf:
        for field in doc['fields']:
            if field['type']=='choice' or field.get('placeholderRects') or field.get('noPrint') or field.get('uiOnly') or field.get('staticPdf') or not field.get('rect'): continue
            rectangles=field.get('dateParts') or field.get('charRects') or [field['rect']]+field.get('mirrorRects',[])+([field['rtlRect']] if field.get('rtlRect') else [])
            for x,y,w,h in rectangles:
                for char in pdf.pages[field['page']-1].chars:
                    if not char['text'].isalpha():continue
                    overlap_x=max(0,min(x+w,char['x1'])-max(x,char['x0']))
                    overlap_y=max(0,min(y+h,char['bottom'])-max(y,char['top']))
                    if overlap_x>1 and overlap_y>2:problems.append((doc['id'],field['id'],char['text'],char['x0'],char['top']))
for problem in problems:print(problem)
if problems:raise SystemExit('Inspect the printed-letter overlaps above.')
print('PASS: mapped answers do not overlap printed letters in any template.')
