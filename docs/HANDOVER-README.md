# Al Naeem Real Estate Fund — start here

This is the fresh-install handover dated 29 September 2026. It contains the current website, its source, tests, PDF templates and a private bootstrap with the existing **admin** and **superadmin** password hashes. It contains **no clients, shared client profiles, submitted forms or archived submissions**.

Only upload the contents of `website/` to the public website folder. Keep this ZIP and everything else private.

## Where to start

- [INSTALL.md](INSTALL.md): requirements and the exact installation commands.
- [DOMAIN-SETUP.md](DOMAIN-SETUP.md): domain, HTTPS and hosting setup.
- [DEVELOPER-REVIEW.md](DEVELOPER-REVIEW.md): how the code works, where to make changes and what to check in a review.
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
| `editable-documents/` | Seven Word sources and nine current PDF templates. Original signature and T&C PDFs have no matching Word redesign. |
| `verification/` | Dated test reports; older reports are historical evidence, not a description of today's UI. |
| `server/` | Optional Apache example for a self-managed server. Shared hosting normally supplies the web server. |
| `MANIFEST.json`, `SHA256SUMS.txt` | File inventory and checksums for this delivery. |

The application uses PHP and SQLite. There is no MySQL setup, Node production service, SMS/OTP provider or email service to configure. Use PHP 8.4 with the extensions in INSTALL.md; the code minimum is PHP 8.3.

Get management passwords from the owner privately. The bundle contains hashes, not plaintext passwords. This is not a publicly distributable starter kit with universal default credentials.

The application is ready for developer handover. The new hosting environment still needs its own acceptance check, especially private-path protection, PHP settings, HTTPS and the CDN security challenge described in PERFORMANCE.md.
