"""Copy reviewed output into source assets; deployment remains a separate step."""
from pathlib import Path
import json, shutil, hashlib
ROOT=Path(__file__).resolve().parents[2]
(ROOT/'output/documents').mkdir(parents=True,exist_ok=True)
layouts={};report={}
existing=json.loads((ROOT/'src/forms/modern-layouts.json').read_text())
for file in sorted((ROOT/'tmp/modern-pdfs').glob('*/layout.json')):
    # Signature and T&C use original PDFs, even if stale generated files remain.
    if file.parent.name in {'terms-and-conditions','signature-form'}:continue
    identifier=file.parent.name;layout=json.loads(file.read_text())
    pdf=file.parent/'final'/f'{identifier}.pdf';docx=file.parent/f'{identifier}.docx'
    assert pdf.is_file() and docx.is_file()
    layouts[identifier]={key:layout[key] for key in ['pages','fields','version']}
    # Consent now maps the existing blank areas; its paper itself is unchanged.
    if identifier=='al-naeem-terms-consent' and not layout['fields']:layouts[identifier]=existing[identifier]
    shutil.copy2(pdf,ROOT/'public/pdfs'/pdf.name)
    shutil.copy2(docx,ROOT/'output/documents'/docx.name)
    # Developer source bundle keeps a matching, editable Word/PDF pair.
    shutil.copy2(pdf,ROOT/'output/documents'/pdf.name)
    report[identifier]={'pages':layout['pages'],'pdf_sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'docx_sha256':hashlib.sha256(docx.read_bytes()).hexdigest()}
(ROOT/'src/forms/modern-layouts.json').write_text(json.dumps(layouts,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'scripts/pdf-design/artifacts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Installed',len(layouts),'review candidates locally; nothing deployed.')
