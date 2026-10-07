#!/usr/bin/env python3
"""Replace only the legacy address in restored original PDF designs.

Requires PyMuPDF. Inputs in reference/pdfs remain immutable. Address wording is
shared with the modern templates in pdf-design/national-address.json.
"""
import argparse
import json
from pathlib import Path

import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
ADDRESS = json.loads((ROOT / 'scripts/pdf-design/national-address.json').read_text())
FORMS = ('signature-form', 'terms-and-conditions')
KYC_FORMS = ('kyc-individual', 'kyc-corporate')
FONT_SIZE = 6


def wrap_address(text, width, font_size=FONT_SIZE):
    lines = ['']
    parts = text.split(' | ')
    for index, part in enumerate(parts):
        part += ' |' if index < len(parts) - 1 else ''
        if fitz.get_text_length(part, fontname='helv', fontsize=font_size) > width:
            raise ValueError('Address segment is too wide for the original footer')
        candidate = f'{lines[-1]} {part}'.strip()
        if fitz.get_text_length(candidate, fontname='helv', fontsize=font_size) > width:
            lines.append(part)
        else:
            lines[-1] = candidate
    if len(lines) > 3:
        raise ValueError('Address does not fit the original three-line footer area')
    return lines


def replace_kyc_footer(page, old):
    """Keep each supplied page's footer artwork, replacing its address only."""
    overlays = [i for i in page.get_image_info(xrefs=True)
                if i['width'] == 846 and i['height'] == 89]
    if len(overlays) > 1:
        raise ValueError('Unrecognized KYC footer image count')
    # Remove the obsolete vector address, including text hidden by the supplied
    # raster footer. Keep every other image/vector object on raster-footer pages.
    redaction = fitz.Rect(150, old.y0 - 0.3, 350, 792)
    if overlays:
        info = overlays[0]
        bounds = fitz.Rect(info['bbox'])
        if bounds.y0 < 750:
            raise ValueError('Unrecognized KYC footer image position')
        doc = page.parent
        pix = fitz.Pixmap(doc, info['xref'])
        if pix.n != 3 or pix.alpha or doc.xref_get_key(info['xref'], 'ColorSpace')[1] != '/DeviceRGB':
            raise ValueError('Unrecognized KYC footer image color space')
        # This opaque RGB image contains contact/address/legal columns. Clear
        # only the address pixels; keep the original dimensions, interpolation,
        # separator, contact column and legal column byte-for-byte decoded.
        samples = bytearray(pix.samples)
        for y in range(40, 89):
            start = (y * 846 + 210) * 3
            samples[start:start + 230 * 3] = b'\xff' * (230 * 3)
        doc.update_stream(info['xref'], bytes(samples), compress=True)
        area = fitz.Rect(bounds.x0 + bounds.width * 150 / 846,
                         bounds.y0 + bounds.height * 34 / 89,
                         bounds.x0 + bounds.width * 467 / 846, 792)
        page.add_redact_annot(redaction, fill=False)
        page.apply_redactions(images=0, graphics=0, text=0)
    else:
        # One supplied individual page has the original vector-only footer.
        area = fitz.Rect(150, old.y0 - 0.3, 350, 792)
        page.add_redact_annot(redaction, fill=False)
        page.apply_redactions(images=1, graphics=1, text=0)
    font_size = 5.5
    for row, line in enumerate(wrap_address(ADDRESS['text'], area.width - 4, font_size)):
        width = fitz.get_text_length(line, fontname='helv', fontsize=font_size)
        page.insert_text((area.x0 + (area.width - width) / 2,
                          area.y0 + 5.92 + row * 6.2),
                         line, fontname='helv', fontsize=font_size, color=(0, 0, 0))
    return {'page': page.number + 1, 'text_redaction': list(redaction),
            'new_address_area': list(area), 'raster_address_replaced': bool(overlays)}


def update_form(name):
    is_kyc = name in KYC_FORMS
    source = ROOT / ('reference/pdfs/supplied-20261007' if is_kyc else 'reference/pdfs') / f'{name}.pdf'
    doc = fitz.open(source)
    edits = []
    for page in doc:
        old = page.search_for('7855')
        if len(old) != 1 or old[0].y0 < page.rect.height - 50:
            raise ValueError(f'Unrecognized original footer: {name}, page {page.number + 1}')
        if is_kyc:
            edits.append(replace_kyc_footer(page, old[0]))
            continue
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
    folders = ['public/pdfs', 'output/documents']
    if is_kyc and (ROOT / 'output/pdf' / f'{name}.pdf').exists():
        folders.append('output/pdf')
    for folder in folders:
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
        (ROOT / folder / f'{name}.pdf').write_bytes(payload)
    return {'name': name, 'version': '20261007-original-kyc' if is_kyc else ADDRESS['version'],
            'pages': len(fitz.open(stream=payload)), 'source': str(source), 'edits': edits}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('forms', nargs='*', metavar='FORM',
                        help='Forms to rebuild (default: all four original-style forms).')
    args = parser.parse_args()
    unknown = set(args.forms) - set(FORMS + KYC_FORMS)
    if unknown:
        parser.error('unknown forms: ' + ', '.join(sorted(unknown)))
    print(json.dumps([update_form(name) for name in (args.forms or FORMS + KYC_FORMS)], indent=2))
