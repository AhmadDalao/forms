# A developer's guide to the code

Start with this picture: the browser is the form editor and PDF renderer; PHP is the account, access and storage layer. Vite builds static assets. PHP serves the APIs and protected routes. SQLite stores records, while PDFs are separate private files. There is no framework server, MySQL dependency, background worker or external form service hidden behind the UI.

The paths below are relative to `source/` in the handover.

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

The current workflow accepts online submissions as **Received**, including unsigned ones. Management follows up manually. The old approval/rejection API paths are disabled, but historical decisions stay readable. Keep receipt status and signature status separate.

An uploaded PDF is a file supplied by the client. It can be previewed, versioned and downloaded; it is not evidence that the application extracted its answers or verified its signature. Do not manufacture structured answers for uploads.

## PDF details worth knowing

Subscription uses its dedicated layout files under `src/subscription/`. Other documents use their definitions plus `src/forms/modern-layouts.json`. Joined names and addresses can have several UI inputs but one printed destination. UI-only fields are intentional where the paper has a combined space.

`pdf-lib` creates the output and PDF.js renders previews. A browser-preview rendering fault does not automatically mean the downloaded PDF is wrong. Compare the downloaded file before changing the template. Browser previews should not trigger eager loading of every document on the login page.

For a template change, keep the content and stable field IDs, update coordinates/layout metadata and the relevant version, regenerate the build defaults and test the **filled** document. A blank PDF looking good proves very little about long Arabic names, email direction, checkbox marks or signatures. Keep the original signature and T&C PDFs intact unless the owner specifically asks to change them.

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

The current first-visit slowdown has a measured hosting component: a Hostinger browser challenge before the application opens. PERFORMANCE.md separates that observation from application/API timing. The destination host is not yet tested. TESTING.md is the acceptance checklist, and TEST-REPORT.md records the evidence without claiming a new legal review or a fresh exhaustive visual audit.
