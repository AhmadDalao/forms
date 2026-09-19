# Client accounts and submissions

Live at https://forms.ahmaddalao.com/. A separate historical password-protected test copy is documented in `docs/HOSTED_PREVIEW.md`.

## Preview

Run `npm run build`, then start the PHP preview with private storage outside `dist`:

```sh
FORMS_DATA_DIR=/Users/ahmaddalao/Desktop/forms-management/management-data \
FORMS_PORTAL_DATA_DIR="$PWD/portal-data" \
php -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8185 -t dist scripts/management-router.php
```

- `/register/`: Individual / Company selection, first and last name, Saudi mobile, password and confirmation. No email registration requirement.
- `/login/`: mobile and password.
- `/my-applications/` (also available through `/account/`): the client's current submissions and version history, edit/resubmit, PDF previews/downloads, current-only or full-history ZIP, optional profile email, password change, and uploads/replacements of manually signed PDFs.
- `/individuals/` and `/companies/`: signed-in clients can open their assigned folder; opposite-category links redirect to it. A **Submit form** action appears after PDF review and is enabled only when the applicable customer signatures are present.
- `/management/`: owner overview, clients and document catalogue. The preview uses the existing management owner login; the original management preview on 8181 stays available.

Portal headers use only the original Itqan Capital logo, extracted from the supplied presentation; see `docs/BRANDING.md`.

The new preview's client database starts empty. Automated test accounts are isolated under `tmp/portal-audit`, not mixed into the preview database.

## Accounts and storage

Saudi mobiles normalize to `+9665XXXXXXXX`; local `05…`, international prefixes and Arabic digits are accepted. A mobile number is an account identifier. This implementation does not send an SMS or claim to verify possession of that number. Client passwords require at least 8 characters and at most 72 UTF-8 bytes and are stored with PHP's password hashing API.

Client and owner sessions use separate HttpOnly, SameSite=Strict cookies, with Secure enabled under HTTPS. Client sessions expire after two hours idle or twelve hours total. Mutation endpoints require a session CSRF token. Persistent rate limits cover registration, sign-in, submissions and password changes. PDF, detail and ZIP endpoints enforce client ownership or a valid owner session.

Signup and password changes include an advisory strength meter computed in the browser from length, variety and common-pattern checks. It does not impose extra character-composition rules; a valid eight-character password is accepted even if rated weak. Login/current-password fields do not enforce new-password length rules. Show/hide controls update the icon and accessible label together.

An owner password reset produces a random temporary password, shows it once, invalidates every existing client session and requires a password change before the client can access submissions again. The application does not message the client; the owner shares the temporary password privately through their normal contact channel. Only a reset audit event is retained, never the temporary plaintext password.

`public/api/portal.php` stores accounts, metadata, hashed passwords and reset audit events in SQLite and PDF bytes in a private directory. Set `FORMS_PORTAL_DATA_DIR` outside the web root in production. The fallback is `_private/portal`, covered by the existing Apache deny rule. PHP requires PDO SQLite, mbstring, fileinfo and ZipArchive. Set upload limits to at least 20 MB / 24 MB. Back up the entire private portal directory, including both SQLite and `pdfs/`; never overwrite it when deploying assets.

## Account category

Signup requires either `individual` or `corporate`. It determines the assigned form folder, signup/continuation destination, My applications form link and completed-PDF upload choices. Clients cannot change their own category through profile updates. Management can change it in **Clients → client profile → Account type**; the API validates the prior category to reject stale changes and records an audit event.

Existing accounts migrate to Individual by default. The migration is transactional and repeatable, preserves passwords, answers and files, and does not reset a category management has already changed. The server reads the current category on requests and checks submission permission again inside the database write transaction. Returning to an open tab refreshes a changed category; stale submissions are rejected even without a refresh.

Previous-category submissions remain available to their owner and management for preview, download and history. Clients cannot edit/resubmit or replace those documents unless management changes their category back. No draft data is copied between individual and company folders. Guest draft migration at sign-in only imports the selected continuation folder when it matches the account category.

Anonymous document links and public blank PDFs retain their existing availability. Account categories govern the signed-in workflow and submission authorization; they are not a confidentiality restriction on the original blank templates.

