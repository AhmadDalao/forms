# Editable website address — 14 October 2026

The superadmin now has a dedicated **Website settings / إعدادات الموقع** page. Saving the national address updates the shared footer on authentication, forms, profiles and management pages. Other roles cannot read the private settings endpoint or save an address. Everyone can read the public address through the existing session response.

The setting lives in private `management/state.json`, under `website`. Saves use the existing file lock, atomic replacement and an independent revision. A stale differing save returns 409 and leaves the user's draft in the editor; reloading is explicit. A retry after a lost successful response returns the saved setting without another revision. Text is escaped in initial markup and inserted through text nodes when a mounted footer refreshes.

No PDF, field mapping, submission, review workflow or database schema changed. Website edits do not rewrite PDF addresses. Fresh installations still use the approved three-line address, schema 8, review off and the supplied admin/superadmin accounts.

Verification files:

- `browser-verification.json`: 8 editing workflow checks, 56 edited-footer views in English/Arabic at desktop/mobile widths; no browser errors. Includes conflict handling, draft preservation on language change, uncertain-response retry, literal markup rendering and both client audiences.
- `default-footer-verification.json`: 64 unchanged-default footer checks across the existing common page shells.
- `api-verification.json`: role/CSRF/method checks, validation, no-op retries, independent revisions, restart and private backup/restore.
- `pdf-address-verification.json`: the approved address remains on all 10 public PDFs / 50 pages and five current Word sources.

The complete unit suite passed 265 tests with no failures or skips, and the production build passed. Representative mobile settings, Arabic conflict handling and footer screenshots were visually inspected. These checks use isolated synthetic data; production verification reads the current address without changing it.
