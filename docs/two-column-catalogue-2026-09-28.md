# Two-column form catalogue — 28 September 2026

Individual and company home pages now show two card columns on desktop/tablets above 600px, and one column on phones. This supersedes the earlier three-column layout and the requirement to fit all six cards without vertical scrolling. Cards keep their existing order, complete titles, statuses and download/upload actions. The fund name remains on one line.

Verification: the production build passed 186 responsive measurements across Chrome, Firefox and WebKit, individual/company accounts, Arabic/English, empty accounts and submitted forms with all signature statuses. Checks cover widths from 320px to 1440px, correct two-column/three-row or one-column/six-row placement, no horizontal overflow, reachable upload buttons, blank/filled/ZIP downloads and opening/returning from an editor. Shared login/signup/management headers also passed. The layout test measures untransformed row positions so hover animation cannot count as an extra grid row.

This is a CSS-only product change. No PDF, field, account, submission or schema changes. Reproduce with `npm run build` and `node scripts/catalogue-layout-audit.mjs`. See `two-column-catalogue-verification.json` for results; test accounts are isolated from production.
