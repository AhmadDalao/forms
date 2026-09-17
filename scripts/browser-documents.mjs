import {docs} from '../src/forms/index.js';

export function catalogueUrl(base, id = 'signature-form') {
  const doc = docs.find(d => d.id === id);
  if (!doc) throw Error(`Unknown document: ${id}`);
  const root = new URL(base);
  root.pathname = root.pathname.replace(/\/(individuals|companies)\/?$/, '/');
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  return new URL(doc.group === 'corporate' ? 'companies/' : 'individuals/', root).href;
}

export async function openCatalogue(page, base, id = 'signature-form') {
  await page.goto(catalogueUrl(base, id));
  await page.locator('.home,.workspace').waitFor();
  if (await page.locator('#back-home').count()) await page.locator('#back-home').click();
  await page.locator(`[data-doc="${id}"]`).waitFor();
}

export async function openDocument(page, base, id) {
  await openCatalogue(page, base, id);
  await page.locator(`[data-doc="${id}"]`).click();
}
