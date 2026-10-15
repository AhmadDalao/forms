# A developer's guide to the code

Start with this picture: the browser is the form editor and PDF renderer; PHP is the account, access and storage layer. Vite builds static assets. PHP serves the APIs and protected routes. SQLite stores records, while PDFs are separate private files. There is no framework server, MySQL dependency, background worker or external form service hidden behind the UI.

The paths below are relative to `source/` in the handover.

The 15 October terms replacement uses the approved 38-page fund PDF (`20261015-approved-terms`), with eight introductory pages and 30 numbered pages. `src/forms/terms.js` maps `investor_name` and `date`, and `src/signatures.js` maps the single `investor` signature, to physical page 38. `src/forms/customer-workflow.js` adds the full-document step before the declaration. `src/person-names.js` and `src/shared-fields.js` distinguish an individual investor's name parts from a company name. The catalogue describes fund terms; `public/api/document-catalogue.php` removes only the obsolete default telephone/fax description from saved catalogue overrides. Keep intentional owner overrides.

The former 13-page definition and Riyadh PDF are frozen under `reference/documents/archived/terms-13-page-schema.json` and `reference/pdfs/archived/terms-13-page-riyadh-20261014.pdf`. The retired 24-page layout remains historical too. These are compatibility inputs, not current templates. The supplied new source is `reference/pdfs/supplied-20261015/terms-and-conditions.pdf`; its body is preserved, with the approved address added below the existing footer artwork. Other templates and the website address are unchanged. Final release/deployment/package evidence is pending; see TEST-REPORT.md.

The shared website footer lives in `src/branding.js` and appears on forms, account/authentication and management pages. A superadmin can edit it under **Website settings**. `src/website-settings.js` receives the saved text through the existing session responses, so there is no extra startup request. It updates mounted footers with text nodes; user-entered markup never becomes HTML.

`public/api/website-settings.php` stores the override under `website` in private `management/state.json`, using its existing file lock and atomic replacement. It has its own revision and last-editor/time metadata. `management.php?action=website_settings` reads the setting; `website_settings_save` accepts `{national_address, revision}` by POST with CSRF and server-side superadmin checks. Stale differing edits return 409; an identical retry is a no-op. Public sessions expose only the address. Private backup/restore includes the setting automatically; a fresh installation uses the approved default without creating a state file.

The default remains `scripts/pdf-design/national-address.json`, copied to `public/api/national-address.json` and `dist/api/national-address.json` during builds. Website edits do **not** rewrite PDF templates or submitted/archived PDFs. The current default and all current PDF footers use the owner-supplied Riyadh address. To change printed addresses, use the footer-only updaters described in `TESTING.md` and run the footer verifier; a full Word rebuild is unnecessary for an address-only edit. Deployment uploads the settings helper and default JSON before the API entrypoints that require them.

The 8 October KYC fix removes an arbitrary six-character cap from the 28 portfolio percentage inputs. PDF generation still checks the actual available space and reports overflow. Paper copy now includes the printed risk-score explanations. KYC ID dropdowns show their own printed options; Family ID stays represented as `Other` plus its existing exact label in the shared profile, so subscription dropdowns keep their separate choices. No database migration or PDF-template change is needed. The field-by-field source comparison is included under `verification/kyc-paper-check-2026-10-08/`.

## Read the project in this order

| File or area | What to look for |
|---|---|
| `src/entry.js` | Chooses management, login/profile or the forms application. Forms load after the access check. |
| `src/portal/access.js`, `public/api/page.php`, `public/api/form-access.php` | Browser navigation and server-side access gates. Hiding a link is not the access control. |
| `src/main.js` | Catalogue, generic form editor, step navigation, draft updates and final review. |
| `src/subscription/editor.js` | Subscription has its own editor and calculated totals. |
| `src/forms/index.js`, `src/schema.js`, `src/forms/*.js` | Document definitions and the transformations applied to them. |
| `src/drafts.js`, `src/shared-fields.js`, `src/shared-sync.js` | Browser drafts, reusable-field mappings and account synchronization. |
| `src/pdf.js`, `src/portal/preview.js` | Filled PDF generation and browser PDF rendering. Follow imports from the call site; the heavy engines are deferred. |
| `src/portal/submit.js`, `upload.js`, `preview.js` | Online submission, PDF replacements and client/admin previews. |
| `src/portal/admin.js`, `submitted-details.js` | Management client profiles and categorized captured answers. |
| `src/management/main.js`, `accounts.js`, `catalogue.js` | Management entry, admin account controls and managed catalogue loading. |
| `public/api/portal.php`, `management.php` | API action dispatch, authentication, permissions and request handling. |
| `public/api/portal-database.php`, `management-accounts.php` | Database setup/migrations and admin account storage. |
| `scripts/build-folders.mjs`, `management-defaults.mjs` | Route pages and server schema/catalogue files generated during the build. |