## Submissions

Online submission explicitly sends the reviewed PDF, entered values and selected shared profile details to the server. Draft editing and signature images remain browser-local until the client submits. Draft keys are separated by account and audience. During sign-in from a guest form, the client can choose to carry over that folder's guest draft; unrelated account drafts are never imported.

Signature controls appear inside the relevant signing step, using the subscription form's electronic/manual choices. There is no separate signature panel or signing-box selector. Each client, representative, staff member and additional signer has an independent choice and image; uploaded documents use the configured signature's page. Manual signing clears that slot's image and leaves its PDF area blank. Electronic signing reveals the upload control and needs an image before PDF review/download. Choices persist in browser draft metadata, independently of document answers. Existing saved images reopen as electronic signatures; submitted versions retain their original images and PDFs. The download-only consent document stays download-only.

Online submission requires an electronic signature image for every applicable customer signing area. Both the editor and the server enforce this rule. Additional named signer/representative rows require their own signatures; unused additional rows and staff-only signing areas do not block the customer. A document without a configured customer signing area uses the signed-PDF upload route. Previously saved submissions remain available unchanged.

With manual signing selected, **Submit form** is disabled and **Download PDF** is the primary review action. The review/download guidance explains how to sign the downloaded PDF and upload it from **My applications → Upload signed form**. Its link opens the matching document's upload dialog after sign-in if needed; it never allows a client to upload to another account category. The same guidance can be reopened from the review step.

Saved submissions are immutable snapshots with server timestamps, source category, PDF SHA-256, field labels, entered values, and normalized signature images when submitted online. Subscription amounts are recalculated server-side from units. A retry of the same online submission reuses its idempotency key. Later edits in a draft do not change a submitted PDF. Every deliberate new version counts as another submission.

The signed-PDF upload supports print/manual signing and download-only documents. The client must confirm that the entire form has been signed; this declaration is stored with the submission. It is not an automatic verification of handwriting or signatures, so management still reviews the uploaded document. Uploaded PDFs retain their exact bytes; structured answers are not inferred from them, and uploaded documents are not treated as verified signatures. Individual PDFs and ZIP entries use the stored bytes, not a regenerated template. ZIP download names use the client's name; audience, version, timestamps and IDs prevent duplicate filenames. The default ZIP contains current forms only; `history=1` includes archived versions too.

Owner statistics show total accounts, distinct clients with submissions, current forms, archived versions, total submissions and current-form counts per document category. Category history remains available when an uploaded template is later removed from the published catalogue. Dates are displayed in Riyadh time. Unsubmitted browser drafts are not counted.

## Editing, archiving and recovery

Each client/document/audience has one current submission. A new submission archives that current row and inserts the next numbered version in one SQLite transaction. The original PDF, answers, signatures, profile snapshot and submission timestamp are never overwritten. Individual and company versions are independent, including shared document templates. Merely opening or editing a form does not archive anything; successful submission does.

Clients use **Edit & resubmit** for online forms or **Upload signed replacement** for externally signed PDFs. Editing opens a separate browser draft, restores the submitted answers and saved signature images, and preserves deliberate blanks instead of filling them from today's shared profile. The client's unrelated working draft stays intact. Closing/reloading the browser resumes the edit when they open that version again. Earlier portal submissions that predate signature-image storage keep their original signed PDFs; the editor explains that those images need uploading again when editing.

Both accounts and management profiles expose **Version history**, including submission/archive timestamps, preview, single PDF download and full-history ZIP. Owner **Restore this version** copies the archived PDF and details into a new current version and archives the formerly current one. Restoration is recorded in the audit table; no history is deleted. Downloads and restoration use original saved bytes, not today's template.

Mutation requests include the current version the user reviewed (`expectedCurrent`) and an idempotency key. A stale edit/replacement/restore receives HTTP 409 and leaves all existing submissions untouched. Retries reuse their key and do not create extra versions. A partial unique index enforces exactly one current row per chain. On the first API request after upgrade, a transactional, idempotent migration numbers existing submissions chronologically (row order breaks timestamp ties) and archives all but the latest per chain, without rewriting files or answer data.

## Verification

