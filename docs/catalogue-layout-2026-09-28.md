# Compact catalogue and single-line fund name — 28 September 2026

The Itqan header keeps the full Arabic or English fund name on one line. Responsive logo/text sizing lets the actions move to a separate row on small screens without clipping the fund name.

Individual and company home catalogues use three columns and two rows from 1100px wide. The title, instruction and ZIP action share a compact heading area. All six cards keep their full title, description, receipt/signature status, blank download, filled download and upload action. No body scrolling is forcibly disabled and no text is truncated. Tablets use two columns, phones one; small viewports, zoom, network errors and longer custom titles may naturally scroll.

Verification: 229 existing tests passed. Chrome, Firefox and WebKit passed 186 layout measurements across individual/company, Arabic/English, fresh accounts and six submitted forms with unsigned, electronic and uploaded signature states. All six cards and actions fit without vertical scrolling at 1280×720, 1366×768 and 1440×900; 1100×900 also passed. Responsive widths 320, 390, 600, 820 and 1024px have no horizontal overflow and keep upload actions reachable. Blank/filled/ZIP downloads, opening the upload dialog, opening an editor and returning home passed. Login/signup/management sign-in headers passed in both languages. Separate authenticated admin and superadmin checks passed from 320–1366px. Fixed-viewport company screenshots were visually checked alongside individual Arabic and mobile layouts.

The loading audit confirms the catalogue/editor still defer PDFs and the PDF engine, continue while profile synchronization is pending, preserve edits and restore saved account data. This release changes only frontend layout; PDF files, answers, shared-data behavior, accounts and schema 7 remain unchanged.

Run `npm run build`, then `node scripts/catalogue-layout-audit.mjs` and `node scripts/loading-audit.mjs`. Browser checks use isolated local PHP/SQLite storage and synthetic clients. See `catalogue-layout-verification.json` for results.
