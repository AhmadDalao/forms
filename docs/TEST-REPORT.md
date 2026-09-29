# Release verification — 29 September 2026

The latest update keeps Submit only simple on the client side. With review off, submitted cards and previews show **Received** plus signature status. Review decision labels and approval/rejection notes are hidden; notifications say **Form update** without decision text. Already-issued correction/signature actions and their instructions remain usable. Management keeps the actual case status and history. The setting stays on its dedicated superadmin page, and both dashboard category columns use the same six-form order.

This update changes frontend presentation only. Backend, database schema, PDF templates and field mappings match the preceding production release. The migration remains schema 8. Review is off by default.

## Tests completed for this update

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

## Release and fresh handover

Public deployment backs up replaced entry pages and preserves private storage. Hosted checks and the deployed asset fingerprints are recorded separately in `verification/submit-only-cycle-live-2026-09-29.json`. The deployment manifest records the source commit. Live checks are read-only apart from authenticated sessions; they do not change the workflow setting or submit test client documents.

Live verification passed for both management roles in Arabic/English on desktop/mobile: settings permissions and saved mode, hidden review counters, category order/counts, client profiles and PDF previews. Hosted JavaScript assets matched the tested build. Review stayed off and submission counts stayed unchanged. Eight overwritten public pages were backed up; private storage was preserved.

The handover builder restores and verifies the fresh bootstrap: schema 8, review off, SQLite integrity, admin/superadmin credential hashes, and zero clients, submissions or saved PDF files. The delivery includes source, public build, installation/domain instructions, database documentation and test scripts. `SNAPSHOT.json`, `MANIFEST.json`, `SHA256SUMS.txt` and `verification/bootstrap-verification-2026-09-29.json` identify and verify that package. Keep the bootstrap private and send its account passwords separately.

Earlier dated verification files remain as history. Their old navigation descriptions and schema/page counts do not override this report.

## Checks on the destination host

The receiving developer still needs to test HTTPS, PHP extensions/limits, private-path denial, account isolation, uploads/downloads, backup restore and cold/warm loading on their own domain using TESTING.md. Local routing tests do not certify a provider's web-server configuration.

The earlier Hostinger investigation found a browser challenge adding about four seconds to fresh automated visits. This update preserves deferred loading; it does not change CDN/security settings. See PERFORMANCE.md. Uploaded signatures remain client-confirmed; the application does not authenticate handwritten signatures.

## 30 September — larger received-application names

The Received applications client column has more space. Client names use 17px text on desktop and 16px on phones, stay on one line beside their account badge, and keep the phone number below. Thirty-six responsive checks passed: three browsers, Arabic/English, and 1440/1280/1024/768/390/320 widths. Profile links still open; no page overflow or browser errors. Long rows retain horizontal scrolling when space is limited. English desktop and Arabic mobile samples were visually inspected. This CSS-only change does not alter form data, PDFs, submission behavior or review settings; the full-cycle evidence above remains the functional baseline. See `received-names-2026-09-30.json`.

Live checks passed in Arabic and English at desktop and phone widths. Hosted CSS matched the tested build, names stayed on one line, profile links opened, and review remained off. Client and submission counts were unchanged. Public files were backed up before deployment.