- `tests/portal-signatures.test.mjs`: required and conditional signature policy, explicit manual choice, staff exclusions, PNG validation, and browser/server policy parity.
- `npm test`: unit checks include account/audience draft isolation, separate version-edit drafts, original blank-field preservation, route roots, and legacy database migration without snapshot changes.
- `node scripts/portal-audit.mjs`: isolated PHP/Chrome test with two accounts. Covers registration, authorization, CSRF, phone validation, draft continuation, private PDF ownership, invalid uploads, idempotent retries, both subscription editors and the signature form, backend calculations, client/owner previews, current/history ZIPs, edit/reload/resubmit, signature recovery, immutable original data, stale-version rejection, owner restoration and retry, replacement uploads, individual/company history isolation, Arabic/English subscription edits and mobile history views. Also checks password reset, old-session revocation, forced password change, catalogue navigation and login throttling.
- `node scripts/management-audit.mjs`: existing catalogue management regression checks, updated to enter Documents from the new overview.
- `node scripts/account-types-audit.mjs`: isolated signup/category restriction tests in Chrome, Firefox and WebKit, management changes, stale tabs, direct links, upload filtering, access-control rejection and prior-document preservation. `QA_BASE`, `QA_CREDENTIALS` and `QA_OUT` can target an explicitly authorized hosted test; remove the recorded temporary accounts afterward.
- `node scripts/password-audit.mjs`: isolated individual/company signup, login, password change and forced reset cycles, minimum-eight and UTF-8 byte boundaries, changing visibility icons, localized advisory strength and EN/AR desktop/mobile layouts in Chrome, Firefox and WebKit. Supports the same explicit hosted QA variables and records synthetic account identities for cleanup.
- `node scripts/signature-steps-audit.mjs`: guest-only checks of signature controls in their assigned steps, legacy image migration, saved choices, independent signers/folders, uploaded signature-only pages, real downloads and original PDF content preservation. `SITE_URL` targets a hosted build; all non-GET/HEAD requests are blocked so it cannot create accounts or submissions.
- Screenshots, audit reports and disposable test data stay under ignored `tmp/` directories.

## Review decisions and client notifications

Management → **Review forms** lists current submissions by Under review / Approved / Rejected. Existing submissions without a recorded decision begin Under review; no historical approval is inferred. Preview & details in a client profile also opens the review controls and complete PDF.

Rejection reasons are **Missing details**, **Incorrect data**, or **Other**. The administrator may add a client-visible explanation (required for Other, maximum 2,000 characters). Approval clears rejection inputs for the new decision, while earlier decisions remain in the history. Decisions record the authenticated management username and server UTC timestamp, displayed in Riyadh time. The existing installation has one configured management owner: people sharing that login share its audit identity; this change does not add staff accounts.

Schema version 3 adds `submission_reviews` without modifying account, answer or PDF snapshots. Decisions are append-only, tied to a specific submission version, and mirrored to the audit log. Notification `read_at` is the only mutable event field. An admin decision requires authentication, CSRF, a valid reason, the last review revision and an idempotency key. A write lock prevents stale or archived-version decisions. A new submission, replacement or owner restoration always starts Under review; it never inherits an earlier version's approval.

Clients see status and rejection explanations beside each form and in its preview. **My applications → Notifications** persists approval/rejection updates across sign-ins, supports marking individual events as read and loading earlier notifications. It refreshes every 30 seconds while visible and when the page regains focus, updating status elements without disturbing profile edits. Notifications identify the exact version and flag superseded decisions and archived versions. Notifications are in-app; no SMS or email is sent. Admin identities are available to management only.

- `node scripts/reviews-audit.mjs`: isolated individual/company review cycles; Chrome, Firefox and WebKit; EN/AR desktop/mobile. Tests actual approval/rejection controls, all three reasons, ownership and CSRF, authenticated actor/time, conflicting windows, idempotent retries, persistent read receipts, safe text display, resubmission/restoration pending states, archived decision history and unchanged PDF hashes. Supports the same explicit hosted QA variables as the account category audit, with recorded synthetic accounts for targeted cleanup.
- `tests/portal-reviews.test.mjs`: repeatable migration, unchanged saved snapshots, distinct actor history, notification pagination/ownership, read receipts, transaction conflicts and archive protection.
