# PDF layout refinements — 28 September 2026

Restored the signature form to its exact original one-page PDF and original input/signature positions. The original 13-page Terms & Conditions PDF remains unchanged. Archived redesigns stay under `reference/documents/archived/` for historical reference and cannot be reinstalled by the builder or installer.

The remaining templates use full-width purple section bars with white text, aligned with the field boxes. Removed duplicated section labels inside choice groups and generic Box 1/2 labels. Short bilingual labels and choices share one line; long wording wraps to retain readability. Names and signatures share a row wherever practical, including subscription applicants, KYC representatives/risk declarations, FATCA signatories and the consent signing area. Corporate FATCA keeps its supplied English language. No answer IDs, validation rules, shared-data meanings or legal statements were changed.

The revised Word sources, PDFs and overlay coordinates use `20260928-sections-3`. Page counts: subscription 2 each, individual KYC 11, company KYC 10, individual and company FATCA/CRS 8 each, consent 1. Signature uses `20260928-original-3`; Terms & Conditions retains `20260928-original-2`.

## Verification

- 225 unit tests and the production build passed, including tests preserving original, retired-modern and restored signature destinations.
- Content/geometry checks passed for 38 redesigned KYC, FATCA and consent pages and 23 preserved legal fragments. Checked aligned header edges, non-repeated group labels, inline bilingual choices and paired name/signature coordinates.
- Visually inspected all 42 revised template pages and the restored original signature page; inspected populated examples for long Arabic/English names, choices, email/telephone, totals and signatures.
- Generated 106 PDFs across all eight fillable forms, including five full fills per form, blank/partial/shared data and every checkbox option. Independently rendered 762 pages; covered all 423 mapped fields, 227 checkbox options and 16 signature slots, with no missing ink, clipping, original-paper erasure or ink outside mapped spaces.
- All 55 fillable-template pages passed LTR/RTL preview comparisons in Chrome, Firefox and WebKit (165 comparisons; 159 exact, six within the existing pixel-difference tolerance).
- Full isolated submission cycle passed: 556 captured answers matched management records and PDF downloads were byte-identical. Shared data, account isolation, offline retry, duplicate submission protection, archived versions, signed replacements, consent upload and ZIP download passed.

Detailed results and the final browser, publication and private-data checks are recorded in `pdf-layout-refinement-verification.json`. This release supersedes prior page counts and the retired modern signature layout. The developer delivery contains seven current Word files and nine PDFs; original signature/T&C have no matching editable Word source.

## Publication and handoff

Published to `https://forms.ahmaddalao.com/` from source commit `6e6bc60`. All nine read-only live smoke checks passed, including every current PDF hash, protected downloads, existing management preview and account controls. Fresh private snapshots and a clean restore confirmed unchanged four clients, 15 saved PDF versions (nine archived), five shared profiles and two historical review records. All 15 saved PDF files remained byte-identical.

The refreshed handoff contains the current public build, editable documents, source and bilingual installation instructions, plus a separate private migration archive containing existing accounts and forms. The archive must remain outside public download paths.
