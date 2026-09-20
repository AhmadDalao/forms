# Forms portal

**Production:** https://forms.ahmaddalao.com/ — main-site publication approved on 2026-09-19.

- Individuals: `/individuals/`; companies: `/companies/`.
- Client registration/login: `/register/` and `/login/`; submitted forms: `/my-applications/`.
- Admin and superadmin dashboard: `/management/`; document management and client account type changes are superadmin-only.
- The root page opens sign-in for visitors and redirects authenticated clients to their own category. Direct folder links require login too.

The light English/Arabic portal supports Saudi mobile registration, first/last names, passwords, separate individual/company shared details, browser drafts, original or explicitly redesigned subscription PDFs, optional signature images, downloads, and private form submission. Client edits create new versions; earlier PDFs remain archived. Management provides customer counts, document category counts, profiles, previews, individual downloads, client ZIP downloads, archived-version recovery, password resets, document titles/order, and reviewed PDF uploads.

Subscription quantities and totals are calculated in both JavaScript and PHP, using the user's specified SAR 1,000 unit price and 2% fee. Readable number grouping is display-only. Source documents and the user's explicit instructions control all fields and options: do not invent new ones. Uploaded documents need mapping/review before publication; arbitrary documents are not guaranteed to become correct forms automatically.

Customers enter their details inside the relevant fields of any form. There is no separate shared-fields panel to complete. Editing a mapped common field updates the account's shared customer profile and matching fields in the other working forms automatically. English and Arabic first, second, optional third and family names retain their separate parts and combine where the paper asks for a full name. Browser drafts and private account autosave both remain active; management can inspect the current saved profile. Individuals, companies and different accounts remain separate. Fields for other people, signatures and document-specific answers are not treated as the customer's common details.

Opening an existing submission or archived version restores that version's own answers without replacing the current customer profile. A deliberate edit to a mapped common field in that revision updates the profile and ordinary working drafts. The saved submission and archive remain immutable; saving the revision creates a new version. Merely opening, previewing or restoring history never changes shared details.

Submitting an online form saves its validated answers, the audience-specific shared customer details supplied with that submission, bilingual field/option/section labels, signature images and PDF as one version linked to the client account. Management’s client profile shows **Submitted details** with a form/version selector; the PDF preview uses the same complete field view. Unanswered fields are shown explicitly rather than silently omitted. Current and archived versions retain their own snapshots, including after restoration. A later profile edit, catalogue edit or form submission does not rewrite earlier data.

Older submissions display their saved answers and available shared details without rewriting historical records. If section metadata was not saved, available definitions are used for display. Uploaded completed PDFs remain downloadable and previewable; no extracted field data is invented for a PDF-only submission.

## Runtime and private data

The frontend uses Vite, plain JavaScript, PDF.js and pdf-lib with locally hosted fonts. PHP 8.3 requires PDO SQLite, mbstring, fileinfo and ZipArchive. Production uses SQLite; the saved MySQL credentials are not used.

- `public/_private/.htaccess` denies web access to private storage.
- `_private/management/` contains admin and superadmin credential hashes, catalogue state and uploaded templates.
- `_private/portal/` contains the account database and immutable submission PDFs.
- Client PDFs require an authenticated admin/superadmin or the matching client account.
- Blank templates and the published catalogue also require authentication. Clients receive only their own category and shared documents; management retains authorized preview access. The web server gates folder pages and original PDF URLs, not just the frontend.
- `FORMS_DATA_DIR` and `FORMS_PORTAL_DATA_DIR` can place runtime data outside the web directory on hosts that support environment configuration.
- The retired `/preview-20260919/` URLs redirect to the protected production routes; their private storage is preserved. Other explicitly configured preview roots keep separate session and draft scopes.

Never copy development databases, credentials, uploads or test accounts from `dist/_private/` into production. The deployment script explicitly excludes them. The owner credential files are initialized separately once and preserved on subsequent releases.

## Development and checks

```sh
npm ci
npm test
npm run build
node scripts/form-access-audit.mjs
node scripts/form-linking-audit.mjs
```

The access and form-linking audits use isolated local accounts and private data, with the same protected route behavior as production. Additional scripts under `scripts/` cover submissions, reviews, PDF/ZIP downloads, archives, layouts and document management. Older scripts that assume anonymous forms or a separate shared-fields panel describe the earlier workflow and need adaptation before use with this release; historical reports are not evidence of a current run.

Editable source documents remain under `output/documents/`; supplied templates are retained under `reference/pdfs/`. Completed answers are transparent blue overlays; signature images are placed only in their selected signing areas.

## Production deployment

The user explicitly authorized main-site publication on 2026-09-19. Build and verify first, then run:

```sh
python3 scripts/deploy.py --production --credentials /absolute/path/to/.env.local
```

For first-time owner initialization only, add `--initialize-management /private/path/to/existing-owner-credentials`. That directory must contain the existing protected `username.php` and `password.php` files. An existing production owner account is never overwritten.

The script uses verified FTPS to the scoped forms directory, uploads only approved build files, protects private storage first, backs up every overwritten file locally under ignored `tmp/deployment-backups/`, verifies uploaded bytes, and publishes HTML after its dependencies. Existing customer storage and unrelated server files stay intact. Its manifest lists created/replaced files for rollback. Do not restore a prior database during a code rollback: preserve new customer records and submissions.

After deployment, verify anonymous login redirects, denied PDF/catalogue reads, private-file denial, management login, authenticated registration/submission/downloads, and both audience catalogues. Check legacy preview and alternate-domain links too. Remove only the explicitly identified synthetic test accounts used for release checks. Never clear the production database.

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
