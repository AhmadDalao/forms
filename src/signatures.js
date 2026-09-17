// Signing areas measured on the unchanged source PDFs, in points from top-left.
// Each person/row is independent, including the explicitly available staff section.
// Stamp and fingerprint areas are not selectable.
const slot = (id, label, ar, page, rect) => ({ id, label, ar, page, rect });
const slots = {
  'subscription-form': [slot('applicant','Applicant signature','توقيع مقدم الطلب',1,[117,574,104,10]),...['manager','entered','approved'].map((id,i)=>slot('staff_'+id,['A/C manager signature','Entered by signature','Reviewer / approver signature'][i],['توقيع مدير الحساب','توقيع مدخل الطلب','توقيع المراجع والمعتمد'][i],1,[101,647.2+i*14.4,116,10]))],
  'signature-form': [slot('specimen', 'Specimen signature', 'نموذج التوقيع', 1, [55, 267, 232, 249])],
  'terms-and-conditions': [11, 13].flatMap(page => [0, 1, 2].map(i => slot(
    `${page === 11 ? 'terms' : 'authorization'}_${i}`,
    `${page === 11 ? 'Account terms' : 'Telephone / fax authorization'} — signer ${i + 1}`,
    `${page === 11 ? 'شروط الحساب' : 'تفويض الهاتف والفاكس'} — الموقع ${i + 1}`,
    page, [84, (page === 11 ? 135 : 327.6) + i * 36.5, 206, 28],
  ))),
  'fatca-crs-individual': [
    slot('signatory', 'Signatory signature', 'توقيع الموقع', 2, [47, 633, 276, 57]),
    slot('relationship_manager', 'Relationship Manager / Customer Service Representative signature', 'توقيع مدير العلاقة / ممثل خدمة العملاء', 3, [266, 128, 205, 24]),
  ],
  'fatca-crs-corporate': [0, 1].map(i => slot(`signatory_${i}`, `Signatory ${i + 1} (${i ? 'right' : 'left'} box)`, `الموقع ${i + 1} (${i ? 'الخانة اليمنى' : 'الخانة اليسرى'})`, 6, [131 + i * 244.2, 277, 187, 34])),
  'kyc-individual': [
    slot('representative', 'Special cases — representative signature', 'الحالات الخاصة — توقيع الوكيل أو الممثل', 3, [117, 566, 124, 23]),
    slot('client', 'Client signature', 'توقيع العميل', 7, [58, 624, 241, 25]),
  ],
  'kyc-corporate': [slot('client', 'Client signature', 'توقيع العميل', 7, [58, 624, 241, 25])],
};
export const signatureSlots = doc => slots[doc.id] || [];

// Saved images are normalized PNGs only, never external URLs or executable SVGs.
export function cleanSignatures(doc, saved) {
  const result = {};
  for (const { id } of signatureSlots(doc)) {
    const data = saved?.[id];
    if (typeof data === 'string' && data.length <= 500000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(data)) result[id] = data;
  }
  return result;
}

export function signaturePlacement(slot, width, height) {
  const [x, y, w, h] = slot.rect;
  const scale = Math.min(Math.min(w, 180) / width, Math.min(h, 70) / height);
  return { x: x + (w - width * scale) / 2, y: y + (h - height * scale) / 2, width: width * scale, height: height * scale };
}

export async function prepareSignature(file) {
  if (file.size > 5 * 1024 * 1024) throw Error('size');
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => header[i] === n);
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (!png && !jpeg) throw Error('type');
  const url = URL.createObjectURL(file), image = new Image();
  try {
    image.src = url;
    try { await image.decode(); } catch { throw Error('decode'); }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 24000000) throw Error('size');
    const scale = Math.min(1, 1600 / image.naturalWidth, 800 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), { data } = pixels;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1, ink = 0, darkEdges = 0, edges = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4, minimum = Math.min(data[i], data[i + 1], data[i + 2]);
      if (minimum >= 235 || data[i + 3] < 12) data[i + 3] = 0;
      else if (data[i + 3] === 255) {
        // Recover ink from a white matte, including anti-aliased pen edges.
        const alpha = 1 - minimum / 255;
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(255 - (255 - data[i + c]) / alpha);
        data[i + 3] = Math.round(alpha * 255);
      }
      const isEdge = x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1;
      if (isEdge) { edges++; if (data[i + 3] > 40) darkEdges++; }
      if (data[i + 3]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); ink++; }
    }
    if (ink < 12) throw Error('blank');
    if (darkEdges / edges > .25 || ink / (canvas.width * canvas.height) > .5) throw Error('background');
    ctx.putImageData(pixels, 0, 0);
    // Trim empty margins only; all visible strokes retain their aspect ratio.
    const cropped = document.createElement('canvas');
    cropped.width = right - left + 5; cropped.height = bottom - top + 5;
    cropped.getContext('2d').drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 2, 2, right - left + 1, bottom - top + 1);
    const result = cropped.toDataURL('image/png');
    if (result.length > 500000) throw Error('size');
    return result;
  } finally { URL.revokeObjectURL(url); }
}
