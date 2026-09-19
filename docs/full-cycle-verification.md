# Full cycle and regression verification — 19 September 2026

**Result: passed for the tested workflows.** The PDF importer correction is deployed at https://forms.ahmaddalao.com/ from commit `2dd84cba9340c3e61af1824026776c3031265603`.

“Regulation testing” was interpreted as regression testing at the start of this work. This report covers software behavior, access controls and document rendering; it does not certify legal or regulatory compliance.

## Coverage and results

| Area | Coverage | Result |
| --- | --- | --- |
| Build and unit checks | Production build, PHP syntax, 56 unit tests | Pass |
| Filled documents | Eight editable templates, five complete samples each: 40 downloads | Pass |
| Existing document layout | 30 PDFs, 190 pages, 1,495 text fields, 2,345 transparent answer images | Pass |
| Subscription layout | Ten PDFs, 20 pages, 572 answer images; zero detected overlaps with source ink | Pass |
| Signature placement | 30 signed/unsigned pairs, 190 pages, 70 signature placements | Pass |
| Cross-browser downloads | Six existing forms in Chrome, Firefox and WebKit: 18 combinations | Pass |
| Input direction | 264 typed-input checks and 48 English/Arabic downloads across three engines | Pass |
| Shared information | 24 document/audience/browser combinations; persistence, overrides, clearing and isolation | Pass |
| Responsive UI | 54 screenshots across English/Arabic, desktop and mobile; widths 320, 390, 768 and 1,440 | Pass |
| Management imports | Ten actual PDFs uploaded privately; 30 generated samples from detected fields; 150 answer images | Pass after correction |
| Local account cycle | Registration, login, submission, revision history, recovery, profile, admin and ZIP workflows | Pass |
| Hosted account cycle | Two temporary clients, 14 PDF versions across individual/company workflows | Pass |
| Production files | All ten hosted PDF assets match the local build byte for byte | Pass |

### Document verification

The six existing editable PDFs were filled with English, Arabic, long English, long Arabic and mixed answers. Individual and company subscriptions each received five separate cases, including shared data and maximum supported amounts. Blank-document downloads were checked separately.

Render checks compare generated pages with their source PDFs. They verify page geometry, original text preservation, answer bounds, transparency and signature placement. Representative rendered pages were also inspected visually for all eight editable templates. This combines automated checks across all tested pages with visual sampling; it is not a claim that every page was manually inspected.

Subscription cases cover required names, optional third name, editable applicant-name override, partial downloads from all four steps, offline/retry behavior, fixed unit price, fee, totals, Arabic amount words, invalid units, backend recalculation and manual/electronic signatures.

Download checks exercise the explicit save fallback when automatic downloading is blocked, preview, unchanged blank originals, retries, edited answers, clearing and oversized-answer recovery. Input tests cover email order, cursor editing, paste, leading zeros, phone/IBAN values, dates and saved-draft reloads.

### Account and management verification

Local and hosted cycles check:

- First/last-name registration, Saudi phone normalization, duplicates, password confirmation, login and logout.
- Client and owner access separation, CSRF, private PDFs, invalid uploads and cross-client access rejection.
- Signature and subscription submission, optional email capture, My applications, previews and individual downloads.
- Editing and resubmitting, immutable original PDFs, archived timestamps, stale-edit rejection, restoring a previous version, retry protection and replacement uploads.
- Separate individual/company histories and separate client accounts.
- Current-document and historical ZIP files, checking contents against stored PDF hashes.
- Admin password reset, strong temporary password, old-password/session revocation and mandatory password change.
- Profile updates, password visibility, keyboard modal focus/Escape, validation errors, mobile layouts and login throttling.
- Management title/order revisions, private drafts, review gates, publishing, rollback and a seventh document using a test catalogue.

Management mutations and real-file uploads ran against isolated local storage. The hosted cycle used only clearly identified temporary client accounts; it did not reset existing clients or change the production catalogue.

## Correction made

The flat-PDF importer proposed one answer area on the top edge of a box in the corporate KYC document. Its old collision check considered text baselines, which could miss printed glyphs extending into the proposed area.

The importer now uses font ascent/descent and transformed text height when rejecting overlapping suggestions. An independent PDF text-geometry assertion was added to the import audit. The false suggestion disappeared, and the rerun found **zero printed-text placement intersections and zero source-ink overlap files** across the generated import samples.

Existing form definitions, source PDFs and customer data were not changed by this fix. Audit scripts were also updated to match the current shared-field location, four-part names, scoped draft/signature storage and separate subscription workflow.

## Deployment and cleanup

The public build was uploaded over verified FTPS, with overwritten-file backups and read-back verification recorded in `deployment-manifest.json`. HTTPS routes, the current build, owner access, mobile layouts and blocked private storage were checked after deployment.

The live cycle created two temporary clients and 14 test PDFs. Targeted cleanup removed those clients and files, with a private database backup first. Original account/submission counts were restored, and SQLite integrity was `ok`. The temporary cleanup endpoint was removed. No credentials or client data are included in this report.

## Practical limits

Flat PDFs still require review and, where necessary, manual field mapping before publication. Four of the ten tested PDFs produced no automatic field suggestions; the review gate correctly prevented incomplete publication. The importer does not automatically understand every new document.

Browser coverage is desktop Chrome, Firefox and Playwright WebKit with mobile viewport tests. Native iOS/Android devices, load testing and a full penetration test were outside this run.

## Evidence

Sanitized totals are in `full-cycle-verification.json`. Detailed local artifacts are retained under `tmp/full-cycle/`, `tmp/subscription/audit/`, `tmp/management-real-files/`, `tmp/management-audit/`, `tmp/portal-audit/` and `tmp/ui-polish/`. These temporary directories include generated test PDFs, screenshots and private operational evidence and are not deployed.
