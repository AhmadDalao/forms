# Al Naeem Real Estate Fund — start here

## Latest update — five customer forms

The separate Terms and Conditions Consent Form (previously card 4) is hidden from both customer catalogues and new-upload choices. The five remaining cards are numbered 1–5; the complete 38-page terms still support reading, signing and submission. Existing consent PDFs, history, management access and notification signing/replacement flows are retained. No PDF, backend, review-mode or signature requirement changed. Evidence: `verification/hidden-consent-2026-10-15/`. Latest handover: `output/developer-handoff-2026-10-15-hidden-consent`.

## Same-day preview correction

The final frontend also fixes a delayed-account-sync race that could leave the original 38-page preview blank. Original document rendering survives shared-data updates; filled reviews still invalidate when answers change. The PDF and backend are unchanged. Reproduction and pixel-based verification are in `verification/terms-preview-fix-2026-10-15/`. The refreshed handover directory is `output/developer-handoff-2026-10-15-preview-fix`.

This fresh-install handover documentation was updated on 15 October 2026 for the owner's approved 38-page fund terms. It retains the original seven-page KYC templates, Riyadh address, current field fixes, schema 8 and optional reviews, off by default. The package contains the website, its source, tests, PDF templates and a private bootstrap with the existing **admin** and **superadmin** password hashes, with **no clients, shared client profiles, submitted forms or archived submissions**. Packaging validates every file and restores the clean schema-8 bootstrap; see MANIFEST.json and `verification/bootstrap-verification-2026-10-15.json`.

Only upload the contents of `website/` to the public website folder. Keep this ZIP and everything else private.

## 15 October — approved fund terms

The current T&C PDF contains all 38 supplied pages: eight introductory pages and 30 numbered pages. Investor name, date and one investor signature appear on physical page 38. Its version is `20261015-approved-terms`. Only the Riyadh address footer is added to the supplied body; KYC, signature and the website address are unchanged. The ten public PDF files now total 75 pages; the five current Word sources are unchanged.

Saved 13-page and retired 24-page terms remain readable and signable using their own definitions and PDFs. Old signatures are not consent to the new document. All 276 tests pass, with completed PDF, browser and live deployment verification. See `verification/approved-terms-2026-10-15/` and TEST-REPORT.md. The output is `output/developer-handoff-2026-10-15-preview-fix`.

## Historical release — 14 October, Riyadh address

7762 King Fahd Branch Road | 4162 Al Malqa District | Muath Tower | Riyadh 13521 | Kingdom of Saudi Arabia

The visible footer of the owner-supplied subscription PDF is the address authority. Its hidden text contains an obsolete Jeddah address and must not be copied. All ten public PDFs (50 pages), five current Word sources and the website default now use Riyadh. Only address areas changed; body designs and field/signature mappings are preserved. Evidence: `verification/riyadh-address-2026-10-14/`.

## Historical release — 14 October, editable website address

The superadmin can edit the national address from **Management → Website settings**. It appears in the footer throughout the website, including sign-in and registration. The setting is private, persistent and included in backups; fresh installs show the approved default. Other roles cannot change it. PDF addresses are maintained separately, and existing submissions retain their saved bytes. See `verification/website-settings-2026-10-14/` for the 265-test suite result and the focused browser/API checks, including conflicting edits and retry handling.

## Historical release — 7 October, national address on every form

All nine current form templates use the new Itqan national address: individual/company subscription, individual/company KYC, signature, consent, individual/company FATCA/CRS, and terms and conditions. The public legacy one-page subscription PDF also receives the address. Five editable Word sources match their PDFs. KYC now uses the owner's supplied seven-page PDFs; signature and terms also retain their original body designs. These four templates have no matching current Word source. Their address footer is updated, and saved submission bytes remain unchanged.

The address is maintained in `source/scripts/pdf-design/national-address.json`. The earlier Jeddah address is superseded by the Riyadh address above. The owner requested the original KYC PDF designs in place of their modern Word redesigns. `source/scripts/pdf-design/template-sources.json` identifies current sources; retired KYC Word/layout files are historical references and must never regenerate the current PDFs. Earlier address-only reports describe the pre-restoration templates.

The restored-KYC release passed 242 unit tests, 114 generated PDFs / 661 pages, 147 browser page/direction checks and 45 isolated workflow checks. All 14 blank KYC pages and 28 long English/Arabic filled pages were inspected, including fresh renders after spacing corrections. Current evidence is `verification/kyc-original-restoration-2026-10-07.json`; see TEST-REPORT.md for the scope and limits.

Before the original KYC restoration, the overlap/regression pass covered 114 fresh PDFs, 56 blank pages and 78 populated pages, with zero detected answer/signature ink collisions and 16 passing workflow suites. Its evidence is `verification/pdf-overlap-verification-2026-10-07.json`; it is historical evidence, not verification of the restored KYC templates.

## Where to start

- [INSTALL.md](INSTALL.md): requirements and the exact installation commands.
- [DOMAIN-SETUP.md](DOMAIN-SETUP.md): domain, HTTPS and hosting setup.
- [DEVELOPER-REVIEW.md](DEVELOPER-REVIEW.md): how the code works, where to make changes and what to check in a review.
- [REVIEW-WORKFLOW.md](REVIEW-WORKFLOW.md): the review switch, decisions, client follow-up and migration rules.
- [DATABASE.md](DATABASE.md): tables, private files, version history and backups.
- [TESTING.md](TESTING.md): repeatable test commands and the new-host acceptance checklist.
- [TEST-REPORT.md](TEST-REPORT.md): what was rerun for this delivery, what is earlier evidence and what remains to check on the destination host.
- [PERFORMANCE.md](PERFORMANCE.md): the measured first-visit delay and the hosting follow-up.
- [HOSTING-ACCESS.md](HOSTING-ACCESS.md): access to request from the hosting provider, including FTP limitations.
- [README-AR.md](README-AR.md) and [INSTALL-AR.md](INSTALL-AR.md): Arabic handover and setup notes.

## What is inside

| Folder or file | Use |
|---|---|
| `website/` | Ready-built website. Upload its contents, including hidden files. |
| `source/` | JavaScript, PHP, tests and build/setup/backup tools. |
| `private-bootstrap.zip` | Restore outside the web root to install the included management accounts and empty client database. |
| `SNAPSHOT.json` | Bootstrap date, counts and checksum. |
| `database/` | Empty SQLite schema examples for review; these do not contain the management logins. |
| `editable-documents/` | Five matching Word sources, nine current PDFs and the source-policy manifest. Original KYC, signature and T&C PDFs have no matching current Word source. |
| `verification/` | Dated test reports; older reports are historical evidence, not a description of today's UI. |
| `server/` | Optional Apache example for a self-managed server. Shared hosting normally supplies the web server. |
| `MANIFEST.json`, `SHA256SUMS.txt` | File inventory and checksums for this delivery. |

The application uses PHP and SQLite. There is no MySQL setup, Node production service, SMS/OTP provider or email service to configure. Use PHP 8.4 with the extensions in INSTALL.md; the code minimum is PHP 8.3.

Get management passwords from the owner privately. The bundle contains hashes, not plaintext passwords. This is not a publicly distributable starter kit with universal default credentials.

Each dated release has separate evidence; earlier results do not verify the new 38-page terms. The new hosting environment also needs its own acceptance check, especially private-path protection, PHP settings, HTTPS and the CDN security challenge described in PERFORMANCE.md.
