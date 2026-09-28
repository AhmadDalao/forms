# Al Naeem Real Estate Fund — developer installation guide

This delivery contains the application, editable sources and a clean database. The **separate private migration ZIP** contains existing client accounts, shared profiles, submissions, earlier versions, PDFs, catalogue configuration, uploaded templates and hashed administrator credentials. Treat that ZIP as confidential account data. Transfer it privately; never upload either delivery ZIP, source code, Word files or databases into a publicly downloadable directory.

## 1. Requirements

| Component | Requirement |
| --- | --- |
| Web server | Apache 2.4 or compatible LiteSpeed, with `mod_rewrite`, `mod_headers`, `mod_mime` and `.htaccess` overrides enabled. HTTPS required. |
| PHP | PHP 8.3 or newer; PDO, `pdo_sqlite`, `mbstring`, `fileinfo`, `zip`, JSON and sessions. CLI PHP is used for setup/restore. |
| Database | SQLite 3.27+ with JSON functions. No MySQL database, username or password is needed. |
| PHP limits | `upload_max_filesize=20M`, `post_max_size=24M`, `memory_limit=256M` or higher, `max_execution_time=120` for migration export. `display_errors=Off`; private server logs. |
| Filesystem | Persistent local disk writable by the PHP user for the two private data directories and PHP sessions. SQLite databases and their parent directories must be writable. Do not use an ephemeral container filesystem or network-shared SQLite storage. |
| Build tools | Only for source changes: Node.js 22.12+ (or 24+) and npm. No Node service is required to serve the prebuilt website. |
| Client | Current Chrome, Safari, Firefox or Edge with JavaScript, cookies and canvas. Forms/PDF rendering run in the browser. |
| External services | No mail, SMS, AI provider or payment API credentials are required. Registration uses Saudi mobile numbers; it does not send OTP messages. |

Allow space for the delivered files, existing private data and backups, plus growth. Each submitted version can contain a PDF up to 20 MB; old versions remain saved. A single PHP/web-server deployment with persistent storage is the supported starting configuration.

## 2. What to upload

```text
developer-handoff/
  website/              Ready-to-serve public build — only this goes in the web root
  source/               Editable application, tests, build/setup/backup scripts
  database/             Empty clients.sqlite, administrators.sqlite and schema SQL
  editable-documents/   Maintainable Word source documents — private, not web content
  server/               Apache vhost example
  INSTALL.md            This guide
  INSTALL-AR.md         Arabic setup notes
  MANIFEST.json         File sizes and SHA-256 checksums
private-migration.zip   Separate confidential snapshot of the existing installation
```

Recommended layout on the new server:

```text
/srv/alnaeem/public/       Contents of website/
/srv/alnaeem/source/       Contents of source/ (optional on production)
/srv/alnaeem/private/      Restored management/ and portal/ directories
/srv/alnaeem/backups/      Private backups, not served by Apache
```

Set the site's document root to `/srv/alnaeem/public`. Do **not** point it at `/srv/alnaeem` or the handoff folder. Hidden `.htaccess` and `.user.ini` files must be copied. `website/api/*.json` are internal server schema files and must remain denied by the web-server rules.

## 3. Restore the existing installation (recommended for this delivery)

1. Keep the new site inaccessible while restoring. Place the migration ZIP outside the web root.
2. From the delivered `source/` directory run:

   ```sh
   php scripts/restore-installation.php /private-transfer/private-migration.zip /srv/alnaeem/private
   php scripts/installation-init.php /srv/alnaeem/private
   ```

   The restore command requires a **new, nonexistent destination**. It checks archive paths, checksums, database integrity, row counts and every submitted PDF hash. The initialization command applies compatible migrations and preserves existing data. Never overwrite an active database with the empty database included in `database/`.

3. Configure PHP environment variables in the vhost/PHP-FPM pool:

   ```text
   FORMS_DATA_DIR=/srv/alnaeem/private/management
   FORMS_PORTAL_DATA_DIR=/srv/alnaeem/private/portal
   ```

   For Apache `mod_php`, use the supplied `server/apache-vhost.conf`. For PHP-FPM, set `env[FORMS_DATA_DIR]` and `env[FORMS_PORTAL_DATA_DIR]` in the pool configuration, restart the pool, and verify PHP receives them. Secure cookies depend on PHP seeing `HTTPS=on`; terminate TLS at this server or configure a trusted proxy correctly. Do not infer HTTPS from arbitrary incoming forwarded headers.

4. Give the PHP service user ownership of private storage. Prefer directory permissions `0700` and file permissions `0600`; never `0777`. Public files should be readable by the web server but not writable by anonymous users. Keep private storage on persistent local disk.
5. Existing client and management passwords continue to work because only their hashes migrate. Request the current superadmin credentials from the owner through a private channel. They are **not** included as plaintext. PHP session files are intentionally excluded; everyone signs in again on the new host.

## 4. Fresh installation instead

