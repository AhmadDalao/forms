# Optional reviews: how this release works

Leave **Review new submissions** off if the team only wants to receive forms and contact clients manually. Turn it on from the **management navigation bar** as superadmin when the team wants decisions and follow-up inside the portal. Ordinary admins can review applications but cannot change this setting. The switch affects the whole installation; there is no email or SMS service.

## What the client sees

Both modes accept unsigned initial forms. With review off, the receipt says **Received**. With review on, it says **Under review**. Signature presence has its own badge; a request for a signature is a decision, not proof that an existing signature disappeared.

A manager can approve, reject, request corrections or request a signature. No choice is selected initially. Rejection and correction need a note explaining what the client should do. Approval and signature requests can carry an optional note. Notes are sent with decisions; there is no separate messaging thread.

Corrections open the latest saved online answers. A client who uploaded a PDF gets a replacement upload instead. Signature requests offer electronic signing where the stored layout supports it, or upload of a PDF the client confirms is signed. An unsigned replacement cannot complete a signature request. We record the client's confirmation; we do not claim to authenticate handwritten signatures or extract structured answers from uploads.

Every successful follow-up creates a new version and returns the case to Under review. Previous PDFs, answers and decisions stay in history. Profile remains limited to account details and passwords. Card downloads and the simple PDF preview remain available.

## Switch and version rules

| Current case | Next client submission |
|---|---|
| No prior version, or previously Received | Follows the current switch |
| Under review, Corrections requested or Signature required | Stays in review even if the switch is now off |
| Approved or Rejected | Follows the current switch |

Enabling review never changes old Received records. Approval locks decision controls on that version. A new client replacement gets its own decisions. Reviewing an archived version, or using a stale review revision, is rejected.

Notification buttons re-fetch the current version and check its status before acting. An old correction notification cannot start an obsolete correction after the application has moved on; it opens the latest preview instead. Reading a notification records its read receipt without changing the decision.

## Where the code lives

- `public/api/portal-workflow.php`: global setting, revisions and explicit enrollment detection.
- `public/api/portal-versions.php`: server-owned enrollment and signature-request completion inside the version transaction.
- `public/api/portal-reviews.php`: schema-8 migration, decision validation, locking and append-only history.
- `public/api/portal.php`: authenticated API actions, CSRF, permissions, receipts, status filters and counts.
- `src/management/main.js`: the navigation switch and its save/retry state across management pages.
- `src/portal/admin.js` and `review.js`: Dashboard, audience columns and review controls.
- `src/portal/follow-up.js`: latest-version client correction/signature actions.

## API contracts

All mutation requests use the existing authenticated session and `X-CSRF-Token` header. IDs and roles are checked on the server.

`admin_workflow_update` accepts a boolean `reviewEnabled`, integer `expectedRevision`, and UUID `requestKey`. Only superadmin may call it. The legacy `review_enabled` spelling remains accepted; contradictory aliases are invalid.

`admin_review` accepts submission `id`, `status`, `reason_text`, integer `expectedRevision` and UUID `requestKey`. Status is `approved`, `rejected`, `correction_required` or `signature_required`. The legacy `expectedReview` revision spelling is accepted. The API derives the reviewer from the session and validates enrollment, current version, notes and approval locking.

Reuse the same request key when retrying an uncertain response. A duplicate returns the recorded result. A stale workflow, submission version or decision revision returns HTTP 409; refresh state before making a new request. A missing required note or signature returns 422. CSRF and role failures return 403. Do not blindly retry a conflict with a new key.

Submission and signing requests continue to carry `workflowRevision` and `expectedCurrent`. If the switch changes during editing/upload, the stale request gets a conflict; retry against the refreshed setting. Enrollment comes from the server, never `submissionMode` or client profile flags. Submitted snapshots contain both `submission_mode: "review"` and `review_required: true` only when the server enrolls them. Direct and legacy snapshots are not rewritten.

## Migration and delivery

Client schema 8 adds a separate correction decision and optional approval notes. Migration preserves existing decision rows, IDs, timestamps, read receipts, indexes, sequence values and audit history. It does not rewrite answers, PDFs or previous profiles. DATABASE.md explains backup and rollback.

The fresh bootstrap contains admin/superadmin hashes and no client data. It is schema 8 with review off. Restoring it is for a new installation only; never replace a live store with the fresh bootstrap. See TESTING.md for the two optional-review audits and the full regression commands.
