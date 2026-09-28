# Restore earlier card proportions — 28 September 2026

The individual and company catalogues retain two columns on screens above 600px and one column on phones. Removed the compact card overrides introduced for the three-column version: desktop card opening area returns to a 140px minimum with 23px/22px padding, titles to 16px, descriptions to 13px, number badges to 40px and card actions to their earlier spacing. The desktop catalogue returns to 1048px of content width, matching the old 1120px shell minus its horizontal padding. Card gap is 16px.

The existing compact page heading, single-line fund name, mobile action layout, statuses and all downloads/uploads remain. Natural vertical scrolling is expected. No data, PDF, API or database change.

Verification: production build passes the existing catalogue browser audit, with 186 responsive measurements across Chrome, Firefox and WebKit, both audiences and languages. No horizontal overflow, correct columns, readable navigation, reachable upload controls, blank/filled/ZIP downloads, editor navigation and shared authentication headers pass. Desktop English individual and Arabic company screenshots were visually inspected. Evidence: `roomy-cards-verification.json`; hosted asset/authentication checks: `roomy-cards-live-verification.json`.
