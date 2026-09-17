"""Compare every signed page with its identical unsigned fill and render slots."""
import base64
import io
import json
import os
from pathlib import Path

import numpy as np
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw

root = Path(os.environ.get('AUDIT_OUT', 'tmp/pdfs/signatures'))
audit = json.loads((root / 'signature-audit.json').read_text())
report = {'site': audit['site'], 'documents': [], 'pages_checked': 0, 'signatures_checked': 0}
previews = {}
for entry in audit['records']:
    name = f"{entry['doc']}-{entry['sample']}"
    signed_path, unsigned_path = root / f'{name}.pdf', root / f'{name}-unsigned.pdf'
    signed, unsigned = PdfReader(signed_path), PdfReader(unsigned_path)
    original = PdfReader(f"reference/pdfs/{entry['doc']}.pdf")
    assert len(signed.pages) == len(unsigned.pages) == len(original.pages), name
    signed_render, unsigned_render = pdfium.PdfDocument(signed_path), pdfium.PdfDocument(unsigned_path)
    for index, (page, before) in enumerate(zip(signed.pages, unsigned.pages)):
        assert page.mediabox == before.mediabox == original.pages[index].mediabox, name
        assert page.extract_text() == before.extract_text(), name
        assert ''.join(page.extract_text().split()) == ''.join(original.pages[index].extract_text().split()), name
        actual_image = signed_render[index].render(scale=2).to_pil().convert('RGB')
        actual = np.asarray(actual_image).astype(np.int16)
        expected = np.asarray(unsigned_render[index].render(scale=2).to_pil().convert('RGB')).astype(np.int16)
        changed = np.max(np.abs(actual - expected), axis=2) > 2
        allowed = np.zeros(changed.shape, dtype=bool)
        slots = [s for s in entry['slots'] if s['page'] == index + 1]
        for slot in slots:
            x, y, w, h = slot['rect']
            left, top, right, bottom = int(x*2)-1, int(y*2)-1, int((x+w)*2)+2, int((y+h)*2)+2
            allowed[top:bottom, left:right] = True
            assert changed[top:bottom, left:right].sum() > 15, (name, slot['id'], 'missing signature')
            # Normalization must retain transparent paper and visible ink.
            png = Image.open(io.BytesIO(base64.b64decode(entry['signatures'][slot['id']].split(',')[1]))).convert('RGBA')
            pixels = np.asarray(png)
            assert pixels[:, :, 3].min() == 0, (name, slot['id'], 'opaque signature background')
            assert not np.any((pixels[:, :, :3].min(axis=2) >= 235) & (pixels[:, :, 3] > 0)), (name, 'white image pixels')
            report['signatures_checked'] += 1
            # Include neighboring borders/labels to make visual placement review useful.
            crop = actual_image.crop((max(0,left-12),max(0,top-22),min(actual_image.width,right+12),min(actual_image.height,bottom+22)))
            previews.setdefault(entry['doc'], {}).setdefault(slot['id'], []).append((entry['sample'],crop))
        assert not changed[~allowed].any(), (name, index+1, 'pixels outside signing areas changed')
        assert not np.any((expected.min(axis=2)<200) & (actual.min(axis=2)>245)), (name, index+1, 'whiteout')
        report['pages_checked'] += 1
    report['documents'].append({'form':entry['doc'],'sample':entry['sample'],'pages':len(signed.pages),'signature_slots':len(entry['slots']),'answers':entry['answers'],'result':'pass'})
    print('PASS',name)

for doc, groups in previews.items():
    tile_w, tile_h = 310, 180
    sheet = Image.new('RGB',(tile_w*5,tile_h*len(groups)), '#ededf2')
    draw = ImageDraw.Draw(sheet)
    for row, (slot_id, examples) in enumerate(groups.items()):
        for col, (sample, image) in enumerate(examples):
            image.thumbnail((tile_w-16,tile_h-40))
            x,y=col*tile_w,row*tile_h
            draw.text((x+8,y+7),f'{slot_id} / {sample}',fill='black')
            sheet.paste(image,(x+(tile_w-image.width)//2,y+32+(tile_h-40-image.height)//2))
    sheet.save(root/f'review-{doc}.png')

report.update({'original_artwork_preserved': True, 'changes_confined_to_selected_signature_areas': True, 'transparent_backgrounds': True})
(root/'verification.json').write_text(json.dumps(report,indent=2))
print(f"PASS: {report['pages_checked']} pages and {report['signatures_checked']} signatures; no changes outside signing areas or whiteouts")
