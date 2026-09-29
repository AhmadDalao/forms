# Database and private storage

This application uses **SQLite files, not MySQL**. No database hostname, MySQL user or MySQL password is needed. Install the supplied private bootstrap with the included script. Copying the website alone does not install the included management credentials. This edition has no clients or submitted PDFs.

## Which database to use

| Location in this delivery | Purpose |
|---|---|
| `private-bootstrap.zip` | Fresh empty client database and existing `admin`/`superadmin` credential hashes. **Use this for the fresh installation.** |
| `database/clients.sqlite` and `database/administrators.sqlite` | Empty schema examples without the management logins; use the private bootstrap to retain them |
| `database/*-schema.sql` | Readable clean schema/export examples; not an export of existing clients |
| `SNAPSHOT.json` | Seed creation time, schema version, zero client/submission counts, included management usernames and checksum |

`source/scripts/restore-installation.php` checks the archive paths, every file checksum, SQLite integrity, foreign keys, schema version, record counts and all submitted PDF hashes. It refuses to overwrite an existing destination. Then `installation-init.php` applies compatible migrations without deleting existing rows. Current client schema version is 7, recorded in `PRAGMA user_version`.

## Restored layout

```text
private/
  portal/
    clients.sqlite
    pdfs/<submission-id>.pdf
  management/
    administrators.sqlite
    state.json                 When catalogue state has been saved
    uploads/                   Custom blank templates, if any
    username.php               Legacy admin username, if configured
    password.php               Guarded legacy password hash, if configured
    superadmin-username.php     Bootstrap superadmin username, if configured
    superadmin-password.php     Guarded superadmin password hash, if configured
```

The account/store files remain private. Names ending in `password.php` contain password **hashes**, not plaintext passwords. Additional admin credentials are also hashed in `administrators.sqlite`. Get the existing superadmin password from the owner separately. PHP sessions are deliberately not included in the migration.

## `portal/clients.sqlite`

| Table | What it stores |
|---|---|
| `users` | Client ID, name, normalized Saudi phone, optional email, password hash, account category, registration/sign-in times and session/reset state |
| `client_shared_profiles` | Current reusable details as JSON, separately keyed by `(user_id, audience)` for individuals and companies; revision and last-saved time |
| `submissions` | One immutable captured-answer/PDF version: client, document/category, titles, time, PDF size/hash, answer JSON, profile/definition snapshot, signature JSON, source and version links |
| `submission_reviews` | Historical administrator decisions, reasons, reviewer identity and timestamps; retained although the current application uses direct Received submissions |
| `workflow_settings` / `workflow_setting_events` | Migration/workflow configuration and its recorded history; do not edit these manually to change behavior |
| `audit` | Client/account-related audit events |
| `rates` | Login/request throttling state |

Relationships and invariants:

- `submissions.user_id` and `client_shared_profiles.user_id` refer to `users.id`.
- `answers` is the captured field data for that version. `profile` stores its shared-data and field/section/PDF-layout definitions so old submissions remain interpretable after templates change.
- Each submission's PDF is `portal/pdfs/<submissions.id>.pdf`. `sha256` and `size` must match that file. PDFs are **not** stored as database blobs.
- A version chain belongs to `(user_id, doc_id, audience)`. Exactly one current version has `archived_at IS NULL`; earlier versions stay stored. `replaces_id`, `restored_from` and `edited_from` preserve its history.
- `(user_id, request_key)` prevents duplicate submissions during retries. Version uniqueness and current-version indexes protect replacement behavior.
- Editing shared account details does not rewrite a submitted/archived version's answer snapshot or PDF.
- An uploaded PDF is identified as an upload; it does not imply the application extracted or verified all of its text/signatures.

## `management/administrators.sqlite`

`administrators` stores additional admin usernames, password hashes and creator/updater timestamps. `administrator_events` records account creation/password actions and the administrator responsible. The separately guarded bootstrap credential files are also needed for the existing superadmin/legacy admin and are included when present.

## Operating the databases

Keep both SQLite files and their parent directories writable by the PHP service user on persistent local storage. Keep the databases together with all PDF and uploaded-template files. Enable PDO SQLite, SQLite JSON support and the other PHP extensions in `INSTALL.md`.

Use the application and its supported restore/migration scripts for changes. Do not edit JSON answers, timestamps, version IDs or review records manually. Do not copy a running database file alone as a backup; use the consistent backup tool:

```sh
# Run from source/, as an account able to read the private store.
php scripts/backup-installation.php /srv/alnaeem/private/management /srv/alnaeem/private/portal /srv/alnaeem/backups/snapshot-YYYYMMDD.zip
```

Restore into a new private directory, verify, and switch the PHP paths after a planned cutover. Do not place databases, migration archives or credential files into the web root. Account data saved on the server migrates; local-only browser drafts from the old domain do not.

## Initial state of this delivery

`admin` and `superadmin` are included with their existing password hashes. The bootstrap accounts use the guarded files in `management/`; additional admins created in the dashboard use `administrators.sqlite`. All those files are installed by the single restore command. Do not copy only `clients.sqlite` and expect management logins to follow.

The client tables contain zero users, profiles, submissions, reviews, audit events and rate-limit records. New database initialization creates the default workflow setting and its initialization event; these are application configuration, not old client activity. `administrator_events` is empty. No old catalogue state or custom uploaded files are included; the latest built-in templates load from the public build.

## ملخص بالعربية

قاعدة المشروع SQLite وليست MySQL. تحتوي حزمة `private-bootstrap.zip` قاعدة عملاء فارغة وحسابي `admin` و`superadmin` بكلمات مرورهما الحالية مجزّأة. لا توجد بيانات عملاء أو حقول مشتركة أو نماذج مرسلة أو أرشيف. تُحفظ حسابات الإدارة الأساسية في الملفات المحمية، ويُحفظ المسؤولون الجدد في قاعدة الإدارة. شغّل الاستعادة ثم التهيئة واضبط المسارات خارج المجلد العام. ملفات `database/` أمثلة فارغة بلا حسابات إدارة، فلا تستخدمها بدل حزمة التهيئة.
