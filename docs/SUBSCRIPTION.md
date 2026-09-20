# Subscription applications

The individual and company subscription applications are part of the current production portal. The access and shared-data behavior below supersedes the original branch-only notes: clients must sign in, fill their details in the form itself, and reuse matching customer details automatically across their account's other forms. Historical rebuild checks below record earlier validation rather than the latest release's results.

## Local preview

Build with `npm run build`, then run from this worktree:

```sh
FORMS_DATA_DIR="$PWD/management-data" \
FORMS_PORTAL_DATA_DIR="$PWD/portal-data" \
php -S 127.0.0.1:8184 -t dist scripts/management-router.php
```

- Individuals: <http://127.0.0.1:8184/individuals/>
- Companies: <http://127.0.0.1:8184/companies/>

Register or sign in before opening a form. Individuals land in `/individuals/` and companies in `/companies/`; an opposite-category link returns the client to their permitted folder. The server protects direct PDF/template links as well as the page. Keep local client and management storage separate from production.

## Behavior

The first document in each folder has four sections and a full, two-page PDF review. Individual names use first, second, optional third and family names. Company applications collect company registration and authorized signatory details. Each audience reuses only its own shared profile. Previously saved subscription names and company drafts migrate when loaded.

Customer name, phone, identity and address inputs remain editable in their own document sections. There is no separate shared-fields panel or link asking the customer to enter them elsewhere. Editing a mapped common field updates the browser profile, autosaves the private account profile, and fills matching fields in the other ordinary forms for that account and audience. Arabic and English names use first, second, optional third and family parts. Full-name fields receive the joined value. Unrelated people, signatures and document-specific answers remain independent.

Applicant names are generated from the customer/signatory name until the customer edits that particular field. The application date starts at today's local date and remains editable. Opening or restoring a submitted/archived version preserves its historical answers and deliberate blanks, without copying them into the current profile. An explicit correction to a mapped common field in a revision does update the current profile and ordinary drafts; the saved version and all archived PDFs remain unchanged.

The applicant section owns the electronic/manual signature selection. Electronic signing requires an uploaded image for final review. Manual signing removes the uploaded applicant signature from the generated document. Drafts, step position and selected signatures remain browser-local until a form is submitted/saved, while mapped customer details autosave to the account separately. When review is enabled, electronic signatures are required for direct submission; manually signed PDFs can be uploaded through My applications. When review is disabled, Save form stores a copy without starting a review and signing is optional.

The current implementation accepts whole units from 1 through 999,999,999 for both audiences. Empty units are permitted for partial downloads. Fund, currency and unit price are fixed; investment, the 2% fee, total and Arabic total words update together. `public/api/subscription/rules.json` supplies the shared constants and number vocabulary. JavaScript calculates the live view; PHP independently calculates the downloaded values from the unit count alone. The browser sends no customer data or signature to this endpoint, and submitted amount overrides are ignored. Failed backend validation prevents a new filled PDF while preserving the local draft. Blank downloads remain available.

## Editable templates

- `output/documents/subscription-individual.docx`
- `output/documents/subscription-company.docx`
- `output/pdf/subscription-individual.pdf`
- `output/pdf/subscription-company.pdf`

The original participation undertaking, risk/receipt declaration, issuer details and fund-manager approval space are retained. The documents use an embedded Bahij TheSans Arabic font, bilingual labels, generous answer areas and transparent blue answers. The web form uses the corresponding PDFs in `public/pdfs/`.

`scripts/rebuild-subscription.py` generates the editable Word sources, exports through the bundled LibreOffice runtime and measures PDF field positions from temporary probe documents. The measured layouts are in `src/subscription/*-layout.json`. For future layout changes, update the source builder, regenerate both formats and mappings, and inspect every page. Replacing a PDF after manually moving Word fields requires updating its coordinates as well.

## Historical rebuild verification

These counts describe the original subscription rebuild. They are not the current unit-test total or proof of the newer login-required/form-to-form linking workflow. See the current release report for its executed checks.

- Production build and all 43 unit tests pass.
- Five full browser fills per audience: English, Arabic, long mixed text, shared-profile/mobile, and the maximum unit count.
- All 10 filled PDFs were downloaded, rendered and visually reviewed: 20 pages, with zero detected intersections between added blue answers and original labels or borders.
- Every answer image retains a transparency mask; manual signature areas remain empty, including after switching from electronic signing.
- Additional browser checks cover partial downloads from all four sections, missing required answers, fractional-unit rejection, a failed calculation request and retry, draft restoration, shared-profile editing, reset, editable applicant names, and existing document downloads.

Current access/linking checks:

```sh
npm test
npm run build
node scripts/form-access-audit.mjs
node scripts/form-linking-audit.mjs
```

The older `subscription-smoke.mjs`, `subscription-audit.mjs` and `subscription-edge-cases.mjs` scripts cover earlier editor flows; adapt anonymous entry or separate shared-panel assumptions before using them against this release. `scripts/verify-subscription.py` renders existing browser samples and checks transparent overlays using the bundled Python runtime. Disposable screenshots, samples and reports stay under ignored `tmp/` directories.

## Original-form correction — 19 September 2026

The current client-portal branch retains the supplied original at `reference/pdfs/subscription-form.pdf` and `public/pdfs/subscription-form.pdf`. Both match the uploaded `ItqanSubscriptionFormV3.11.pdf` byte for byte (SHA-256 `00f425442280ac98c154a4a40c17951695fc8ee6ba10af2aaf7bed87bf990a0a`). The editable sources build on its sections rather than reducing them to a summary.

| Original content | Current editable document |
| --- | --- |
| Itqan logo, salutation and participation undertaking | Original logo asset; bilingual undertaking on page 1 |
| Client/account, title and names | Page 1; restored title and English-name fields |
| Individual or company identity | Page 1 in the appropriate audience version |
| Correspondence address | Page 1, with the requested national-address fields plus optional P.O. Box |
| Subscription Details / تفاصيل الاشتراك | Prominent original-style purple section bar on page 2; all requested calculated amounts |
| Risk and receipt declaration | Full Arabic and English wording on page 2 |
| Applicant name, date and signature | Page 2, with the existing electronic/manual signature flow |
| Company-use approval block | Page 2; signature verification, branch/date, account manager, entered-by, reviewer/approver and three separate staff signature lines retained for completion on paper |
| Issuer/contact/copy information | Footer on both pages |

The original's combined identity area remains split into individual and company versions as requested. The separate percentage and fee-amount inputs remain consolidated into the single calculated 2% fee. Additional national-address fields and readable answer areas use two pages. Other forms are unchanged.

The corrected PDFs are version 3. The September 19 preview ran on port 8185; the current local preview command is above. Registration at `/register/` asks for account type, first and last name, mobile, password and confirmation. The official application collects its required name parts separately and reuses matching account data. Existing client accounts and archived PDFs are preserved.

Historical validation at that correction: 50 unit tests; five complete fills per audience; 20 generated pages checked for overlap/transparency; manual-signature blanks; English/Arabic signup/mobile layouts; submissions, archives, restores, resets and named ZIP exports. That correction was initially tested before publication; these historical counts do not describe today's release or deployment status.
