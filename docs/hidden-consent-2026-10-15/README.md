# Hide the standalone consent card — 15 October 2026

The owner approved hiding customer card 4, the separate Terms and Conditions Consent Form. Both individual and company catalogues now show five forms, consecutively numbered: subscription, KYC, signature, FATCA/CRS, and the complete fund terms. The combined 38-page terms retain their existing read, fill, sign and submit flow.

This is a presentation change. `customerCatalogueFor()` hides `al-naeem-terms-consent` from customer cards and new-upload choices. The internal `catalogueFor()` stays unchanged because it also generates backend definitions. Management still exposes existing consent records. PDF templates, fields, signatures, database records and submitted bytes are untouched; signature requirements and review settings are unchanged.

An explicit upload target can reinclude the hidden form only when the account has a current submission for that document and audience. This preserves pending historical correction/signature follow-ups. It does not delete the backend definition or disable the old API: hiding is intentionally different from rejecting submissions from an already-open older page.

Run `npm test`, `npm run build` and `node scripts/hidden-consent-audit.mjs`. The isolated browser audit covers both audiences, Arabic/English, desktop/mobile, Chrome/Firefox/WebKit, hidden fresh-upload choices, and existing notification preview, electronic signing, PDF replacement and immutable history.

Fresh handover: `output/developer-handoff-2026-10-15-hidden-consent`. Public templates still include the retained consent PDF for compatibility. The fresh bootstrap still contains only admin/superadmin credentials, schema8 and review off, with no clients or submitted forms.

The maintained customer-workflow audit passed nine checks, including current terms submission/replacement and preservation of the earlier PDF bytes. The submit-only client audit passed seven checks across all three engines, retaining hidden consent follow-ups and six stored records. The catalogue-layout script was updated and syntax-checked; its full separate sweep was not rerun because the focused visibility audit already checks the changed layout.

Production deployed from `e0477176d400644ecc47a0c895bed5ef08aabf5d` at `20261015T170130Z`. Eight live Arabic/English desktop/mobile views passed using actual hosted assets with browser-only synthetic customer replies. The hidden consent template still matches its original bytes; production counts and workflow are unchanged. All overwritten public files were backed up; only static assets and HTML were published.
