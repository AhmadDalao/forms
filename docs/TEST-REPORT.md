# Handover verification — 29 September 2026

The current application passed the checks below. This update changes the handover documentation and packaging, not the website, PDFs or database schema. Application code tested: `b4c4d160e92b9653227bae96af504335e9ce4167`. The delivery manifest records the later documentation/package commit and every packaged file's hash.

## Rerun for this delivery

| Check | Result |
|---|---|
| Unit tests, `npm test` | **236 passed, 0 failed, 0 skipped** |
| Production build, `npm run build` | **Passed** |
| PHP syntax | **26 files passed**, including API and setup/backup scripts |
| Admin handover audit | **6 checks passed**: role permissions, account creation, chosen password resets, session revocation and verified backup/restore |
| Customer workflow audit | **9 grouped checks passed**: both audiences/languages, form headers and final review pages, identity/signature controls, consent submission, upload replacement, versions, ZIP, notifications and profile save |
| Management views audit | **19 checks passed**: current/archived previews, downloads, roles, mobile, failed requests/retries, cancellation and session expiry |
| Loading audit, run separately | **5 checks passed**: delayed profile data does not block editing, in-flight edits survive, confirmed values reload and opening screens avoid eager PDF loading |

The browser suites used temporary local databases and synthetic accounts. They reported no browser errors. They did not edit production clients, accounts or submissions. The build emits large-chunk notices for the deferred PDF engines; these are not build failures or evidence that those engines load at login.

Exact grouped assertions and source-file hashes are in `verification/handover-verification-2026-09-29.json`. The fresh bootstrap is restored and initialized during packaging; its integrity, empty client tables and preserved credential-hash archive are checked in `verification/bootstrap-verification-2026-09-29.json`. `MANIFEST.json` and `SHA256SUMS.txt` cover the delivered files. ZIP integrity and source/build matching are checked before release.

## Earlier evidence retained with this delivery

These reports are dated **28 September**, and are not presented as new runs:

- `customer-workflow-verification.json`: actual input controls, reload, submission and management answer/PDF matching for all nine editable forms, plus shared/direct-submission checks.
- `current-documents-verification.json`: 36 presentations across nine forms, both languages and desktop/mobile; 2,232 field label/value/direction checks through the current management entry point.
- `roomy-cards-verification.json`: 186 responsive measurements across Chrome, Firefox and WebKit, individual/company, English/Arabic and card actions.
- `latest-client-preview-verification.json`: client previews resolve the latest version; management can still inspect history.
- Earlier `full-regression-verification.json` and PDF design reports: broader PDF generation, coverage and layout evidence. They describe earlier releases and may contain older page counts or UI descriptions. Read current customer-workflow reports when they differ.

No template or field mapping changed in this handover. A fresh exhaustive field-by-field PDF visual audit was **not** rerun today. Future field/template changes require the broader commands and visual checks in TESTING.md.

## Performance and destination-host acceptance

The live Hostinger check reproduced a browser challenge adding roughly four seconds on fresh automated visits. Login became usable in 4.5–4.9 seconds; a repeat visit took 0.3 seconds. Management took 0.4–0.8 seconds. Some fonts finished as late as 7.1 seconds. See PERFORMANCE.md and the raw timing report. We did not reproduce the full reported 20-second delay or change CDN security settings.

The package is ready for developer handover. **The new domain has not been deployed or accepted by these tests.** The receiving developer must still verify HTTPS, PHP extensions and limits, private-path denial, account isolation, upload/download, restore and cold/warm loading on that host. Local routing tests do not certify a provider's `.htaccess` behavior. Software testing does not certify legal compliance or the authenticity of uploaded signatures.
