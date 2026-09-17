# Document management test branch

The management feature is isolated in `codex/management`, in `/Users/ahmaddalao/Desktop/forms-management`. The production site remains on the separate `main` checkout. The deployment script refuses this feature branch until production rollout is explicitly approved.

## Local review

Run `npm run build`, then:

```sh
FORMS_DATA_DIR="$PWD/management-data" php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8181 -t dist scripts/management-router.php
```

Open `http://127.0.0.1:8181/management/`. The locally generated owner password is in `tmp/management/owner-password.txt` (permissions 0600, ignored by Git). To set a different password, put it in a private file and run:

```sh
php scripts/management-init.php management-data < /path/to/private-password-file
```

Changing the password does not alter the catalogue. Existing logged-in sessions expire after 30 minutes of inactivity or eight hours total; sign out when finished.

## Workflow

1. Edit the English/Arabic titles and descriptions, or move cards up/down separately in the individual and company lists. Shared documents retain one title in both lists.
2. Save the draft. Visitors continue to see the published version.
3. Add a blank PDF and choose its audience. Native PDF text boxes, checkboxes, radio buttons and dropdowns import automatically. Flat PDFs get conservative suggestions from blank lines; scans and unusual layouts may need boxes drawn by hand. No OCR or external AI service is used.
4. Review every page. Edit both language labels, drag/resize boxes, add missing text/checkbox/signature areas, and map repeated fields to the appropriate audience's shared profile. These mappings never transfer a person's details to the company profile.
5. Generate English and Arabic sample PDFs, inspect all fields, then mark the new document reviewed. Alternatively choose download only.
6. Publish the catalogue on this test installation. The public preview folders then show the changed titles/order/new document. A new shared document becomes card 7 in both folders automatically.
7. Restore previous publication copies the previous catalogue into the draft; publication remains explicit.

Original forms keep their field IDs, mappings and local saved answers. Administrator titles do not change the text printed in the original PDF. New fields use the existing transparent blue PDF renderer, optional answers, downloads at any step, browser drafts and signature uploads.

The importer does not promise to understand every official document. Label translation, semantic grouping, scans and complex tables require human review. It rejects encrypted PDFs, XFA, rotated/cropped pages and PDFs with digital-signature fields or existing answers instead of silently changing them. PDFs must have 1–50 standard pages and be under 20 MB; schemas allow up to 400 fields. Uploaded bytes are preserved.

## Storage and deployment boundary

The PHP service uses one password hash, secure same-site sessions, CSRF tokens, persistent login throttling, optimistic revision checks and locked atomic JSON writes. Only catalogue configuration and uploaded source PDFs reach the server. Customer answers and signature images remain in their browser.

Production data defaults to `public/_private/management` (the corresponding `_private` directory after deployment), protected by Apache `Require all denied`. `FORMS_DATA_DIR` can instead point outside the web root. Uploaded documents are served through the PHP endpoint only when published, or to the authenticated owner while in draft. The last ten published catalogues are retained for rollback; PDFs are retained so those versions remain available.

Before any approved production rollout, verify PHP and `mbstring`, the private-directory access rule, writable data permissions, HTTPS session cookies, file-size limits and a fresh production password. Deploying source code must never overwrite the data directory. The current static-site deployment script intentionally does not handle this rollout.

## Verification

`npm test` covers the established form/draft/profile behavior. `node scripts/management-audit.mjs` starts an isolated PHP server with disposable test data and verifies management/API/customer workflows. `scripts/catalogue-audit.mjs` checks the existing form catalogue against the local PHP preview. Test output and credentials stay under ignored temporary directories.

## Limits confirmed with the real source files

The eight-file audit in `management-real-files-verification.json` found incomplete flat-PDF detection. Two actual documents produced no suggestions; the other six still needed missing fields and labels corrected. Do not treat an upload or a successful sample download as proof of a complete form.

The editor highlights overlapping answer boxes, and both the PDF renderer and server refuse them. Long answers are fitted within their assigned box or rejected. These checks cannot determine whether a manually placed box belongs over original printed content: compare every field with the paper and inspect sample answers before approving a new layout. This setup is done once per new document.
