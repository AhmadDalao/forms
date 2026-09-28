"""Content and geometry gates for the redesigned Word/PDF family."""
from pathlib import Path
import json,re,hashlib
from docx import Document
import pdfplumber
from customer_fields import customer_fields
ROOT=Path(__file__).resolve().parents[2]
sources=json.loads((ROOT/'scripts/pdf-design/source-text.json').read_text())
schemas={d['id']:d for d in customer_fields(json.loads((ROOT/'reference/documents/form-schema-20260927.json').read_text()))}
normalize=lambda text:re.sub(r'[\W_ـ]+','',text,flags=re.UNICODE).casefold()
report={'documents':{},'failures':[]}
for path in sorted((ROOT/'tmp/modern-pdfs').glob('*/layout.json')):
    # Signature and T&C use original PDFs, even if stale generated files remain.
    if path.parent.name in {'terms-and-conditions','signature-form'}:continue
    identifier=path.parent.name;layout=json.loads(path.read_text());schema=schemas.get(identifier,{})
    docx=path.parent/f'{identifier}.docx';pdf=path.parent/'final'/f'{identifier}.pdf'
    package=Document(docx);text=' '.join(package._element.xpath('.//w:t/text()'));normalized=normalize(text)
    if layout['version'] in {'20260928-sections-3','20260928-client-flow-4'}:
        for label in (['Educational Level','Marital Status','Correspondence / Statement'] if identifier=='kyc-individual' else ['Correspondence / Statement'] if identifier=='kyc-corporate' else []):
            if text.count(label)!=1:report['failures'].append([identifier,'repeated section label',label])
        if re.search(r'\bBox [12]\b',text):report['failures'].append([identifier,'unnecessary Box context label'])
        pairs=({'representative_name':'representative','risk_client_name':'client'} if identifier.startswith('kyc-') else {'signer_ar':'signatory','signer_en':'signatory','staff_account_holder':'relationship_manager'} if identifier=='fatca-crs-individual' else {'signer_0_name':'signatory_0','signer_1_name':'signatory_1'} if identifier=='fatca-crs-corporate' else {})
        for name,signature in pairs.items():
            if name not in layout['fields']:continue
            a=layout['fields'][name];b=layout['fields']['signature:'+signature]
            if a['page']!=b['page'] or abs(a['rect'][1]-b['rect'][1])>.2:report['failures'].append([identifier,name,'name and signature are not on the same row'])
    for key in layout['sources']:
        expected=normalize(' '.join(row['text'] for row in sources[key]['lines']))
        if expected not in normalized:report['failures'].append([identifier,'source paragraph omitted or changed',key])
    expected={f['id'] for f in schema.get('fields',[]) if not f.get('uiOnly')}
    expected|={'signature:'+s['id'] for s in schema.get('signatureSlots',[])}
    if expected!=set(layout['fields']):report['failures'].append([identifier,'mapping coverage',sorted(expected^set(layout['fields']))])
    inline_choices=[]
    if layout['version'] in {'20260928-inline-2','20260928-sections-3','20260928-client-flow-4'} and identifier!='fatca-crs-corporate':
        paragraphs=[' '.join(p.xpath('.//w:t/text()')).replace('  ',' ') for p in package._element.xpath('.//w:p')]
        for field in schema.get('fields',[]):
            for option in field.get('options',[]):
                if not option.get('ar') or not option.get('label'):continue
                # Each translation pair is a single editable paragraph with one checkbox.
                paired=any('□' in text and option['label'] in text and option['ar'] in text and ' / ' in text for text in paragraphs)
                if not paired:report['failures'].append([identifier,field['id'],option['value'],'bilingual choice split into separate paragraphs'])
                if len(option['ar'])+len(option['label'])<=55:
                    inline_choices.append((field,option))
    pages=[]
    with pdfplumber.open(pdf) as rendered:
        if len(rendered.pages)!=layout['pages']:report['failures'].append([identifier,'page count'])
        for field,option in inline_choices:
            position=layout['fields'][field['id']]
            x,y,w,h=position['options'][option['value']]
            page=rendered.pages[position['page']-1]
            chars=[c for c in page.chars if c['x0']>=x+8 and c['x0']<min(x+240,page.width-45) and c['top']>=y-4 and c['bottom']<=y+17]
            line=''.join(c['text'] for c in sorted(chars,key=lambda c:c['x0']))
            if '/' not in line or not re.search(r'[\u0600-\u06ff]',line) or normalize(option['label']) not in normalize(line):
                report['failures'].append([identifier,field['id'],option['value'],'short bilingual choice not on one line',line])
        for n,page in enumerate(rendered.pages,1):
            if layout['version'] in {'20260928-sections-3','20260928-client-flow-4'}:
                purple=tuple(int(v,16)/255 for v in ['40','1D','58'])
                for bar in page.rects:
                    color=bar.get('non_stroking_color')
                    if isinstance(color,(list,tuple)) and len(color)==3 and max(abs(a-b) for a,b in zip(color,purple))<.001:
                        if abs(bar['x0']-48)>.2 or abs(bar['x1']-547.3)>.2:report['failures'].append([identifier,n,'section bar does not match table width'])
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
    report['documents'][identifier]={'pages':pages,'source_fragments':layout['sources'],'mapped_destinations':len(expected),'short_inline_choices_checked':len(inline_choices),'pdf_sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'docx_sha256':hashlib.sha256(docx.read_bytes()).hexdigest()}
out=ROOT/'tmp/modern-pdfs/content-verification.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'documents':len(report['documents']),'pages':sum(len(d['pages']) for d in report['documents'].values()),'source_fragments':sum(len(d['source_fragments']) for d in report['documents'].values()),'failures':report['failures']},ensure_ascii=False,indent=2))
raise SystemExit(bool(report['failures']))
