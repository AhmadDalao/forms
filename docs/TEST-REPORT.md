# Handover verification — 7 October 2026

## 7 October — national address across all forms

The owner expanded the address update to all nine current templates plus the public legacy subscription PDF. Seven editable Word sources match their PDFs. Signature and terms retain their original body design. The address source is `scripts/pdf-design/national-address.json`, version `20261007-national-address`.

The full address is present on all **56 public PDF pages** and all seven Word sources. Modern and subscription Word body XML and answer coordinates are unchanged. The original signature/T&C word positions and field maps remain unchanged; MuPDF body comparisons are exact, while PDFium/Poppler show small renderer antialiasing differences on some terms pages. The source originals remain untouched.

- **238 unit tests** and the production build passed.
- **114 generated PDFs / 755 pages** passed; **2,093 text**, **917 choice** and **34 signature** rectangles were checked. Every mapped field, option and signature slot was covered, with five complete fills per form plus blank, partial, shared-data and option samples.
- **19 isolated customer/management check groups** passed on the final build. All **557 captured answers** across nine forms matched management, and downloaded PDFs matched submitted bytes. The management audit inspected **36 Arabic/English desktop/mobile views** containing **2,232 displayed values**. Both fixture template sets match the final public build by SHA-256.
- Visual inspection covered all 56 blank pages and 78 populated long Arabic/English sample pages across 20 contact sheets. No footer overlap, answer clipping or shifted fields was found.

Preview testing caught an unnecessary image mask introduced while editing the original-style footers. The footer builder now removes the old address decoration and completely transparent filler without creating that mask. The browser audit now treats image-decoding warnings as failures. All **165 page/direction comparisons** passed across Chrome, Firefox and WebKit, covering all 55 pages of the nine editable forms in Arabic/English browser directions, with zero page or image-decoding errors.

Evidence: `verification/all-forms-address-verification-2026-10-07.json`. These are synthetic isolated tests. The backend/schema and optional-review behavior are unchanged; their broader regression remains the dated September baseline.

## 7 October — earlier KYC-only stage

Only the current individual and corporate KYC PDF templates and matching Word sources are in scope. The owner supplied this footer and explicitly confirmed the spelling **Branch**:

```text
Al Zahraa District - Prince Naif Branch - Al Saha Square, 1st Floor
2505 - Al Zahra Dist
Unit No 7940
Jeddah 23425-2753
Kingdom of Saudi Arabia
```

The supplied corporate PDF matches the original exactly. The individual PDF is a reprint of the same seven-page content. Neither supplied PDF contains annotations; no new content or field requirement was identified. Field definitions, options and PDF mappings remain unchanged. Existing submitted PDFs and their archived versions must retain their bytes.

Scoped verification passed. The 11-page individual and 9-page corporate templates have identical body pixels, Word body XML and all 209 mapped destinations compared with the previous release. Only the footer address pixels changed. Both PDFs use cache version `20261007-itqan-address`.

- All **238 unit tests** and the production build passed.
- **31 generated PDFs / 311 pages** passed content, geometry, transparent blue answer ink and clipping checks: **818 text, 794 choice and 6 signature rectangle checks**. Five complete fills per KYC plus blank, partial, shared and option samples cover every mapped field and choice.
- **60 page/direction comparisons** passed across Chrome, Firefox and WebKit, covering all 20 pages in Arabic/English browser directions.
- **20 isolated workflow checks** passed. All **228 applicable captured answers** matched management records. Customer/admin downloads matched submitted hashes; desktop/mobile Arabic/English previews rendered every page. Customer upload replacements preserved prior answers and PDF hashes, and historical notifications opened the latest file.
- All 20 blank pages and eight populated sample pages were visually inspected. No footer wrapping, clipping or overlap was found.

The workflow checks use synthetic local clients and Chrome. Initial submissions use the production API code, replacements use the customer UI, and historical notification events are fixture data. The per-page preview checks also run Firefox/WebKit. At that earlier KYC-only stage, the nine-form regression had not been rerun. The expanded address release above records the subsequent all-form PDF and customer/management checks. Evidence: `verification/kyc-address-verification-2026-10-07.json` (under `docs/` in the repository).

The release was published to Hostinger after backing up all 12 overwritten public files. Live checks passed: both authenticated KYC templates and all new browser assets matched the verified build, a stored submission retained its exact PDF hash, and the management profile/PDF preview opened. Review remained off; workflow revision and client/submission counts were unchanged. PHP application code and private storage were not replaced.

The refreshed October handover retains the same private fresh-install admin/superadmin bootstrap with no client data. The builder restores it and verifies schema 8, review off, empty client/submission tables and SQLite integrity. The dated result is `verification/bootstrap-verification-2026-10-07.json`; the included application is identified by `MANIFEST.json` and `SNAPSHOT.json`.

## 29–30 September — previous tested baseline

The previous delivery included the full-cycle release tested on 29 September and the name-layout update checked on 30 September. The submit-only update keeps the client side simple. With review off, submitted cards and previews show **Received** plus signature status. Review decision labels and approval/rejection notes are hidden; notifications say **Form update** without decision text. Already-issued correction/signature actions and their instructions remain usable. Management keeps the actual case status and history. The setting stays on its dedicated superadmin page, and both dashboard category columns use the same six-form order.

