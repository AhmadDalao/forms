# Client accounts and submissions

Implemented on `codex/client-portal`, based on the tested subscription branch. This work has not been deployed or merged into the live site.

## Preview

Run `npm run build`, then start the PHP preview with private storage outside `dist`:

```sh
FORMS_DATA_DIR=/Users/ahmaddalao/Desktop/forms-management/management-data \
FORMS_PORTAL_DATA_DIR="$PWD/portal-data" \
php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8185 -t dist scripts/management-router.php
```

- `/register/`: name, Saudi mobile, password and confirmation. No email registration requirement.
- `/login/`: mobile and password.
- `/account/`: the client's current submissions and version history, edit/resubmit, PDF previews/downloads, current-only or full-history ZIP, optional profile email, password change, and replacement uploads of manually completed PDFs.
- `/individuals/` and `/companies/`: the existing form folders. A **Submit form** action appears after PDF review.
- `/management/`: owner overview, clients and document catalogue. The preview uses the existing management owner login; the original management preview on 8181 stays available.

The new preview's client database starts empty. Automated test accounts are isolated under `tmp/portal-audit`, not mixed into the preview database.

## Accounts and storage

Saudi mobiles normalize to `+9665XXXXXXXX`; local `05…`, international prefixes and Arabic digits are accepted. A mobile number is an account identifier. This implementation does not send an SMS or claim to verify possession of that number. Passwords require at least 12 characters and at most 72 UTF-8 bytes and are stored with PHP's password hashing API.

Client and owner sessions use separate HttpOnly, SameSite=Strict cookies, with Secure enabled under HTTPS. Client sessions expire after two hours idle or twelve hours total. Mutation endpoints require a session CSRF token. Persistent rate limits cover registration, sign-in, submissions and password changes. PDF, detail and ZIP endpoints enforce client ownership or a valid owner session.

An owner password reset produces a random temporary password, shows it once, invalidates every existing client session and requires a password change before the client can access submissions again. The application does not message the client; the owner shares the temporary password privately through their normal contact channel. Only a reset audit event is retained, never the temporary plaintext password.

`public/api/portal.php` stores accounts, metadata, hashed passwords and reset audit events in SQLite and PDF bytes in a private directory. Set `FORMS_PORTAL_DATA_DIR` outside the web root in production. The fallback is `_private/portal`, covered by the existing Apache deny rule. PHP requires PDO SQLite, mbstring, fileinfo and ZipArchive. Set upload limits to at least 20 MB / 24 MB. Back up the entire private portal directory, including both SQLite and `pdfs/`; never overwrite it when deploying assets. A production rollout still needs the existing branch/deployment approval step and host extension/private-storage verification.

## Submissions

Online submission explicitly sends the reviewed PDF, entered values and selected shared profile details to the server. Draft editing and signature images remain browser-local until the client submits. Draft keys are separated by account and audience. During sign-in from a guest form, the client can choose to carry over that folder's guest draft; unrelated account drafts are never imported.

Saved submissions are immutable snapshots with server timestamps, source category, PDF SHA-256, field labels, entered values, and normalized signature images when submitted online. Subscription amounts are recalculated server-side from units. A retry of the same online submission reuses its idempotency key. Later edits in a draft do not change a submitted PDF. Every deliberate new version counts as another submission.

The completed-PDF upload supports print/manual signing and download-only documents. Uploaded PDFs retain their exact bytes; structured answers are not inferred from them, and uploaded documents are not treated as verified signatures. Individual PDFs and ZIP entries use the stored bytes, not a regenerated template. ZIP download names use the client's name; audience, version, timestamps and IDs prevent duplicate filenames. The default ZIP contains current forms only; `history=1` includes archived versions too.

Owner statistics show total accounts, distinct clients with submissions, current forms, archived versions, total submissions and current-form counts per document category. Category history remains available when an uploaded template is later removed from the published catalogue. Dates are displayed in Riyadh time. Unsubmitted browser drafts are not counted.

## Editing, archiving and recovery

Each client/document/audience has one current submission. A new submission archives that current row and inserts the next numbered version in one SQLite transaction. The original PDF, answers, signatures, profile snapshot and submission timestamp are never overwritten. Individual and company versions are independent, including shared document templates. Merely opening or editing a form does not archive anything; successful submission does.

Clients use **Edit & resubmit** for online forms or **Upload replacement** for externally completed PDFs. Editing opens a separate browser draft, restores the submitted answers and saved signature images, and preserves deliberate blanks instead of filling them from today's shared profile. The client's unrelated working draft stays intact. Closing/reloading the browser resumes the edit when they open that version again. Earlier portal submissions that predate signature-image storage keep their original signed PDFs; the editor explains that those images need uploading again when editing.

Both accounts and management profiles expose **Version history**, including submission/archive timestamps, preview, single PDF download and full-history ZIP. Owner **Restore this version** copies the archived PDF and details into a new current version and archives the formerly current one. Restoration is recorded in the audit table; no history is deleted. Downloads and restoration use original saved bytes, not today's template.

Mutation requests include the current version the user reviewed (`expectedCurrent`) and an idempotency key. A stale edit/replacement/restore receives HTTP 409 and leaves all existing submissions untouched. Retries reuse their key and do not create extra versions. A partial unique index enforces exactly one current row per chain. On the first API request after upgrade, a transactional, idempotent migration numbers existing submissions chronologically (row order breaks timestamp ties) and archives all but the latest per chain, without rewriting files or answer data.

## Verification

- `npm test`: unit checks include account/audience draft isolation, separate version-edit drafts, original blank-field preservation, route roots, and legacy database migration without snapshot changes.
- `node scripts/portal-audit.mjs`: isolated PHP/Chrome test with two accounts. Covers registration, authorization, CSRF, phone validation, draft continuation, private PDF ownership, invalid uploads, idempotent retries, both subscription editors and the signature form, backend calculations, client/owner previews, current/history ZIPs, edit/reload/resubmit, signature recovery, immutable original data, stale-version rejection, owner restoration and retry, replacement uploads, individual/company history isolation, Arabic/English subscription edits and mobile history views. Also checks password reset, old-session revocation, forced password change, catalogue navigation and login throttling.
- `node scripts/management-audit.mjs`: existing catalogue management regression checks, updated to enter Documents from the new overview.
- Screenshots, audit reports and disposable test data stay under ignored `tmp/portal-audit/`.