## A normal client visit

The PHP route gate checks whether the visitor may open the category page. The browser then confirms the session and `entry.js` loads the forms code. The account category determines which six cards appear: three audience-specific forms and three shared documents. There are nine unique templates across both audiences.

The form definitions describe labels, choices, required rules, sections and PDF positions. `forms/index.js` imports these definitions and applies name, paper-copy, layout and workflow changes. Inspect the **resulting definition**, not just one input file, when debugging a field. Stable document and field IDs are important: saved answers and historical snapshots refer to them.

## What happens when a shared field changes

Take an Arabic first name entered in the individual subscription. The draft store saves that form locally. `shared-fields.js` maps the edited field to the individual Arabic-name keys. Matching ordinary drafts update from those keys. `shared-sync.js` queues a patch and saves it through `shared_profile_save` in PHP.

The browser queue is scoped to account and audience. It tracks each pending field edit, its expected previous value and a revision. That is why a late server response or another tab should not silently erase a newer local edit. Explicitly clearing a field is also an edit; it must not be confused with a missing value.

Arabic and English names are separate. Company names are separate from authorized-person names. A representative's details, overseas/tax addresses and staff-entered names must not be treated as the customer's ordinary profile. Existing deliberately different addresses need to remain different. The role switch on a signatory controls whether customer details are reused; entering the name before selecting the role must work too.

Only common profile fields synchronize to the account as the user types. A whole unsent document is still a browser draft. Submitting it creates the durable server copy. Do not tell users that every unsent document answer will follow them to another device.

## Submission and versions

The browser generates the filled PDF from the template, answer values and any signatures. The submission request sends the PDF with metadata: document/audience, answers, definition/profile snapshot, signature information, a request key and the expected current version. PHP authenticates the owner, validates the payload and stores the submission record with its private PDF.

A repeated request key protects retries from creating duplicates. An expected-version check prevents two edits from silently replacing the wrong current version. A replacement creates a new version and archives the previous one. Opening a past version does not rewrite its answers, the current shared profile or its PDF.

For signing, `submissionSigningDefinition()` in `portal-versions.php` resolves the trusted saved layout before the server's legacy fallback and current definition. It governs both signature status and accepted signing slots. The signing capability's `use_saved_pdf` flag tells `src/portal/sign-submission.js` to overlay the saved PDF instead of opening the current editor when layouts differ. Current matching online layouts keep their editor flow. This lets unsigned 13-/24-page terms be signed in place without applying page-38 coordinates or treating old signatures as consent to the new fund document. A signature creates a new version; the preceding PDF and answers remain immutable.

`src/portal/submitted-details.js` prefers captured field, section and signature definitions. For old terms records without those definitions, `src/portal/legacy-terms-definitions.js` supplies compact, frozen display labels selected by saved layout or legacy answer/signature keys. It does not replace captured definitions or rewrite answers. A known current 38-page layout takes precedence over stray old keys.

Review is optional and off by default. With the switch off, new submissions are **Received**; with it on, they enter **Under review**. Both modes accept unsigned initial forms. PHP decides enrollment inside the version transaction; browser metadata cannot opt out. Open review/correction/signature cases continue after the switch is turned off. A replacement after approval or rejection uses the current setting. Keep the decision and signature badges separate.

`portal-workflow.php` owns the setting and explicit enrollment marker; `portal-versions.php` creates immutable replacements; `portal-reviews.php` records decisions and runs schema migration 8. `src/portal/review.js` renders management decisions, and `follow-up.js` resolves client actions against the latest version. Read REVIEW-WORKFLOW.md for transition rules, request fields and conflicts.

