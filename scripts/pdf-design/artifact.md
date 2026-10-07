# Modern document family — 28 September 2026

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

Terms & Conditions and the signature form are excluded from this redesign at the owner’s request. Their original 13-page and 1-page body designs, input coordinates and signature positions are restored; the 7 October national-address update changes only their footer address. Archived modern output must never be reinstalled.

## Slots and intentional differences

- Replace subscription body with the target document's exact existing fields,
  options, instructions, declarations, definitions and internal-use areas.
- Retain the subscription's logo, palette, table rules and bilingual hierarchy.
- Repeat a compact brand header on continuation pages; use live page numbers.
- Permit additional pages instead of shrinking long text into the old boxes.
- Preserve the English-only corporate FATCA source language; do not invent
  Arabic legal translations. Existing website labels remain unchanged.
- Preserve all customer field IDs, shared-data meanings and signature IDs.
  Generate new coordinates from marker copies, never estimate them by eye.
- Keep current and archived submitted PDF bytes untouched. Refilled or newly
  submitted versions use the new templates and get their own immutable file.
- Consent is fillable online in its existing signing areas. Its editable source retains the full supplied
  declaration, investor signing area and named officials; page 38 stays removed.

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

## KYC address footer — 7 October 2026

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
`build.py` retains it in all five generated modern documents, the subscription
builder uses it for both audience templates, and `scripts/update-original-footers.py`
updates only the address column of the original signature and terms PDFs.
The private source/reference PDFs remain immutable, as do submitted versions.
Seven editable Word sources and all public form PDF variants must contain the
new address. Preserve all body pixels, page sizes, fields and signature maps.
All-form checks are recorded separately in
`docs/all-forms-address-verification-2026-10-07.json`.
