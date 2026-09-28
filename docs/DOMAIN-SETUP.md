# Deploying on your own domain

Use this with `INSTALL.md` (full requirements) and `DATABASE.md` (data layout). The ready-built site works on a new domain without a Node server. This guide assumes a domain or subdomain root, for example `https://forms.example.com/`.

## Values your developer needs from the hosting provider

| Value | Where it is used |
|---|---|
| Chosen domain/subdomain | DNS, hosting website entry, HTTPS certificate and optional canonical URL |
| Server IPv4 address; IPv6 only if supported | DNS A record; optional AAAA record |
| Website document-root path | Copy the **contents** of `website/` here |
| Private persistent directory outside the document root | Restore existing SQLite databases and submitted PDFs here |
| PHP 8.3+ service user/pool | File ownership, environment variables, sessions and upload limits |
| Existing superadmin sign-in | Obtain privately from the project owner; passwords are not printed in this package |

## 1. Domain and HTTPS

1. Create the website/domain in the new hosting control panel. Choose PHP 8.3 or newer on Apache or compatible LiteSpeed. Enable the extensions and limits listed in `INSTALL.md`.
2. At the authoritative DNS provider, point the chosen hostname's A record to the new server IP. Add AAAA only when the host supplies working IPv6; remove stale conflicting records for that hostname. If using hosting nameservers, make the records in that provider's DNS zone instead.
3. Issue a valid HTTPS certificate for the exact hostname. Configure HTTP-to-HTTPS redirection through the hosting panel or server configuration. PHP must receive the correct HTTPS state so secure session cookies work.
4. For a self-managed Apache server, adapt `server/apache-vhost.conf`: domain, document root, certificate paths, PHP handler and private storage paths. For PHP-FPM, set storage variables in its pool as described in `INSTALL.md`.

## 2. Upload the public files

Extract the handover privately first. Upload **only the contents of `website/`**, including `.htaccess` and `.user.ini`, into the chosen document root, such as `/srv/alnaeem/public/` or the hosting account's `public_html/`.

Do not upload the complete handover ZIP, `source/`, `database/`, `editable-documents/` or `private-migration.zip` into the document root. Keep private restore/setup scripts outside it. Enable `.htaccess` overrides and the required rewrite/header modules before testing public access.

No build is needed for the supplied `website/`. If rebuilding after source changes, from `source/` run:

```sh
npm ci
npm test
FORMS_SITE_URL=https://forms.example.com/ npm run build
```

Replace the example hostname. Publish `source/dist/` public files; never overwrite existing private storage with a development directory. The supplied ready build has the old canonical URL removed, and routes use the current origin. Business/legal links inside the source documents remain as supplied.

## 3. Restore existing accounts and forms

Keep the new website restricted until setup is complete. Copy `private-migration.zip` to a private transfer directory. From `source/`:

```sh
php scripts/restore-installation.php /private-transfer/private-migration.zip /srv/alnaeem/private
php scripts/installation-init.php /srv/alnaeem/private
```

The restore destination must not already exist. Replace all example paths with the actual hosting paths. Set these values in the PHP runtime, not merely in an interactive shell:

```text
FORMS_DATA_DIR=/srv/alnaeem/private/management
FORMS_PORTAL_DATA_DIR=/srv/alnaeem/private/portal
```

Ensure the PHP service user owns the private directories, with private directories `0700` and files `0600`. Verify PHP sessions have a writable private path. If the hosting panel does not expose PHP environment configuration, ask the provider to configure these two values; do not solve it by exposing the database in a public directory.

Use the existing private snapshot for this delivery. `database/` contains empty databases/schema examples for a fresh installation only; it must not replace the restored databases. Existing password hashes continue to work. Session cookies are not migrated, so users sign in again.

## 4. Verify the new domain

Run the acceptance checklist in `INSTALL.md`. At minimum:

- Visit `/` without signing in: it should lead to login. Direct category, template and private-data links must remain protected.
- Check `/login/`, `/register/`, `/individuals/`, `/companies/`, `/my-applications/` and `/management/`. A client must see only their account category.
- Sign in as superadmin. Compare account, submission and archive counts with `SNAPSHOT.json`. Preview/download an existing current and archived PDF and a client ZIP.
- With synthetic accounts, verify shared data, a new submission, replacement/archive behavior and passwords. Check both languages and a phone-sized screen.
- Confirm source ZIPs, SQLite files and `api/*.json` schema files cannot be downloaded anonymously.

## 5. Final cutover

The included snapshot has an exact export timestamp in `SNAPSHOT.json`; later submissions are not included. If the old site stays active, arrange a final quiet window with the owner, stop new writes there, export a fresh private snapshot, restore into a new private directory, and repeat counts/hash checks before switching users to the new host.

Do not let two servers write to the same SQLite file. Keep the old installation and private backups available for recovery. Account-saved data moves with the database; unsent browser-only drafts do not automatically move to another domain.

## شرح مختصر بالعربية

اربط النطاق أو النطاق الفرعي بعنوان الخادم الجديد وفعّل HTTPS وPHP 8.3 أو أحدث. ارفع محتويات `website/` فقط إلى جذر الموقع مع الملفات المخفية. استعد `private-migration.zip` خارج المجلد العام باستخدام الأوامر أعلاه، ثم اضبط `FORMS_DATA_DIR` و`FORMS_PORTAL_DATA_DIR` في إعدادات PHP الفعلية. لا تستخدم القواعد الفارغة في `database/` بدل بيانات العملاء الحالية. اتبع `INSTALL-AR.md` و`INSTALL.md`، وقارن أعداد العملاء والنسخ مع `SNAPSHOT.json` قبل الإطلاق. يجب أخذ نسخة حديثة وقت النقل النهائي إذا استمر الموقع القديم في استقبال بيانات بعد تاريخ النسخة المرفقة.
