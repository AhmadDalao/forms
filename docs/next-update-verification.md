# Names, shared details and direct submissions — 20 September 2026

Implemented the approved update. Clients enter names and contact information inside the documents. Matching ordinary drafts and the account profile reuse those values; company/individual accounts, Arabic/English names, representatives and distinct addresses remain separate. Submitted PDFs, their captured answers and archived versions do not change when shared details change.

Subscription has adjacent, explicitly labelled Arabic and English name groups. Individual KYC retains its single printed name area, with separate city/district controls joined into the existing printed address space. Company names and authorized-person names remain independent. Identity labels, account-holder selection order, address roles, deliberate blanks, legacy company names and cross-tab refresh are covered by regressions.

The final preview has one Submit form action. Unsigned forms are accepted. Management sees Received and a separate signature status; old saved forms keep their Saved label. Active review controls and the workflow toggle are removed. Previous decisions, reasons, administrators and timestamps remain read-only. Replacement PDFs and resubmissions create new versions. Uploads remain labelled as uploads and do not acquire invented structured answers or verified signatures.

Login/signup use the supplied presentation title and original logo assets: Itqan above Wessal, Dinar and RSM, with their role labels. Both numbered promotional blocks are removed. Other navigation remains Itqan-branded. Login does not load templates or the heavy PDF engines.

## Evidence

- **210 unit/regression tests passed.** Includes cross-tab storage events, offline conflict/retry, account isolation, role-before/after-name entry, deliberate clearing, company language names, separate head-office addresses and migration rollback/idempotency/history preservation.
- **557 field checklist entries**, eight editable forms, **43 pages including consent**: [field checklist](next-update-field-checklist.json). Includes source-aligned labels, options, PDF destinations, language/direction, shared meaning and validation. UI-only controls and printed destinations are distinguished.
- **Five complete fills per editable form**: English, Arabic, long English, long Arabic, and mixed/optional-third-name data; additional blank, partial, shared/restored and every-choice samples. **106 PDFs / 567 pages**, **2,829 text rectangles**, **1,006 checkbox rectangles**, **32 signature placements**, **3,231 transparent image overlays**, **260 unchanged pages**. No uncovered mapped fields/options/signatures or verification failures. All 14 Arabic/English long-answer contact sheets were visually inspected.
- **145 name-joining cases** passed. All nine supplied original PDF uploads match their preserved references. The approved company FATCA source is unchanged. Consent retains its editable Word source and download-only PDF.
- Isolated Chrome lifecycle passed: login/signup English/Arabic at desktop/mobile sizes, protected routes, real form edits, browser/account restore, multiple tabs, offline retry, explicit blanks, individual/company isolation, bidirectional company English names, unsigned submission, simultaneous clicks, a lost response after a committed submission, idempotent retry, signed replacement, archived snapshots, stale-version rejection, consent upload, management receipt, exact answers, PDF/ZIP download and cross-account denial.
- All eight populated PDFs submitted through the real endpoint. **556 populated answer values** matched management detail responses and downloaded PDFs matched the submitted files byte for byte. This is a populated-answer count, separate from the 557-entry schema inventory.

Raw evidence is retained privately under `tmp/next-update-pdfs/`, `tmp/next-update-paper/`, and `tmp/workflow-toggle-1789929394555-1b9d42/direct-intake/`. These are not in the public build. Repeatable scripts: `scripts/current-pdf-audit.mjs`, `scripts/current-pdf-audit-verify.py`, `scripts/paper-field-match-audit.mjs`, `scripts/next-update-field-checklist.mjs`, and `scripts/direct-intake-audit.mjs`.

## Release safeguards and limits

Deploy only the allowlisted public build over FTPS, back up overwritten public files, and retain production private storage and credentials. Migration 7 changes only the workflow setting and records the transition; it does not rewrite submitted answers, PDFs or previous review records. Live verification is recorded separately in `docs/next-update-live-verification.json` after publishing.

The checks establish software, rendering and source-document consistency. They are not legal or regulatory certification. Text must still fit the original document's physical answer spaces; unlimited text is not promised. A client-supplied image or uploaded PDF is not identity or signature verification.