Skip this section when preserving existing accounts. The included `database/` is for a separate empty installation only.

```sh
php scripts/installation-init.php /srv/alnaeem/private
php scripts/management-superadmin-init.php /srv/alnaeem/private/management YOUR_CHOSEN_USERNAME < /secure/superadmin-password.txt
```

Write the chosen password into that private file with permission `0600`, never into a shell command/history. Bootstrap currently requires 14–72 bytes; dashboard-created admin and client passwords require at least eight characters, with a 72-byte maximum. Remove the temporary password file after storing credentials securely. There is no default account. From `/management/`, the superadmin can create ordinary admins under **Administrators** and choose their passwords. Ordinary admins cannot create accounts, alter the catalogue or change client account types.

## 5. New domain and source builds

Routes work on the new origin. The supplied prebuilt HTML omits the old site's canonical URL. To rebuild with the new canonical domain:

```sh
npm ci
npm test
FORMS_SITE_URL=https://forms.example.com/ npm run build
```

Publish the contents of `source/dist/` as public files. Never copy a local development `_private/` directory over live private storage. Set the environment variable on every build for the destination domain. The historical redirect for the original domain is host-scoped and does not redirect a different installation to that domain.

For local preview, build first and use an isolated private directory:

```sh
FORMS_DATA_DIR=/tmp/alnaeem-preview/management FORMS_PORTAL_DATA_DIR=/tmp/alnaeem-preview/portal php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8181 -t dist scripts/management-router.php
```

The PHP development server is for localhost testing, not public production. Nginx is not configured by this delivery: an Nginx deployment must implement the same login gates for `/`, `/individuals/`, `/companies/`, original PDF URLs and private/API schema denial before exposing the site. Apache/LiteSpeed is the supported ready-to-upload option.

## 6. Data and behavior

- `portal/clients.sqlite`: accounts, shared profiles, submitted field/label snapshots, version chains, signature data, audit events and historical decisions. `portal/pdfs/`: immutable PDF files named by submission ID. Both are required to restore a complete installation.
- `management/state.json` and `management/uploads/`: catalogue drafts/publication history and custom blank PDFs. The build supplies curated default templates. Preserve both private paths during updates.
- `management/administrators.sqlite`: additional admin hashes and account-management audit records. Protected credential PHP files retain the legacy admin and bootstrap superadmin hashes. No plaintext passwords are stored.
- Current operation is direct submission with **Received** status. Historical decisions remain readable. Signature status is separate. Clients can submit replacements; earlier versions stay archived.
- Shared customer values save to the account and browser, scoped to client and individual/company audience. Document-specific unsent drafts remain on the original browser. **A server migration cannot transfer unsent local-only drafts or browser storage to a different domain.** Account-saved shared details and submitted versions are included.
- Password resets accept a chosen password and confirmation, end old sessions and record the administrator. Client resets use a temporary password; the client must choose a private replacement on next sign-in. Admin reset changes invalidate the affected admin's sessions.
- The UI and PDF mappings follow supplied forms. Imported/new PDFs require mapping and visual review before publication; upload alone does not guarantee accurate fields.

## 7. Acceptance checks before opening the new site

1. Without login: `/` and category pages redirect to sign-in; `/pdfs/subscription-individual.pdf`, API catalogue/schema files and `/_private/` cannot expose data. Direct index URLs must be protected too.
2. Confirm English/Arabic login and signup, eight-character password minimum, confirmation and visibility controls. Test a new synthetic individual and company; each sees only the correct catalogue.
3. Sign in as superadmin, check migrated client/submission/archive counts against the private ZIP manifest, preview/download a current and archived PDF, and download a client ZIP. Existing data must remain unchanged.
4. Create a test admin through **Administrators**. Confirm it can view clients/forms but cannot create admins, change client account types or edit/publish documents. Reset its password and verify its previous session is revoked.
5. For a synthetic client, fill Arabic and English names, phone/email and address in one form; open another and confirm matching shared fields. Reload and sign in from a fresh browser to confirm account restoration. Keep representatives and tax addresses separate.
6. Fill and preview every form in both languages. Check PDF labels, radio/checkbox marks, blue text, complete names and LTR email/telephone values. Test risk answers and totals, subscription calculations, unsigned submission, resubmission, archived version and PDF/ZIP download.
7. Test chosen client-password reset and forced client change. Test logout and anonymous denial again.
8. After acceptance, arrange final cutover with the owner. If the original site continued receiving data after this snapshot, take a **fresh export during the cutover window** and restore into a new private directory. Never point both servers at one SQLite file. Do not assume this delivery contains submissions created after its manifest timestamp.

## 8. Backups, upgrades and rollback

Create a consistent snapshot (CLI, run as the PHP storage owner):

```sh
php scripts/backup-installation.php /srv/alnaeem/private/management /srv/alnaeem/private/portal /srv/alnaeem/backups/snapshot-YYYYMMDD.zip
```