An uploaded PDF is a file supplied by the client. It can be previewed, versioned and downloaded; it is not evidence that the application extracted its answers or verified its signature. Do not manufacture structured answers for uploads.

## PDF details worth knowing

Subscription uses its dedicated layout files under `src/subscription/`. Consent and the two FATCA/CRS documents use `src/forms/modern-layouts.json`. Individual/company KYC use their supplied seven-page PDFs and original field geometry; signature uses its one-page source and T&C the approved 38-page source. These four PDFs have no matching current Word source. There are ten public PDF assets / 75 pages, including the legacy subscription compatibility file, and five current Word sources. The authoring policy in `scripts/pdf-design/template-sources.json` excludes supplied PDFs from modern generation and installation, even when retired Word outputs remain on disk. Joined names and addresses can have several UI inputs but one printed destination. UI-only fields retain captured answers where the original paper has no corresponding space.

`pdf-lib` creates the output and PDF.js renders previews. A browser-preview rendering fault does not automatically mean the downloaded PDF is wrong. Compare the downloaded file before changing the template. Browser previews should not trigger eager loading of every document on the login page.

For a layout or address change to the same document, keep the content and stable field IDs, update coordinates/layout metadata and the relevant version, regenerate the build defaults and test the **filled** document. Replacing the legal document, as on 15 October, requires distinct fields/signature IDs and frozen historical definitions; do not recycle old consent. A blank PDF looking good proves very little about long Arabic names, email direction, checkbox marks or signatures. Preserve the supplied KYC, signature and T&C bodies; use the original-footer pipeline for approved address changes. Historical layout snapshots and saved PDFs stay unchanged.

## Management and accounts

`/management/` uses its own authentication and roles. Superadmin-only actions are enforced in PHP as well as hidden in the UI. The two supplied bootstrap accounts use guarded private credential files; admins created later use `management/administrators.sqlite`. Both stores belong in a backup.

Client details are reviewed through Current documents → Preview & details. The modal renders the captured answers by section and shows the saved PDF. All disclosure sections start closed. Clients get a simpler preview of the latest saved PDF; management can intentionally inspect an archived version. Keep those two paths distinct.

Passwords are hashed. Resetting a client password accepts a chosen temporary password, revokes older sessions and requires the client to choose a private replacement. Do not add passwords to logs, browser storage, README files or deployment commands.

## Where to make common changes

| Change | Start here | Also check |
|---|---|---|
| Label, choice or validation rule | `src/forms/` or subscription model | PHP generated schema, all languages, historical snapshots |
| Shared-field behavior | `src/shared-fields.js` | `drafts.js`, `shared-sync.js`, `public/api/portal-shared.php`, order-of-entry tests |
| Subscription amounts | `src/subscription/calculations.js` | `public/api/subscription/calculate.php` and `rules.json`; client/server results must agree |
| Form card appearance | `src/style.css`, catalogue rendering in `src/main.js` | Two columns on desktop; one on phones; full action labels |
| Login/profile appearance | `src/portal/main.js`, `style.css` | Shared header in `src/branding.js` and `branding.css` |
| Admin document details | `src/portal/admin.js`, `submitted-details.js` and CSS | Uploaded PDFs, unanswered fields and archived snapshots |
| Storage/schema | `public/api/portal-database.php` | Migrate existing installations; backup/restore and version tests |

## Review notes and known limits

There is some deliberately retained legacy behavior: old routes, old decision history, guarded bootstrap credentials and draft migrations. Removing it as “unused” can break existing accounts or links. The large `main.js` and `portal.php` files mix several responsibilities; change them narrowly and keep tests close to the behavior being changed.

SQL/filesystem boundaries and request authorization deserve particular attention in review. Keep both the record and its PDF consistent, never trust a supplied account ID without checking ownership, and keep every private file outside public download paths. Recheck `.htaccess` behavior on the destination host; the localhost router cannot certify that host's rules.

The current first-visit slowdown has a measured hosting component: a Hostinger browser challenge before the application opens. PERFORMANCE.md separates that observation from application/API timing. The destination host is not yet tested. TESTING.md is the acceptance checklist, and TEST-REPORT.md records the evidence including the current PDF, workflow and cross-browser regression evidence.
