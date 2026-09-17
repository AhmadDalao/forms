// Normalize only for calculations; keep the visitor's original text in the PDF.
export function parseNumber(value) {
  const normalized = String(value ?? '').trim()
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0))
    .replace(/[\u061c\u200e\u200f]/g, '')
    .replace(/[٬,\s]/g, '').replace(/٫/g, '.').replace(/[%٪]$/, '');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
