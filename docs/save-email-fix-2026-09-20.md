# Form saving — 20 September 2026

Reproduced a save failure by entering an unfinished email (`name@`) in KYC and then saving the Signature Form. The shared profile correctly retained the unfinished draft, but submission validation incorrectly rejected it even though the Signature Form has no email question.

The server now validates email answers belonging to the current document. It preserves the exact shared-profile snapshot and only copies a valid email into an empty account email. A current-document email takes precedence over the shared snapshot. Existing account emails are unchanged.

Validation:

- PHP syntax, production build and 194 unit tests passed.
- 18 focused regression groups passed, including actual browser saves in English and Arabic for individual/company accounts, rejection of invalid email in the current KYC, valid contact-email precedence, correcting and saving a new version, and immutable archived snapshots. No JavaScript errors.
- Evidence: `tmp/workflow-toggle-1789921083857-5fcc78/save-email-regression.json`.
- Repeat the focused audit after building with `node scripts/form-save-email-repro.mjs`. It uses synthetic accounts and isolated local storage.

The reported symptom did not specify an error or document. This corrects a reproduced blocker; it does not establish that every possible save failure shares this cause.
