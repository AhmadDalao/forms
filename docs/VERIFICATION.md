# Verification — 2026-09-16

## Build and application

- `npm test`: 11 tests passed for draft recovery/clearing, unconditional paper fields, all three US TIN lines, leading-zero identifiers and document/page mappings.
- `npm run build`: passed. The PDF libraries produce a large bundle warning; this does not prevent the static production build.
- Synthetic Arabic/English examples exported for all six documents. All 38 source pages, page dimensions and original text were retained. Untouched pages and selected signature/staff regions were compared as rendered pixels.
- Visually reviewed generated pages and corrected split dates, boxed identifiers, narrow tax tables, checkboxes, Arabic text and small multiline fields. Additional exports checked all corporate GIIN and US TIN lines.
- Chrome, Firefox and WebKit passed the production-build flow at desktop/mobile sizes: choose, enter Arabic/mixed text, preserve leading zeros, preview, download, edit, reject overflowing answers, switch language, clear, and open all six documents.
- Local drafts autosave to app-prefixed localStorage keys. No form submissions or answers in network requests. Hostinger may perform its own browser challenge before the application opens; this was observed separately from entered answers.

## Deployment

- Uploaded the static `dist/` directory using explicit FTPS on port 21. Control/data encryption and certificate/hostname validation remained enabled.
- FTP root `/` is scoped to `/home/u867436826/domains/ahmaddalao.com/public_html/forms`.
- Published dependencies before `index.html`. Left the existing `default.php` and unrelated files untouched.
- `https://ahmaddalao.com/forms/` returns HTTP 200 over HTTPS.
- The live Hostinger site passed the same six-document fill/preview/download checks in Chrome, Firefox and WebKit, including mobile Arabic review, overflow handling, reset and no answer transmission.
- Downloaded every public deployed file and checked its SHA-256 against the build. The PDF worker is served as JavaScript, and the original PDF templates match byte-for-byte.
- Confirmed saved FTP/database passwords are absent from the public build. `.env.local` remains mode 0600 and was not uploaded.

## Scope

The output is a static PDF for printing, with optional user-uploaded signature images. Unselected signing areas and staff-use areas remain blank. Drafts persist after refresh/close in the same browser. Clear controls remove one or all app drafts; unrelated site storage is preserved. The app does not submit documents, classify tax status, verify identity or provide a digital signature. It retains the exact supplied corporate FATCA document, including its EFG Hermes wording, as explicitly approved by the owner.

## Follow-up fixes and improvements

- Remeasured individual KYC rounded fields against source vector borders, including names, nationality, addresses, contact details and date cells. Date placeholder erasure now targets only the labels, preserving the printed borders. Also corrected representative/witness cells and refined signature-form insets.
- A screenshot-based regression fixture verified all 20 KYC field borders remain pixel-identical. All six schemas were scanned at character level for overlap with original printed letters.
- Arabic and Persian digits now work in portfolio totals. Invalid numbers produce a clear warning instead of a misleading zero total.
- Persistent drafts use separate keys per form, restore the last section/language, and support clear-one and clear-all. Storage failures keep answers in memory and display an unavailable-saving message. Clearing in another tab updates the current tab.
- Blank downloads are byte-for-byte original PDFs. Download buttons work without visiting Review, including partially completed forms and every document section.
- Follow-up browser verification passed on the production build in Chrome for Testing, Firefox and WebKit. The live deployment passed the full Chrome-for-Testing restart/restore, section-download and clear-data flow, with no transmitted form answers.
- A delayed-template regression verified downloading before the preview loads; a blocked-storage regression verified the warning and a working PDF download.
- Final live HTML/JavaScript hashes matched the build after the last upload; delayed-preview and blocked-storage download checks also passed against the live URL.

## Paper-form behavior correction

