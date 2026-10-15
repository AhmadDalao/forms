# Document authoring policy

## Current sources — 15 October 2026

`template-sources.json` lists the current Word documents, modern generator targets
and supplied PDF templates. It is shared by the generator, installer, verifier
and handover packager.

- Five current Word/PDF pairs: individual/company subscription, consent, and
  individual/company FATCA/CRS.
- Individual/company KYC use the owner's supplied **seven-page PDFs**, with only
  the approved national-address footer updated. There is no matching current
  KYC Word source. Signature uses its supplied one-page PDF; T&C uses the
  approved 38-page fund PDF. Neither has a matching current Word source.
- `build.py` generates only consent and the two FATCA/CRS forms. KYC targets are
  rejected. `install.py` and `verify.py` ignore retired KYC/signature/T&C output,
  including stale directories in `tmp/modern-pdfs/`.
- The installer preserves other reviewed mappings and removes retired
  original-PDF entries from the modern map. KYC PDF positions are maintained
  with their original form definitions, not generated from the retired Word layouts.
- `scripts/update-original-footers.py` rebuilds the supplied PDF footer updates.
  Keep its source PDFs immutable. After any PDF edit, verify the original body,
  mapped fields and filled samples before updating public assets.
- Archived modern Word/layout sources are reference material only. Never use
  them to regenerate a current KYC PDF. Current and archived client submissions
  retain their own saved bytes and layout snapshots.

The September design notes and early October verification below describe the
earlier modern family. Their KYC page counts and Word-source claims are historical
and are superseded by the seven-page original-PDF policy above.

## Approved fund terms — 15 October 2026

The immutable source is `reference/pdfs/supplied-20261015/terms-and-conditions.pdf`.
Keep all 38 physical pages: eight introductory pages followed by 30 numbered
pages, ending with the investor declaration. The current version is
`20261015-approved-terms`. `scripts/update-original-footers.py terms-and-conditions`
adds the approved Riyadh address beneath the supplied artwork, without changing
the body. This is a supplied PDF, not a Word redesign.

The only printed customer fields are `investor_name` and `date`, with signature
slot `investor`, on physical page 38. The document-version blank on page 4 is not
a customer input. Do not carry the retired account-terms questions, choices or
signature IDs into the new legal document. Individual name parts join into the
name destination; company names stay separate from authorized-person names.

The preceding 13-page schema/PDF and retired 24-page layout remain frozen under
`reference/`. Historical signing uses its saved PDF and trusted layout; captured
details take precedence over legacy display fallbacks. Never migrate an old
signature to the new terms or rewrite stored submission bytes. The separate
consent form, original KYC/signature PDFs, five Word sources and website address
are unchanged. Current public assets total ten PDFs / 75 pages. Verification
for this replacement is in `docs/approved-terms-2026-10-15/`, including source,
filled-PDF, browser and live checks. Packaging verifies the clean database and
file manifest separately.

## Reference and preservation contract

Reference: `reference/documents/subscription-style.docx`, SHA-256
`600d5816464650deecf1f7a242ef74ea6c4da768dc701298434693c6677e1f9a`.
Both rendered subscription pages were inspected. The working documents clone
this package, retaining its styles, embedded editable Arabic font and logo.
The original reference is never overwritten.

Use A4 portrait, 48 pt side margins, 499.3 pt content width. Purple `401D58`,
ink `242235`, secondary text `656575`, rules `9B92A2`, answer ink `1456A0`.
Arabic: Bahij TheSansArabic Plain; English: Arial. Bilingual section bars use
white 9 pt English / 10.5 pt Arabic, with 19 pt leading. Field labels use
9.5 pt Arabic and 7.5 pt English. Answer spaces have at least 22 pt height.
Long declarations use 8.5 pt English / 10 pt Arabic and generous leading.

KYC, Terms & Conditions and the signature form are excluded from this redesign at the owner’s request. Their supplied body designs are preserved; the national-address update changes only their footer address. Archived modern output must never be reinstalled.

## Slots and intentional differences

- Replace subscription body with the target document's exact existing fields,
  options, instructions, declarations, definitions and internal-use areas.
- Retain the subscription's logo, palette, table rules and bilingual hierarchy.
- Repeat a compact brand header on continuation pages; use live page numbers.
- Permit additional pages instead of shrinking long text into the old boxes.
- Preserve the English-only corporate FATCA source language; do not invent
  Arabic legal translations. Existing website labels remain unchanged.
