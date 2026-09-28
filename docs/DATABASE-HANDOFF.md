# Database and private storage

This application uses **SQLite files, not MySQL**. No database hostname, MySQL user or MySQL password is needed. Restore the supplied private snapshot with the included script; copying the website alone does not transfer accounts or submitted PDFs.

## Which database to use

| Location in this delivery | Purpose |
|---|---|
| `private-migration.zip` | Existing clients, shared profiles, submissions, archived PDFs, management accounts and catalogue state. **Use this for the requested migration.** |
| `database/clients.sqlite` and `database/administrators.sqlite` | Empty databases for a separate fresh installation only |
| `database/*-schema.sql` | Readable clean schema/export examples; not an export of existing clients |
| `SNAPSHOT.json` | Actual export timestamp, schema version, aggregate record counts and migration archive checksum |

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

## ملخص بالعربية

قاعدة البيانات SQLite وليست MySQL، ولا تحتاج إلى اسم مستخدم أو كلمة مرور لقاعدة MySQL. يحتوي `private-migration.zip` على البيانات الحالية المطلوب نقلها، بينما ملفات `database/` فارغة ومخصصة لتثبيت جديد فقط. تحفظ قاعدة `clients.sqlite` حسابات العملاء والحقول المشتركة وإجابات كل نسخة وسجلها، وتوجد ملفات PDF نفسها في `portal/pdfs/`. يجب نقل الاثنين معًا. بيانات الأفراد والشركات منفصلة، والطلبات القديمة لا تتغير عند تحديث الحقول المشتركة. تحفظ قاعدة الإدارة والملفات المحمية كلمات مرور مجزّأة، وتستمر كلمات المرور الحالية بالعمل بعد النقل. شغّل أداة الاستعادة ثم التهيئة، واضبط مجلدي التخزين في PHP خارج المسار العام، وقارن الأعداد مع `SNAPSHOT.json`.
