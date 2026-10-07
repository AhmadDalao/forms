# How to test this delivery

Run these commands from `source/`. Use disposable local data. The browser audits start their own PHP server, choose an available localhost port and create synthetic accounts under `tmp/`. They do not need the real admin password. Do not adapt them to write into production.

## Install test tools once

```sh
npm ci
npx playwright install
```

Several scripts use the Chrome channel, so Google Chrome must also be installed (or install it using `npx playwright install chrome` on a supported development machine). PHP CLI needs the same extensions as production. Python PDF inspection uses `pypdfium2`, `pypdf`, `pdfplumber`, `python-docx`, `Pillow` and `numpy`. Editing source documents also uses `reportlab`, `PyMuPDF`, `lxml` and LibreOffice. These are development tools, not hosting requirements.

## Editing document templates

The address source is `scripts/pdf-design/national-address.json`. Rebuild subscriptions with `python3 scripts/rebuild-subscription.py`; this writes Word/PDF files and recalculates their answer maps. The script uses LibreOffice on `PATH` (or its standard macOS installation), or an explicit `DOCX_RENDERER=/path/to/render_docx.py`. A custom renderer runs with the current Python; set `DOCX_PYTHON=/path/to/python3` to use another environment. The modern document builder also accepts `DOCX_RENDERER` and otherwise uses LibreOffice plus Poppler.

The subscription builder reuses the Bahij font embedded in `reference/documents/subscription-style.docx`; `SUBSCRIPTION_ARABIC_FONT=/path/to/BahijTheSansArabic-Plain.ttf` overrides it. Install Arial for document rendering and set `SUBSCRIPTION_ARIAL_FONT=/path/to/Arial.ttf` if it is outside the usual macOS or Linux locations. Keep the approved fonts available to LibreOffice. Re-rendered files and recalculated maps require the PDF checks below and visual review before publication; changing renderer or fonts can change layout. `python3 scripts/update-original-footers.py` separately updates the original signature and terms footers with PyMuPDF. Current KYC uses the modern Word pipeline: 11 pages for individuals and nine for companies. The supplied seven-page Letter PDFs in `reference/pdfs/supplied-20261007/` are historical references only. The source policy in `scripts/pdf-design/template-sources.json` lists seven current Word documents, including the five modern documents: the two KYC forms, consent and the two FATCA/CRS forms.

## First pass

```sh
npm test
npm run build
python3 scripts/verify-national-address.py tmp/national-address-verification.json
node scripts/admin-handoff-audit.mjs
node scripts/review-navigation-audit.mjs
node scripts/optional-review-audit.mjs
node scripts/optional-review-actions-audit.mjs
node scripts/customer-workflow-audit.mjs
node scripts/management-views-audit.mjs
node scripts/loading-audit.mjs
```

Run the loading audit alone so CPU contention from other browser suites does not distort its timing assertions. Each browser script prints its report location. A nonzero exit is a failure: read the JSON/log and inspect its screenshot before accepting the release. Do not treat a partially written report as a pass.

## After changing fields, PDFs or sharing

Run the broader checks in this order:

```sh
QA_OUT=tmp/client-corrections-pdfs node scripts/current-pdf-audit.mjs
python3 scripts/current-pdf-audit-verify.py tmp/client-corrections-pdfs
python3 scripts/verify-pdf-overlap.py tmp/client-corrections-pdfs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/client-corrections-audit.mjs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/direct-intake-audit.mjs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/submit-only-client-audit.mjs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/admin-presentation-audit.mjs
node scripts/shared-profiles-audit.mjs
node scripts/staff-name-audit.mjs
node scripts/preview-direction-audit.mjs
```

Inspect the generated PDFs as well as the reports. Check long Arabic/English names, an omitted third name, mixed text, phone/email direction, every choice, blue answer text, signing areas and page breaks. Automated bounds/coverage checks help but cannot approve every possible customer string.

The overlap check compares the actual transparent answer/signature ink at 144 dpi with printed content and other answers, excluding dotted placeholders that the PDF generator intentionally removes. It writes `ink-overlap.json` and fails on collisions, unsupported transforms, generation errors or ink outside the page. Pair it with the placement audit for checkbox coverage and visual inspection for printed-label typography; it does not replace those checks.

## Current and historical KYC templates

Check all 11 pages of the modern individual KYC and all nine pages of the modern company KYC, including long bilingual values, checkboxes, signatures and the national-address footer. Compare the PDFs with their current Word sources and `src/forms/modern-layouts.json`; the supplied seven-page PDFs are historical references, not the current layout baseline.

Test primary email and representative email independently. The current individual KYC prints `rep_email` in its email field. In the historical seven-page restoration, this value was captured as `uiOnly` because the original paper has a representative **Fax** box; preserve that snapshot behavior and never print an email beneath its Fax label.

Historical original (7 pages), earlier modern (individual 11 / company 9) and seven-page restoration submissions retain their own PDF/signature snapshots. Test adding a signature to each layout; editing an old submission creates a new version using the current modern template. A stale browser with an obsolete template version must receive `template_changed`, rather than submit misplaced answers. Record current results in `verification/kyc-modern-restoration-2026-10-07.json`; the original-restoration report remains historical.

