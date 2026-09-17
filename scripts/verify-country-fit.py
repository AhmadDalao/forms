"""Verify downloaded country fixtures retain the paper and add transparent ink only."""
import json, os, re
from pathlib import Path
import numpy as np
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageChops

root = Path(__file__).resolve().parents[1]
out = root / os.environ.get('QA_OUT', 'tmp/pdfs/country-fit')
report = json.loads((out / 'report.json').read_text())
schema = {d['id']: d for d in json.loads((out / 'schema.json').read_text())}
counts = dict(downloads=0, pages=0, populated_fields=0, transparent_images=0)
cache = {}
for record in report['results']:
    name = record['doc']
    if name not in cache:
        path = root / 'reference/pdfs' / (name + '.pdf')
        original = pdfium.PdfDocument(path)
        source = PdfReader(path)
        cache[name] = (source, [p.render(scale=2).to_pil().convert('RGB') for p in original], [''.join(p.extract_text().split()) for p in source.pages])
    source, renders, source_text = cache[name]
    path = out / record['file']
    values = json.loads(path.with_suffix('.json').read_text())
    reader, filled = PdfReader(path), pdfium.PdfDocument(path)
    assert len(reader.pages) == len(source.pages)
    for i, (before_page, after_page) in enumerate(zip(source.pages, reader.pages)):
        assert list(before_page.mediabox) == list(after_page.mediabox)
        assert source_text[i] == ''.join(after_page.extract_text().split()), (name, i, 'source text changed')
        before, after = renders[i], filled[i].render(scale=2).to_pil().convert('RGB')
        allowed = Image.new('L', before.size)
        draw = ImageDraw.Draw(allowed)
        for f in schema[name]['fields']:
            if f['page'] != i + 1 or f['id'] not in values: continue
            rtl = bool(re.search(r'[\u0600-\u06ff]', values[f['id']]))
            primary = f.get('rtlRect', f['rect']) if rtl else f['rect']
            for x, y, w, h in [primary] + f.get('mirrorRects', []):
                box = tuple(round(v * 2) for v in (x, y, x+w, y+h))
                assert ImageChops.difference(before.crop(box), after.crop(box)).getbbox(), (name, f['id'], 'missing ink')
                draw.rectangle((int(x*2)-1, int(y*2)-1, int((x+w)*2)+1, int((y+h)*2)+1), fill=255)
            counts['populated_fields'] += 1
        diff = ImageChops.difference(before, after).convert('L')
        assert ImageChops.multiply(diff, ImageChops.invert(allowed)).getbbox() is None, (name, i, 'ink outside answer area')
        a, b = np.asarray(before, dtype=np.int16), np.asarray(after, dtype=np.int16)
        assert not np.any((b.min(axis=2)>220) & ((b-a).max(axis=2)>50)), (name, i, 'whiteout')
        old = before_page['/Resources'].get('/XObject', {})
        new = after_page['/Resources'].get('/XObject', {})
        if hasattr(old, 'get_object'): old = old.get_object()
        if hasattr(new, 'get_object'): new = new.get_object()
        for key in set(new)-set(old):
            image = new[key].get_object()
            if image.get('/Subtype') != '/Image': continue
            assert '/SMask' in image, 'Answer image must be transparent'
            alpha = np.frombuffer(image['/SMask'].get_data(), dtype=np.uint8).reshape(int(image['/Height']), int(image['/Width']))
            rgb = np.frombuffer(image.get_data(), dtype=np.uint8).reshape(-1, 3)
            assert (alpha == 0).any() and np.all(rgb[alpha.ravel()>0].min(axis=1)<100)
            assert not any(edge.any() for edge in [alpha[0], alpha[-1], alpha[:,0], alpha[:,-1]]), (record['file'], i+1, key, 'Ink touches image edge')
            assert np.all(np.abs(rgb[alpha.ravel()==255].astype(int)-[20,86,160])<=2), 'Answer ink is not blue'
            counts['transparent_images'] += 1
        counts['pages'] += 1
    counts['downloads'] += 1
report['verification'] = counts
(out / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print('PASS', counts, 'source artwork preserved; no whiteouts, missing ink or clipped edges')
