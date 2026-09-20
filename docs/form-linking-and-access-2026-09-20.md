# In-form common data and required login — 20 September 2026

The separate shared-details panel and correction links are removed. Customers edit the existing fields in each document. Explicit edits to mapped customer names, contact details, identity details and corresponding address components update matching ordinary drafts and the private account profile. Browser storage remains active, including pending offline edits.

Individual/company profiles and different client accounts stay separate. Arabic and English four-part names stay distinct. Other people's names, bank details and unrelated address roles are not treated as the customer's identity. Combined free-text address boxes are not split into invented components.

Opening a submitted version preserves its exact answers. Explicitly correcting a common field in that revision updates the live profile and ordinary drafts; neither that action nor background profile updates rewrites saved submissions/PDFs. The revision's other historical answers remain intact until the client changes them.

Root and direct form-page links require authentication. Clients are redirected to their assigned Individuals or Companies folder. Template PDFs and the published catalogue enforce authentication and account category on the server. Management retains authenticated preview access. Unpublished uploaded documents remain restricted to superadmins. Retired preview links redirect to the protected main installation.

## Validation

- Production build passed; 194 unit tests passed.
- Six real-session access groups passed: root/index routes, category restrictions, original/uploaded PDFs, catalogue filtering, password-reset/session revocation, forged cookies, management preview and logout.
- 27 integration groups passed across Chrome, Firefox and WebKit, with no JavaScript errors. Coverage includes edits originating in different forms, Arabic/English typing without losing focus, clearing common values, new-browser recovery, offline tabs, individual/company isolation, explicit revision corrections, immutable submitted versions and logout/login redirects.
- Six actual filled PDFs downloaded during pending autosaves and passed PDF/page-count checks. No PDF template or rendering geometry changed in this update; the prior complete paper-alignment audit remains the layout evidence.
- A ten-group Chrome follow-up also passed, adding same-browser sign-out/sign-in to a different account with no previous client's fields or drafts shown.
- Desktop and Arabic mobile screenshots were inspected; no horizontal overflow was detected.

Evidence (local, excluded from deployment):

- `tmp/form-linking-unit.log`
- `tmp/workflow-toggle-1789915760366-ac0c13/form-access-report.json`
- `tmp/workflow-toggle-1789915919060-f69a62/form-linking/report.json`
- `tmp/workflow-toggle-1789916027776-7fc06d/form-linking/report.json`

These tests used synthetic users and isolated private storage. They did not modify production clients, profiles, submissions or decisions. Earlier audit assumptions about anonymous form access and a separate shared-details editor are superseded by this change.

## Production verification

Source commit `92d6f2b6588d36ef7e0fcca0e15b4b037b5beae1` was published to Hostinger. One FTP read timed out while checking an existing file; the successful retry verified all 79 public build files. Both attempt backup locations are retained in `docs/deployment-manifest.json`. Production private storage was preserved.

Six live verification groups passed on the actual Apache installation, including both `forms.ahmaddalao.com` and the older `ahmaddalao.com/forms/` alias. Anonymous root/folder/index requests redirect to login; PDFs and catalogue APIs deny anonymous requests; schema/private paths remain blocked; retired preview links redirect to the protected site. All 37 release asset hashes match, and four authenticated individual/company PDF downloads exactly match the build. English individual and Arabic company editor screens have editable fields, no separate shared-entry panel, and no horizontal overflow. Logging out removes PDF access.

Live verification used management authentication only, with no client-data reads or business writes. The management session was logged out afterward. Evidence: `tmp/form-linking-live/report.json` and its screenshots.
