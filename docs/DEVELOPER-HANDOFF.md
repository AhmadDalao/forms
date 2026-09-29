# Installing the forms portal

This package starts a new installation with the supplied admin and superadmin accounts. It does not migrate clients or submissions from the current site. The public application is unchanged from the latest delivered release; this handover consolidates the documentation and includes fresh verification.

## Hosting requirements

| Item | Requirement |
|---|---|
| Hosting | HTTPS on Apache 2.4 or compatible LiteSpeed, with working `.htaccess` rewrite, headers and MIME rules. Ordinary shared hosting is suitable when it provides these. |
| PHP | PHP 8.4 is suitable; minimum 8.3. Enable PDO, pdo_sqlite, mbstring, fileinfo, zip, JSON and sessions. Setup commands need PHP CLI or provider assistance. |
| Database | SQLite 3.27+ with JSON functions. No MySQL account is used. |
| Uploads | `upload_max_filesize=20M`, `post_max_size=24M`, `memory_limit=256M` or higher; allow `max_execution_time=120` for exports. Keep `display_errors=Off`. |
| Storage | Persistent local disk, writable private directories and PHP sessions. Do not put SQLite on a network share or ephemeral disk. |
| Build tools | Node 22.12+ or 24+ and npm, only when rebuilding source. No Node process is needed on production. |
| Browsers | Current Chrome, Edge, Safari or Firefox with JavaScript and cookies. |

Keep room for future uploads and backups. Each saved version may have a PDF up to 20 MB, and previous versions remain stored.

## Install on the new domain

1. Configure the domain and HTTPS using DOMAIN-SETUP.md. Keep the new site restricted until acceptance checks pass.
2. Upload **only the contents of `website/`**, including `.htaccess` and `.user.ini`, to the document root. Do not upload the complete handover or its private archives there.
3. Put `source/` and `private-bootstrap.zip` outside the document root. From `source/`, run:

```sh
php scripts/restore-installation.php /private-transfer/private-bootstrap.zip /srv/alnaeem/private
php scripts/installation-init.php /srv/alnaeem/private
```

Replace the example paths with the host's actual paths. Restore requires a destination that does not exist. It checks archive paths, checksums and SQLite integrity before the destination can be used. Initialization applies compatible migrations without clearing records.

4. Set these variables in the **PHP web runtime**, not just in your SSH shell:

```text
FORMS_DATA_DIR=/srv/alnaeem/private/management
FORMS_PORTAL_DATA_DIR=/srv/alnaeem/private/portal
```

On PHP-FPM use the pool's `env[...]` settings or the provider's supported equivalent. On shared hosting ask the provider how to expose these variables to PHP. The Apache example is optional; it is not something the client must install on their PC. Nginx needs equivalent access/rewrite rules and is not a ready-configured deployment in this package.

5. Give the PHP service user access to both private directories and the session directory. Private directories should be `0700` and files `0600` where the hosting ownership model allows it. Do not use `0777`. PHP must see HTTPS correctly for secure cookies.
6. Sign in at `/management/` with the owner's existing admin and superadmin credentials. Confirm the role controls and zero client/submission counts. Run TESTING.md against this restricted installation.
7. After testing with synthetic accounts, use a new restore of the clean seed for the public launch. Never replace a database with the empty seed after real users start registering.

Copying `database/clients.sqlite` alone does not install the management accounts. Use `private-bootstrap.zip`. Its guarded credential files contain password hashes, and additional admins live in `administrators.sqlite`. Obtain the passwords privately from the owner.

## Build or run locally

From `source/`:

```sh
npm ci
npm test
FORMS_SITE_URL=https://forms.example.com/ npm run build
```

Change the example URL to the destination domain. The supplied prebuilt HTML already omits the old canonical URL. Publish the public files from `dist/` after rebuilding; preserve the production private directories.

For a local browser check, build first and use separate test storage:

```sh
php scripts/installation-init.php /tmp/alnaeem-preview
FORMS_DATA_DIR=/tmp/alnaeem-preview/management FORMS_PORTAL_DATA_DIR=/tmp/alnaeem-preview/portal php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8181 -t dist scripts/management-router.php
```

This local initialization creates empty databases, not the included management accounts. Restore the private seed into a new local directory if those accounts are needed. The automated browser tests create their own synthetic accounts and private storage. PHP's localhost server is for development; the hosting provider's web server serves production.

## Current behavior to expect

- Visitors must sign in. Clients land on the individual or company forms catalogue matching their account.
- The catalogue has two roomy columns on desktop and one on phones. Each card provides blank download, filled download and filled-PDF upload. Current filled files can also be downloaded as a ZIP.
- Profile is for account details and passwords. `/my-applications/` remains a legacy alias.
- All nine templates are editable online. Consent has its own editor. T&C starts with its complete original 13-page document. Both T&C and the signature template retain their original PDFs.
- Final review shows the generated PDF, then one Submit form action. Unsigned initial forms are accepted. They become Received by default, or Under review when the superadmin selects Under review on the dedicated Submission settings page. Submit only hides review counters on Dashboard and Received applications. Existing open cases remain accessible and continue after review is turned off. Signature status is separate; uploaded replacements remain identifiable as uploads. See REVIEW-WORKFLOW.md.
- Management reviews a client's documents from Current documents → Preview & details. Categorized answers start collapsed. The separate details card and shared-profile display were removed; stored data was preserved.
- Client notification previews open the latest saved PDF and do not show archive labels or duplicate downloads. Management keeps version history.
- With review off, client cards/previews show Received and signature status; decision labels and approval/rejection notes disappear. Notifications use Form update without decision text. Already-issued correction/signature actions and their instructions remain usable. Toggling the setting does not rewrite saved decisions or close an open client PDF preview.
- Superadmin can create admins, choose/reset passwords, manage the document catalogue and change client account types. Ordinary admins cannot perform those superadmin actions. Client password resets force a private replacement at the next sign-in and revoke old sessions.

Read DEVELOPER-REVIEW.md before changing sharing, PDF mappings or version handling. The source forms and the owner's approved changes determine fields; tests are not legal or regulatory certification.

## Backups and updates

From `source/`, with access to private storage:

```sh
php scripts/backup-installation.php /srv/alnaeem/private/management /srv/alnaeem/private/portal /srv/alnaeem/backups/snapshot-YYYYMMDD.zip
```

This takes a consistent database snapshot with the related files. Do not copy a running SQLite file alone. Restore into a new private directory and verify before switching paths.

Before an upgrade, back up the public build and private storage. Deploy the public build as a complete release, apply supported migrations if needed and run the acceptance checks. Do not overwrite production storage with local test data. For rollback, restore the previous public build; restore older data only through an explicit recovery plan that accounts for newer submissions.

Existing browser-only drafts belong to the old browser and origin. They do not migrate to a different domain. Account-saved shared values and submitted versions can be migrated separately if that is requested later; they are intentionally absent from this fresh package.
