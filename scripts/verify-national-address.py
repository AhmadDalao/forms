"""Check the owner-approved footer on every current PDF page and Word source."""
from pathlib import Path
import hashlib, json, re, sys
from docx import Document
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
ADDRESS = json.loads((ROOT / 'scripts/pdf-design/national-address.json').read_text())
normalize = lambda value: re.sub(r'[^a-z0-9]', '', value.lower())
documents = ['subscription-individual', 'subscription-company', 'kyc-individual',
             'kyc-corporate', 'signature-form', 'al-naeem-terms-consent',
             'fatca-crs-individual', 'fatca-crs-corporate', 'terms-and-conditions',
             'subscription-form']
report = {'version': ADDRESS['version'], 'address': ADDRESS['text'], 'documents': {}, 'failures': []}
for name in documents:
    path = ROOT / 'public/pdfs' / (name + '.pdf')
    pdf = PdfReader(path)
    with pdfplumber.open(path) as geometry:
        for number, page in enumerate(pdf.pages, 1):
            if normalize(ADDRESS['text']) not in normalize(page.extract_text() or ''):
                report['failures'].append([name, number, 'missing full national address'])
            paper = geometry.pages[number - 1]
            footer = paper.crop((0, paper.height * .9, paper.width, paper.height))
            # The supplied one-page subscription footer has tightly spaced lines.
            text = footer.extract_text(y_tolerance=1) or ''
            if not all(word in text for word in ['Prince', 'Naif', 'Branch', '7940', '2505']):
                report['failures'].append([name, number, 'address not in bottom footer'])
            if '7855' in text or '2563' in text:
                report['failures'].append([name, number, 'old national address remains'])
            if any(c['x0'] < 0 or c['x1'] > paper.width + .5 or c['bottom'] > paper.height + .5
                   for c in footer.chars if c['text'].strip()):
                report['failures'].append([name, number, 'footer outside page'])
    word = ROOT / 'output/documents' / (name + '.docx')
    if word.exists():
        for section in Document(word).sections:
            if normalize(ADDRESS['text']) not in normalize(' '.join(p.text for p in section.footer.paragraphs)):
                report['failures'].append([name, 'Word footer missing address'])
    for folder in ['output/documents', 'output/pdf']:
        copy = ROOT / folder / path.name
        if copy.exists() and copy.read_bytes() != path.read_bytes():
            report['failures'].append([name, folder, 'PDF copy differs'])
    report['documents'][name] = {'pages': len(pdf.pages), 'word_source': word.exists(),
                                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
report['pages'] = sum(item['pages'] for item in report['documents'].values())
report['passed'] = not report['failures']
if len(sys.argv) > 1:
    target = Path(sys.argv[1]); target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['passed'] else 1)
