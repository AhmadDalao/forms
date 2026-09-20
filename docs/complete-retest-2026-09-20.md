# Complete retest — 20 September 2026

The audited software flows pass after six defects were corrected. This run used synthetic clients and private local fixtures; production clients, shared profiles, submissions, decisions and archives were not changed by testing.

## Fixes

1. Shared nationality now reaches individual KYC.
2. Shared company registration/licence number now reaches the corporate KYC registration field.
3. Ordinary English street names fit the three narrow FATCA individual street blanks. The original rectangles remain unchanged; their minimum font size is 5 pt. Excessive text still fails safely.
4. Telephone, email and URL PDF values use left-to-right direction, including telephone numbers written with Arabic digits and a leading plus.
5. The two individual KYC name boxes follow the complete name’s reading direction. Arabic first/second names start on the right; English starts on the left. Mixed-language chunks cannot collide.
6. Corporate KYC correspondence addresses use the full clear row, ending before the printed label. Complete shared national addresses now download without dropping components.

No fields, choices, legal text or original PDF pages were added or removed by these fixes.

## Paper and PDF coverage

- All 8 editable templates and the download-only consent: 43 active template pages reviewed.
- 555 schema fields inspected, including 112 UI-only name helpers; 423 mapped paper answer definitions. Derived targets and name helpers are not extra paper questions.
- 227 paper radio/checkbox choices, 8 subscription card choices, 21 dropdown options and 16 signature slots inventoried.
- Five complete fills for each editable template: English, Arabic, longer English, longer Arabic and mixed text. Additional blank, partial, shared-data and exhaustive option cases.
- 106 generated PDFs / 567 pages checked. All 423 mapped answer definitions and all 227 checkbox/radio options covered. All 16 signature positions exercised.
- 2,828 text placements, 1,006 checkbox placements and 32 signature placements checked. 3,229 added images have transparent backgrounds; answer ink is blue.
- Original page sizes/text retained; no changes outside mapped answer/approved placeholder spaces, opaque whiteouts, clipped text-image edges or missing expected ink in the tested corpus.
- 54 populated long-English/long-Arabic pages visually reviewed. Additional independent inspection of Arabic, English and both mixed-script name orders; country, street and full-address fit; telephone/email direction.
- Chrome, Firefox and WebKit independently pass Arabic-digit LTR rendering and produce PDFs for all four name-direction cases plus the full corporate address.
- Original supplied PDFs remain preserved byte for byte. The two subscription layouts and consent are the previously approved reconstructions.

See [field-by-field paper inventory](paper-field-match-verification.md) and [machine-readable results](complete-retest-2026-09-20.json).

## Shared information and accounts

All 57 editable shared fields (30 individual, 27 company) save exactly to the private account profile and restore in a fresh Arabic mobile browser, across Chrome, Firefox and WebKit. That is 171 field save/restore cases, plus six successful filled KYC downloads using the saved profiles. The final complete shared suite passes 21 groups with no browser errors or PDF failures.

The lifecycle suites also cover guest-to-account migration, account/category isolation, logout/login, server restarts, management visibility, intentional blank values, manual form overrides and Use shared value. Disjoint offline changes merge; conflicting edits require a visible choice that survives reload. Two offline tabs retain their separate queued changes after closing/reopening. Existing submitted data/PDF snapshots and archived versions stay immutable.

Shared details are account-backed. Unsaved document-specific working drafts remain local until the user saves or submits the form; an explicit per-form override does not silently rewrite the shared profile.

## Workflow and interface results

| Suite | Passing coverage |
| --- | --- |
| Unit/regression | 175 tests, zero failures |
| PHP syntax | 12 API files, including backend subscription calculator |
| Account/submission lifecycle | 9 groups; signup/login, actual form submissions, server totals, client/admin previews, PDF/ZIP, edit/resubmit, restore, ownership, immutable history, reset/session revocation |
| Review on/off | 8 groups; signature enforcement, unsigned tool saves, mode persistence, stale requests, re-enable and historical status preservation |
| Admin/superadmin | 12 groups; permissions, category change restrictions, catalogue publication/rollback, EN/AR navigation on 3 engines |
| Approvals/rejections | 10 groups; actor/time/reasons, locked approvals, current-only filters, pagination, notifications, stale concurrent actions, 3 engines |
| Account categories | 5 groups; assigned catalogues, opposite direct-link restrictions, management change and prior history |
| Passwords | 6 groups; 8-character minimum, confirmation, Unicode/byte bounds, reset/forced change, eye controls and strength meter on 3 engines |
| Document import | Native widget and flat-PDF cases, review gate, bilingual samples, seventh card, publication/rollback and both audiences |
| Signature controls | 96 browser/language/viewport/audience/document combinations, 9 signed PDFs; exact positions, transparency, manual clearing, required image enforcement and custom signature-only document |
| Navigation | 12 document/language cases plus 48 responsive cases; all steps visible, live counts, keyboard, previews and no horizontal clipping |
| Real typing | 264 keystroke/focus/direction checks and 48 EN/AR downloads on 3 engines |
| Four-part names | 18 UI/PDF groups; aligned desktop rows, mobile layout, optional third name, joined output and reload |

Broader backend lifecycle suites ran against the initial build; affected shared-field and PDF paths were rerun against the corrected final source/build. The backend was unchanged in this audit. Several old audit selectors/default assumptions were updated to match the already-existing four-part name controls and country defaults; those were test harness changes, not product defects.

## Limits and evidence

This is software and paper-consistency verification, not legal or regulatory certification. It covers the current curated templates and tested import fixtures, not every possible future upload or unlimited free-text length. Oversized answers must be corrected rather than allowed to cover printed content.

Raw synthetic PDF renders/reports are in `tmp/pdfs/current-audit-20260920/`; exact per-suite evidence paths and source hashes are in the JSON report. Production publication and HTTPS/browser checks are recorded below after completion.
