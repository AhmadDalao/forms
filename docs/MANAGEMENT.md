# Management

Production management is at `https://forms.ahmaddalao.com/management/`. The same sign-in page serves admins and the superadmin. The header contains Overview, Review forms and Clients; Documents appears only for the superadmin.

## Local review

Run `npm run build`, then:

```sh
FORMS_DATA_DIR="$PWD/management-data" php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8181 -t dist scripts/management-router.php
```

Open `http://127.0.0.1:8181/management/`. Choose an admin username and store its password in a private file outside public paths. Configure the ordinary admin account with:

```sh
php scripts/management-init.php management-data YOUR_USERNAME < /path/to/private-password-file
```

To add or change the username while keeping the existing password, run `php scripts/management-init.php management-data YOUR_USERNAME --keep-password`. There is no default or generated username. Login requires the configured username and password; usernames ignore casing and surrounding spaces. Changing either credential invalidates that account’s sessions. Configuration changes do not alter the catalogue. Existing logged-in sessions expire after 30 minutes of inactivity or eight hours total; sign out when finished.

## Roles and superadmin setup

Ordinary admins can review submissions, approve/reject with their username recorded, view clients, change client account types, reset client passwords, download PDFs/ZIP files and recover archived versions. They cannot access catalogue drafts or change titles, order, uploaded documents, field mappings or publication. The API enforces these restrictions with 403 responses; hiding buttons alone is not the permission check.

Create the separate superadmin using a chosen, distinct username and a strong password of 14–72 bytes:

```sh
php scripts/management-superadmin-init.php management-data YOUR_SUPERADMIN_USERNAME < /path/to/private-password-file
```

This adds protected `superadmin-username.php` and `superadmin-password.php` files with permissions 0600. Existing `username.php` and `password.php` remain the ordinary admin credentials. The command refuses collisions or replacement and leaves catalogue, client data and archived submissions untouched. Usernames are case-insensitive. Roles are resolved from server credentials on every authenticated request. Existing management sessions from before the role upgrade must sign in again once; client sessions are unaffected.

## Superadmin document workflow

1. Edit the English/Arabic titles and descriptions, or move cards up/down separately in the individual and company lists. Shared documents retain one title in both lists.
2. Save the draft. Visitors continue to see the published version.
3. Add a blank PDF and choose its audience. Native PDF text boxes, checkboxes, radio buttons and dropdowns import automatically. Flat PDFs get conservative suggestions from blank lines; scans and unusual layouts may need boxes drawn by hand. No OCR or external AI service is used.
4. Review every page. Edit both language labels, drag/resize boxes, add missing text/checkbox/signature areas, and map repeated fields to the appropriate audience's shared profile. These mappings never transfer a person's details to the company profile.
5. Generate English and Arabic sample PDFs, inspect all fields, then mark the new document reviewed. Alternatively choose download only.
6. Publish the catalogue on the current installation. The public form pages then show the changed titles/order/new document. A new shared document becomes card 7 in both folders automatically.
7. Restore previous publication copies the previous catalogue into the draft; publication remains explicit.

Original forms keep their field IDs, mappings and local saved answers. Administrator titles do not change the text printed in the original PDF. New fields use the existing transparent blue PDF renderer, optional answers, downloads at any step, browser drafts and signature uploads.

The importer does not promise to understand every official document. Label translation, semantic grouping, scans and complex tables require human review. It rejects encrypted PDFs, XFA, rotated/cropped pages and PDFs with digital-signature fields or existing answers instead of silently changing them. PDFs must have 1–50 standard pages and be under 20 MB; schemas allow up to 400 fields. Uploaded bytes are preserved.

## Storage and deployment boundary

The PHP services use separate admin and superadmin credentials with password hashes, secure same-site sessions, CSRF tokens, persistent login throttling, optimistic revision checks and locked atomic JSON writes. Catalogue configuration and source PDFs are separate from the private client-account database, submitted PDFs and archived versions. Client drafts/profile data follow the portal’s account synchronization rules.

Production data defaults to `public/_private/management` (the corresponding `_private` directory after deployment), protected by Apache `Require all denied`. `FORMS_DATA_DIR` can instead point outside the web root. Uploaded documents are served through the PHP endpoint only when published, or to the authenticated superadmin while in draft. The last ten published catalogues are retained for rollback; PDFs are retained so those versions remain available.

The approved production rollout uses `python3 scripts/deploy.py --production`. It backs up overwritten public files and preserves private storage. To add the explicitly prepared superadmin once, use `--initialize-superadmin /path/to/private-credential-directory`; it uploads only the two guarded credential files under protected `_private/management`, refuses different existing credentials, and verifies that existing admin credentials remain unchanged. Never upload the plaintext password file, source documents, test output, databases or backups.

## Verification

`npm test` covers the established form/draft/profile behavior. `node scripts/management-roles-audit.mjs` verifies both roles, direct API restrictions, review attribution, unified navigation and same-browser account switching. `node scripts/portal-audit.mjs` exercises the client lifecycle as an ordinary admin. `node scripts/management-audit.mjs` starts an isolated PHP server with disposable test data and verifies management/API/customer workflows. `scripts/catalogue-audit.mjs` checks the existing form catalogue against the local PHP preview. Test output and credentials stay under ignored temporary directories.

## Limits confirmed with the real source files

The eight-file audit in `management-real-files-verification.json` found incomplete flat-PDF detection. Two actual documents produced no suggestions; the other six still needed missing fields and labels corrected. Do not treat an upload or a successful sample download as proof of a complete form.

The editor highlights overlapping answer boxes, and both the PDF renderer and server refuse them. Long answers are fitted within their assigned box or rejected. These checks cannot determine whether a manually placed box belongs over original printed content: compare every field with the paper and inspect sample answers before approving a new layout. This setup is done once per new document.

Client `/login/` continues to use a Saudi mobile number. Management requires a username and password. The management session endpoint returns the authenticated username, role and document permission, never password hashes or plaintext passwords. Credentials stay outside version control.
