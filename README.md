# Forms portal — Al Naeem Real Estate Fund

A bilingual client portal for individual and company forms. The frontend is plain JavaScript built with Vite; PHP handles accounts and private storage using SQLite. PDF generation and previews run in the browser.

## Start here

- [Developer code review](docs/DEVELOPER-REVIEW.md)
- [Installation](docs/DEVELOPER-HANDOFF.md) and [Arabic notes](docs/DEVELOPER-HANDOFF-AR.md)
- [Testing guide](docs/TESTING.md) and [latest test report](docs/TEST-REPORT.md)
- [Optional review workflow](docs/REVIEW-WORKFLOW.md)
- [Database and private storage](docs/DATABASE-HANDOFF.md)
- [Performance findings](docs/PERFORMANCE.md)

Run `npm ci`, `npm test` and `npm run build`. PHP 8.3+ with the extensions in the installation guide is required for APIs and integration tests. Node is a build/test dependency, not a production web service.

Review is optional and off by default. New forms are Received, or Under review when superadmin enables reviews from the navigation bar. Admins can approve, reject, request corrections or request signatures, with in-app notes and versioned follow-up. Signature status stays separate. All nine templates can be filled online. Common customer details synchronize across matching ordinary drafts and the account; submissions and their archived versions keep their own snapshots. Client notification previews open the latest PDF. Management reviews categorized answers from Current documents.

This handover is a fresh installation with admin and superadmin, without existing clients or submissions. The private bootstrap is transferred separately inside the private handover ZIP and is deliberately excluded from Git. Production credentials, SQLite files, submitted PDFs, backups and delivery ZIPs must never be committed or published under the web root.

Only deploy the public build. Preserve production private storage and take a backup before replacing files. Uploaded or changed templates require mapping and filled-PDF review; uploading a PDF alone does not prove it is a correct editable form.
