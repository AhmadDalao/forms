# Full regression and document verification — 19 September 2026

**Passed for the tested scope. Two defects were fixed and published to [the live site](https://forms.ahmaddalao.com/).** Source commit: `27e5472`.

## Defects fixed

1. **Approval lock bypass:** an approved form was disabled in the UI but a direct API request could change its decision. The server now rejects that change without altering history, notifications or audit data. Retrying the original approval remains safe. Corrections use a new version, which starts under review.
2. **Imported signature fields:** explicit Signature / التوقيع captions could become text fields, and a neighboring signature caption could be assigned to a name box. They now create signature slots and retain the correct same-row column label. Regression checks include the actual Arabic documents and an English Signature / Name / Date fixture.

No existing document template, curated form field, saved submission or archived PDF was changed by these fixes.

## Tested scope

| Area | Coverage | Result |
|---|---|---|
| Build and code | Production build, all public API PHP syntax, 101 unit tests | Passed |
| Source matching | Eight editors; 447 schema fields, 239 radio/checkbox options, 21 dropdown options, 16 signature slots | No omitted customer questions or incorrect destinations found |
| Five complete samples per editor | English, Arabic, long and mixed answers; 40 PDFs / 210 pages | Passed |
| All PDF checks including shared data and input direction | 112 downloads / 678 pages; 264 real typing/caret checks | Passed |
| Client lifecycle | 27 groups: signup/login, profile, password/reset/expiry, sharing, storage, submission/revision/archive/recovery, ZIPs and ownership | Passed |
| Management | 39 groups: admin/superadmin permissions, details, catalogue changes, imports, review gates, publishing and rollback | Passed |
| Importer correction | 10 real originals; 30 generated samples / 175 pages; final-bundle upload → edit → review → publish → client signing/download | Passed |
| Review lifecycle | 10 groups including filtering, conflicts, notifications, approval lock, resubmission and unchanged archived PDFs | Passed |
| Signature controls and rendering | 96 UI cases; nine PDF cases / 22 placements; original streams, geometry, transparency and exact placement | Passed |
| Navigation | 12 document/language cases, 48 responsive cases, keyboard and live completion counters | Passed |
| Hosted verification | Read-only public/client-entry and both management roles; exact asset and original-PDF hashes; private-path protection | Passed |

Chrome, Firefox and WebKit were exercised in Arabic/English and desktop/mobile viewports. The complete account submission lifecycle used Chromium; the three-engine matrix covered passwords, categories, reviews, signatures, navigation, shared data and typing. Test mutations ran in isolated local fixtures. Live checks used management login/logout and reads only.

## Field and document findings

All supplied original PDFs were compared with the project references. The active subscription templates are the approved individual/company rebuilds. The one-page consent is the approved reconstructed document. The supplied corporate FATCA wording remains unchanged as previously requested.

All 42 active template pages plus the consent page were visually reviewed. Long English and Arabic output was inspected on every populated original-form page. Rendered comparisons checked answer boundaries, original text and geometry, unchanged pages, transparent overlays and signature positions. No clipping, printed-text overlap or white background covering the source was found in the tested existing templates.

Shared values stay separate between individual and company accounts. Manual overrides, saved revisions and deliberate blanks persist. Completion/signing dates default to today and remain editable; historical birth, expiry, incorporation and identity-issue dates remain blank until entered. Subscription calculations and Arabic amount words were checked, including backend recalculation and maximum supported units.

Staff-only paper sections intentionally remain available for manual completion, except the optional staff fields explicitly requested for individual FATCA. Schema counts include derived and workflow fields; they are not a count of unique paper questions.

## Limits and remaining manual review

New flat PDFs still require a person to review their mappings before publication. Four tested originals had no automatic suggestions. Some dense-table suggestions retain ambiguous slash captions or date-border positions that need correction. **The importer does not automatically produce a complete, semantically correct form from every PDF.** These suggestions are separate from the verified existing form definitions.

This was software regression and supplied-document/business-rule testing, not legal or regulatory certification. It does not establish the legal validity of uploaded signatures. Every defined option was checked against its source, but every possible input/option combination was not rendered. Physical devices, printers, load testing and a full penetration test were outside this run.

## Evidence

Sanitized results and deployment details are in [full-regression-verification.json](full-regression-verification.json). Detailed PDF/field evidence is retained in `tmp/pdfs/full-audit-20260919/`; client tests in `tmp/client-regression-1789848164456/`; management tests in `tmp/full-management-audit-1789848167568614000/`; review, navigation and signature checks in `tmp/full-audit-current/`. These artifacts contain synthetic test data and are not part of the public build.
