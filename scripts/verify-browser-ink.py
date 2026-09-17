"""Catch lost bidi runs and clipped glyphs in the three-browser PDF audit."""
import json
import os
from pathlib import Path

import numpy as np
from pypdf import PdfReader

root = Path(os.environ.get('QA_ROOT', 'tmp/pdfs/recheck'))
baseline = os.environ.get('BASELINE', 'final-alignment')
records = json.loads((root / baseline / 'downloads.json').read_text())
issues, edges = [], []
checked = 0

def objects(page):
    value = page['/Resources'].get('/XObject', {})
    return value.get_object() if hasattr(value, 'get_object') else value

def alpha(image):
    return np.frombuffer(image['/SMask'].get_data(), dtype=np.uint8).reshape(
        int(image['/Height']), int(image['/Width']))

for record in records:
    source = PdfReader('reference/pdfs/' + record['doc'] + '.pdf')
    reference = PdfReader(root / baseline / record['file'])
    for engine, folder in [('chrome', baseline), ('firefox', baseline+'-firefox'), ('webkit', baseline+'-webkit')]:
        pdf = PdfReader(root / folder / record['file'])
        for n, page in enumerate(pdf.pages):
            old, actual, expected = objects(source.pages[n]), objects(page), objects(reference.pages[n])
            for key in set(actual) - set(old):
                image = actual[key].get_object()
                if '/SMask' not in image:
                    continue
                a, b = alpha(image), alpha(expected[key].get_object())
                checked += 1
                x, reference_x = np.where(a > 40)[1], np.where(b > 40)[1]
                ratio = (x.max()-x.min()+1) / (reference_x.max()-reference_x.min()+1)
                # Normal font rasterization differs slightly across engines;
                # a missing Arabic/Latin run removed roughly half the ink.
                if ratio < .8:
                    issues.append([engine, record['file'], n+1, str(key), round(ratio, 3)])
                if any((edge > 2).any() for edge in [a[0], a[-1], a[:, 0], a[:, -1]]):
                    edges.append([engine, record['file'], n+1, str(key)])

result = {'answer_images_checked': checked, 'width_discrepancies': issues, 'edge_contacts': edges}
(root / 'cross-browser-ink-final.json').write_text(json.dumps(result, indent=2)+'\n')
assert not issues, f'Possible missing text runs: {issues}'
assert not edges, f'Answer ink touches canvas edges: {edges}'
print('PASS', checked, 'answer images: complete cross-browser ink widths and clear edges')
