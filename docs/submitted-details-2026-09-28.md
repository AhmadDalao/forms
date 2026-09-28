# Submitted details presentation — 28 September 2026

Management preview now opens with Submitted details closed. Its document categories, signatures and previous-decision history also start closed. Client previews remain PDF-only.

The redundant shared-customer snapshot section is removed from presentation. Underlying account sharing, captured profile snapshots, answers, PDFs, previous decisions and archived versions are preserved.

Both the inline management profile and the preview use the same PDF-inspired presentation: full-width dark-purple category headers, white field cells, blue values, longer answers spanning both columns, and a single-column phone layout. Native details/summary controls retain keyboard support. Text directions for email, phone, identifiers and Arabic answers remain explicit.

Verification:

- Build succeeds; 236 unit tests pass.
- All nine editable forms checked in Arabic/English on desktop/mobile: 36 form presentations, every rendered field label/value/direction checked, category and signature accordions initially closed, shared snapshot absent, no horizontal overflow.
- Both management preview entry points checked, including keyboard expansion and complete PDF rendering.
- 19 management workflow checks across Chrome, Firefox and WebKit: permissions, current/archived versions, retries and session expiry.
- 26 client preview checks across the same engines: latest-version resolution, mobile/RTL, PDF pages and notification return flow.
- Expanded desktop Arabic and phone English previews visually inspected.

Evidence: `submitted-details-verification.json`. Deployment is public frontend only, with overwritten-file backups and private storage preserved. Live verification is recorded separately in `submitted-details-live-verification.json`. No database or PDF migration is required.
