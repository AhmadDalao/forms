# Approved fund terms — 15 October 2026

This release replaces the current terms template with the owner's approved fund document. It does not change the supplied seven-page KYC PDFs, one-page signature form, separate consent form, five current Word sources or website address.

## Current source and fields

- Immutable source: `reference/pdfs/supplied-20261015/terms-and-conditions.pdf`.
- Current template: `public/pdfs/terms-and-conditions.pdf`; output mirror: `output/documents/terms-and-conditions.pdf`.
- Version: `20261015-approved-terms`.
- All 38 physical pages retained: eight introductory pages, 29 pages of fund terms and the final investor declaration. The declaration refers to appendices, but no separate appendices are attached in this supplied file.
- Only the approved Riyadh national-address footer is added; the supplied body is preserved.
- Printed customer fields: `investor_name` and `date`; signature slot: `investor`. All three destinations are on physical page 38. The page-4 document-version blank is not a customer field.
- Individual name-part inputs join into the investor-name destination; company investor names remain distinct from authorized-person names.
- Current inventory: nine application templates plus the legacy subscription compatibility file, ten public PDFs / 75 pages, and five Word sources.

## Saved versions

The preceding 13-page schema is frozen at `reference/documents/archived/terms-13-page-schema.json`; its PDF is `reference/pdfs/archived/terms-13-page-riyadh-20261014.pdf`. The retired 24-page layout remains in `reference/documents/archived/terms-modern-layout.json` with its preserved PDF reference. These files describe historical submissions, not current templates.

Historical signing resolves the trusted saved layout and overlays the saved PDF when it differs from the current definition. Old signature IDs cannot sign the new legal document. The preceding PDF, answers and captured definitions remain unchanged when a signed replacement is created. Management details prefer captured definitions; records without them use frozen legacy labels instead of showing the new investor/date questions.

## Verification status

All 276 unit tests pass. Source preservation, 8 filled PDFs / 304 pages, three-browser current workflows, responsive historical signing, and the address on all 75 public PDF pages have passed. Reports and synthetic visual evidence are included here. Live deployment also passed; see live-verification.json and release-verification.json.

Repeatable commands and acceptance scope are in `docs/TESTING.md`. The focused `scripts/approved-terms-audit.mjs` uses synthetic isolated fixtures, previews all 38 pages in three browsers and exercises unsigned submission, signing, replacement and saved-version preservation. Screenshots written under `tmp/` are local audit artifacts unless explicitly included in a release evidence file; this README does not imply they are packaged.

## Handover

The output is `output/developer-handoff-2026-10-15-approved-terms`. `scripts/create-handoff.py` includes the focused audit script, this entire folder under `verification/approved-terms-2026-10-15/`, and supplied/archived sources through its existing reference-tree copy. The package contains nine current PDFs and five current Word sources in `editable-documents/`; the tenth compatibility PDF is in the public website assets.

The deployed application commit is `f4d6eb285edfcdde4b8146e909da55b0a37c81e8`. All 14 overwritten public files were backed up; private storage, review-off setting and production counts stayed unchanged. The packager restores and verifies the zero-client schema-8 bootstrap and writes file hashes and ZIP integrity evidence. Dated reports from earlier releases remain historical and do not verify this replacement.
