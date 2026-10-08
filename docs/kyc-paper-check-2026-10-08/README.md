# KYC paper check — 8 October 2026

The individual and corporate KYC forms were compared, page by page and in both directions, with the supplied seven-page PDFs. This folder preserves the **pre-fix findings** and records the subsequent source corrections separately. The layouts and national-address footers remain unchanged.

## Corrections recorded

- [x] Removed the six-character cap from all 28 portfolio percentage inputs and restored explicit percentage column context. These are allocations, with the paper's 100% total guidance.
- [x] Restored every authored KYC Family ID choice. Shared-profile and subscription schemas retain their existing **Other + Family ID detail** representation.
- [x] Restored all three printed risk-guidance paragraphs and the “Despite recommendation Itqan Capital” text. These are static source text, not new questions.
- [x] Restored corporate “Realization **of** Income”; retained individual “Realization Income” as printed. Corrected both Balanced Arabic labels to **متوازنة** and both risk-capital question prefixes to **ماهي نسبة**.
- [x] Confirmed that each supplied-source and public-template PDF SHA-256 is unchanged from the audit baseline; full values are in [corrections.json](corrections.json).

[corrections.json](corrections.json) records the current composed fields and disposition of each correction. It contains no application test results; the release test report is separate.

## Audit evidence

| Form | Pre-fix checklist | Pre-fix composed definition | Coverage |
|---|---|---|---|
| Individual | [individual-baseline-audit.json](individual-baseline-audit.json) | [individual-baseline-definition.json](individual-baseline-definition.json) | All seven pages; 129 evidence rows; 120 composed field IDs |
| Corporate | [corporate-baseline-audit.json](corporate-baseline-audit.json) | [corporate-baseline-definition.json](corporate-baseline-definition.json) | All seven pages; 115 paper answer units; 108 composed field IDs |

The baseline files deliberately retain the old capped-input, missing-copy and hidden-Family findings. They do **not** describe the corrected UI. The early corporate Family-ID retirement hypothesis was resolved by the narrower source restoration recorded above.

Each form has seven portfolio categories in two columns (14 cells), and five suitability questions with 3/4/4/4/4 options (19 choices). The corporate checklist accounts for all six banking questions, five contact rows, ten authorized-person correspondence/contact rows and nine custody fields. No other customer questions were found missing or invented.

[source-copy.json](source-copy.json) preserves bilingual risk guidance and the document-specific page-4 wording. English/Arabic differences already printed in the source are retained. Local render images were reviewed during the audits; **PNGs are not included** in this folder. These files contain blank template definitions and audit text, not customer answers.

## Intentional exceptions retained

- Individual issue place and representative issue date/place; corporate authorized-person issue date/place remain removed as previously requested.
- Individual representative Fax remains replaced by UI-only Email, saved in application details without printing email below the original Fax label.
- Expanded names and separate individual city/district controls remain joined into their original printed spaces. The requested representative identity dropdown remains.
- Page 6 in both PDFs is explicitly for RM/CSR and internal use. Those fields remain staff/manual paper areas, not customer requirements.

[reference-integrity.json](reference-integrity.json) accounts for every linked field ID against the current composed documents or an explicitly retired field/signature slot. It is a documentation integrity record, not a functional test report.
