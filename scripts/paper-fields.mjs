import {openCatalogue,openDocument,catalogueUrl} from './browser-documents.mjs';
// Check that every mapped paper field stays available as answers change.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';

const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await openCatalogue(page,base);
  for (const doc of docs) {
    await openDocument(page,base,doc.id);
    for (const [step, section] of doc.sections.entries()) {
      await page.locator(`[data-step="${step}"]`).click();
      const allVisible = async () => {
        assert.equal(await page.locator('#fields [data-field]:visible').count(), section.fields.length, `${doc.id}/${section.id}`);
      };
      await allVisible();
      for (const field of section.fields.filter(f => f.type === 'choice' || f.type === 'select')) {
        const input = page.locator(`[name="${field.id}"]`);
        if (field.type === 'choice') {
          await input.first().check(); await allVisible();
          await input.last().check(); await allVisible();
          await page.locator(`[data-clear="${field.id}"]`).click();
        } else {
          await input.selectOption(field.selectOptions[0][0]); await allVisible();
          await input.selectOption('');
        }
        await allVisible();
      }
    }
    console.log(`${doc.id}: all ${doc.fields.length} fields stay visible with blank and changed selections`);
    await page.locator('#back-home').click();
  }
  // Existing answers in formerly hidden fields survive changes, refresh and download.
  await openDocument(page,base,'fatca-crs-individual');
  await page.locator('[data-step="1"]').click();
  assert.equal(await page.locator('[name="tin_type"]').count(), 0);
  for (const id of ['ssn', 'itin', 'atin']) await page.locator(`[name="${id}"]`).fill('012345678');
  await page.locator('[name="us_person"][value="no"]').check();
  await page.locator('[name="outside_tax"][value="no"]').check();
  await page.locator('[data-step="2"]').click();
  await page.locator('[name="tax_country_0"]').fill('France');
  await page.locator('[name="tax_explanation_0"]').fill('Paper answer');
  await page.locator('[name="tax_reason_0"]').selectOption('A');
  await page.reload();
  await page.locator('[name="tax_explanation_0"]').waitFor();
  assert.equal(await page.locator('[name="tax_explanation_0"]').inputValue(), 'Paper answer');
  const downloading = page.waitForEvent('download');
  await page.locator('#download-now').click();
  await (await downloading).saveAs('tmp/pdfs/paper-fields-download.pdf');
  await page.locator('[data-step="1"]').click();
  for (const id of ['ssn', 'itin', 'atin']) assert.equal(await page.locator(`[name="${id}"]`).inputValue(), '012345678');
  assert.deepEqual(errors, []);
  console.log('Formerly hidden answers survive selection changes, reload and partial download.');
} finally {
  await browser.close();
}
