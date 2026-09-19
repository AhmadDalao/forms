# Hosted review installation

The `codex/client-portal` branch has a separate review installation at:

- `https://forms.ahmaddalao.com/preview-20260919/management/`
- `https://forms.ahmaddalao.com/preview-20260919/register/`
- `https://forms.ahmaddalao.com/preview-20260919/individuals/`
- `https://forms.ahmaddalao.com/preview-20260919/companies/`

This is a test copy, not a production rollout. Everything uploaded stays below the new `preview-20260919` directory in the scoped FTP account. The live root, `.htaccess`, and individual/company entrypoints are compared by SHA-256 before and after uploading. The production deployment script and main checkout are unchanged.

The browser's preview password prompt and the management sign-in use the separately configured `admin` credentials given to the owner. Passwords are excluded from version control. The local credential handoff file is `tmp/hosted-preview/credentials.json`, mode 0600. The server stores a Basic-auth bcrypt hash and a PHP management password hash, protected by `_private/.htaccess`.

The preview has its own SQLite database, catalogue storage, PDF submissions, cookie names/paths and browser-storage prefixes. Root and legacy `/forms/` drafts keep their original storage keys. Test pages have a visible preview label, `noindex` directives, and private/no-store response headers. The host runs PHP 8.3 with PDO SQLite, mbstring, fileinfo and ZipArchive. Uploaded PHP limits are 20 MB per file and 24 MB per request.

Deployment staging and scripts are in ignored `tmp/hosted-preview/`. Never copy an existing `_private` directory during an asset update: it contains the preview's credentials, accounts and submitted PDFs. Never replace its database when deploying a new build. The initial upload started with no users or submissions.

Local verification: all 53 unit tests, the full client-portal browser audit, and the catalogue-management browser audit pass. Hosted audit evidence is recorded separately in `docs/hosted-preview-verification.json`; screenshots and temporary test records stay under `tmp/hosted-preview/qa/`.
