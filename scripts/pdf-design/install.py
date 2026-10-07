"""Copy reviewed output into source assets; deployment remains a separate step."""
from pathlib import Path
import json, shutil, hashlib
ROOT=Path(__file__).resolve().parents[2]
(ROOT/'output/documents').mkdir(parents=True,exist_ok=True)
sources=json.loads((ROOT/'scripts/pdf-design/template-sources.json').read_text())
allowed=set(sources['modern_documents'])
existing=json.loads((ROOT/'src/forms/modern-layouts.json').read_text())
# Preserve other reviewed mappings, but never reactivate retired original-PDF layouts.
layouts={key:value for key,value in existing.items() if key not in sources['original_pdf_documents']}
artifact_file=ROOT/'scripts/pdf-design/artifacts.json'
report={key:value for key,value in json.loads(artifact_file.read_text()).items() if key in allowed}
installed=0
for file in sorted((ROOT/'tmp/modern-pdfs').glob('*/layout.json')):
    # A whitelist rejects stale signature/T&C and unknown candidates.
    if file.parent.name not in allowed:continue
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
    installed+=1
(ROOT/'src/forms/modern-layouts.json').write_text(json.dumps(layouts,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'scripts/pdf-design/artifacts.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Installed',installed,'review candidates locally; original PDF templates untouched; nothing deployed.')