That September update changed frontend presentation only. Backend, database schema, PDF templates and field mappings matched the preceding production release. The migration remains schema 8. Review is off by default.

## Tests completed for the September baseline

| Check | Result |
|---|---|
| Unit suite | **238 passed**, no failures or skipped tests; includes schema-8 migration, rollback and preserved history |
| Build and PHP API syntax | Passed; **18 API PHP files** checked |
| Integration/browser suites | **15 suites, 135 grouped checks passed** |
| All-form submission | All **9 forms**, **557 captured answers** matched management records; downloaded PDFs matched submitted bytes |
| PDF generation and verification | **114 PDFs / 755 pages**, zero reported failures; five complete fill samples for each of nine forms, plus blank/partial/option samples |
| PDF placement | **2,093 text**, **917 choice** and **34 signature** rectangles checked; no uncovered mapped fields, options or signature slots |
| Catalogue layout | **186 measurements** across individuals/companies, Arabic/English and Chrome/Firefox/WebKit |
| Backup/restore | Accounts, structured answers, archives, PDF hashes and administrator credentials restored exactly in an isolated installation |
| Loading | Five groups passed; forms remain usable during delayed account loading, late data preserves edits, PDFs and PDF engines stay deferred |

The suites cover direct submission, optional review, notes, correction, electronic signatures, confirmed signed uploads, approval locking, rejection, replacement versions, duplicate/lost requests, conflicting administrators, changed modes, stale versions, notifications/read receipts, latest-file actions, account isolation, chosen passwords, permissions and expired sessions. Management preview checks cover both entry points, every rendered page, retries and responsive layouts. Categorized management answers are checked against saved snapshots for all nine documents.

The new submit-only audit exercises both audiences, both languages, desktop/mobile and all three browser engines. It checks all six saved statuses with review off and on, switching modes while the notification panel and PDF preview are open, preserved answers/PDF hashes/decisions, and the signing-details failed-network fallback. Tests found and fixed two frontend issues: a mode refresh could tear down an open notification panel, and the signing failure screen referenced an undefined variable. The affected suites passed again after those fixes.

Arabic and English rendered PDF samples from every document were visually inspected. Twelve contact sheets cover 48 sampled pages, including blue answers, names, choices, bilingual labels and signatures. Automated bounds and coverage checks cover the entire generated set; visual inspection was sampled. This is not a guarantee that arbitrarily long customer text will fit without shrinking.

Detailed assertions, coverage and source/build hashes: `verification/submit-only-cycle-verification-2026-09-29.json`. Tests use disposable local installations and synthetic clients. Real production submissions are not changed by these tests. Browser device checks use responsive viewports, not physical phones.

## September release and fresh handover

Public deployment backs up replaced entry pages and preserves private storage. Hosted checks and the deployed asset fingerprints are recorded separately in `verification/submit-only-cycle-live-2026-09-29.json`. The deployment manifest records the source commit. Live checks are read-only apart from authenticated sessions; they do not change the workflow setting or submit test client documents.

Live verification passed for both management roles in Arabic/English on desktop/mobile: settings permissions and saved mode, hidden review counters, category order/counts, client profiles and PDF previews. Hosted JavaScript assets matched the tested build. Review stayed off and submission counts stayed unchanged. Eight overwritten public pages were backed up; private storage was preserved.

The handover builder restores and verifies the fresh bootstrap: schema 8, review off, SQLite integrity, admin/superadmin credential hashes, and zero clients, submissions or saved PDF files. The delivery includes source, public build, installation/domain instructions, database documentation and test scripts. `SNAPSHOT.json`, `MANIFEST.json`, `SHA256SUMS.txt` and `verification/bootstrap-verification-2026-09-30.json` identify and verify that package. Keep the bootstrap private and send its account passwords separately.

Earlier dated verification files remain as history. Their old navigation descriptions and schema/page counts do not override this report.

## Checks on the destination host

The receiving developer still needs to test HTTPS, PHP extensions/limits, private-path denial, account isolation, uploads/downloads, backup restore and cold/warm loading on their own domain using TESTING.md. Local routing tests do not certify a provider's web-server configuration.

The earlier Hostinger investigation found a browser challenge adding about four seconds to fresh automated visits. This update preserves deferred loading; it does not change CDN/security settings. See PERFORMANCE.md. Uploaded signatures remain client-confirmed; the application does not authenticate handwritten signatures.

## 30 September — larger received-application names

The Received applications client column has more space. Client names use 17px text on desktop and 16px on phones, stay on one line beside their account badge, and keep the phone number below. Thirty-six responsive checks passed: three browsers, Arabic/English, and 1440/1280/1024/768/390/320 widths. Profile links still open; no page overflow or browser errors. Long rows retain horizontal scrolling when space is limited. English desktop and Arabic mobile samples were visually inspected. This CSS-only change does not alter form data, PDFs, submission behavior or review settings; the full-cycle evidence above remains the functional baseline. See `verification/received-names-2026-09-30.json`.

Live checks passed in Arabic and English at desktop and phone widths. Hosted CSS matched the tested build, names stayed on one line, profile links opened, and review remained off. Client and submission counts were unchanged. Public files were backed up before deployment.
