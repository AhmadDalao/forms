#!/usr/bin/env python3
"""Replace only the legacy address in the two restored original PDF designs.

Requires PyMuPDF. Inputs in reference/pdfs remain immutable. Address wording is
shared with the modern templates in pdf-design/national-address.json.
"""
import json
from pathlib import Path

import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
ADDRESS = json.loads((ROOT / 'scripts/pdf-design/national-address.json').read_text())
FORMS = ('signature-form', 'terms-and-conditions')
FONT_SIZE = 6


def wrap_address(text, width):
    lines = ['']
    parts = text.split(' | ')
    for index, part in enumerate(parts):
        part += ' |' if index < len(parts) - 1 else ''
        if fitz.get_text_length(part, fontname='helv', fontsize=FONT_SIZE) > width:
            raise ValueError('Address segment is too wide for the original footer')
        candidate = f'{lines[-1]} {part}'.strip()
        if fitz.get_text_length(candidate, fontname='helv', fontsize=FONT_SIZE) > width:
            lines.append(part)
        else:
            lines[-1] = candidate
    if len(lines) > 3:
        raise ValueError('Address does not fit the original three-line footer area')
    return lines


def update_form(name):
    doc = fitz.open(ROOT / f'reference/pdfs/{name}.pdf')
    for page in doc:
        old = page.search_for('7855')
        if len(old) != 1 or old[0].y0 < page.rect.height - 50:
            raise ValueError(f'Unrecognized original footer: {name}, page {page.number + 1}')
        # Only the address column; the contact details, Arabic legal notice,
        # diamond separator, page number and every body pixel stay in place.
        x = 150 if name == 'signature-form' else 158.25
        top = old[0].y0 - 0.3
        area = fitz.Rect(x, top, x + 200, top + 28)
        page.add_redact_annot(area, fill=False)
        # The overlapping images are the obsolete map pin and an entirely
        # transparent footer filler. Remove them whole: pixel-redacting the
        # transparent filler needlessly creates a CCITT mask that PDF.js cannot
        # decode without a separately configured WASM asset directory.
        page.apply_redactions(images=1, graphics=1, text=0)
        for row, line in enumerate(wrap_address(ADDRESS['text'], area.width - 4)):
            width = fitz.get_text_length(line, fontname='helv', fontsize=FONT_SIZE)
            page.insert_text((area.x0 + (area.width - width) / 2, top + 7 + row * 8.5),
                             line, fontname='helv', fontsize=FONT_SIZE, color=(0, 0, 0))
    # A complete rewrite drops obsolete objects and redacted text/image bytes.
    payload = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    for folder in ('public/pdfs', 'output/documents'):
        (ROOT / folder / f'{name}.pdf').write_bytes(payload)
    return {'name': name, 'version': ADDRESS['version'], 'pages': len(fitz.open(stream=payload))}


if __name__ == '__main__':
    print(json.dumps([update_form(name) for name in FORMS], indent=2))
