# Customer workflow release — 28 September 2026

The customer home now contains each document's receipt/signature status and blank download, filled download and completed-PDF upload actions. The bulk ZIP download is on the same page. Profile is reserved for account details and password changes. Client history controls are removed; stored versions and management history remain intact.

## Form changes

- Identity controls are ordered type, number, expiry in one desktop row wherever the original form provides those fields. Personal ID issue place/date are removed from both KYC forms. The representative fax-number field becomes email. Other identity, registration, birth and expiry dates retain their meanings.
- The individual FATCA signer role appears before both name groups and the declaration/signature step is last. Four role choices share a desktop row. Selecting account holder reuses the client's matching names; representatives remain separate.
- Fresh signature methods are unselected. Previously saved explicit choices remain preserved.
- The first T&C step displays all 13 original PDF pages; acceptance, authorization and review follow. The original T&C and signature PDFs remain unchanged.
- Consent is now fillable for either audience, with investor name, date and signature mapped into its unchanged one-page PDF.
- Generic forms now show the complete generated document before download/submission, using the subscription flow. Portfolio percentage warnings remain present.
- Itqan and the bold bilingual fund name share the responsive navigation. Notifications open independently of the profile.

KYC Word/PDF sources were updated together. The company KYC now has 9 pages after removing an unnecessary forced page break; individual KYC has 11. Previous submitted PDFs keep their own definitions and signing coordinates. Deploy the complete public build so the new field definitions, templates and release-owned consent editability update together.

## Verification

- 229 automated tests passed, zero failures.
- 114 generated PDF cases, 755 pages; all mapped fields, all choices and every signature slot covered; five complete fills per form; zero fit/placement/transparency failures.
- Every visible field was entered through the real browser, reloaded, submitted and checked against management's captured answers and downloaded PDF. Risk answers and replacement history passed.
- Both audiences passed the new home actions, online consent, signed replacement upload, ZIP download, profile email/password navigation, unset signatures and T&C steps.
- All nine documents passed categorized management details and both preview buttons in Arabic/English at 1440 and 390 pixels.
- Management navigation passed Chrome, Firefox and WebKit, both languages, with delayed responses.
- Loading tests confirmed the home/editor work while shared-profile loading is delayed, preserve edits and defer PDF assets/engines until needed.
- All final pages of both edited KYC documents were visually checked. Generated long Arabic/English examples and consent preview were also inspected.

Machine-readable evidence and public-template checksums: `customer-workflow-verification.json`. These are application/PDF regression checks, not a legal compliance certification.