- Removed conditional hiding and export filtering throughout all six forms. Users decide what to fill or skip; changing a classification does not remove entered answers from the PDF.
- Removed the invented US TIN type selector. SSN, ITIN and ATIN are separate, always available lines, matching the uploaded paper. Existing answer field IDs and draft keys are preserved.
- Browser regression checked all 361 mapped fields with blank and changing selections, plus refresh recovery and early download of formerly hidden answers.
- Synthetic fixtures deliberately use selections that previously hid dependent fields. All 294 entered text fields were verified as rendered in their mapped PDF spaces. All 38 pages retained original text and geometry; protected signature/staff areas and 20 individual KYC borders remained unchanged.
- Visually inspected the affected individual tax, corporate tax and KYC pages. Original PDF template files remain byte-for-byte unchanged.
- Deployed this correction using verified FTPS. Every public file matched the build SHA-256 over HTTPS. The live site passed all-field visibility checks, actual downloaded-answer checks, browser restart recovery, every-section downloads, blank-original downloads and clear-one/all/tab behavior.

## Five-sample alignment audit

- Filled and downloaded every document five times through its browser inputs: English, Arabic, longer English, longer Arabic and mixed Arabic/English. Final local audit: 30 PDFs, 190 pages, 1,480 text-field checks and 2,260 transparent text-image checks.
- Removed white rectangle painting. Faint date/TIN placeholders are excluded from the original drawing only when their field is filled; text overlays retain transparent backgrounds. The original template files are unchanged.
- Corrected 80 checkbox bounds against the rendered source glyphs, with proportional stroke widths for smaller boxes.
- Corrected the corporate KYC ID row to its actual eleven cells; moved KYC contact/financial text above writing guides; limited bilingual answers to their printed cells; adjusted corporate tax right margins and ownership percentages.
- All 190 pages retained source text and page geometry. All 80 untouched sample pages were pixel-identical. Added ink was confined to mapped spaces; no whitening occurred outside the faint placeholder areas. Existing signature/staff and KYC border regressions passed.
- Visually reviewed every filled page using long Arabic/English comparisons and five-sample detail sheets for all six forms. Blank, partially filled and overflow behavior remain supported; answers that exceed a fixed paper space are reported instead of clipped.
- Repeated the full 30-download audit on the live Hostinger site. All 190 pages passed again; all 110 populated page renders matched the reviewed local versions exactly. Partial live downloads also preserved unused TIN cells and blank date placeholders pixel-for-pixel. Every deployed public file matched its build hash over HTTPS.

## Optional signature-image upload

- Added 13 explicit customer signing slots across all six documents. Each uploaded image belongs only to the selected person/row/page. Original template files and staff areas remain unchanged.
- PNG/JPG uploads are checked, white backgrounds removed, transparent margins trimmed, and the resulting ink fitted into the signing box without stretching. Preview uses the exact downloadable PDF. Users can replace/remove signatures or download unsigned originals at any point.
- Signature images persist with the form's existing browser draft. Tests covered refresh, actual browser shutdown/relaunch, clear-one/all/tabs, invalid/oversized/blank images and a simulated full browser storage quota. Failed saving keeps the image downloadable and shows the existing storage warning.
- `npm test`: 14 tests passed. Production build passed. Secret scan passed; no credentials are in the public bundle.
- Filled all six forms five times through browser inputs with English, Arabic, long and mixed answers and five synthetic signature variants. Generated both signed and unsigned copies for each: 30 pairs, 190 page comparisons and 65 signature placements. No pixels changed outside selected signature regions; no whiteouts occurred. Original text and page geometry were preserved. Visually inspected every signing slot in all five variants.
- Chrome, Firefox and WebKit passed image upload, replacement, removal, independent signer slots, signature-only/blank downloads, draft restoration, mobile Arabic and clear-all/tab behavior. Requests contained no answers or signature image data.
- Firefox revealed a narrow corporate controlling-person date cell at its previous minimum text size. The minimum now permits a 0.2-point reduction when required by that browser's font bounds; all five date fixtures fit. The printed date format and source artwork are unchanged.
- Detailed page/placement results: `signature-audit.json`.
- Deployed via verified FTPS after retrying one transient hosting timeout. All 23 public files matched the build SHA-256 over HTTPS; the six original PDFs remain byte-identical. The live site passed the six-document signature workflow and all 38 pages/13 signing slots passed PDF comparison. Every live page render matched its reviewed local counterpart exactly.

## Subdomain and download recovery

