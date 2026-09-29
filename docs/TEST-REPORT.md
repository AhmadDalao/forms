# Release verification — 29 September 2026

This release restores optional reviews and updates the management dashboard. Review is off by default. It changes the client database to schema 8; PDF templates, field definitions and sharing mappings are unchanged. The delivery manifest identifies the final commit and hashes every packaged file.

## Navigation-switch follow-up

The review switch now lives in the management navigation bar on every management page and client profile. It is superadmin-only. Changing it updates the control without navigating away or saving/discarding document edits.

The follow-up reruns the 238-test unit suite, optional-review API and real UI action suites, management previews, account permissions/backup restore, all-nine-form customer workflows, navigation race checks and the loading audit. A new navigation audit covers Chrome, Firefox and WebKit in Arabic/English at 1440, 768, 390 and 320 pixels, including saved mode, retries, stale revisions, language changes, pending requests and unsaved catalogue edits. Exact results and source hashes are in `verification/review-navigation-verification-2026-09-29.json`; hosted checks are in `verification/review-navigation-live-2026-09-29.json`.

Hosted navigation checks passed for both roles in Arabic/English on desktop/mobile, including client profiles and PDF previews. The saved review mode and submission counts stayed unchanged.

Backend, database schema, PDF templates and field definitions are unchanged in this follow-up. The 114-PDF audit below belongs to the preceding optional-review release; it was not regenerated for moving the navigation control. Current form submission/preview workflows were rerun.

## Earlier optional-review release checks

| Check | Result |
|---|---|
| Unit suite | **238 passed; 0 failures or skipped tests** |
| Production build and PHP syntax | **Passed**; 26 PHP files checked |
| Optional-review API and browser audit | **8 groups passed**: both audiences, role/CSRF checks, unsigned intake, corrections, signatures, rejection/approval, switches, concurrent administrators, duplicate requests, stale versions and preserved history |
| Optional-review action audit | **8 groups passed**: actual UI decisions and notes, lost-response retries, corrections, electronic signing, replacement uploads, obsolete notifications, approval locking and restart |
| Customer workflow | **9 groups passed**, including all nine forms, both audiences and languages, final review, submission, replacements, downloads and profile changes |
| Direct intake | **11 groups passed**; every form's captured answers and PDF match management; unsigned Received behavior remains available |
| Shared profiles | **6 groups passed**: sharing, account/category isolation, conflicts, clearing, reload and offline recovery |
| Management views | **19 groups passed**, covering current/archive previews, roles, downloads, phones, retries and session expiry |
| Management presentation | **8 groups passed**: nine documents × two languages × two widths, categorized answers match their saved snapshots; sections start closed |
| Account/permission/backup audit | **6 groups passed**, including admin creation, chosen resets, revoked sessions and backup/restore |
| Notifications | **6 groups passed**, including latest-version previews and simple client presentation |
| Responsive catalogue | **186 measurements passed** across both audiences, languages and Chrome/Firefox/WebKit |
| Loading audit | **5 groups passed**: editing stays usable while account data loads; late responses preserve edits; PDF engines/files stay deferred |
| PDF generation and verification | **114 PDFs / 755 pages passed**, with all nine documents covered, five fill scenarios plus option/partial/blank cases; zero reported failures |
| Schema-7 migration | **Passed** on synthetic edge cases and a private restored production backup: records, review IDs, read receipts, indexes, sequence values and PDF bytes preserved |

Optional-review controls were checked in Chrome, Firefox and WebKit, Arabic/English, desktop/mobile and both admin roles. Client corrections, electronic signing and upload follow-ups were exercised against real local PHP endpoints and synthetic accounts. The suites reported no browser errors.

PDF checks covered 2,093 text destinations, 917 choice destinations and 34 signature destinations, including transparent answer overlays. Representative rendered Arabic/English pages from every document were visually inspected. Bounds/coverage checks ran across the generated set; this does not promise that every possible customer string will fit without shrinking.

The production backup remained private. All mutable workflow tests used disposable local installations. The exact assertions and source hashes are recorded in `verification/optional-review-verification-2026-09-29.json`. Live deployment checks are recorded separately in `verification/optional-review-live-2026-09-29.json`.

Live Hostinger checks also passed for both management roles in Arabic/English on desktop/mobile, both preview entry points, PDF hashes, category counts, role controls and private-path denial. Review remained off. A post-release private backup confirmed schema 8 and unchanged existing client records, submissions, decisions, read receipts, indexes, sequence values, PDFs and credential hashes.

## Fresh handover

Packaging restores the supplied admin/superadmin bootstrap and checks schema 8, review off, SQLite integrity, preserved credential hashes and empty client tables/PDF storage. It also creates clean database/schema examples. See `verification/bootstrap-verification-2026-09-29.json`, `SNAPSHOT.json`, `MANIFEST.json` and `SHA256SUMS.txt`. No production client data or plaintext passwords belong in this handover.

Earlier verification files are retained as dated evidence. Their older UI descriptions and schema/page counts do not override this report.

## What the receiving developer still needs to check

The destination domain has not been deployed by these tests. Verify HTTPS, PHP extensions/limits, private-path denial, account isolation, uploads/downloads, backup restore and cold/warm loading on that host using TESTING.md. Local routing tests cannot certify a provider's `.htaccess` behavior.

The earlier Hostinger timing investigation found a browser challenge adding about four seconds to fresh automated visits. This release keeps the application loading safeguards; it does not change CDN/security settings or claim to eliminate every network-related delay. See PERFORMANCE.md. Uploaded signatures remain client-confirmed, not authenticated by this software.

## 2026-09-29 — dedicated Submission settings page

The management navigation now opens **Submission settings / إعدادات الإرسال**, a separate superadmin page with **Submit only / إرسال فقط** and **Under review / تحت المراجعة**, explanations, the current saved mode and an explicit Save settings button. There is no inline navigation or Dashboard switch. Submit only hides Dashboard review summary cards and the status counters on Received applications. Existing cases remain visible and reviewable; switching modes does not rewrite their status.

Validation: 238 unit tests passed. Eight integration/browser suites passed (76 grouped checks): settings navigation 9, optional review API/browser 8, real review/follow-up actions 8, delayed management navigation 12, management views 19, customer workflow 9, admin/backup-restore 6 and loading 5. Settings-page checks cover Chrome, Firefox and WebKit, both admin roles, Arabic/English and 1440/768/390/320 widths. They verify explicit saves, persistence, conditional counters, previous open-case access, delayed responses, language changes and concurrent-setting conflicts. The real action suite also verifies lost-response retries retain the same request ID. Screenshots were visually checked in English desktop and Arabic mobile.

The final build matches the tested build byte-for-byte. Backend and PDF hashes match the previous production release; this update changes no PDF contents, field mappings or database schema. Existing historical PDF-fit evidence still applies; that PDF audit was not regenerated for this settings-only change. Detailed current evidence: `submission-settings-verification-2026-09-29.json`.
