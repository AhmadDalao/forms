# Deploying on your own domain

Use this with `INSTALL.md` (full requirements) and `DATABASE.md` (data layout). The ready-built site works on a new domain without a Node server. This guide assumes a domain or subdomain root, for example `https://forms.example.com/`.

## Values your developer needs from the hosting provider

| Value | Where it is used |
|---|---|
| Chosen domain/subdomain | DNS, hosting website entry, HTTPS certificate and optional canonical URL |
| Server IPv4 address; IPv6 only if supported | DNS A record; optional AAAA record |
| Website document-root path | Copy the **contents** of `website/` here |
| Private persistent directory outside the document root | Restore the fresh SQLite database and included admin/superadmin credentials here |
| PHP 8.3+ service user/pool | File ownership, environment variables, sessions and upload limits |
| Existing superadmin sign-in | Obtain privately from the project owner; passwords are not printed in this package |

## 1. Domain and HTTPS

1. Create the website/domain in the new hosting control panel. Choose PHP 8.3 or newer on Apache or compatible LiteSpeed. Enable the extensions and limits listed in `INSTALL.md`.
2. At the authoritative DNS provider, point the chosen hostname's A record to the new server IP. Add AAAA only when the host supplies working IPv6; remove stale conflicting records for that hostname. If using hosting nameservers, make the records in that provider's DNS zone instead.
3. Issue a valid HTTPS certificate for the exact hostname. Configure HTTP-to-HTTPS redirection through the hosting panel or server configuration. PHP must receive the correct HTTPS state so secure session cookies work.
4. For a self-managed Apache server, adapt `server/apache-vhost.conf`: domain, document root, certificate paths, PHP handler and private storage paths. For PHP-FPM, set storage variables in its pool as described in `INSTALL.md`.

## 2. Upload the public files

Extract the handover privately first. Upload **only the contents of `website/`**, including `.htaccess` and `.user.ini`, into the chosen document root, such as `/srv/alnaeem/public/` or the hosting account's `public_html/`.

Do not upload the complete handover ZIP, `source/`, `database/`, `editable-documents/` or `private-bootstrap.zip` into the document root. Keep private restore/setup scripts outside it. Enable `.htaccess` overrides and the required rewrite/header modules before testing public access.

No build is needed for the supplied `website/`. If rebuilding after source changes, from `source/` run:

```sh
npm ci
npm test
FORMS_SITE_URL=https://forms.example.com/ npm run build
```

Replace the example hostname. Publish `source/dist/` public files; never overwrite existing private storage with a development directory. The supplied ready build has the old canonical URL removed, and routes use the current origin. Business/legal links inside the source documents remain as supplied.

## 3. Install the fresh database and included management accounts

Keep the new website restricted until setup is complete. Copy `private-bootstrap.zip` to a private transfer directory. From `source/`:

```sh
php scripts/restore-installation.php /private-transfer/private-bootstrap.zip /srv/alnaeem/private
php scripts/installation-init.php /srv/alnaeem/private
```

The restore destination must not already exist. Replace all example paths with the actual hosting paths. Set these values in the PHP runtime, not merely in an interactive shell:

```text
FORMS_DATA_DIR=/srv/alnaeem/private/management
FORMS_PORTAL_DATA_DIR=/srv/alnaeem/private/portal
```

Ensure the PHP service user owns the private directories, with private directories `0700` and files `0600`. Verify PHP sessions have a writable private path. If the hosting panel does not expose PHP environment configuration, ask the provider to configure these two values; do not solve it by exposing the database in a public directory.

Use `private-bootstrap.zip` for this fresh installation. It contains the existing `admin` and `superadmin` hashes but no clients, shared profiles or submissions. `database/` contains unprovisioned schema examples and must not replace the restored seed. No sessions or old management activity are included.

## 4. Verify the new domain

Run the acceptance checklist in `TESTING.md`. At minimum:

- Visit `/` without signing in: it should lead to login. Direct category, template and private-data links must remain protected.
- Check `/login/`, `/register/`, `/individuals/`, `/companies/`, `/account/` (with `/my-applications/` as a legacy alias) and `/management/`. A client must see only their account category.
- Sign in as both included management accounts. Compare with `SNAPSHOT.json`: zero clients, zero submissions, zero archived versions. Verify the superadmin-only controls. Use synthetic clients and new submissions to test preview/download and ZIP behavior before opening registration.
- With synthetic accounts, verify shared data, a new submission, replacement/archive behavior and passwords. Check both languages and a phone-sized screen.
- Confirm Submission settings starts in Submit only mode. Using synthetic accounts, test unsigned Received, then enable review as superadmin and test correction, signature replacement, approval and rejection for both audiences. Turn it off and confirm ongoing cases still work. Leave it off for launch unless the owner chooses otherwise.
- Confirm source ZIPs, SQLite files and `api/*.json` schema files cannot be downloaded anonymously.

## 5. Launch the fresh installation

This edition intentionally starts empty. Do not restore client records from the original site. Keep that site and its backups intact. Finish acceptance checks with synthetic clients, then restore the clean seed into a new private directory and switch the PHP paths before public launch. Never overwrite a live database with the empty seed after real clients begin registering.

For the access checklist and FTP-only limitations, see `HOSTING-ACCESS.md`.

## شرح مختصر بالعربية

اربط النطاق وفعّل HTTPS وPHP 8.3 أو أحدث. ارفع محتويات `website/` فقط، واستعد `private-bootstrap.zip` خارج المجلد العام. اضبط `FORMS_DATA_DIR` و`FORMS_PORTAL_DATA_DIR` في PHP. تحتوي الحزمة حسابي `admin` و`superadmin` بكلمات مرورهما الحالية، دون عملاء أو طلبات أو أرشيف. لا تستورد بيانات الموقع القديم، ولا تستبدل بيانات الموقع الجديد بعد بدء التسجيل بقاعدة فارغة. راجع `README-AR.md` و`HOSTING-ACCESS.md`.