- Verified HTTPS and application assets at https://forms.ahmaddalao.com/. Hostinger serves the same scoped forms directory. The HTML canonical URL and deployment manifest now use the subdomain root; relative asset/template paths remain valid at both addresses.
- Removed the unconditional “PDF downloaded” success claim. Prepared files show their filename, a persistent Save PDF link, and a button to preview the actual filled PDF inside the page. Downloads still start automatically where supported. The URL stays valid until answers/signatures change, the form is cleared, or another document is selected.
- Network/export errors now appear beside the download controls, with a retry button. Overlong-answer errors also identify the relevant fields. Retrying preserves entered answers.
- `download-regression.mjs`: all six forms passed in Chrome, Firefox and WebKit, 18 combinations. The test deliberately blocks automatic link activation and verifies a real second click can save the PDF, repeated saves match exactly, blank originals stay unchanged, and changed answers/reset remove stale file links. Mobile Arabic layout and overflow handling passed.
- `download-errors.mjs`: simulated template failures and overlong answers in all three engines. Errors were visible, answers remained intact and retry generated a successful download after correction/recovery.
- The in-app browser generated synthetic filled files in Downloads and rendered the safer inline PDF preview. Browser automation policy blocked a separate-tab generated-PDF navigation test; that feature was replaced with the inline preview, so it is not part of the shipped flow.
- Live verification passed on the subdomain: all 23 public files matched the build SHA-256, and all six filled PDFs downloaded via the direct Save PDF action matched the reviewed local outputs byte-for-byte (38 pages). The old address remains accessible for existing origin-specific drafts. No PDF templates or rendering positions changed in this update.

## Full country names in narrow fields

- Fixed the bank branch/country/currency mappings on both KYC forms to use the measured blank space between printed labels, rather than limiting answers to the short dotted underline. Full country names fit at the existing readable font sizes; printed labels and source PDFs are unchanged.
- Widened the individual FATCA/CRS country cells inside their existing table borders, allowing “United States of America” without abbreviation.
- The earlier five-sample audit used “KSA” for narrow country fields and missed this realistic failure. Updated it to use complete English and Arabic country names independently of field width. Added a dedicated regression that fills every country/citizenship field, plus KYC branch and currency, through real browser inputs.
- Five names per country-bearing document passed in Chrome, Firefox and WebKit: Saudi Arabia, United States of America, United Arab Emirates, المملكة العربية السعودية and الولايات المتحدة الأمريكية. The user's literal spelling “united states of amaerca” also downloaded from the production build without truncation or automatic correction.
- Final local verification: 60 actual downloads, 360 pages, 420 populated fields and 465 transparent answer images. Source text/page geometry and pixels outside answer areas are preserved; no whiteouts or clipped image edges. A WebKit Arabic currency edge detected during QA was fixed by extending the transparent vertical area without moving its center.
- Visually inspected five-sample banking and tax-table sheets, full controlling-person country tables, and final three-engine English/Arabic comparisons. All six official PDF templates remain byte-identical. Printed-letter overlap scan, 14 unit tests and production build passed.
- Deployed via verified FTPS to https://forms.ahmaddalao.com/. All 23 public files matched the build over HTTPS. Repeated all five country-name cases across the four country-bearing forms on the live site: 20 actual downloads / 120 pages, each byte-identical to the reviewed local version. Details: `country-fit-verification.json`.

## Separate folders, wider forms and paper wording

