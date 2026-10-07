"""Rebuild KYC, FATCA/CRS and consent in the approved subscription Word style.

Signature and terms retain their supplied PDF bodies.

The probe has identical geometry, with tiny coordinate markers beside blank
answer areas. Its measured positions produce the application layout manifest.
No customer records or stored submissions are read or modified by this script.
"""
from pathlib import Path
import argparse, copy, json, os, re, shutil, subprocess, sys, statistics, tempfile
from docx import Document
from docx.shared import Pt, Mm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ROW_HEIGHT_RULE, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import pdfplumber
from customer_fields import customer_fields

ROOT=Path(__file__).resolve().parents[2]
REF=ROOT/'reference/documents/subscription-style.docx'
OUT=ROOT/'tmp/modern-pdfs'
RENDER=os.environ.get('DOCX_RENDERER')
PURPLE='401D58';INK='242235';MUTED='656575';BORDER='9B92A2';WIDTH=499.3
FONT='Bahij TheSansArabic Plain'
NATIONAL_ADDRESS=json.loads((ROOT/'scripts/pdf-design/national-address.json').read_text())
TEMPLATE_SOURCES=json.loads((ROOT/'scripts/pdf-design/template-sources.json').read_text())
SCHEMA=customer_fields(json.loads((ROOT/'reference/documents/form-schema-20260927.json').read_text()))
SOURCES=json.loads((ROOT/'scripts/pdf-design/source-text.json').read_text())

def render_document(target,out):
    if RENDER:
        out.mkdir(parents=True,exist_ok=True)
        for old in out.glob('page-*.png'):old.unlink()
        subprocess.run([sys.executable,RENDER,str(target),'--output_dir',str(out),'--emit_pdf'],check=True)
        return
    # Portable development path; neither Office nor Python is needed in production.
    soffice=shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice and Path('/Applications/LibreOffice.app/Contents/MacOS/soffice').is_file():
        soffice='/Applications/LibreOffice.app/Contents/MacOS/soffice'
    if not soffice or not shutil.which('pdftoppm'):
        raise RuntimeError('Install LibreOffice and Poppler (pdftoppm), or set DOCX_RENDERER.')
    out.mkdir(parents=True,exist_ok=True)
    pdf=out/(target.stem+'.pdf')
    pdf.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix='forms-office-') as profile:
        subprocess.run([soffice,'-env:UserInstallation='+Path(profile).as_uri(),'--headless','--convert-to','pdf:writer_pdf_Export','--outdir',str(out),str(target)],check=True,timeout=180)
    if not pdf.is_file():raise RuntimeError('LibreOffice did not produce '+str(pdf))
    for old in out.glob('page-*.png'):old.unlink()
    subprocess.run(['pdftoppm','-r','144','-png',str(pdf),str(out/'page')],check=True,timeout=180)
    for page in out.glob('page-*.png'):
        page.rename(out/('page-'+str(int(page.stem.split('-')[-1]))+'.png'))

def run(p,text,size=9,ar=False,bold=False,color=INK):
    r=p.add_run(text);r.font.name=FONT if ar else 'Arial';r.font.size=Pt(size);r.font.color.rgb=RGBColor.from_string(color);r.bold=bold
    rp=r._r.get_or_add_rPr();rp.rFonts.set(qn('w:cs'),FONT)
    if ar:
        rp.append(OxmlElement('w:rtl'))
        n=OxmlElement('w:szCs');n.set(qn('w:val'),str(round(size*2)));rp.append(n)
        if bold:rp.append(OxmlElement('w:bCs'))
    return r

def para(p,text='',size=9,ar=False,bold=False,color=INK,leading=None,keep=False):
    pf=p.paragraph_format;pf.space_before=Pt(0);pf.space_after=Pt(0);pf.line_spacing=Pt(leading or size*1.4);pf.keep_with_next=keep
    p.alignment=WD_ALIGN_PARAGRAPH.RIGHT if ar else WD_ALIGN_PARAGRAPH.LEFT
    if ar:
        p._p.get_or_add_pPr().append(OxmlElement('w:bidi'));p._p.get_or_add_pPr().get_or_add_jc().set(qn('w:val'),'start')
    run(p,text,size,ar,bold,color);return p

