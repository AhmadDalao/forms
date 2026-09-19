# Subscription application rebuild

The individual and company subscription applications are isolated on `codex/subscription`, based on `codex/management`. Nothing from this branch has been deployed. The other document schemas and PDF templates are unchanged; the individual audience's redundant section-level signature launcher was removed.

## Local preview

Build with `npm run build`, then run from this worktree:

```sh
FORMS_DATA_DIR="$PWD/management-data" php -S 127.0.0.1:8184 -t dist scripts/management-router.php
```

- Individuals: <http://127.0.0.1:8184/individuals/>
- Companies: <http://127.0.0.1:8184/companies/>

This is a separate preview from the existing management installation on port 8181. Keep its management state separate.

## Behavior

The first document in each folder has four sections and a full, two-page PDF review. Individual names use first, second, optional third and family names. Company applications collect company registration and authorized signatory details. Each audience reuses only its own shared profile. Previously saved subscription names and company drafts migrate when loaded.

Shared answers are displayed without duplicate input controls. The shared-profile link returns to the existing customer information panel for corrections. Applicant names are generated from the customer/signatory name until the customer edits that particular field. The application date starts at today's local date and remains editable.

The applicant section owns the electronic/manual signature selection. Electronic signing requires an uploaded image for final review. Manual signing removes the uploaded applicant signature from the generated document. Drafts, step position and selected signatures remain browser-local.

The current implementation accepts whole units from 1 through 999,999,999 for both audiences. Empty units are permitted for partial downloads. Fund, currency and unit price are fixed; investment, the 2% fee, total and Arabic total words update together. `public/api/subscription/rules.json` supplies the shared constants and number vocabulary. JavaScript calculates the live view; PHP independently calculates the downloaded values from the unit count alone. The browser sends no customer data or signature to this endpoint, and submitted amount overrides are ignored. Failed backend validation prevents a new filled PDF while preserving the local draft. Blank downloads remain available.

## Editable templates

- `output/documents/subscription-individual.docx`
- `output/documents/subscription-company.docx`
- `output/pdf/subscription-individual.pdf`
- `output/pdf/subscription-company.pdf`

The original participation undertaking, risk/receipt declaration, issuer details and fund-manager approval space are retained. The documents use an embedded Bahij TheSans Arabic font, bilingual labels, generous answer areas and transparent blue answers. The web form uses the corresponding PDFs in `public/pdfs/`.

`scripts/rebuild-subscription.py` generates the editable Word sources, exports through the bundled LibreOffice runtime and measures PDF field positions from temporary probe documents. The measured layouts are in `src/subscription/*-layout.json`. For future layout changes, update the source builder, regenerate both formats and mappings, and inspect every page. Replacing a PDF after manually moving Word fields requires updating its coordinates as well.

## Verification completed

- Production build and all 43 unit tests pass.
- Five full browser fills per audience: English, Arabic, long mixed text, shared-profile/mobile, and the maximum unit count.
- All 10 filled PDFs were downloaded, rendered and visually reviewed: 20 pages, with zero detected intersections between added blue answers and original labels or borders.
- Every answer image retains a transparency mask; manual signature areas remain empty, including after switching from electronic signing.
- Additional browser checks cover partial downloads from all four sections, missing required answers, fractional-unit rejection, a failed calculation request and retry, draft restoration, shared-profile editing, reset, editable applicant names, and existing document downloads.

Reproducible checks:

```sh
npm test
npm run build
node scripts/subscription-smoke.mjs
node scripts/subscription-audit.mjs
node scripts/subscription-edge-cases.mjs
```

Run `scripts/verify-subscription.py` with the bundled Python runtime after the browser audit to render samples and check transparent overlays. Disposable screenshots, filled samples and reports are under ignored `tmp/subscription/`.

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

The corrected PDFs are version 3. Current preview: `http://127.0.0.1:8185/individuals/` and `/companies/`. Registration at `/register/` now asks only for first and last name, mobile, password and confirmation. The official application still collects its required name parts separately and reuses shared values. Existing client accounts and archived PDFs are unchanged.

Validation: 50 unit tests; five complete fills per audience; 20 generated pages checked for answer overlap/transparency; manual signatures remain blank; English/Arabic signup and mobile layouts; submissions, editing, archives, restores, password resets and named ZIP exports. Use `FORMS_BASE_URL=http://127.0.0.1:8185 node scripts/subscription-audit.mjs` for this branch, followed by the bundled-Python `scripts/verify-subscription.py`. The portal audit uses an isolated database on port 8187. No production deployment.
