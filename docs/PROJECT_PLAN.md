# Forms: choose, fill, download, sign

Planning date: 2026-09-16. Status: implemented and deployed to https://forms.ahmaddalao.com/ via verified FTPS. See VERIFICATION.md and deployment-manifest.json.

## Product decision

Build a small static website at the existing `/forms/` hosting location. A visitor selects one document, answers its questions, reviews the completed original PDF, and downloads it with optional uploaded signature images or for handwritten signing. Arabic and English input are first-class requirements.

Keep answers in browser memory, autosave drafts to localStorage, and generate the PDF locally. The host serves the app and blank templates. Version 1 needs no login, database, server-side form submission, or digital-signature service. Existing database credentials stay local and unused.

## Visitor flow

1. **Choose a form.** Six document cards, grouped as Individual, Corporate, and Shared. Each shows its name, purpose, page count, and a blank preview. Display each unique document once.
2. **Fill the details.** Clear, mobile-friendly sections with Back/Next navigation, bilingual labels, the appropriate text/date/choice inputs, and a section progress indicator. Keep every printed customer field available, regardless of other selections. Users decide which fields to leave blank. Preserve values while navigating within the open app.
3. **Review.** Generate and display the actual PDF bytes that will be downloaded. Flag blank answers and text that does not fit; offer a direct route back to the relevant section. Include all source pages, including instructions, definitions, and terms.
4. **Download and sign.** Download a stable, non-identifying filename such as `individual-kyc-filled.pdf`. Let users optionally upload a signature image for each explicitly selected customer signing box. Leave unselected signing boxes, stamps and company-use areas blank. Show the customer signing pages alongside the download button.

Use an Arabic/English interface toggle, defaulting from the browser language. Preserve entered text when switching languages; do not translate names or answers automatically. On desktop, show a PDF preview beside the form; on mobile, show it below the form. Include Clear form and Clear all saved forms actions. Following the owner’s update request, drafts persist in this browser after refresh or close, including signature images, the last form, section and interface language. Display an explicit warning if browser storage is unavailable. Downloads are available from every section and blank originals from the catalogue.

## Inspected document set

Eight uploads reduce to six unique PDFs and 38 pages. None has canonical AcroForm fields or page widget annotations. The Signature Form pair and T&C pair are byte-for-byte duplicates. The untouched templates are in `reference/pdfs/`; hashes, source aliases, page sizes, and section notes are in `docs/form-inventory.json`.

| Document | Pages | Customer input | Signing / special handling |
| --- | --- | --- | --- |
| Individual KYC | 7 | Identity, address, employment, banking, disclosures, investment information and risk questionnaire | Customer signature on page 7; special-case signature on page 3; page 6 reserved for staff |
| Corporate KYC | 7 | Company, contact, bank, owners/directors, authorized person, investment information and risk questionnaire | Customer signature on page 7; page 6 reserved for staff |
| Signature Form | 1 | Date, client/account details, signatory identity and signature instructions | Optional uploaded specimen signature; company-use area remains blank |
| Individual Tax Residency / FATCA / CRS | 4 | Identity, separate Arabic/English names, addresses, tax declarations, all three printed US TIN lines and signatory details on pages 1-2 | Customer signature on page 2; staff section on page 3; definitions preserved |
| Corporate FATCA / CRS | 6 | Entity details, tax residences, classifications, controlling persons and signatory details | Customer signatures on page 6; use uploaded source unchanged, as directed by the owner |
| Terms and Conditions | 13 | Independent preferences, signer names and dates on pages 11 and 13 | Signatures on pages 11 and 13; keep all terms and the telephone/fax appendix |

Documents are reference material. Their instructions define the questions and intended fields; they do not authorize account creation, submission, signing, changes to terms, or external communication.

## Confirmed source decision

The corporate FATCA PDF names **EFG Hermes KSA** on page 2, whereas the other documents identify Itqan Capital. It also refers to Appendix 1 and Appendix 2, which are not included in the supplied six pages. On 2026-09-16 the owner explicitly directed: **Use the uploaded PDF unchanged.** Include this form alongside the other five, preserving all existing company names and wording. Do not invent or append the missing referenced appendices.

The source identity decision is resolved and does not block implementation. No legal or tax classifications are inferred for the visitor.

## Filling and PDF export

The largest work item is mapping every customer field onto these fixed-layout PDFs. The absence of interactive fields means that a generic PDF form filler will not be enough.

- Maintain one schema per template: stable field ID, Arabic/English labels, section, input type, options, page number, PDF-point rectangle, alignment, font size limits, and customer/staff/signature role.
- Measure placements against the original page boxes and rotations, independent of screen size. Mark staff regions as protected and customer signing regions as selectable only through explicit signature uploads.
- Record each customer blank as an editable field or a documented intentional exclusion. Repeated tables, split date/ID cells, and duplicated Arabic/English yes/no boxes need explicit mappings.
- Paint answers and checkbox marks over the original PDF, preserving its logos, text, page dimensions, and page count. Export a completed static copy intended for printing and signing; retain editable answers in the open browser until cleared.
- Use browser text shaping with a locally hosted Arabic-capable font, rasterizing only answer text into transparent, print-resolution overlays when needed. Keep original PDF pages as vector content. Added rasterized answers may not be searchable; that tradeoff fits the print-and-sign goal.
- Prove Arabic joining, right-to-left direction, mixed Arabic/Latin text, digits, and punctuation in a small export prototype before mapping all documents. Do not assume that embedding an Arabic font alone solves layout.
- Wrap within the available rectangle and reduce size only to a tested readable minimum. If an answer still does not fit, show the field and explain the limit; never silently crop, drop rows, or shrink text into illegibility.