- Preserve customer field IDs, shared-data meanings and signature IDs when
  editing the same document. The approved terms replacement above intentionally
  uses new IDs; freeze old definitions for historical submissions. Generate new
  Word coordinates from marker copies, never estimate them by eye.
- Keep current and archived submitted PDF bytes untouched. Refilled or newly
  submitted versions use the new templates and get their own immutable file.
- The separate consent form is fillable online in its existing signing areas.
  Its editable source retains the supplied declaration, investor signing area
  and named officials; its earlier page-38 exclusion remains unchanged. This
  does not exclude page 38 from the newly supplied full terms document.

## Verification gates

Check every field and choice has exactly one intended destination, all source
legal fragments survive extraction and Word generation, no marker appears in
final files, and every rendered page is inspected. Exercise blank, English,
Arabic, long/mixed and restored/shared fills, all choices and signatures, then
test client/admin preview, submit, replacement, archive and downloads before
publishing. Retain original PDFs privately as the comparison authority.

## Inline bilingual labels — 28 September 2026

Bilingual choices are one paragraph in Arabic / English order, with one checkbox per choice. Short field labels share a baseline where their existing wording fits; long questions retain readable wrapping. Original T&C and signature PDFs are unchanged. Corporate FATCA retains its supplied English language. Preserve every label and choice value; remeasure coordinates after reflow.

## Section and signing rows — 28 September 2026

Every section bar uses full-width purple with white type, with edges aligned to the table. Suppress the repeated field label when it matches the immediately preceding section title. Omit generic Box 1/2 context, but retain person, address and portfolio distinctions. Keep name/signature boxes on one row where feasible; remeasure both destinations together. Source words, choice values, required rules and saved history remain unchanged.

## Earlier KYC address-footer phase — 7 October 2026 (superseded)

Change only the current individual and corporate KYC PDFs and their matching
Word sources. Retain these owner-supplied address elements, compacted into one
7 pt footer line to preserve the body layout; **Branch** is explicitly confirmed:

```text
Al Zahraa District - Prince Naif Branch - Al Saha Square, 1st Floor
2505 - Al Zahra Dist
Unit No 7940
Jeddah 23425-2753
Kingdom of Saudi Arabia
```

The supplied corporate PDF matches the original exactly; the individual PDF
reprints the same seven-page content. Neither contains annotations, and neither
adds a content or field requirement. Retain the current KYC body, field IDs,
options, page layout and mappings. Current and archived submitted PDFs remain
immutable; only future template-based outputs use this footer.

Scoped verification passed and is recorded in
`docs/kyc-address-verification-2026-10-07.json`: all 20 template pages, unchanged
Word body XML and all 209 mapped destinations, 31 generated PDFs / 311 pages,
three-browser previews and isolated customer/admin submission/replacement flows.
Saved submissions are not regenerated. September full-system verification remains
historical evidence, separate from this scoped footer check.

## Address on all forms — 7 October 2026

The owner clarified that the address applies to every current form, not just KYC.
The canonical address and browser cache version live in `national-address.json`.
`build.py` retains it in the three generated modern documents, the subscription
builder uses it for both audience templates, and `scripts/update-original-footers.py`
updates only the address column of the original KYC, signature and terms PDFs.
The private source/reference PDFs remain immutable, as do submitted versions.
Five current editable Word sources and all public form PDF variants must contain
the new address. Retired KYC Word files are excluded from current verification
and handover. Preserve all body pixels, page sizes, fields and signature maps.
All-form checks are recorded separately in
`docs/all-forms-address-verification-2026-10-07.json`.

## Riyadh address — 14 October 2026

The visible footer of `reference/pdfs/supplied-20261014/national-address-source.pdf`
now supplies the address in `national-address.json`. Its hidden text still names
Jeddah; do not use that text layer as the address source. Every current PDF footer
and the five current Word footers use Riyadh, with no body/map changes.

For future address-only edits, `scripts/update-generated-address.py` replaces the
isolated address text objects in the five generated PDFs and matching Word XML,
and refreshes the legacy one-page subscription. Use `update-original-footers.py`
for the four original-style PDFs. A full Word rebuild is unnecessary. Bump all
current template versions and keep historical layout snapshots untouched.
Evidence: `docs/riyadh-address-2026-10-14/`.
