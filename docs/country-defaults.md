# Editable country defaults

New individual and company drafts start with **Saudi Arabia** on English pages or **المملكة العربية السعودية** on Arabic pages. All country inputs remain editable, including countries copied from shared details into subscription forms.

Defaults cover address, bank, birth, registration, incorporation and applicable tax-country fields. Country fields explicitly asking about countries outside Saudi Arabia stay blank. Nationality, citizenship, place-of-birth composites and yes/no declarations are not country fields and are not defaulted.

Unused additional corporate tax rows and controlling-person rows stay empty. Starting a row inserts its editable country default; clearing the row removes only an untouched automatic country. Chosen countries and deliberate blanks survive reloading. Shared country changes replace automatic fallbacks, while form-specific edits remain unchanged.

Saved submission versions retain their original answers, including unanswered country fields. Individual and company data remain separate. Country defaults never alter the original blank PDF download.

The explicit field inventory and fallback rules are in `src/countries.js`. `src/drafts.js` initializes them on form open and records which values were automatic. Shared defaults use the existing shared-data flow. Subscription PDF generation no longer inserts a country independently of the entered answers.

Verification: 118 unit tests passed (11 country-default cases). The local browser audit is `scripts/country-defaults-audit.mjs` and uses isolated storage. Deployment and browser/PDF evidence are recorded in `docs/country-defaults-verification.json`.

Published to the main site from source `f025f5e`. Hosted checks passed for all six country-bearing forms in both languages. The local audit passed 19 browser checks, 12 filled PDF downloads and 12 byte-identical blank downloads; all 32 populated country overlays stayed inside their field bounds. Private paths remained blocked.
