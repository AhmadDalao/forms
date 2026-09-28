# Bilingual PDF labels — 28 September 2026

The signature form, individual/company KYC and individual FATCA/CRS now pair each Arabic/English choice beside one checkbox, such as **نعم / Yes** and **السيد / Mr.** Short field and question labels also share one line. Long text wraps without removing either language. Directional isolates keep numbers and punctuation within the correct language.

The editable Word sources, public PDFs and measured answer/signature positions were updated together under layout version `20260928-inline-2`. Individual KYC is now 12 pages and company KYC 10; signature remains 2 and individual FATCA/CRS 9. Every Word wording token was compared with the previous source and preserved. The other five PDFs, including the restored original 13-page Terms & Conditions, remain byte-for-byte unchanged.

## Verification

- All 223 unit tests and the production build pass.
- Content checks preserve 23 source fragments across the modern template family. The four changed templates have 167 short bilingual choices verified on the same PDF baseline.
- Visually inspected every updated template page (33 pages), plus populated examples for Arabic names, English contact values, title/Yes/No checkmarks, risk assessment and signatures.
- Generated 53 PDFs covering five complete fills per changed form, blanks, partial/shared data and all choices. Independent rendering checked 470 pages, all 278 mapped fields, all 204 choices and all six signature positions. No missing marks, paper erasure or ink outside the assigned spaces was found.
- The disposable full submission cycle passed: all eight editable forms saved 556 exact answer values to management, with byte-identical downloads. Lost-response retry, archived versions, shared fields, account isolation and signed replacements were also checked.

Detailed results, browser checks and publication verification are recorded in `bilingual-pdf-verification.json`. Previous release reports in the package describe their historical layouts; this report and the current editable documents supersede their KYC page counts.

## Deployment and handoff

Publish only the public build. Preserve production private storage and existing PDF versions. The delivery includes updated Word/PDF pairs, source, installation instructions and a separate verified private migration archive; none of those private files belongs under the web root.