def update_national_address(doc):
    """Keep the owner's address in every footer without changing form content."""
    for section in doc.sections:
        paragraphs=section.footer.paragraphs
        p=next((p for p in paragraphs if ('7855' in p.text and '2563' in p.text) or 'Prince Naif Branch' in p.text),None)
        if p is None:
            p=section.footer.add_paragraph()
            paragraphs[-1]._p.addprevious(p._p)
        p.clear()
        for bidi in p._p.xpath('./w:pPr/w:bidi'):bidi.getparent().remove(bidi)
        # One line fits the 499 pt footer and preserves every body position.
        para(p,NATIONAL_ADDRESS['text'],7,color=MUTED,leading=9)
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER

def cell_setup(cell,shade=None):
    pr=cell._tc.get_or_add_tcPr()
    margins=OxmlElement('w:tcMar')
    for side,value in [('top',65),('bottom',55),('left',100),('right',100)]:
        e=OxmlElement('w:'+side);e.set(qn('w:w'),str(value));e.set(qn('w:type'),'dxa');margins.append(e)
    pr.append(margins)
    if shade:
        e=OxmlElement('w:shd');e.set(qn('w:fill'),shade);pr.append(e)

def table_setup(table,widths,borders=True,keep=True):
    table.autofit=False;table.alignment=WD_TABLE_ALIGNMENT.CENTER
    for i,w in enumerate(widths):
        table.columns[i].width=Pt(w)
        for row in table.rows:row.cells[i].width=Pt(w)
    e=OxmlElement('w:tblBorders')
    for side in ['top','bottom','left','right','insideH','insideV']:
        n=OxmlElement('w:'+side);n.set(qn('w:val'),'single' if borders else 'nil');n.set(qn('w:sz'),'3');n.set(qn('w:color'),BORDER);e.append(n)
    table._tbl.tblPr.append(e)
    for row in table.rows:
        if keep:row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        for cell in row.cells:cell_setup(cell)

