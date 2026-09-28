# Management client profile — 28 September 2026

Removed the redundant current Shared customer details card from management client profiles. Shared-data storage, form autofill, immutable submitted answers and archival snapshots are unchanged.

The account overview now groups the client name, category badge, contact information, counts, dates and actions in one compact card. Superadmin account-type controls are integrated into that card and remain unavailable to ordinary administrators. Current documents show a received count. Submitted details retain the document/version selector, all captured answers, signatures, previews and downloads, with distinct expandable category rows and clearer label/value spacing. The existing light purple visual style and RTL/mobile behavior are preserved.

Verification: 229 automated tests passed. All nine documents passed categorized answer/value checks and both management preview entry points in Arabic/English at desktop/mobile widths. Chrome, Firefox and WebKit passed ordinary-admin, new-admin and superadmin profile/navigation/preview checks, including current and archived versions, interrupted requests and expired sessions. No database or PDF template change is required. Re-run `node scripts/admin-presentation-audit.mjs` with generated audit PDFs and `node scripts/management-views-audit.mjs` after building.
