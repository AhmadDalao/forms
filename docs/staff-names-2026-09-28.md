# Independent relationship-manager names — 28 September 2026

The individual FATCA/CRS Relationship Manager / Customer Service Representative section no longer autofills its account-holder name from the shared customer identity. Editing this staff name no longer changes the customer's name elsewhere. The row remains available for manual entry by staff; customer identity and account-holder signatory fields continue sharing normally.

The existing shared-data reconciliation clears only values tracked as automatically inherited in ordinary drafts. Explicit overrides and untracked/manual values survive, even when identical to the customer's name. Submitted and archived snapshots and their isolated edit drafts remain unchanged. Field labels, PDF templates, APIs and schema are unchanged.

Verification: all 235 unit tests passed, including six new cases covering Arabic/English, manual input, reload, tracked old autofill, deliberate old values and historical revisions. The isolated browser audit covers Arabic desktop with an old inherited draft and English mobile with a fresh account. It checks empty staff inputs/signature selection, eight-page final preview, PDF download, synthetic submission with empty staff answers, manual name persistence, unchanged shared customer names and immutable submitted snapshots. No browser errors. The Arabic staff-section screenshot was visually inspected.

Reproduce with `npm test`, `npm run build` and `node scripts/staff-name-audit.mjs`. See `staff-names-verification.json`. No database or PDF migration is required.

Published to the main Hostinger site with backups and private storage preserved. All ten changed live assets match the tested build, individual/company routes still require login, and management login loads without browser errors. Client interactions were tested using isolated synthetic accounts. See `staff-names-live-verification.json`.