class Builder:
    def __init__(self,schema,probe):
        self.schema=schema;self.id=schema['id'];self.probe=probe;self.doc=Document(REF);self.markers={};self.printed=set();self.printed_signatures=set();self.sources=[];self.last_heading=None
        body=self.doc._element.body
        for el in list(body):
            if el.tag!=qn('w:sectPr'):body.remove(el)
        sec=self.doc.sections[0];sec.top_margin=Pt(120 if self.id=='fatca-crs-individual' else 93);sec.bottom_margin=Pt(61);sec.left_margin=sec.right_margin=Pt(48);sec.header_distance=Pt(20)
        # Retain embedded font/style package, replace document-specific prose.
        self.doc.core_properties.title=schema['paperAr'] or schema['paperTitle'];self.doc.core_properties.author='';self.doc.core_properties.last_modified_by=''
        header=sec.header
        for t in list(header.tables):t._element.getparent().remove(t._element)
        for p in list(header.paragraphs):p.clear()
        table=header.add_table(rows=1,cols=2,width=Pt(WIDTH));table_setup(table,[141,WIDTH-141],False)
        table.cell(0,0).paragraphs[0].add_run().add_picture(str(ROOT/'public/branding/itqan.png'),width=Pt(128))
        cell=table.cell(0,1)
        if schema['paperAr']:
            para(cell.paragraphs[0],schema['paperAr'],11 if self.id=='fatca-crs-individual' else 14,True,True,PURPLE,15 if self.id=='fatca-crs-individual' else 19)
            p=para(cell.add_paragraph(),schema['paperTitle'],8 if self.id=='fatca-crs-individual' else 9,False,True,MUTED,12);p.alignment=WD_ALIGN_PARAGRAPH.RIGHT
        else:
            para(cell.paragraphs[0],schema['paperTitle'],14,False,True,PURPLE,19)
        # Retain document titles/page numbering on tax/consent forms; the owner
        # requested the same national address on every current form.
        if self.id.startswith('fatca-') or self.id=='al-naeem-terms-consent':
            for p in list(sec.footer.paragraphs):p._element.getparent().remove(p._element)
            p=sec.footer.add_paragraph();para(p,schema['paperTitle'],7,color=MUTED)
            p=sec.footer.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            n=OxmlElement('w:fldSimple');n.set(qn('w:instr'),'PAGE');p._p.append(n)
        self.fields={f['id']:f for f in schema.get('fields',[])}
        self.signatures={s['id']:s for s in schema.get('signatureSlots',[])}
        for p in list(sec.footer.paragraphs):
            if 'Client copy' in p.text or 'custody' in p.text.lower():p._element.getparent().remove(p._element)
        update_national_address(self.doc)

    def space(self,height=5):
        p=self.doc.add_paragraph();para(p,' ',1,leading=height)

    def heading(self,en,ar='',small=False):
        if not en and not ar:return
        if self.last_heading==(en,ar):return
        self.last_heading=(en,ar)
        # Paragraph spacing is painted with its shading in Word. Use an actual
        # white spacer so adjacent section/subsection bars remain distinct.
        spacer=self.doc.add_paragraph();para(spacer,'',1,leading=5,keep=True)
        # Real body paragraphs honor keep-with-next across table boundaries in
        # both Word and LibreOffice; a separate heading table can be orphaned.
        color='FFFFFF';shade=PURPLE
        long=bool(en and ar and len(en)+len(ar)>110)
        labels=[(en,False),(ar,True)] if long else [(None,False)]
        for index,(text,rtl) in enumerate(labels):
            p=self.doc.add_paragraph();para(p,'',10 if rtl else 8.5,rtl,True,color,19,True)
            p.paragraph_format.space_before=Pt(0);p.paragraph_format.space_after=Pt(0 if long and index==0 else 3)
            p.paragraph_format.left_indent=Pt(0);p.paragraph_format.right_indent=Pt(0)
            p.paragraph_format.first_line_indent=Pt(5)
            shd=OxmlElement('w:shd');shd.set(qn('w:fill'),shade);p._p.get_or_add_pPr().append(shd)
            if text is not None:run(p,text,10 if rtl else 8.5,rtl,True,color)
            elif en and ar:
                p.paragraph_format.tab_stops.add_tab_stop(Pt(WIDTH-5),WD_TAB_ALIGNMENT.RIGHT)
                run(p,en+'\t',8.5,bold=True,color=color);run(p,ar,10,True,True,color)
            elif ar:p.alignment=WD_ALIGN_PARAGRAPH.RIGHT;run(p,ar,10,True,True,color)
            else:run(p,en,8.5,bold=True,color=color)

    def note(self,en,ar=''):
        self.last_heading=None
        labels=[(en,False),(ar,True)] if en and ar else [(ar,True)] if ar else [(en,False)]
        t=self.doc.add_table(rows=1,cols=len(labels));table_setup(t,[WIDTH/len(labels)]*len(labels),False,False)
        for i,(txt,rtl) in enumerate(labels):para(t.cell(0,i).paragraphs[0],txt,10 if rtl else 8.5,rtl,leading=14 if rtl else 12)
        self.space(3)

    def fragment(self,key,arabic=None):
        self.last_heading=None
        keys=[key,arabic] if arabic else [key];self.sources+=keys
        t=self.doc.add_table(rows=1,cols=len(keys));table_setup(t,[WIDTH/len(keys)]*len(keys),False,False)
        for i,k in enumerate(keys):
            data=SOURCES[k];c=t.cell(0,i);lines=data['lines'];groups=[];current=[];last=None
            median=statistics.median(x['size'] for x in lines)
            gap=statistics.median([max(0,b['y']-a['bottom']) for a,b in zip(lines,lines[1:])] or [4])
            for line in lines:
                numbered=bool(re.match(r'^(?:(?:[A-Z]|[أبجدهوزحطيكلمنسعفصقرشت])\s*[.ـ\-:]|[•▪])\s*',line['text']))
                new=last is not None and (key=='tax-intro-en' or line['y']-last['bottom']>max(5,gap+2.5) or line['size']>median+1 or last['size']>median+1 or numbered or line.get('bold')!=last.get('bold'))
                if new and current:groups.append(current);current=[]
                current.append(line);last=line
            if current:groups.append(current)
            for j,group in enumerate(groups):
                text=' '.join(x['text'] for x in group)
                p=c.paragraphs[0] if j==0 else c.add_paragraph()
                heading=len(text)<160 and (group[0]['size']>median+.8 or group[0].get('bold'))
                para(p,text,10 if data['rtl'] else 8.5,data['rtl'],heading,PURPLE if heading else INK,14 if data['rtl'] else 12)
                p.paragraph_format.space_after=Pt(5)
        self.space(3)

    def marker(self,p,info,kind='text'):
        token='M'+str(len(self.markers)+1).zfill(4)+'X';self.markers[token]={**info,'kind':kind}
        run(p,token if self.probe else ' ',2)

    def rows(self,items,widths=None,height=24):
        if not items:return
        group_heading=self.last_heading
        self.last_heading=None
        widths=widths or [WIDTH/len(items)]*len(items)
        t=self.doc.add_table(rows=1,cols=len(items));table_setup(t,widths)
        for i,(item,w) in enumerate(zip(items,widths)):
            f=self.fields[item] if isinstance(item,str) else item
            c=t.cell(0,i);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.BOTTOM
            ar=f.get('ar','').replace(' (PDF)','');en=f.get('label','').replace(' (PDF)','')
            if re.match(r'^giin_[345]$',f.get('id','')):en+=' ('+f['id'][-1]+')'
            if re.match(r'^(ideal_|current_|person_\d+_ownership$)',f.get('id','')):
                en+=' (%)';ar+=' (%)'
            # Corporate tax document remains in its original language.
            if self.id=='fatca-crs-corporate':ar=''
            redundant_context=f.get('context') and group_heading and f['context'][0]==group_heading[0]
            if f.get('context') and not redundant_context and not re.fullmatch(r'Box \d+',f['context'][0]):
                context=f['context'];para(c.paragraphs[0],context[0],7,bold=True,color=PURPLE,leading=10)
                if ar and len(context)>1:para(c.add_paragraph(),context[1],8,True,True,PURPLE,11)
                label=c.add_paragraph()
            else:label=c.paragraphs[0]
            if ar and en and len(ar)*6.2+len(en)*4.5+15<w-20:
                # Short bilingual labels belong together, not on separate baselines.
                para(label,'',9,leading=14)
                run(label,'\u2067'+ar+'\u2069',9.5,True);run(label,' / ',8,color=MUTED);run(label,'\u2066'+en+'\u2069',7.5,color=MUTED)
            elif ar:
                para(label,ar,9.5,True,leading=13)
                para(c.add_paragraph(),en,7.5,color=MUTED,leading=11)
            else:para(label,en,9,color=INK,leading=13)
            answer=c.add_paragraph();para(answer,'',2,leading=height)
            if f.get('id'):
                self.marker(answer,{'id':f['id'],'width':w-12,'height':height-2,'signature':f.get('signature',False)})
                if f.get('signature'):self.printed_signatures.add(f['id'])
                else:self.printed.add(f['id'])
        self.space(.1)
        return t

    def choice(self,f):
        # Keep a whole question together: one field has one PDF page even when
        # the section spans several pages.
        ar=f.get('ar','') if self.id!='fatca-crs-corporate' else ''
        norm=lambda s:re.sub(r'\W+','',s).casefold()
        repeated=self.last_heading and norm(self.last_heading[0])==norm(f['label'])
        category=not re.match(r'^\d+[.]',f['label']) and '?' not in f['label'] and '؟' not in ar and len(f['label'])+len(ar)<160
        if not repeated and category:self.heading(f['label'],ar);repeated=True
        group_heading=self.last_heading if repeated else None
        self.last_heading=None
        outer=self.doc.add_table(rows=1,cols=1);table_setup(outer,[WIDTH]);cell=outer.cell(0,0)
        if repeated:para(cell.paragraphs[0],'',1,leading=1)
        elif self.id!='fatca-crs-corporate' and f.get('ar'):
            if len(f['ar'])*6.2+len(f['label'])*4.8+15<WIDTH-32:
                p=cell.paragraphs[0];para(p,'',9,leading=14)
                run(p,'\u2067'+f['ar']+'\u2069',9.5,True,True);run(p,' / ',8,color=MUTED);run(p,'\u2066'+f['label']+'\u2069',8,color=MUTED)
            else:
                para(cell.paragraphs[0],f['ar'],9.5,True,True,leading=13)
                para(cell.add_paragraph(),f['label'],8,color=MUTED,leading=12)
        else:para(cell.paragraphs[0],f['label'],9,bold=True,leading=13)
        if f['id'] in ['currencies','us_person','outside_tax'] and f.get('help'):
            para(cell.add_paragraph(),f['help'],8,color=MUTED,leading=12)
            if f.get('arHelp'):para(cell.add_paragraph(),f['arHelp'],9,True,color=MUTED,leading=13)
        opts=f.get('options',[])
        columns=2 if len(opts)>1 and max(len(o['label'])+len(o.get('ar','')) for o in opts)<125 else 1
        t=cell.add_table(rows=(len(opts)+columns-1)//columns,cols=columns)
        table_setup(t,[(WIDTH-12)/columns]*columns,False)
        for i,o in enumerate(opts):
            c=t.cell(i//columns,i%columns);p=c.paragraphs[0]
            category=({'1':'US Entities & US Financial Institutions','3':'Non-US Financial Institutions','8':'Exempt Entities','9':'Non-US Entity that is not Financial Institutions','11':'Passive Non-US Entity that is not Financial Institutions'} if f['id']=='fatca_class' else {'12':'Financial Institutions (FI)','15':'Active Non-Financial Entity (NFE)','19':'Passive Non-Financial Entity (NFE)'} if f['id']=='crs_class' else {}).get(o['value'])
            if category:
                para(p,category,8,bold=True,color=PURPLE,leading=12);p=c.add_paragraph()
            para(p,'□ ',12,leading=16)
            token='M'+str(len(self.markers)+1).zfill(4)+'X';self.markers[token]={'id':f['id'],'option':o['value'],'kind':'choice'}
            run(p,token if self.probe else ' ',2)
            if self.id!='fatca-crs-corporate' and o.get('ar'):
                # Isolate each language so numeric ranges do not jump across the slash.
                run(p,'\u2067'+o['ar']+'\u2069',9,True)
                if o['label']:run(p,' / ',8)
            if o['label']:run(p,'\u2066'+o['label']+'\u2069',8)
        # Word's mandatory trailing cell paragraph should take no extra room.
        para(cell.paragraphs[-1],'',1,leading=1)
        self.printed.add(f['id'])
        self.space(.1)
        self.last_heading=group_heading

    def field_list(self,ids):
        pending=[]
        def flush():
            if pending:self.rows(pending.copy());pending.clear()
        for id in ids:
            f=self.fields[id]
            if f.get('uiOnly') or id in self.printed:continue
            pair=({'representative_name':'representative','risk_client_name':'client'} if self.id.startswith('kyc-') else {'staff_account_holder':'relationship_manager'} if self.id=='fatca-crs-individual' else {'signer_0_name':'signatory_0','signer_1_name':'signatory_1'} if self.id=='fatca-crs-corporate' else {}).get(id)
            if pair:
                flush();self.rows([id,self.signature_field(pair)],height=45);continue
            if self.id=='fatca-crs-individual' and id=='signer_ar':
                flush();self.rows(['signer_ar','signer_en',self.signature_field('signatory')],widths=[175,175,WIDTH-350],height=45);continue
            if f['type']=='choice':flush();self.choice(f);continue
            compact_controller=self.id=='fatca-crs-corporate' and re.match(r'^person_\d+_(dob|birthplace|nationality|country|ownership|tin)$',id)
            wide=not compact_controller and (f.get('multiline') or f.get('join') or len(f['label'])>55 or len(f.get('ar',''))>65)
            if wide:
                flush();self.rows([id],height=max(25,45 if f.get('multiline') else 25))
            else:
                pending.append(id)
                if len(pending)==2:flush()
        flush()

    def signature_field(self,id):
        s=self.signatures[id]
        if id=='specimen':s={**s,'label':'Specimen Signature(s)/Figerprint','ar':'نموذج التوقيع / البصمة'}
        if self.id=='fatca-crs-corporate':s={**s,'label':'Signature','ar':''}
        return {'id':id,'label':s['label'],'ar':s['ar'],'signature':True}

    def signature(self,id):
        self.rows([self.signature_field(id)],height=65)

    def section(self,id):
        section_id=id
        s=next(s for s in self.schema['sections'] if s['id']==id)
        self.heading(s['title'],s['ar'] if self.id!='fatca-crs-corporate' else '')
        # UI-only name parts are represented by their existing derived paper
        # field. Retain the paper field even if it is hidden from the web UI.
        groups=s.get('paperGroups') or [{'fields':[f['id'] for f in s['fields']]}]
        for g in groups:
            if self.id=='kyc-individual' and set(g['fields']) & {'name_1','name_2','name_first'}:
                self.heading('Name','الاسم الرباعي',True)
                self.rows([{**self.fields[k],'label':'','ar':'','context':None} for k in ['name_1','name_2']])
            if g.get('title'):
                title=g['title'];ar=g.get('ar','')
                if self.id=='fatca-crs-individual' and g.get('nameRow'):title=title.replace('Customer name','Customer Full Name')
                self.heading(title,ar if self.id!='fatca-crs-corporate' else '',True)
            ids=[]
            for id in g['fields']:
                f=self.fields[id]
                parents=[x['id'] for x in s['fields'] if not x.get('uiOnly') and id in x.get('join',[])]
                for key in ([*parents] if f.get('uiOnly') else [id]):
                    if key not in ids:ids.append(key)
            if section_id=='suitability':ids=[id for id in ids if id.startswith('risk_') and id!='risk_client_name' and not id.startswith('risk_client_name_')]
            if self.id=='fatca-crs-individual' and all(id in ids for id in ['ar_first','ar_middle','ar_last']):
                self.rows(['ar_last','ar_middle','ar_first']);continue
            if self.id=='fatca-crs-individual' and all(id in ids for id in ['en_first','en_middle','en_last']):
                self.rows(['en_first','en_middle','en_last']);continue
            self.field_list(ids)
            if 'current_alternative' in ids:
                self.note('Ensure That the sum of all percentages above equal 100%','يجب التأكد من أن مجموع النسب يساوي 100%')
        if section_id=='suitability':
            self.note('No. Of Points between (1) and (6): Low to medium risks (recommends client to invest in the funds/ portfolio of Low risks)','عدد النقاط من (1) إلى (6): مخاطر منخفضة (ننصح العميل بالاستثمار في منتجات منخفضة المخاطر)')
            self.note('No. Of Points between (7) and (15): medium to high risks (recommends client to invest in the funds/ portfolio medium risks)','عدد النقاط من (7) إلى (15): مخاطر متوسطة إلى مرتفعة (ننصح العميل بالاستثمار في منتجات متوسطة المخاطر)')
            self.note('No. Of Points more than (15): high risks (recommends client to invest in the funds/ portfolio high risks)','عدد النقاط أكثر من (15): مخاطر مرتفعة (ننصح العميل بالاستثمار في منتجات عالية المخاطر)')
            self.note('Despite recommendation Itqan Capital','بالرغم من توصية إتقان كابيتال')
        self.field_list([f['id'] for f in s['fields']])
        for slot in self.signatures.values():
            if slot.get('section')==section_id and slot['id'] not in self.printed_signatures:
                if slot['id']=='specimen':self.doc.add_page_break()
                self.signature(slot['id'])

    def manual_options(self,en,ar,options):
        self.heading(en,ar,True)
        table=self.doc.add_table(rows=(len(options)+1)//2,cols=2)
        table_setup(table,[WIDTH/2]*2,False)
        for i,(en,ar) in enumerate(options):
            p=table.cell(i//2,i%2).paragraphs[0];para(p,'□ ',12,leading=16)
            run(p,'\u2067'+ar+'\u2069',9,True);run(p,' / ',8);run(p,'\u2066'+en+'\u2069',8)
        self.space(3)

    def staff_kyc(self):
        self.heading('To be Completed by RM or CSR','يتم تعبئته من قبل مدير العلاقة أو ممثل خدمة العملاء')
        self.rows([{'label':"Account Holder’s Full Name (First Name, Father’s Name, Surname)",'ar':'الاسم الكامل لصاحب الحساب (الاسم الأول، اسم الأب، اسم العائلة)'}])
        self.rows([{'label':'Signature of RM/CSR','ar':'توقيع مدير العلاقة / ممثل خدمة العملاء'},{'label':'Client CIF','ar':'رقم ملف بيانات العميل'}])
        self.manual_options('Internal Process (For Internal Use)','الإجراءات الداخلية (للاستخدام الداخلي)',[['Client Signature','توقيع العميل'],['Complete Document','استكمال المستندات'],['Establish Investment Account in The System','تأسيس حساب استثماري على النظام']])
        self.note('Review:','المراجعة:')
        self.manual_options('Client Classification','تصنيف العميل',[['Retail Client','عميل تجزئة'],['A qualified Client','عميل مؤهل'],['An Institutional Client','عميل مؤسسي']])
        self.manual_options('Client Risk Rating','درجة تقييم مخاطر العميل',[['Low','منخفض'],['Medium','متوسط'],['High','عالية']])
        self.heading('Senior Management Approval (If needed)','موافقة الإدارة العليا (عند الحاجة)',True)
        self.rows([{'label':'Name','ar':'الاسم'},{'label':'Signature','ar':'التوقيع'}],height=35);self.rows([{'label':'Position','ar':'الوظيفة'},{'label':'Date','ar':'التاريخ'}])

    def build(self):
        id=self.id
        if id=='signature-form':
            self.section('client');self.section('signatory')
            self.heading('For Company use only','لاستعمال الشركة فقط')
            self.rows([{'label':'Branch','ar':'الفرع'},{'label':'Signed / Stamped in my Presence','ar':'تم (التوقيع / أخذ البصمة والختم) أمامي'}])
            self.note('Reviewed & Approved By','مراجعة واعتماد');self.rows([{'label':'Name','ar':'الاسم'},{'label':'Signature','ar':'التوقيع'}])
            self.note('Account Manger','مسؤول الحساب');self.rows([{'label':'Name','ar':'الاسم'},{'label':'Signature','ar':'التوقيع'}])
        elif id.startswith('kyc-'):
            for s in self.schema['sections']:
                if s['id']=='suitability':
                    self.staff_kyc();self.doc.add_page_break()
                self.section(s['id'])
        elif id=='fatca-crs-individual':
            self.fragment('tax-intro-en','tax-intro-ar');self.section('identity');self.section('residency')
            self.fragment('tax-tin-en','tax-tin-ar');self.fragment('tax-tin-entry-en','tax-tin-entry-ar');self.fragment('tax-residency-en','tax-residency-ar');self.fragment('tax-reasons-en','tax-reasons-ar');self.section('tax')
            self.heading('Section D – Declaration and Signature','القسم د – الإقرار والتوقيع')
            self.fragment('tax-declaration-en','tax-declaration-ar');self.section('signatory');self.section('staff')
            # The source fragments already contain their bilingual glossary
            # heading; printing another title repeats it immediately below.
            self.doc.add_page_break();self.fragment('tax-definitions-en','tax-definitions-ar');self.fragment('tax-definitions-continued-en','tax-definitions-continued-ar')
        elif id=='fatca-crs-corporate':
            self.section('entity');self.fragment('entity-tax-instructions');self.section('tax')
            self.note('If the Account Holder is tax resident in more than three countries/jurisdictions, please use a separate sheet')
            self.fragment('entity-instructions');self.section('fatca');self.fragment('entity-fatca-note');self.section('crs');self.fragment('entity-crs-note')
            self.fragment('entity-controller-intro');self.section('controllers');self.fragment('entity-controller-reasons')
            self.fragment('entity-declaration');self.section('signatories')
            self.heading('(To be completed by the company Account Officer)')
            self.rows([{'label':'Customer Account Number:'}],height=30)
            self.rows([{'label':'Account Officer Name:'},{'label':'Account Officer signature:'}],height=45)
            p=self.doc.add_paragraph();para(p,'The remainder of this page ',8,color=MUTED)
            n=OxmlElement('w:fldSimple');n.set(qn('w:instr'),'PAGE');p._p.append(n)
            run(p,' is intentionally left blank.',8,color=MUTED)
        elif id=='al-naeem-terms-consent':
            self.heading('','إقرار من مالكي الوحدات:')
            self.note('','لقد قمت / قمنا بقراءة الشروط والأحكام والملاحق الخاصة بالصندوق وفهم ما جاء فيها والموافقة عليها، كما جرى الحصول على نسخة منها بعد التوقيع عليها. وإثباتاً لما تقدم، قام المستثمر بالتوقيع على هذه الشروط والأحكام الخاصة بالصندوق في التاريخ والسنة المذكورين أدناه.')
            self.space(25);self.heading('','من قبل المستثمر')
            self.rows([{'ar':'التوقيع:'},{'ar':'الاسم:'}],height=55)
            self.rows([{'ar':'التاريخ:'}],height=30)
            self.space(45)
            t=self.doc.add_table(rows=1,cols=2);table_setup(t,[WIDTH/2]*2,False)
            para(t.cell(0,0).paragraphs[0],'العضو المنتدب والرئيس التنفيذي\nد. محمد بسام هاشم السيد',10,True,leading=16)
            para(t.cell(0,1).paragraphs[0],'مسؤول المطابقة والالتزام\nأسامه فايز المالكي',10,True,leading=16)
        expected={f['id'] for f in self.schema.get('fields',[]) if not f.get('uiOnly')}
        assert self.printed==expected,(id,'Missing fields',expected-self.printed,'extra',self.printed-expected)
        assert {m['id'] for m in self.markers.values() if m.get('signature')}==set(self.signatures),(id,'Missing signatures')

def measure(pdf,markers):
    result={};occurrences={}
    with pdfplumber.open(pdf) as doc:
        for n,page in enumerate(doc.pages,1):
            for token,info in markers.items():
                matches=page.search(token,regex=False)
                if not matches:continue
                assert len(matches)==1 and token not in occurrences,(token,'duplicate')
                occurrences[token]=n;m=matches[0]
                if info['kind']=='choice':
                    boxes=[c for c in page.chars if c['text']=='□' and c['x0']<m['x0'] and abs(c['bottom']-m['bottom'])<14]
                    c=min(boxes,key=lambda c:abs(c['x0']-m['x0'])+abs(c['bottom']-m['bottom']))
                    rect=[c['x0'],c['top']+.8,9.2,9.2]
                    f=result.setdefault(info['id'],{'page':n,'options':{}})
                    assert f['page']==n,(info['id'],'choice crosses pages')
                    f['options'][info['option']]=[round(v,2) for v in rect]
                else:
                    edges=[e['top'] for e in page.edges if e['orientation']=='h' and e['x0']<=m['x0']<=e['x1'] and e['top']>m['bottom']]
                    bottom=min(edges)
                    key=('signature:' if info.get('signature') else '')+info['id']
                    result[key]={'page':n,'rect':[round(m['x0'],2),round(bottom-info['height']-3,2),round(info['width'],2),round(info['height'],2)]}
        assert len(occurrences)==len(markers),(len(occurrences),len(markers),set(markers)-set(occurrences))
        return result,len(doc.pages)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--only');ap.add_argument('--author-only',action='store_true');args=ap.parse_args()
    titles={
        'kyc-individual':('Investor Information (Individuals)','معلومات المستثمر (أفراد)'),
        'kyc-corporate':('Investor Information (Corporate)','معلومات المستثمر (الشركات)'),
        'fatca-crs-individual':('INTERNATIONAL TAX TRANSPARENCY — Self-Certification & Declaration Form (FATCA & CRS) – INDIVIDUAL','الشفافية الضريبية الدولية — نموذج شهادة إقرار ذاتي (قانون الامتثال الضريبي للحسابات الأجنبية ومعيار الإبلاغ المشترك) – الأفراد'),
        'fatca-crs-corporate':('International Tax Self-Certification Form (For ENTITIES)',''),
        'al-naeem-terms-consent':('','إتقان كابيتال | صندوق النعيم العقاري')}
    assert set(titles)==set(TEMPLATE_SOURCES['modern_documents'])
    if args.only and set(args.only.split(','))-set(titles):
        ap.error('Unknown or excluded document. Signature and terms retain their supplied PDFs; use the original-footer pipeline.')
    documents=[d for d in SCHEMA if d['id'] in titles]+[{'id':'al-naeem-terms-consent'}]
    manifest={}
    for schema in documents:
        id=schema['id']
        if args.only and id not in args.only.split(','):continue
        schema['paperTitle'],schema['paperAr']=titles[id]
        base=OUT/id;base.mkdir(parents=True,exist_ok=True)
        for probe in [True,False]:
            b=Builder(schema,probe);b.build();target=base/('probe.docx' if probe else id+'.docx');b.doc.save(target)
            if args.author_only:continue
            out=base/('probe' if probe else 'final')
            render_document(target,out)
            pdf=out/(target.stem+'.pdf')
            if probe:layout,pages=measure(pdf,b.markers)
            else:
                with pdfplumber.open(pdf) as rendered:
                    assert len(rendered.pages)==pages,(id,len(rendered.pages),pages)
                    assert not any(re.search(r'M\d{4}X',p.extract_text() or '') for p in rendered.pages)
                manifest[id]={'pages':pages,'fields':layout,'sources':b.sources,'version':NATIONAL_ADDRESS['version']}
                (base/'layout.json').write_text(json.dumps(manifest[id],ensure_ascii=False,indent=2)+'\n')
                print(id,pages,'pages',len(layout),'mapped destinations',flush=True)
    (OUT/'build-result.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
