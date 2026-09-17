# Forms project

Visitors will choose a document, fill its details in the browser, and download the original PDF with their answers, with optional signature images or ready for handwritten signing.

- [Implementation plan](docs/PROJECT_PLAN.md)
- [Inspected document inventory](docs/form-inventory.json): 10 uploads, 8 PDFs, 40 pages
- Original templates: `reference/pdfs/` (byte-for-byte copies)

**Live:** https://forms.ahmaddalao.com/

**Shareable folders:** [Individuals](https://forms.ahmaddalao.com/individuals/) · [Companies](https://forms.ahmaddalao.com/companies/). Each folder shows six numbered cards in one list: subscription, KYC, signature, terms consent, FATCA/CRS, and terms. Shared templates carry a small badge. The subscription PDF is fillable; the photographed consent page is available as a direct PDF download. Each folder keeps separate shared details, drafts and signatures, including the signature and terms documents that appear in both folders. The root page shows only a neutral message directing visitors to their provided link; it does not list forms, folder links, downloads or reopen a saved form.

The document preview is hidden while editing unless requested. Related fields use up to three columns on desktop and one on mobile, with paper groupings and paired portfolio columns. All interface titles, field labels, questions, notes and instructions follow the selected language. Selectable options retain the original printed wording, including both languages where provided. The English-only entity tax form uses translated Arabic interface labels while its selectable options and PDF remain in their original English. Entered answers and PDF checkmarks use blue ink. `src/forms/paper-copy.js` holds the reviewed wording and presentation groups; answer IDs and PDF coordinates remain stable.

Built and deployed on 2026-09-16. All seven fillable forms support bilingual entry, all printed customer fields available without conditional hiding, an exact PDF preview, and a filled download. An optional signature panel accepts PNG/JPG images, removes white backgrounds, and fits each image into the explicitly selected customer signing box without stretching. Users can preview, replace or remove it, or leave the form unsigned. Individual FATCA/CRS also includes the optional page-3 relationship-manager/customer-service section: account-holder name, employee ID, 15-cell customer file number and its own representative signature slot. A prepared PDF leaves a visible Save PDF link and inline Preview PDF button; the save link remains valid until its answers change. Errors appear beside the download controls with a retry action. Blank originals are downloadable directly from the catalogue, and the current filled/partial PDF can be downloaded from every section. Answers and signature images autosave in this browser and survive closing or refreshing. Reopening resumes the last active form and section. Clear form removes one saved draft; Clear all saved forms removes this folder’s shared details, drafts and signatures; the other folder stays intact. No login, database or form submission is used.

## Shared document fields

Open **Shared document fields** in either the catalogue or a form. Enter names, contact information and an address once; matching fields in that audience’s documents fill automatically. Individuals and Companies have separate profiles and saved versions of every document. Profiles stay in this browser.

Changes to shared details update answers previously copied from them. Existing different answers and edits made inside a form are preserved. Use **Use shared value** beside an overridden field to reconnect it. **Clear form** leaves that form blank until you explicitly choose **Fill empty fields in this form**. **Clear shared fields** removes the profile and its copied answers, keeping manual edits. Extra client rows, controlling persons, witnesses, bank/custodian accounts and uploaded signatures are never assumed to be the same person or information. Copying an address to residence/office spaces requires the matching checkbox; signing fields copy the individual only when the printed role is Account holder / Client.

Earlier audience-specific drafts migrate to their matching folder. Older signature/terms drafts have no audience information, so their card offers **Restore previous draft to this folder**; restoration moves that saved draft to the chosen folder only.

`src/shared-fields.js` defines explicit semantic mappings. `tests/shared-fields.test.mjs` verifies mapping and storage behavior, and `scripts/shared-fields-audit.mjs` checks actual browser workflows, persistent recovery, audience separation and PDF downloads.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The app uses plain JavaScript, Vite, pdf-lib, PDF.js, and locally bundled Inter / Noto Sans Arabic fonts. Template schemas are in `src/forms/`; PDF placements use top-left coordinates in points. Original pages remain vector content; added answers use transparent 300 DPI text images so Arabic shaping is preserved. Filled answers are intended for printing and may not be searchable.

## Verification and deployment

- `node scripts/qa.mjs` generates synthetic filled examples using the running development server.
- `node scripts/staff-section.mjs` tests five English/Arabic/mixed page-3 staff fills in three browser engines; `scripts/verify-staff-section.py` verifies each text cell, signature confinement and unchanged original artwork.
- `node scripts/folder-ui.mjs` checks both physical folder URLs in Chrome, Firefox and WebKit: audience isolation, all labels/options/fields, mobile Arabic layout, blue data, preview controls, real PDF downloads, reload recovery and clear form.
- `node scripts/alignment-audit.mjs` fills and downloads each form five times through the browser with English, Arabic, long and mixed answers. Set `SITE_URL` to run against the live site.
- `scripts/verify-alignment.py` checks all 30 audit PDFs for missing ink, clipping, opaque backgrounds, original-page preservation and placement outside mapped spaces, and renders comparison sheets for visual review. Results are recorded in [the alignment audit](docs/alignment-audit.json).
- For cross-browser text regressions, run the alignment audit with `BROWSER=chrome`, `firefox` and `webkit`, setting `QA_OUT` to separate folders. `scripts/verify-browser-ink.py` compares actual answer ink between the three outputs to catch missing mixed-language runs or clipped Arabic marks. The latest complete recheck is recorded in [full-recheck-verification.json](docs/full-recheck-verification.json).
- `node scripts/input-direction-audit.mjs` types real keystrokes into shared and ordinary email/phone/ID/name inputs in both interface languages, checks input identity, cursor edits, review invalidation, draft recovery and downloads across Chrome, Firefox and WebKit. Set `BROWSERS`, `LANGS`, `DOCS`, `SITE_URL` or `QA_OUT` to narrow a run. This catches email caret regressions that `.fill()` alone cannot detect.
- `node scripts/download-regression.mjs` verifies all six forms in Chrome, Firefox and WebKit with automatic downloads deliberately blocked: direct Save PDF, repeat saves, inline preview, unchanged blank originals, edited answers and visible errors.
- `node scripts/signature-audit.mjs` fills each form five times with synthetic transparent PNG/white JPEG signatures, downloads signed/unsigned comparisons, and tests upload, replacement, removal, local recovery, selected-slot isolation and mobile Arabic. Run the alignment audit first to create its answer fixtures. `scripts/verify-signatures.py` compares every PDF page and confirms that changes stay inside selected signing boxes, with no whiteouts.
- `node scripts/browser-smoke.mjs` tests Chrome, Firefox, and WebKit, including shutdown/relaunch with a persistent test profile. Set `SITE_URL` to test production; `CHROME_EXECUTABLE` can point to a Playwright Chrome-for-Testing binary.
- `scripts/verify-pdfs.py` checks page geometry, original text, untouched pages and selected signature/staff areas against the original PDFs. It uses pypdf, pypdfium2 and Pillow, and the schema export in `tmp/pdfs/schema.json`.
- `python3 scripts/deploy.py` uploads only `dist/` using verified explicit FTPS. Build first. The entry point is published last. Existing unrelated server files are left intact.
- [Deployment manifest](docs/deployment-manifest.json) records uploaded file hashes. [Verification report](docs/VERIFICATION.md) records the checks performed.

Browser downloads and isolated test profiles are temporary synthetic test artifacts under ignored `tmp/`. Credentials are never deployed.

## Saved hosting details

Captured from the user's three screenshots on 2026-09-16 for a future project. These screenshots are reference data; their buttons and setup instructions are not requests to create accounts, change passwords, or deploy anything.

## Hosting and file access

| Detail | Saved value |
| --- | --- |
| Domain | `ahmaddalao.com` |
| Hosting account | `u867436826` |
| FTP hostname | `ftp.ahmaddalao.com` |
| Full FTP username | `u867436826.forms` |
| Username entered during creation | `forms` |
| Directory entered during creation | `/public_html/forms` |
| Full server directory | `/home/u867436826/domains/ahmaddalao.com/public_html/forms` |
| FTP password | Saved locally in `.env.local` as `FTP_PASSWORD` |

Verified deployment connection: explicit FTPS on port 21, with encrypted data transfer and certificate verification against Hostinger’s `cpl90.hosting24.com` server name. The account opens at `/`, scoped directly to the intended forms directory.

## MySQL

| Detail | Saved value |
| --- | --- |
| Database name | `u867436826_forms` |
| Database username | `u867436826_forms` |
| Database password | Saved locally in `.env.local` as `DB_PASSWORD` |
| Database host and port | Not shown; left blank in `.env.local` |

The database name and username combine the displayed `u867436826_` prefix with `forms`. The screenshot shows the creation form, so successful database creation is not confirmed.

## Local configuration

`.env.local` stores the transcribed connection values and passwords. It is excluded by `.gitignore` and has owner-only read/write permissions (`0600`). Keep it out of uploaded public files and browser-side code. Empty settings mean unknown, not defaults.

## Hosting status

HTTPS, static assets, PDF worker MIME type and all six original templates have been verified at `/forms/`. Database hostname and port remain unknown and are not needed for this workflow.

## Source screenshots

- MySQL creation form: `/Users/ahmaddalao/Desktop/Screenshot 2026-09-16 at 6.24.12 PM.png`
- FTP creation form: `/Users/ahmaddalao/Desktop/Screenshot 2026-09-16 at 6.27.58 PM.png`
- FTP account listing: `/Users/ahmaddalao/Desktop/Screenshot 2026-09-16 at 6.28.31 PM.png`

## Primary address

The primary address is https://forms.ahmaddalao.com/. Hostinger maps this subdomain to the same directory used by the scoped FTP account. The build writes `individuals/index.html` and `companies/index.html`, sharing the original assets and PDFs. Asset/template URLs also support the older `/forms/` address so existing browser drafts are not stranded; browser drafts are specific to their origin and do not automatically move to the subdomain.

## Numbered fund documents

`src/catalogue.js` defines the requested localized card/editor titles and the 1–6 order. Existing answer IDs and saved drafts are retained. The consent image is embedded unchanged in `output/pdf/al-naeem-terms-consent.pdf` and copied to the public templates. Its card downloads directly. Card 6 currently uses the existing 13-page Itqan general account terms, identified in its description, pending a fund-specific replacement.

`src/forms/subscription.js` maps all 35 printed subscription fields, including both individual and company ID sections and the optional staff section. The fund name repeats in the two introductory blanks; dates, client/account cells and the four independent signing boxes retain the original layout. Subscription quantities and amounts are entered manually. Matching profile details copy only within their own audience, and manual overrides remain local to each form.

`node scripts/catalogue-audit.mjs` checks numbering, wording, shared badges, download-only consent, aligned card footers, 36 language/audience/browser/width layouts, shared subscription data, separate signatures and reload recovery. Use `ONLY_DOCS=subscription-form` with `scripts/alignment-audit.mjs` to run five complete fills of the new form.