- Added physical `individuals/index.html` and `companies/index.html` entry points with correct shared asset/PDF paths. Each shows the appropriate KYC/tax forms plus shared signature and terms documents. Existing answer IDs, local draft keys and old root/legacy paths are retained; a saved individual/company form cannot automatically open in the wrong audience folder.
- Original preview is hidden by default and available via Show document. Downloading keeps it hidden; reviewing opens the filled PDF. Returning to editing restores the wider layout. Export errors remain visible even while the preview is closed.
- Related paper fields use up to three desktop columns, two at intermediate widths and one on phones. Named source subsections, paired ideal/current portfolio rows, numbered tax rows and controlling-person rows preserve their grouping. FATCA/CRS detail fields are beside the relevant printed choices and always available without selection-dependent hiding.
- Reviewed supplied PDF headings, questions and options against rendered source pages. The catalogue/editor display both document titles. Questions and options show the original English/Arabic together, including Mr. / السيد and Male / ذكر; fuller disclosure questions, investment choices and printed risk points replace shortened labels. The corporate tax source is English-only, so its questions retain their full English wording; its Arabic document title is a catalogue translation.
- Added blue answer text and selected controls in the editor, and blue text/checkmarks in filled PDFs (#1456a0). Uploaded signatures retain their image ink. No original PDF, coordinates, font fitting, answer IDs or choice mappings changed.
- Local folder UI regression passed all 24 folder/form/browser combinations in Chrome, Firefox and WebKit: each field and choice label, hidden/open/review previews, actual downloads, saved-answer reloads, clear form, audience isolation and mobile Arabic without horizontal overflow. Banking branch/country/currency share one desktop row.
- Filled and downloaded all six documents five times again: 30 PDFs / 190 pages / 1,480 text-field checks / 2,260 transparent blue answer images. Original geometry/text and pixels outside answer areas were preserved; all 80 unmodified pages were pixel-identical. Visually reviewed representative long English/Arabic pages from all six documents and desktop/mobile UI captures. All source templates remain byte-identical.
- Simulated failed template requests and oversized answers in all three engines: visible errors, preserved data and successful retry. 16 unit tests and production build passed.
- Published both folders via verified FTPS. All 25 public files matched the build SHA-256 over HTTPS. Both folder URLs redirect correctly without a trailing slash, including under the legacy `/forms/` address. Live Chrome passed all eight folder/document combinations; all eight downloaded PDFs matched the reviewed local files byte-for-byte.
- Signature lifecycle regression passed after changing preview behavior: upload, replacement, signature-only/blank downloads, restore, invalid uploads, signing-page preview, mobile Arabic and cross-tab clearing. Detailed results: `folders-verification.json`.

## Interface titles and root-page visibility

- Page, folder, document and section titles now follow the selected interface language. Printed form questions/options retain the original bilingual wording.
- The root page displays a neutral instruction to use the provided form link. It exposes no catalogue, folder links or downloads and cannot resume a saved form. Individual/company folder URLs continue to restore their drafts.
- Local Chrome passed all eight folder/document combinations, language switching, mobile Arabic, downloads, draft recovery and the hidden root with an existing saved draft. Production build and all 16 unit tests passed. PDF templates and rendering were not changed.
- Deployed through verified FTPS; all 25 public files match the build over HTTPS. Live Chrome passed all eight folder/document combinations and both root-page language states with an existing draft; all eight downloads matched local output byte-for-byte. See `title-root-verification.json`.

## Catalogue download alignment

- Pinned each card’s blank-download footer to the bottom so links and divider lines align across a row despite different title lengths.
- Checked both folders in English/Arabic at desktop, tablet and mobile widths (12 layouts), then verified both languages/folders live after FTPS deployment.

## Field-label language

- Field labels, questions, row/context labels, helper text and paper instructions now show only the selected interface language. Selectable options keep the source wording, including both languages where printed.
- Added Arabic interface translations for labels and group headings in the English-only corporate tax form; its original selectable options and PDF remain unchanged.
- Verified exact field/context/help/instruction text in both languages across every section of all six forms, including mobile Arabic and bilingual choices. All eight folder/document workflows passed in local Chrome, together with all 16 unit tests. Confirmed every field has an Arabic label and that answer IDs, option text/values and PDF mappings are unchanged. Visually reviewed the individual tax form in both languages.
- Published through verified FTPS; all 25 public files match the build over HTTPS. Live Chrome passed all eight folder/document workflows and every field-label check in both languages. All eight downloads match the local output byte-for-byte. Details: `field-language-verification.json`.

## Hidden audience switcher

- Removed the Individuals/Companies navigation from both catalogue pages; each shared URL still opens its own four documents. Language switching is retained. Build and local/live browser checks passed for both folders and both languages after verified FTPS deployment.

## Individual FATCA/CRS staff section

- Added a fifth, optional section for the relationship manager/customer service representative on page 3. Includes account-holder full name, employee ID and the 15-cell customer information file number. Leading zeros remain intact. The section has a shortcut to its own signature-upload slot, separate from the customer’s signature on page 2.
- Staff-only wording remains visible, and the review no longer incorrectly says all company-use sections remain blank for this document. Existing customer answer IDs, sections and draft keys are unchanged.
- Five English, Arabic, long and mixed fills passed in Chrome, Firefox and WebKit: 15 signed/unsigned pairs, 60 page comparisons. Every new text/cell area contains transparent blue ink; signatures and text stay within their measured spaces; original lettering, borders and untouched pages are preserved, with no whiteouts. Customer-only fills leave page 3 pixel-identical. Blank/cleared downloads remain byte-identical to the original.
- Verified signature preview opens page 3, signature/answer persistence across reload, both interface languages, mobile layout, removal and clear form. Visually reviewed all 15 filled sections and the new UI. All 16 unit tests and printed-letter overlap checks passed. Detailed results: `staff-section-verification.json`.
- New staff name/employee fields follow the first strong letter for automatic text direction. This fixes Firefox clipping with mixed Arabic/English names; all 15 final samples passed a full-name ink-width guard and visual review. Existing fields retain their prior direction behavior.
- Deployed through verified FTPS; all 25 public files matched the final build over HTTPS. Repeated all five staff fills on the live site; all 13 downloads (signed/unsigned pairs, blank, customer-only and cleared) matched the reviewed local PDFs byte-for-byte.

## Document toolbar alignment

- Removed the 430px toolbar limit and kept Show document, Download blank and Download PDF on one row. On narrow screens, three equal columns keep the controls together with readable wrapping inside each button.
- Verified 144 layouts across all eight folder/document combinations, both interface languages and nine widths from 320px to 1600px. All controls align without page overflow; visually reviewed desktop English and mobile Arabic. Production build passed.
- Published through verified FTPS. All 25 public files match the build over HTTPS, and all 144 layout checks passed on the live site. See `action-layout-verification.json`.


## Complete recheck and cross-browser text fixes

- Rechecked all six unique PDFs (38 source pages) against the eight uploads. All 26 source/reference/public/build copies matched the recorded hashes. Original templates remain unchanged and no credentials are present in the public build.
- Fixed Firefox dropping Arabic or Latin runs from mixed-language answers and WebKit clipping some Arabic marks. Browser-reported text bounds were incomplete; the renderer now measures actual ink on a padded transparent canvas before fitting it inside the existing field. Blue text, minimum font sizes and the original document artwork are preserved.
- Fixed Arabic individual FATCA/CRS tax explanations appearing on the English lines. Arabic answers now use the original Arabic explanation lines; English answers keep their original positions.
- Final alignment audit: every PDF filled five times in Chrome, Firefox and WebKit (English, Arabic, longer English, longer Arabic and mixed). All 90 downloads / 570 pages passed: 4,485 populated text-field checks and 7,035 transparent answer-image checks. All 225 untouched sample pages were pixel-identical. Cross-engine ink-width and image-edge checks found no missing runs or clipping.
- Repeated the five country-name cases across all four country-bearing PDFs and all three engines: 60 downloads / 360 pages / 420 populated fields / 465 transparent images passed. Includes United States of America and its Arabic name, along with bank branches and currencies.
- Signature audit covered all 14 slots with five samples per form (30 signed/unsigned pairs, 190 page comparisons, 70 placements); Firefox and WebKit also passed all six documents. After the renderer fix, all 14 slots and upload/replacement/removal/preview/storage lifecycle checks passed again. Signature changes remain confined to the selected boxes with transparent backgrounds.
- All 24 folder/form/browser workflows passed: exact language-specific questions and titles, printed bilingual choices, all 364 mapped fields available, blue entries, hidden/show/review preview behavior, downloads, reload recovery, audience isolation and mobile Arabic. Root-page catalogue and audience-switcher remain hidden.
- Download fallback passed all 18 document/browser combinations with automatic downloads deliberately blocked: real Save PDF clicks, repeated saves, blank originals, changed answers, reset, preview and visible error handling. Failed-template retries and overlong-answer corrections also passed after the renderer change.
- Actual browser shutdown/relaunch recovered drafts in all three engines. Clear-one/all/across-tabs preserved unrelated storage. Signature persistence and full-storage recovery passed. Downloads from every section in Chrome and the first/last sections in the other engines passed. All 144 toolbar layout checks passed. All 16 unit tests, printed-letter overlap checks and the production build passed.
- Visually reviewed filled English/Arabic pages across all six documents, all signature slots, mixed-language crops and live desktop/mobile pages. Updated regression scripts to use the audience folder URLs and added a cross-browser ink regression check.
- Published through verified FTPS. All 25 public files matched the final build SHA-256 over HTTPS; worker/PDF content types and subdomain/legacy folder redirects passed. Repeated all 30 complete fills on the live site: every downloaded PDF is byte-identical to its reviewed local counterpart. Live Chrome passed all eight folder/document workflows; live Firefox passed fallback downloads for all six forms.
- Detailed evidence: [full-recheck-verification.json](full-recheck-verification.json). These checks cover the recorded samples and workflows; they are not an assertion about every possible input or device.


## Shared document fields — 2026-09-17

- Added a collapsible Shared document fields panel on each audience’s catalogue and inside every form. Names, identity/contact details and address components are mapped explicitly by meaning. Full names and address lines are composed where the original PDF uses a single line; split-name/address fields receive their corresponding components.
- Individuals and Companies now own separate browser profiles, drafts, active-form preferences and signatures, including the two shared templates. No personal/company profile is copied between folders. Clear all removes only the current folder’s profile and drafts.
- Shared edits update previously copied answers. Existing different answers and manual/blank overrides remain intact. Use shared value reconnects one field; Fill empty fields restores automatic values after clearing a form. Clearing the shared profile removes its automatic copies and preserves manual edits.
- Address copying into residence/office/correspondence destinations uses explicit checkboxes. Individual signatory details copy only for the selected Client / Account holder role. Additional clients, signatories, witnesses, controllers, bank/custodian accounts and signature images are not inferred to be the same person or value.
- Earlier audience-specific drafts migrate automatically with their answers, signatures and section. Older signature/terms drafts lacked an audience, so they require Restore previous draft to this folder. A restored draft is assigned only to the chosen folder; existing different answers remain intact.
- All 23 unit tests passed, including field/schema compatibility, audience isolation, signature isolation, manual and blank overrides, role changes, clearing/reuse, legacy migration and unavailable storage.
- Chrome, Firefox and WebKit each passed all eight audience/document workflows, actual browser shutdown/relaunch, input/caret preservation, same-audience tab updates, opposite-audience isolation, manual overrides, clear/reuse and Arabic mobile layout. All 24 real PDF downloads / 156 pages passed: 237 populated text-field checks and 327 transparent blue image checks; original artwork and placement preserved with no clipping or whiteouts.
- Existing Chrome folder regression passed all eight workflows, including exact field labels/options, previews, downloads, audience routing, root-page visibility and mobile layout. Separate browser tests verified real legacy draft restoration with a signature, signature isolation, folder-scoped clearing and successful downloads when browser saving fails.
- Visually reviewed the catalogue, expanded desktop/mobile shared-fields panel and representative filled PDFs. The six official templates are byte-identical; no credentials occur in the public build.
- Published using verified FTPS. All 25 public files match the build over HTTPS. All eight live audience/document workflows, restart/override/tab/clear checks and migration/storage tests passed. Every live PDF is byte-identical to the corresponding reviewed local PDF.
- Evidence: [shared-fields-verification.json](shared-fields-verification.json).


## Email typing and bilingual recheck — 2026-09-17

- Reproduced the reported email reversal in Chrome and Firefox, and loss of all but the last character in WebKit. The input was already displayed left-to-right: rebuilding the shared form on every keystroke reset the native email caret. The previous text-input caret test and `.fill()`-based email tests missed this behavior.
- Shared inputs now remain mounted while dependent answers, counters and saved-draft indicators update. Editing from review invalidates the old PDF and returns to editing without replacing the active shared input. Email, phone/fax and date controls use left-to-right entry in both interface languages. Corporate authorized-person email now uses the email input type.
- Real typing, mid-address insertion, backspace, whole-value replacement, input identity/focus, Arabic/English names, dates, leading-zero IDs/accounts, draft reload and review invalidation passed: 312 typed-input checks, all eight folder/document combinations in both languages across Chrome, Firefox and WebKit, with 48 actual PDF downloads. All 312 PDF pages, 264 populated fields and 750 transparent answer images passed artwork, mapped-placement, clipping and blue-ink checks. Visually reviewed every email output in all three engines.
- The Arabic run also exposed a short compound name (`أحمد علي`) being rejected in the individual FATCA/CRS first-name space. Reduced only the internal padding of its three Arabic name fields; the minimum font size, mapped rectangles and original template remain unchanged. The compound-name regression passes in all three engines and its rendered output was visually checked.
- Refilled every unique PDF five times (English, Arabic, long English, long Arabic and mixed). All 30 PDFs / 190 pages / 1,495 text-field checks / 2,345 transparent text images passed. All 75 untouched pages remained identical. Reviewed representative English/Arabic pages from all six documents; no white backgrounds were introduced.
- All 24 folder/document/browser workflows passed language-specific labels, bilingual printed options, previews, downloads, draft recovery, mobile Arabic and hidden root-page checks. All 24 shared-field workflows passed typing, restart, copying, overrides, cross-tab updates, audience separation and clear/reuse. Legacy restoration, signature isolation and storage-failure recovery passed; all 23 unit tests passed. Original PDF hashes are unchanged and the public build contains no credentials.
- Published through verified FTPS. All 25 public files match the tested build over HTTPS. Live Chrome repeated every form in both languages; live Firefox/WebKit repeated both KYC forms and the individual tax form in both languages. All 28 live downloads match the reviewed local PDFs byte-for-byte.
- Previously saved backwards email strings require re-entry; the application does not guess corrections to existing answers. Detailed evidence: [email-direction-verification.json](email-direction-verification.json).


## Numbered fund documents and subscription form — 2026-09-17

- Both audience catalogues now use one continuous six-card sequence in the requested order. Titles follow the interface language, each card has a number, and four shared documents have a small badge instead of a separate section. Download footers remain aligned.
- Added the unchanged subscription PDF with 35 optional fields across five sections, shared-profile mappings and four independent signature upload slots. Individual identity values do not fill company IDs; corporate signatory details do not replace company details.
- Converted the supplied consent photograph into a one-page A4 PDF, embedding the original JPEG byte-for-byte without recreating or changing its wording. Card 4 downloads it directly.
- Card 6 retains the existing 13-page Itqan general account terms. Its description identifies the actual source. The fund-specific terms were not supplied; keeping the existing PDF is a stated assumption, not a confirmed response to the clarification.
- All 25 unit tests, production build, printed-letter overlap checks and 33 source/reference/public/build hash checks passed. No credentials occur in the public build.
- Chrome, Firefox and WebKit passed 36 catalogue layouts across both languages, audiences and desktop/tablet/mobile sizes. Direct consent downloads match the converted source. Shared copying, isolation, saved drafts, signature uploads/reload and the neutral root page passed. Ten local audience/form workflows checked the existing forms and new subscription form.
- Five complete subscription fills per browser (English, Arabic, long English, long Arabic and mixed) produced 15 PDFs. All 450 populated text checks and 675 transparent answer-image checks passed. Visually reviewed the output and moved address answers above the original dotted guides; all 15 final samples passed that guard. Original artwork is preserved without white overlays. All 24 local signature placements stayed within their four independent boxes.
- Published through verified FTPS. All 27 public HTTPS files match the final build. Live Chrome passed 12 catalogue layouts and eight signature placements, with direct consent downloads and persistence checks in both folders. All five live subscription PDFs match the reviewed local output byte-for-byte. One initial page timeout during concurrent live checks passed on sequential rerun.
- Evidence: [catalogue-verification.json](catalogue-verification.json).


## Language button visibility — 2026-09-17

- The language button now uses the logo’s purple background with white, semibold text and the existing primary-button hover color. Keyboard focus styling is preserved.
- Production build passed. Checked both folders and languages at desktop/mobile widths, language switching, hover and keyboard focus. Published through verified FTPS; all 27 public HTTPS files match the build, and the button color and switching passed live in both folders/languages.


## Consent page rebuilt from editable Word — 2026-09-17

- Replaced the photograph-based consent PDF with a clean Arabic Word reconstruction, then exported the Word document through bundled LibreOffice. Preserved the source wording, officer names, name/signature/date lines and section order; removed the printed page number 38.
- Inspected the complete rendered page after correcting RTL alignment and removing an inherited title border. The final DOCX contains native editable text and no images; the final PDF is one page with embedded fonts and no image objects. Verified all source headings, labels and names against the photo.
- Card 4 remains download-only in both folders. Its URL now includes a content version so browsers fetch the new file. Production build and both local card downloads passed. Published through verified FTPS; all 27 public files match the build, and both live card downloads match the reviewed PDF byte-for-byte.
- The management feature remains isolated in the separate codex/management worktree.

## Consent typography refinement — 2026-09-17

- Replaced Arial with Bahij TheSansArabic Plain from Itqan’s published brand assets. Reduced the body to 9 pt and adjusted section spacing, headings, signing lines and officer blocks against the supplied photograph. Exact font metadata cannot be recovered from the photo; this is a visual match.
- Embedded the editable font in Word and verified the exported one-page PDF contains the matching font subsets, no photograph and no page number 38. Inspected the full latest render.
- Production build and all 27 HTTPS file hashes passed. Both live audience folders download the revised PDF byte-for-byte.

## Management branch — 2026-09-17

- Added an isolated local `/management/` interface for bilingual titles/descriptions, separate audience ordering, draft saves, explicit publication and rollback. Existing field schemas and customer drafts remain intact.
- Native text fields, checkboxes, radio buttons and dropdowns import from new PDFs. Flat forms receive blank-line suggestions and a page editor for labels, drawing/moving/resizing fields, signature areas and audience-specific shared mappings. New fillable documents require review; download-only is also available.
- All 29 unit tests and 12 existing Chrome catalogue layouts passed. The isolated PHP/browser audit passed authentication, CSRF, throttling, private storage, revision conflicts, draft isolation, upload/import, review gates, publication/rollback, shared profiles, both-language customer downloads and recovery. Seven generated PDFs passed page/static/transparent-overlay checks; English/Arabic samples were visually inspected. A signature box was drawn and dragged through the UI, then exported.
- The test preview is at http://127.0.0.1:8181/management/ and uses local-only data. Management has not been deployed; the branch's deployment script refuses production publishing pending user review. See MANAGEMENT.md and management-verification.json.

## Real-document management import audit — 2026-09-17

- Tested all eight actual source PDFs (40 pages) as new uploads in isolated storage. Source bytes were preserved, draft files remained private and incomplete imports could not be approved. Existing production forms were not edited.
- Initial tests found five overlapping suggestion pairs across three flat documents, and several suggestions came from header edges. Tightened raster suggestions to ignore colored bars, thick boundaries and non-empty answer bands, and removed overlapping suggestions. Added independent geometry rejection in PDF generation and PHP review/publication; conflicting boxes are highlighted in the editor.
- Re-ran five answer profiles (English, Arabic, long English, long Arabic, mixed) on each of the six documents with detected fields: 30 draft PDFs, 175 rendered pages and 155 transparent answer images. No sample ink intersected original ink; no image clipped at its edge. Deliberately oversized values were blocked in all six documents. Both languages and representative answer pages were visually reviewed.
- This does not prove complete automatic mapping. Individual FATCA/CRS and the subscription form produced zero suggestions; the other documents were incomplete and included labels/positions that require manual correction. One corporate KYC candidate overlaps a source text bounding rectangle even though the tested ink does not touch it. Newly uploaded flat PDFs remain a one-time manual setup/review workflow, not automatic publication-quality conversions.
- All 31 unit tests and the expanded management API/browser audit passed, including direct API rejection of overlapping boxes. The changes are on the management branch only. Evidence: management-real-files-verification.json.

## 2026-09-19 — Approved production portal release

- Published the tested client portal and owner management at https://forms.ahmaddalao.com/ after explicit owner approval; copied the existing owner credentials without changing the username/password.
- Deployed 66 public build files using verified FTPS, retaining prior public files in a local deployment backup and excluding development private databases. Protected runtime storage before publishing the PHP endpoints.
- Passed 56 unit tests, isolated portal and management browser audits, and the complete production client workflow: registration, login, submissions, previews, individual and ZIP downloads, edit/resubmit, immutable archives, recovery and password reset. Checked both languages, mobile layouts, logos, document routes, all PDF hashes, no-store API headers and access denial for private files.
- Removed only the two explicitly tracked synthetic accounts and their 14 test PDFs after verification. Final database integrity check passed; final dashboard had zero users/submissions. The password-protected preview remains separate.
- Introduced no new form fields or options. Detailed evidence: `live-release-verification.json` and `deployment-manifest.json`.