## After changing navigation or layout

```sh
node scripts/form-access-audit.mjs
node scripts/management-navigation-audit.mjs
node scripts/catalogue-workflow-audit.mjs
node scripts/catalogue-layout-audit.mjs
node scripts/notifications-audit.mjs
node scripts/client-preview-audit.mjs
```

Some suites cover Chrome, Firefox and WebKit. The card audit checks both audiences and languages at phone, tablet and desktop widths. Management navigation deliberately delays responses while changing tabs, to catch an old response replacing the new screen.

## Checks the receiving developer should perform on the new host

| Area | Expected result |
|---|---|
| Anonymous visitor | `/` and direct form/category/template URLs require login. Private files and API schema JSON cannot be downloaded. Check direct index URLs too. |
| Fresh database | Schema 8; admin and superadmin can sign in; zero clients, shared profiles and submissions before synthetic testing. |
| Permissions | Ordinary admin cannot create admins, publish catalogue changes or change client account type. Superadmin can. |
| Client routing | Individual and company clients enter their own catalogue after login; another client's data is inaccessible. |
| Shared values | Enter common names, phone/email and address in one form; verify other matching forms and account reload. Arabic/English, company/person and other people's details remain separate. |
| Editing order | Enter a signer name before selecting Account holder, then reverse the order. Both give the correct values. |
| Conflicts and clearing | Clear a common field deliberately, reload, use two tabs, disconnect/reconnect and retry. A stale response must not silently replace a newer edit. |
| Submission | Preview every form, submit unsigned and signed examples, double-click/retry, then confirm one saved version and complete management answers/PDF. |
| Optional review | Default off. Superadmin can switch it; ordinary admin cannot. Both roles decide enrolled cases. Initial unsigned forms work in either mode. Existing Received records remain Received. |
| Submit-only display | With review off, clients see Received plus signature status, generic notifications and no approval/rejection notes. Existing correction/signature actions and instructions remain usable. Switching modes updates open cards, notifications and PDF previews without closing them or changing stored decisions. |
| Decisions and notes | No preselection. Reject/correct require a note, approve/signature permit one. Check escaped notes in cards and notifications, read receipts, approval locking and obsolete notification actions. |
| Review replacements | Switch off during a pending/correction/signature case: it continues. Unsigned signature follow-ups fail; electronic signatures or a confirmed signed PDF create a new Under review version. After approval/rejection, a replacement follows the current switch. |
| Concurrent requests | Change modes during editing/upload, use two admins, repeat a request after a lost response, and try reviewing an archived version. Expect conflicts or one saved decision, never duplicate history. |
| Schema upgrade | Restore a schema-7 backup into an isolated directory, initialize schema 8, then compare rows, IDs, timestamps, read receipts, indexes, decision sequences and PDF hashes. Never migrate the only copy. |
| Replacements | Upload a filled PDF and submit an edited version. Management retains history; old client notifications open the latest file. |
| Downloads | Blank PDF, current filled PDF and client ZIP work; a logged-out or wrong-account request cannot download them. |
| Passwords | Admin-created account and chosen resets work; old sessions are revoked; reset clients choose a private password. |
| Appearance | English/Arabic, phone/desktop, two-column cards, no clipped buttons; management sections start closed. |
| Persistence | Restart PHP, reopen the browser and recheck server-saved data. Remember that unsent document drafts are browser-local. |
| Backups | Create a backup, restore into a new directory, verify login, counts and PDF hashes without overwriting the original. |
| Performance | Measure cold and warm visits from the client's actual network. Identify any hosting challenge separately from API/asset timings. |

Record the domain, date, browser, result and evidence for each row. Delete only synthetic test data using the agreed fresh-install procedure before launch; never clear a store after real clients start using it.

## What a passing report means

TEST-REPORT.md records the current modern-KYC restoration checks separately from the historical seven-page restoration, earlier all-form address checks and September workflow evidence. A passing local run is not proof of destination-host permissions, email/SMS delivery (the app has no such provider), a real signature's authenticity or legal compliance. Keep that distinction in the developer sign-off.

## Submission settings page

`review-navigation-audit.mjs` checks the dedicated settings page, explicit Save action, both modes, hidden off-mode counters, existing review access, conflict/retry handling, delayed navigation, both management roles and Arabic/English at desktop, tablet and phone widths in Chrome, Firefox and WebKit. `optional-review-actions-audit.mjs` also tests a committed settings response lost in transit; retrying must reuse the request key.

`submit-only-client-audit.mjs` uses the generated PDF audit's `records.json` as valid sample answers. It checks six saved statuses for each audience, both languages, desktop/mobile and Chrome/Firefox/WebKit; generic off-mode notifications; live setting changes while the PDF and notification panel are open; preserved answers, PDF hashes and decisions; and signing-details network failure. Generate the samples with the command above before running it. The optional-review action audit separately verifies that completing a previously issued request while review is off uses a Received receipt.
