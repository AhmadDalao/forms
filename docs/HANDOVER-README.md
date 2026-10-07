# Al Naeem Real Estate Fund — start here

This fresh-install handover documentation was updated on 7 October 2026 for the national-address footer update across all current forms. The previous tested baseline is 30 September 2026: larger, single-line client names in Received applications, schema 8 and optional reviews, off by default. The handover contains the website, its source, tests, PDF templates and a private bootstrap with the existing **admin** and **superadmin** password hashes. It contains **no clients, shared client profiles, submitted forms or archived submissions**.

Only upload the contents of `website/` to the public website folder. Keep this ZIP and everything else private.

## 7 October — national address on every form

All nine current form templates use the new Itqan national address: individual/company subscription, individual/company KYC, signature, consent, individual/company FATCA/CRS, and terms and conditions. The public legacy one-page subscription PDF also receives the address. Five editable Word sources match their PDFs. KYC now uses the owner's supplied seven-page PDFs; signature and terms also retain their original body designs. These four templates have no matching current Word source. Their address footer is updated, and saved submission bytes remain unchanged.

The address is maintained in `source/scripts/pdf-design/national-address.json`. The owner confirmed **Prince Naif Branch** and subsequently requested the original KYC PDF designs in place of their modern Word redesigns. `source/scripts/pdf-design/template-sources.json` identifies current sources; retired KYC Word/layout files are historical references and must never regenerate the current PDFs. Earlier address-only reports describe the pre-restoration templates.

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

The 7 October national-address refresh is documented separately from the earlier September full-system evidence. The new hosting environment also needs its own acceptance check, especially private-path protection, PHP settings, HTTPS and the CDN security challenge described in PERFORMANCE.md.
