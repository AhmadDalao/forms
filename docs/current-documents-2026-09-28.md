# Current documents review entry point — 28 September 2026

Removed the separate Submitted details card below Current documents, its duplicate document/version selector, and its automatic saved-detail API request. Removed associated state, loading/retry logic and unused CSS.

Use Preview & details on each Current documents row to review the saved PDF, categorized answers and signatures. These modal sections remain collapsed initially. Management version history retains earlier versions, their original details, downloads and restore controls. No answers, account sharing, PDFs or archived snapshots were changed.

Verified against the production build in isolated browser fixtures:

- All nine forms, Arabic/English, desktop/mobile: 36 presentations and 2,232 field label/value/direction checks through Current documents.
- PDF page counts, keyboard controls, initial collapsed state and mobile layouts pass.
- 19 management checks across Chrome, Firefox and WebKit, for admin/superadmin/new admin: current and archived previews, permissions, failures/retries and session expiry.
- Opening an individual/company profile does not render the duplicate card or issue its redundant detail request.
- Arabic desktop profile visually inspected.

Local evidence: `current-documents-verification.json`. Live evidence: `current-documents-live-verification.json`. Deploy public frontend files only; private storage and backups remain outside public paths. No database or PDF migration is required.
