import checkboxBounds from './forms/checkbox-bounds.json' with { type: 'json' };
// Coordinates use PDF points, measured from the top-left of each original page.
export const docs = [];
export function document(id, title, ar, group, description, arDescription, pages, signing) {
  const doc = { id, title, ar, group, description, arDescription, pages, signing, sections: [], fields: [] };
  docs.push(doc);
  return doc;
}
export function section(doc, id, title, ar, page, note='', arNote='') {
  const s = { id, title, ar, page, note, arNote, fields: [] };
  doc.sections.push(s);
  return s;
}
export function text(doc, s, id, label, ar, rect, config={}) {
  const f = { id, label, ar, type: 'text', page: s.page, rect, fontSize: 10, ...config };
  doc.fields.push(f); s.fields.push(f); return f;
}
export function choice(doc, s, id, label, ar, options, config={}) {
  for(const option of options){
    const measured=checkboxBounds[doc.id]?.[id]?.[option.value];
    if(measured)option.rect=measured;
  }
  return text(doc, s, id, label, ar, null, { type: 'choice', options, ...config });
}
export function option(value, label, ar, rect, extraRects=[]) { return { value, label, ar, rect, extraRects }; }
export function hasValue(value) { return Array.isArray(value) ? value.length > 0 : value != null && String(value).trim() !== ''; }
