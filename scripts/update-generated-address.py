"""Update only national-address footer text in generated templates.

Requires PyMuPDF, python-docx/lxml and reportlab (legacy subscription helper).
The canonical five-part address is scripts/pdf-design/national-address.json.
No form rebuilding, field maps, source reference PDFs or customer data are used.
Existing single-line five-part Saudi address paragraphs are recognized so later
address changes are repeatable; already-current PDFs/Word files are left intact.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, math, re, shutil, sys, zipfile
from xml.sax.saxutils import escape
import numpy as np
import pymupdf as fitz
from lxml import etree
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
GENERATED=['subscription-individual','subscription-company','al-naeem-terms-consent','fatca-crs-individual','fatca-crs-corporate']
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def address_text(text):return text.count(' | ')==4 and text.endswith('Kingdom of Saudi Arabia')
def span_address(page):
    spans=[s for b in page.get_text('dict')['blocks'] for line in b.get('lines',[]) for s in line['spans'] if s['bbox'][1]>page.rect.height-50 and address_text(s['text'])]
    assert len(spans)==1,('Expected exactly one address line',page.number,len(spans))
    return spans[0]

def footer_font(requested):
    candidates=[Path(requested)] if requested else [
        Path(sys.executable).parent.parent.parent/'native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype/LiberationSans-Regular.ttf',
        Path('/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'),
        Path('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf')]
    result=next((p for p in candidates if p.is_file()),None)
    if result is None:raise RuntimeError('Provide --font pointing to LiberationSans-Regular.ttf.')
    return result

def replace_pdf(path,new,font_path):
    doc=fitz.open(path);font=fitz.Font(fontfile=str(font_path));changes=[]
    for page in doc:
        old=span_address(page)
        if old['text']==new:continue
        assert old['font']=='LiberationSans' and old['size'] in (6.5,7.0)
        old_x,old_y=old['origin'];target_y=page.rect.height-old_y
        changed=[];emitted_address=False
        # Match the isolated address block from either LibreOffice (Td) or this
        # updater (identity Tm). Keep every other content-stream byte untouched.
        for xref in page.get_contents():
            raw=doc.xref_stream(xref);matches=[]
            for block in re.finditer(rb'BT\s.*?\bET\b',raw,re.S):
                emitted=re.search(rb'1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s+Tm\s+/NationalAddress\s+([-\d.]+)\s+Tf',block.group())
                at=re.search(rb'([-\d.]+)\s+([-\d.]+)\s+Td\s+/\w+\s+([-\d.]+)\s+Tf',block.group()) or emitted
                if at and abs(float(at[1])-old_x)<.02 and abs(float(at[2])-target_y)<.02 and abs(float(at[3])-old['size'])<.01:
                    matches.append(block);emitted_address=bool(emitted)
            for block in reversed(matches):
                raw=raw[:block.start()]+b'BT\nET'+raw[block.end():]
            if matches:doc.update_stream(xref,raw);changed.extend([xref]*len(matches))
        assert len(changed)==1,('Ambiguous address text object',path,page.number,changed)
        width=font.text_length(new,fontsize=old['size']);assert width<=499.3
        right=path.stem.startswith('subscription-')
        x=old['bbox'][2]-width if right else (old['bbox'][0]+old['bbox'][2]-width)/2
        if emitted_address:
            # Use the same font metrics both ways, avoiding cumulative drift
            # from the rounded glyph widths returned by PDF text extraction.
            x=old_x+(font.text_length(old['text'],fontsize=old['size'])-width)/(1 if right else 2)
        rgb=tuple(((old['color']>>shift)&255)/255 for shift in (16,8,0))
        page.insert_text((x,old_y),new,fontname='NationalAddress',fontfile=str(font_path),fontsize=old['size'],color=rgb,overlay=True)
        changes.append({'page':page.number+1,'removedTextObjectInOriginalStream':changed[0],'font':'LiberationSans','size':old['size'],'baseline':old_y,'align':'right' if right else 'center'})
    if changes:
        temp=path.with_suffix('.address-tmp.pdf');doc.save(temp,garbage=0,deflate=True);doc.close();temp.replace(path)
    else:doc.close()
    return changes

def replace_word(path,new):
    with zipfile.ZipFile(path) as z:entries=z.infolist();parts={i.filename:z.read(i) for i in entries}
    changed=[]
    for name,raw in list(parts.items()):
        if not re.fullmatch(r'word/footer\d+\.xml',name):continue
        root=etree.fromstring(raw)
        for paragraph in root.xpath('//w:p',namespaces=NS):
            text=''.join(paragraph.xpath('.//w:t/text()',namespaces=NS))
            if not address_text(text) or text==new:continue
            old=escape(text).encode();replacement=escape(new).encode()
            assert raw.count(old)==1,('Address must occupy one XML text node',path,name)
            raw=raw.replace(old,replacement,1);changed.append(name)
        parts[name]=raw
    if changed:
        temp=path.with_suffix('.address-tmp.docx')
        with zipfile.ZipFile(temp,'w') as z:
            for info in entries:z.writestr(info,parts[info.filename])
        temp.replace(path)
    return changed

def compare_word(before,after,new):
    with zipfile.ZipFile(before) as a,zipfile.ZipFile(after) as b:
        assert a.namelist()==b.namelist();changed=[n for n in a.namelist() if a.read(n)!=b.read(n)]
        assert all(re.fullmatch(r'word/footer\d+\.xml',n) for n in changed)
        for name in changed:
            original=a.read(name);texts=etree.fromstring(original).xpath('//w:p',namespaces=NS)
            old=next(''.join(p.xpath('.//w:t/text()',namespaces=NS)) for p in texts if address_text(''.join(p.xpath('.//w:t/text()',namespaces=NS))))
            assert original.replace(escape(old).encode(),escape(new).encode(),1)==b.read(name)
        return {'changedZipEntries':changed,'allOtherEntriesByteIdentical':True,'footerOnlyExactTextReplacement':True}

def verify_pdf(before,after,new,out,legacy=False):
    a=fitz.open(before);b=fitz.open(after);assert len(a)==len(b);rows=[]
    for i,(old,current) in enumerate(zip(a,b),1):
        assert old.rect==current.rect and old.rotation==current.rotation
        if legacy:
            assert new in ' '.join(current.get_text().split());allowed=fitz.Rect(156,815,355,838)
        else:
            s0=span_address(old);s1=span_address(current);assert s1['text']==new
            assert s0['size']==s1['size'] and s0['color']==s1['color']
            assert abs(s0['origin'][1]-s1['origin'][1])<.01
            allowed=fitz.Rect(s0['bbox'])|fitz.Rect(s1['bbox'])
        p0=old.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);p1=current.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
        x=np.frombuffer(p0.samples,dtype=np.uint8).reshape(p0.height,p0.width,p0.n);y=np.frombuffer(p1.samples,dtype=np.uint8).reshape(p1.height,p1.width,p1.n)
        changed=np.any(x!=y,axis=2);outside=changed.copy()
        # One raster pixel of antialiasing allowance around the address glyph box.
        x0=max(0,math.floor(allowed.x0*2)-1);y0=max(0,math.floor(allowed.y0*2)-1);x1=min(p0.width,math.ceil(allowed.x1*2)+1);y1=min(p0.height,math.ceil(allowed.y1*2)+1)
        outside[y0:y1,x0:x1]=False
        count=int(outside.sum());assert count==0,('Pixels changed outside address',after,i,count)
        body_limit=int((old.rect.height-60)*2);assert not changed[:body_limit].any()
        image=Image.fromarray(y);footer=image.crop((0,int((old.rect.height-72)*2),p1.width,p1.height));footer.save(out/f'{after.stem}-page-{i}-footer.png')
        rows.append({'page':i,'size':list(current.rect),'changedPixels':int(changed.sum()),'outsideAddressChangedPixels':count,'bodyPixelsIdentical':True,'nonAddressFooterPixelsIdentical':True,'addressBounds':list(allowed)})
    return rows

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--before-dir',type=Path,required=True);ap.add_argument('--report-dir',type=Path,required=True);ap.add_argument('--font');args=ap.parse_args()
    before=args.before_dir.resolve();out=args.report_dir.resolve();before.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    canonical=json.loads((ROOT/'scripts/pdf-design/national-address.json').read_text());new=canonical['text'];assert address_text(new);font_path=footer_font(args.font)
    report={'canonical':canonical,'font':font_path.name,'pdfs':[],'words':[],'mirrors':[]}
    for name in GENERATED:
        pdf=ROOT/'public/pdfs'/f'{name}.pdf';word=ROOT/'output/documents'/f'{name}.docx'
        for source in [pdf,word]:
            if not (before/source.name).exists():shutil.copyfile(source,before/source.name)
        operations=replace_pdf(pdf,new,font_path);wordChanges=replace_word(word,new)
        pages=verify_pdf(before/pdf.name,pdf,new,out)
        report['pdfs'].append({'name':name,'beforeSha256':digest(before/pdf.name),'afterSha256':digest(pdf),'pages':pages,'operations':operations})
        report['words'].append({'name':name,'beforeSha256':digest(before/word.name),'afterSha256':digest(word),'changedThisRun':wordChanges,**compare_word(before/word.name,word,new)})
        for folder in ['output/documents','output/pdf']:
            mirror=ROOT/folder/pdf.name
            if mirror.is_file():shutil.copyfile(pdf,mirror);report['mirrors'].append(str(mirror.relative_to(ROOT)))
    legacy=ROOT/'public/pdfs/subscription-form.pdf'
    if not (before/legacy.name).exists():shutil.copyfile(legacy,before/legacy.name)
    with fitz.open(legacy) as d:already=new in ' '.join(d[0].get_text().split())
    if not already:
        spec=importlib.util.spec_from_file_location('rebuild_subscription',ROOT/'scripts/rebuild-subscription.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.refresh_legacy_subscription()
    report['pdfs'].append({'name':'subscription-form','beforeSha256':digest(before/legacy.name),'afterSha256':digest(legacy),'legacyReferencePreserved':True,'pages':verify_pdf(before/legacy.name,legacy,new,out,legacy=True)})
    for folder in ['output/documents','output/pdf']:
        mirror=ROOT/folder/legacy.name
        if mirror.is_file():shutil.copyfile(legacy,mirror);report['mirrors'].append(str(mirror.relative_to(ROOT)))
    images=sorted(out.glob('*-footer.png'))
    for part in range(0,len(images),8):
        selected=images[part:part+8];width=max(Image.open(p).width for p in selected);height=sum(Image.open(p).height+24 for p in selected)
        sheet=Image.new('RGB',(width,height),'white');draw=ImageDraw.Draw(sheet);y=0
        for p in selected:
            draw.text((8,y+4),p.stem,fill='black');im=Image.open(p);sheet.paste(im,(0,y+24));y+=im.height+24
        sheet.save(out/f'footer-contact-sheet-{part//8+1}.png')
    report['summary']={'pdfs':len(report['pdfs']),'pages':sum(len(p['pages']) for p in report['pdfs']),'words':len(report['words']),'outsideAddressChangedPixels':0,'allNonFooterWordEntriesByteIdentical':True}
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['summary']))

if __name__=='__main__':main()
