# Al Naeem Real Estate Fund — start here

This is the complete developer handover. The outer ZIP is a **private transfer package**, not an archive to extract into the public website folder.

## Read these files in order

1. **`DOMAIN-SETUP.md`** — connect your domain, configure HTTPS/PHP, upload the website and complete the cutover.
2. **`INSTALL.md`** — exact server requirements, restore commands, environment variables, tests, backups and maintenance.
3. **`DATABASE.md`** — SQLite files/tables, submitted PDFs, shared data and version history.
4. **`SNAPSHOT.json`** — export date and actual record counts for the included existing database.
5. **`INSTALL-AR.md` / `README-AR.md`** — Arabic installation notes.

## Package contents

| Path | Purpose | Public upload? |
|---|---|---|
| `website/` | Latest tested, ready-built website | **Yes — its contents only** |
| `private-migration.zip` | Existing clients, shared account details, submitted PDFs, archives and management data | **No — restore outside the web root** |
| `source/` | Editable code, build scripts, tests and restore/backup tools | No |
| `database/` | Empty SQLite databases and readable schemas for a fresh install; not the existing client database | No |
| `editable-documents/` | Seven Word sources and nine current PDF templates | No |
| `server/` | Apache virtual-host example | Server configuration, not a public file |
| `verification/` | Regression and visual/presentation test evidence | No |
| `MANIFEST.json`, `SHA256SUMS.txt` | Complete package inventory and checksums | No |
| `BUILD-MANIFEST.json` | Original clean application-package manifest | No |

## Quick deployment route

- Use Apache 2.4 or compatible LiteSpeed, HTTPS and PHP 8.3+ with the extensions in `INSTALL.md`. SQLite is included; MySQL is not required. Node is needed only for source rebuilds.
- Copy `website/` contents, including `.htaccess` and `.user.ini`, to the new domain's document root.
- From `source/`, restore the included private archive to a new private directory, then run initialization:

```sh
php scripts/restore-installation.php /private-transfer/private-migration.zip /srv/alnaeem/private
php scripts/installation-init.php /srv/alnaeem/private
```

- Set PHP runtime variables `FORMS_DATA_DIR=/srv/alnaeem/private/management` and `FORMS_PORTAL_DATA_DIR=/srv/alnaeem/private/portal`. Adjust paths to your server.
- Existing client/admin passwords continue to work. Obtain superadmin credentials from the owner privately; no plaintext sign-in or hosting passwords are included.
- Run the acceptance checklist in `INSTALL.md` before opening the new domain to users. If the original site receives new data after the snapshot time, take a fresh export during the final cutover.

The complete archive contains personal client data. Transfer it privately to the intended developer and keep it outside public download paths.

## ابدأ من هنا

هذه الحزمة الكاملة للمطور، وليست ملفًا يُفك داخل المجلد العام للموقع. ارفع **محتويات `website/` فقط**. يحتوي `private-migration.zip` على قاعدة العملاء الحالية والنماذج ونسخها المؤرشفة وحسابات الإدارة؛ استعده خارج جذر الموقع. ملفات `database/` فارغة لتثبيت جديد فقط ولا تستبدل بها بيانات العملاء. ابدأ بـ `README-AR.md` و`DOMAIN-SETUP.md` ثم اتبع `INSTALL.md`. يوضح `DATABASE.md` تفاصيل التخزين، ويوضح `SNAPSHOT.json` تاريخ النسخة وأعداد سجلاتها. أرسل الحزمة للمطور بقناة خاصة، ولا تنشرها كرابط تنزيل عام.
