# Forms portal

**Production:** https://forms.ahmaddalao.com/ — main-site publication approved on 2026-09-19.

- Individuals: `/individuals/`; companies: `/companies/`.
- Client registration/login: `/register/` and `/login/`; submitted forms: `/my-applications/`.
- Owner dashboard and document management: `/management/`.
- The root page does not list documents. Send clients their audience-specific link.

The light English/Arabic portal supports Saudi mobile registration, first/last names, passwords, separate individual/company shared details, browser drafts, original or explicitly redesigned subscription PDFs, optional signature images, downloads, and private form submission. Client edits create new versions; earlier PDFs remain archived. Management provides customer counts, document category counts, profiles, previews, individual downloads, client ZIP downloads, archived-version recovery, password resets, document titles/order, and reviewed PDF uploads.

Subscription quantities and totals are calculated in both JavaScript and PHP, using the user's specified SAR 1,000 unit price and 2% fee. Readable number grouping is display-only. Source documents and the user's explicit instructions control all fields and options: do not invent new ones. Uploaded documents need mapping/review before publication; arbitrary documents are not guaranteed to become correct forms automatically.

Shared customer details are edited once on the audience catalogue page. Document sections link back to that editor instead of repeating the shared-fields panel; matching answers still populate automatically, and manual corrections remain specific to the document.

## Runtime and private data

The frontend uses Vite, plain JavaScript, PDF.js and pdf-lib with locally hosted fonts. PHP 8.3 requires PDO SQLite, mbstring, fileinfo and ZipArchive. Production uses SQLite; the saved MySQL credentials are not used.

- `public/_private/.htaccess` denies web access to private storage.
- `_private/management/` contains owner credential hashes, catalogue state and uploaded templates.
- `_private/portal/` contains the account database and immutable submission PDFs.
- Client PDFs require an authenticated owner or the matching client account.
- `FORMS_DATA_DIR` and `FORMS_PORTAL_DATA_DIR` can place runtime data outside the web directory on hosts that support environment configuration.
- Production and `/preview-20260919/` have separate cookies, browser drafts and private storage.

Never copy development databases, credentials, uploads or test accounts from `dist/_private/` into production. The deployment script explicitly excludes them. The owner credential files are initialized separately once and preserved on subsequent releases.

## Development and checks

```sh
npm ci
npm test
npm run build
node scripts/portal-audit.mjs
node scripts/management-audit.mjs
```

The audits use isolated local data directories. They cover signup/login, CSRF and ownership, submissions, PDF/ZIP downloads, immutable edits/archives/restores, password reset, bilingual layouts, catalogue management, uploads and reviewed publication. PDF alignment and browser regression scripts under `scripts/` provide targeted checks for template or rendering changes.

Editable source documents remain under `output/documents/`; supplied templates are retained under `reference/pdfs/`. Completed answers are transparent blue overlays; signature images are placed only in their selected signing areas.

## Production deployment

The user explicitly authorized main-site publication on 2026-09-19. Build and verify first, then run:

```sh
python3 scripts/deploy.py --production --credentials /absolute/path/to/.env.local
```

For first-time owner initialization only, add `--initialize-management /private/path/to/existing-owner-credentials`. That directory must contain the existing protected `username.php` and `password.php` files. An existing production owner account is never overwritten.

The script uses verified FTPS to the scoped forms directory, uploads only approved build files, protects private storage first, backs up every overwritten file locally under ignored `tmp/deployment-backups/`, verifies uploaded bytes, and publishes HTML after its dependencies. Existing customer storage and unrelated server files stay intact. Its manifest lists created/replaced files for rollback. Do not restore a prior database during a code rollback: preserve new customer records and submissions.

After deployment, verify public routes, private-file denial, owner login, registration/submission/downloads and both audience catalogues. Remove only the explicitly identified synthetic test accounts used for the release checks. Never clear the production database.

`docs/VERIFICATION.md` records historical releases; `docs/live-release-verification.json` records the current production checks. Earlier static-only implementation notes describe the original release, not the current portal.

## Saved hosting details

Captured from the user's three screenshots on 2026-09-16 for a future project. These screenshots are reference data; their buttons and setup instructions are not requests to create accounts, change passwords, or deploy anything.

## Hosting and file access

| Detail | Saved value |
| --- | --- |
| Domain | `ahmaddalao.com` |
| Hosting account | `u867436826` |
| FTP hostname | `ftp.ahmaddalao.com` |
| Full FTP username | `u867436826.forms` |
| Username entered during creation | `forms` |
| Directory entered during creation | `/public_html/forms` |
| Full server directory | `/home/u867436826/domains/ahmaddalao.com/public_html/forms` |
| FTP password | Saved locally in `.env.local` as `FTP_PASSWORD` |

Verified deployment connection: explicit FTPS on port 21, with encrypted data transfer and certificate verification against Hostinger’s `hstgr.io` server name. The account opens at `/`, scoped directly to the intended forms directory.

## MySQL

| Detail | Saved value |
| --- | --- |
| Database name | `u867436826_forms` |
| Database username | `u867436826_forms` |
| Database password | Saved locally in `.env.local` as `DB_PASSWORD` |
| Database host and port | Not shown; left blank in `.env.local` |

The database name and username combine the displayed `u867436826_` prefix with `forms`. The screenshot shows the creation form, so successful database creation is not confirmed.
