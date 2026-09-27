"""Extract legal paragraphs without reversing Arabic ligatures inside glyphs.

PDF ToUnicode maps can map one glyph to several logical Arabic characters.
Reversing extracted strings corrupts these ligatures; reorder glyph records,
then preserve Latin/number runs. Source rectangles are explicit and reviewed.
"""
from pathlib import Path
import json, re, statistics, unicodedata
import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'scripts/pdf-design/source-text.json'

def logical(chars, rtl=False):
    if rtl:
        # Some source PDFs paint zero-advance spacing glyphs over letters.
        # They are not visible spaces in the paper and must not split words.
        letters=[c for c in chars if c['text'].strip()]
        chars=[c for c in chars if c['text'].strip() or not any(max(0,min(c['x1'],x['x1'])-max(c['x0'],x['x0']))> .55*(c['x1']-c['x0']) for x in letters)]
    chars = sorted(chars, key=lambda c:c['x0'], reverse=rtl)
    if not rtl:
        text='';last=None
        for c in chars:
            if last and c['x0']-last['x1']>max(1.4,c['size']*.18) and not text.endswith(' '):text+=' '
            text+=c['text'];last=c
        return re.sub(r'\s+',' ',text).strip()
    chunks=[];run=[]
    for c in chars:
        s=c['text']
        if re.fullmatch(r'[A-Za-z0-9.,:/%+\- ]+',s):run.append(s)
        else:
            if run:chunks.append(''.join(reversed(run)));run=[]
            chunks.append(s)
    if run:chunks.append(''.join(reversed(run)))
    text=re.sub(r'\s+',' ',''.join(chunks)).strip()
    return re.sub(r'^(\d+)\.(?=\S)',r'\1. ',text)

def extract(page, box, rtl=False):
    chars=[c for c in page.chars if box[0]<=c['x0'] and c['x1']<=box[2]+.2 and box[1]<=c['top'] and c['bottom']<=box[3]+.2]
    unique={}
    for c in chars:unique[(c['text'],round(c['x0'],2),round(c['top'],2))]=c
    chars=list(unique.values())
    lines=[]
    for c in sorted(chars,key=lambda c:(round(c['bottom'],1),c['x0'])):
        row=next((r for r in reversed(lines[-3:]) if abs(r['bottom']-c['bottom'])<2.8),None)
        if row is None:row={'bottom':c['bottom'],'chars':[]};lines.append(row)
        row['chars'].append(c)
    lines.sort(key=lambda r:r['bottom'])
    result=[]
    for row in lines:
        text=logical(row['chars'],rtl)
        if not text:continue
        ink=[c for c in row['chars'] if c['text'].strip()]
        result.append({'text':text,'y':round(min(c['top'] for c in row['chars']),2),'bottom':round(max(c['bottom'] for c in row['chars']),2),'size':round(statistics.median(c['size'] for c in row['chars']),1),'bold':sum('Bold' in c['fontname'] for c in ink)>len(ink)*.8})
    return result

def main():
    docs={};sources={}
    def crop(key,doc,page,box,rtl=False):
        if doc not in docs:docs[doc]=pdfplumber.open(ROOT/'reference/pdfs'/f'{doc}.pdf')
        rows=extract(docs[doc].pages[page-1],box,rtl)
        assert rows,(key,box)
        sources[key]={'document':doc,'page':page,'box':box,'rtl':rtl,'lines':rows}
    # All terms clauses, including the telephone/fax appendix. Page 11 has only
    # controls and staff fields, which the designer recreates as editable rows.
    for n in [*range(1,11),12,13]:
        top=99 if n==1 else 115 if n==12 else 67
        bottom=264 if n==13 else 734
        crop(f'terms-{n}-en','terms-and-conditions',n,[30,top,302,bottom])
        crop(f'terms-{n}-ar','terms-and-conditions',n,[306,top,582,bottom],True)
    crop('terms-appendix-title-ar','terms-and-conditions',12,[0,73,595,90],True)
    crop('terms-appendix-title-en','terms-and-conditions',12,[0,100,595,115])
    # Individual FATCA: instructions, declaration and all definitions.
    for key,page,box,ar in [
        ('tax-intro-en',1,[39,78,350,109],False),('tax-intro-ar',1,[350,78,590,109],True),
        ('tax-tin-en',1,[40,567,308,626],False),('tax-tin-ar',1,[312,567,585,626],True),
        ('tax-tin-entry-en',1,[0,634,595,644],False),('tax-tin-entry-ar',1,[0,644,595,654],True),
        ('tax-residency-en',2,[40,82,308,103],False),('tax-residency-ar',2,[312,82,585,103],True),
        ('tax-reasons-en',2,[40,181,308,282],False),('tax-reasons-ar',2,[312,181,585,282],True),
        ('tax-declaration-en',2,[40,308,332,590],False),('tax-declaration-ar',2,[334,308,585,590],True),
        ('tax-definitions-en',3,[40,201,317,730],False),('tax-definitions-ar',3,[320,201,585,730],True),
        ('tax-definitions-continued-en',4,[40,69,317,520],False),('tax-definitions-continued-ar',4,[320,69,585,520],True),
    ]:crop(key,'fatca-crs-individual',page,box,ar)
    # Corporate FATCA is supplied in English only.
    for key,page,box in [
        ('entity-tax-instructions',1,[64,430,580,558]),
        ('entity-instructions',2,[80,115,580,350]),
        ('entity-fatca-note',3,[85,654,580,705]),
        ('entity-crs-note',4,[85,502,580,550]),
        ('entity-controller-intro',5,[64,76,580,135]),
        ('entity-controller-reasons',5,[122,512,580,585]),
        ('entity-declaration',6,[85,70,575,219]),
    ]:crop(key,'fatca-crs-corporate',page,[0,box[1],595,box[3]])
    OUT.write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
    print(len(sources),'source fragments')

if __name__=='__main__':main()
