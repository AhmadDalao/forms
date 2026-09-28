# Form header actions — 28 September 2026

Removed the redundant Show document button beside the generic form downloads and its obsolete side-preview panel. The header now matches subscription: Download blank and Download PDF. The download-ready message keeps the Save PDF fallback without an extra preview shortcut. Mobile headers use two equal action columns.

The final review step still shows every completed PDF page before submission. T&C retains its original 13-page first step. Submitted-document previews in management and client notifications remain available. No PDF, field definition, data, API or schema changes.

Verification: 229 unit tests passed. The isolated customer workflow audit checked every individual/company form header in Arabic and English at 390px and 1440px, every generic form's complete final review, T&C first step, signatures, consent submission, card downloads, signed replacement upload, archived version retention, ZIP download and profile updates. Loading checks confirm no PDF/engine requests when merely opening ordinary forms, late shared data does not overwrite user edits, and confirmed account values restore after reload. No browser errors. The Arabic KYC screenshot was visually inspected.

Reproduce after building with `node scripts/customer-workflow-audit.mjs` and `node scripts/loading-audit.mjs`. See `form-preview-actions-verification.json` for results. Tests use synthetic accounts and isolated private storage.

Published to the main Hostinger site with overwritten public files backed up and private storage preserved. All three changed live assets match the tested build; the published editor contains no header/ready-message preview shortcut and retains final-step rendering. Individual/company authentication and management login passed. See `form-preview-actions-live-verification.json`.