Superadmin-authenticated `POST /api/management.php?action=export_backup` with the management session's `X-CSRF-Token` offers the same private ZIP over HTTPS. It is not a public download URL. Export uses SQLite's consistent snapshot operation, verifies PDF hashes and removes temporary server files after streaming. A concurrent submission after the snapshot belongs to the next backup.

Back up both public build and private data before upgrades. Replace public build files only, then run setup migrations and acceptance checks. For rollback, restore the earlier public build; do not replace the database with an older snapshot and lose new submissions. Test any data restoration in a new directory and compare counts/hashes first. Keep backups encrypted in transit and in storage using the organization's normal secure transfer/backup system.

Browser preview fixes do not alter stored or downloaded PDFs. Keep PHP/database/PDF errors in private server logs and return generic failures to users. No legal or regulatory certification is implied by software tests.

## 9. Developer verification and template maintenance

The delivered source includes the application tests and portable migration/admin audits. Install browser engines once with `npx playwright install`; the Chrome-channel tests also need Google Chrome installed. After `npm ci` and `npm run build`:

```sh
npm test
node scripts/admin-handoff-audit.mjs
node scripts/form-access-audit.mjs
node scripts/management-views-audit.mjs
node scripts/loading-audit.mjs
QA_OUT=tmp/client-corrections-pdfs node scripts/current-pdf-audit.mjs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/client-corrections-audit.mjs
PDF_AUDIT_OUTPUT=tmp/client-corrections-pdfs node scripts/direct-intake-audit.mjs
node scripts/preview-direction-audit.mjs
```

These scripts start disposable local fixtures; they must not be aimed at production. To verify the generated PDFs independently, install Python 3 with `pypdfium2`, `pypdf`, `Pillow` and `numpy`, then run `python3 scripts/current-pdf-audit-verify.py tmp/client-corrections-pdfs`. These are development tools, not production requirements.

The eight editable Word/PDF pairs and the original Terms & Conditions PDF are in `editable-documents/`. The subscription templates remain the approved reference. Six other documents use the same typography, purple section bars, tables and answer color. Their current page counts are: signature 2, individual KYC 14, company KYC 11, individual FATCA/CRS 9, company FATCA/CRS 8, terms 13 (original), and consent 1. Additional pages preserve readable content and signing space. Consent remains download-only.

Terms & Conditions was restored to the exact original 13-page PDF at the owner’s request. It has no matching editable Word source. The retired 24-page Word/PDF files are clearly marked under `source/reference/documents/archived/` for historical reference only. The builder and installer exclude Terms & Conditions, including stale generated output. Its active version is `20260928-original-2`; fields and signatures use the original positions.

Original supplied PDFs are retained under `source/reference/pdfs/`. The immutable Word style reference and pre-redesign field definitions are under `source/reference/documents/`. Source declarations/instructions and their extraction locations are recorded in `source/scripts/pdf-design/source-text.json`; do not silently rewrite legal wording when changing presentation.

To regenerate the six redesigned templates, install Python 3 with `python-docx` and `pdfplumber`, LibreOffice, and Poppler (`pdftoppm`). Install the reference typefaces **Bahij TheSansArabic Plain** and **Arial** with appropriate font rights. The Word packages retain the embedded Arabic font; check exported PDFs for font substitution on a different workstation. These dependencies are for document authoring only, not the production website.

From `source/`, edit `scripts/pdf-design/build.py` and the intended wording sources, then run:

```sh
python3 scripts/pdf-design/build.py
python3 scripts/pdf-design/verify.py
# Inspect every page under tmp/modern-pdfs/*/final/ before installation.
python3 scripts/pdf-design/install.py
npm test
npm run build
QA_OUT=tmp/pdf-release node scripts/current-pdf-audit.mjs
python3 scripts/current-pdf-audit-verify.py tmp/pdf-release
PDF_AUDIT_OUTPUT=tmp/pdf-release node scripts/direct-intake-audit.mjs
node scripts/management-views-audit.mjs
```

`--only signature-form` (or comma-separated IDs) limits regeneration. The builder creates editable text, exports final/probe PDFs and measures field coordinates from the probe. `DOCX_RENDERER` can optionally point to a compatible custom rendering script. The installer updates public PDFs, Word sources, hashes and `src/forms/modern-layouts.json` together. Manual Word edits require a matching coordinate update and renewed verification; never replace a PDF alone while keeping its old overlay map. For future releases, bump the version in the builder and consent catalogue entry before installing revised templates.

New submissions store a server-owned PDF-layout snapshot. Stored and archived PDF bytes are never regenerated during deployment. `scripts/pdf-design/legacy-signing-layouts.json` preserves the old positions for submissions predating layout snapshots: **do not replace it with today's coordinates**. An old browser tab is blocked from submitting against a replaced template and asked to reload/review its retained draft. Re-test both historical and current signature replacement after any PDF change.