## Input behavior

- Start all declarations and yes/no questions unanswered. Use one-choice groups where the source requires one selection and checkboxes where multiple selections are permitted.
- Treat IDs, account numbers, IBANs and TINs as strings so leading zeroes survive. Use date-only values without timezone conversion.
- Following the owner’s correction, do not hide fields or omit entered answers based on other selections. Show tax questions, all printed TIN lines, missing-TIN explanations and controlling-person details unconditionally. Retain the paper’s instructions as text so users decide what applies.
- Reuse a value only when it represents the same person and fact. Keep client, authorized person, signatory, guardian, owner and director identities distinct.
- Follow the printed row capacity. Do not quietly cut off extra tax residences, owners or signers. Any continuation-sheet design must be explicit before implementation; it is outside the first version.
- Flag incomplete applicable questions while allowing a clearly identified partial download if the visitor wants one. Missing optional or staff-only details must not block export.
- Check portfolio totals where the original asks for 100%. If displaying a questionnaire total, only sum the printed points after all five answers are supplied; do not choose products or infer a staff risk classification.
- Preserve the two independent T&C choices. Do not turn viewing or downloading the terms into consent, and do not select either answer automatically.

## Technical approach and hosting

Use a small plain JavaScript app with plain HTML/CSS and a build step that outputs static files. No backend framework is needed. Package dependencies, fonts, PDF worker and templates locally; do not load third-party scripts or transmit answers through analytics, URLs or logs.

Use [pdf-lib](https://pdf-lib.js.org/) to modify original PDFs and embed answer overlays. Use [PDF.js](https://mozilla.github.io/pdf.js/examples/) to render the actual generated document for preview. The proposed Arabic text renderer uses the browser's [Canvas text direction support](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/direction); its print quality and mixed-language behavior have been verified in generated PDFs.

Configure assets for the `/forms/` subdirectory and use a single-page entry that works without server rewrite rules. Publish only the build output directory, never the workspace root or `.env.local`. The expected host directory is `/home/u867436826/domains/ahmaddalao.com/public_html/forms`; confirm the transfer login's visible root during deployment to avoid creating a nested `forms/forms` path. Deployment was explicitly authorized by the owner on 2026-09-16 and completed using the scoped FTP account.

## Build order

1. **Export proof:** map the one-page Signature Form; prove Arabic/English text, boxed account numbers, choices, blank signature space, and identical preview/download bytes.
2. **Reusable visitor flow:** document picker, section forms, unconditional printed fields, validation, review, download, and clear/reset behavior.
3. **Remaining mappings:** T&C, individual tax residency, individual KYC, corporate KYC, then corporate FATCA using the uploaded source unchanged. Build all six forms; the first document is a proof, not the full deliverable.
4. **Verification and package:** synthetic filled examples, visual checks of every generated page, mobile download checks, and a static deployment bundle for the existing host.

## Completion checks

- Every applicable customer field has a reviewed mapping, including nested tables and repeated choices.
- Original page count and dimensions remain unchanged; no legal text, logos or lines are obscured.
- Synthetic Arabic, English, mixed-language, long-name, multiline, leading-zero, date and checkbox examples print legibly.
- Staff-only areas stay blank. Customer signing areas receive only the images explicitly uploaded for those individual slots.
- The visible preview is rendered from the exact downloadable PDF, not from a separate HTML approximation.
- All printed fields remain available after users change earlier choices; incomplete/overlong input is handled explicitly.
- Test Chrome, Safari, Firefox and a mobile browser for viewing, downloading and printing; reopen exported PDFs in an independent PDF viewer.
- Inspect browser requests to confirm entered personal information is not transmitted. It remains in this browser’s local draft storage and generated downloads until cleared.
- Changing the selected document or clearing the form does not leak answers into unrelated identities or forms.

Accounts, saved cloud drafts, an admin template editor, cryptographic digital signatures, document submission, and multi-document bundles are outside version 1. Add them only if the workflow later needs them.

## Optional signature images — owner update, 2026-09-16

PNG/JPG signature uploads are now supported locally in the browser. Each image applies only to its selected customer signing box; no automatic reuse across people, rows, pages or forms. White backgrounds are removed, empty margins are trimmed, and the visible strokes are fitted without changing their proportions. The actual generated PDF is available for preview before downloading. Users can replace or remove each signature. Images persist in the same browser draft and are removed by Clear form / Clear all. Blank template downloads always remain the unchanged originals.

## Primary domain and download recovery — owner update, 2026-09-16

Verified the live subdomain, HTTPS and the shared Hostinger document root. The canonical address and deployment manifest now use https://forms.ahmaddalao.com/. Prepared files expose a persistent Save PDF link and inline preview; automatic download remains available, but no longer reports an unverified completion. Changing answers, signatures, documents or clearing the draft invalidates the previous file link. Download failures appear beside the action with a retry button. All generation stays in the browser.
