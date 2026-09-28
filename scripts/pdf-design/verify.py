"""Content and geometry gates for the redesigned Word/PDF family."""
from pathlib import Path
import json,re,hashlib
from docx import Document
import pdfplumber
ROOT=Path(__file__).resolve().parents[2]
sources=json.loads((ROOT/'scripts/pdf-design/source-text.json').read_text())
schemas={d['id']:d for d in json.loads((ROOT/'reference/documents/form-schema-20260927.json').read_text())}
normalize=lambda text:re.sub(r'[\W_ـ]+','',text,flags=re.UNICODE).casefold()
report={'documents':{},'failures':[]}
for path in sorted((ROOT/'tmp/modern-pdfs').glob('*/layout.json')):
    # T&C intentionally uses its original PDF, even if old generated files remain.
    if path.parent.name=='terms-and-conditions':continue
    identifier=path.parent.name;layout=json.loads(path.read_text());schema=schemas.get(identifier,{})
    docx=path.parent/f'{identifier}.docx';pdf=path.parent/'final'/f'{identifier}.pdf'
    package=Document(docx);text=' '.join(package._element.xpath('.//w:t/text()'));normalized=normalize(text)
    for key in layout['sources']:
        expected=normalize(' '.join(row['text'] for row in sources[key]['lines']))
        if expected not in normalized:report['failures'].append([identifier,'source paragraph omitted or changed',key])
    expected={f['id'] for f in schema.get('fields',[]) if not f.get('uiOnly')}
    expected|={'signature:'+s['id'] for s in schema.get('signatureSlots',[])}
    if expected!=set(layout['fields']):report['failures'].append([identifier,'mapping coverage',sorted(expected^set(layout['fields']))])
    pages=[]
    with pdfplumber.open(pdf) as rendered:
        if len(rendered.pages)!=layout['pages']:report['failures'].append([identifier,'page count'])
        for n,page in enumerate(rendered.pages,1):
            if re.search(r'M\d{4}X',page.extract_text() or ''):report['failures'].append([identifier,n,'probe marker in final PDF'])
            if any(c['x0']<0 or c['x1']>page.width+.5 or c['top']<0 or c['bottom']>page.height+.5 for c in page.chars if c['text'].strip()):report['failures'].append([identifier,n,'text outside page'])
            for key,field in layout['fields'].items():
                if field['page']!=n:continue
                for box in field.get('options',{}).values() if 'options' in field else [field['rect']]:
                    x,y,w,h=box
                    # No paper label may intrude into a typed answer area.
                    if 'options' not in field:
                        hits=[c for c in page.chars if c['text'].strip() and min(c['x1'],x+w)-max(c['x0'],x)>.5 and min(c['bottom'],y+h)-max(c['top'],y)>.5]
                        if hits:report['failures'].append([identifier,key,'label in answer area',''.join(c['text'] for c in hits)])
            pages.append({'page':n,'width':page.width,'height':page.height,'characters':len(page.chars)})
    report['documents'][identifier]={'pages':pages,'source_fragments':layout['sources'],'mapped_destinations':len(expected),'pdf_sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'docx_sha256':hashlib.sha256(docx.read_bytes()).hexdigest()}
out=ROOT/'tmp/modern-pdfs/content-verification.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'documents':len(report['documents']),'pages':sum(len(d['pages']) for d in report['documents'].values()),'source_fragments':sum(len(d['source_fragments']) for d in report['documents'].values()),'failures':report['failures']},ensure_ascii=False,indent=2))
raise SystemExit(bool(report['failures']))
