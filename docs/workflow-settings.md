# Review workflow switch

Open **Management → Workflow / سير العمل** using the superadmin account. Choose a mode, then select **Save workflow / حفظ سير العمل**. Selecting a card alone does not change the site. Regular admins can see the active mode but cannot change it.

| Mode | Client behavior | Management behavior |
|---|---|---|
| Review workflow | Signed online submissions or confirmed signed PDF uploads enter review. | Approve, reject with a reason, or request a signature. Existing approval locks and notifications apply. |
| Form-filling tool | Fill, download, or save PDFs and answers to the account. Signing is optional. | View saved details, PDFs, versions and downloads without an active review queue or decision controls. |

The setting applies to individual and company accounts. Their data and permitted documents remain separate. The initial setting is **Review workflow**, preserving the existing site behavior.

## Existing records

- Switching modes never rewrites submissions, original PDFs, decisions, read receipts or archives.
- Previous decisions remain visible in the decision history. Turning review back on resumes review for previously eligible current versions; approved versions stay locked.
- A version saved in tool mode is permanently marked as not requiring review. Turning review on does not silently add it to the queue. A client can explicitly submit a new signed version under review mode.
- Restoring an archived version preserves that source version’s review eligibility. The original source and its history remain saved.
- All mode changes record the superadmin username, timestamp and revision in private storage.

## Implementation

Private SQLite schema 5 adds `workflow_settings` and `workflow_setting_events`. Both setting updates and review decisions use SQLite write transactions. A stale decision cannot race past disabling the workflow.

`admin_workflow_update` requires a superadmin session, CSRF token, strict boolean mode, expected revision and idempotency key. Public session responses expose only the mode and revision. Submissions record server-controlled `profile.review_required`; client-supplied values cannot override it.

Save, upload and signature actions capture the workflow revision and recheck it under the version-write lock. A mode change returns a conflict before archiving the current version or creating a PDF. Open dialogs retain their original intent; clients close and reopen them to use the new mode. Mode refreshes preserve unsaved profile entries and selected upload files.

The deployment publishes the new helper before dependent PHP files. Migration is additive, transactional and repeatable. Private client storage stays on Hostinger; the pre-deployment database backup remains in the protected private directory.

## Deployment

Live at [Management](https://forms.ahmaddalao.com/management/) → **Workflow / سير العمل**. Deployed source: `ef5024f`. Review mode remains enabled (revision 0); no production mode changes were made during verification.

## Verification

- `npm test`: 107 tests passed, including six new workflow cases for migration rollback, concurrency, idempotency, review eligibility, stale saves and archive preservation.
- Production build and PHP syntax checks passed.
- Existing review-on client regression: 12 groups, two synthetic accounts, 14 preserved versions, zero browser errors; signup/login, signature and subscription submissions, profile edits, password resets, archive/restore, private previews and exact-byte ZIP downloads.
- Isolated browser/API cycle: default-on → disabled → restarted → re-enabled; real unsigned generic and individual/company subscription saves, optional signature placement, signature enforcement on re-enable, stale requests, both management roles, ownership and exact PDF/ZIP integrity.
- English/Arabic at desktop and mobile sizes. Additional UI checks cover settings, optional signing and preservation of typed profile/login details during mode changes.
- Ten focused hotfix cases: a delayed overview response cannot replace a newer navigation choice; initial tool-mode boot reads its own dashboard response; duplicate decision receipts immediately adopt the current mode without losing history.
- Hosted read-only checks passed: 24 public-route cases, eight management-role cases, nine current asset hashes and ten unchanged public PDF hashes. No application mutations or browser errors.
- The additive production migration preserved all original rows (one user, three submissions, one review and one audit event), review sequence and all three PDF hashes. Verification ran on the server without exporting client data. Private paths remain blocked over HTTPS.

Detailed evidence and test boundaries: [workflow-verification.json](workflow-verification.json). Browser checks used Chromium/Chrome; real workflow changes and submissions were exercised in isolated local storage.

Run the repeatable local workflow audit with `npm run build && npm run test:workflow`. It creates synthetic users and private storage in a unique local fixture and does not write to production.

No document fields, legal wording, calculations or PDF templates were changed for this feature.
