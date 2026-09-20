# Paper and field matching — 20 September 2026

Fresh comparison of the current eight curated editors against their active PDFs, the supplied originals, and the explicit user changes. All 42 active editor-template pages plus the one-page download-only consent were rendered and reviewed. The detailed inventory lists every current schema field, option, signature slot and page.

## Counts

| Document | Pages | Schema fields | UI-only name helpers | Paper answer fields | Radio/checkbox options | Card options | Dropdown options | Signature slots |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Signature | 1 | 18 | 8 | 10 | 6 | 0 | 0 | 1 |
| Subscription, individual | 2 | 49 | 8 | 29 | 0 | 4 | 9 | 1 |
| Subscription, company | 2 | 46 | 8 | 30 | 0 | 4 | 3 | 1 |
| Terms and conditions | 13 | 34 | 24 | 10 | 4 | 0 | 0 | 6 |
| FATCA/CRS, individual | 4 | 73 | 16 | 57 | 16 | 0 | 9 | 2 |
| FATCA/CRS, company | 6 | 104 | 28 | 76 | 19 | 0 | 0 | 2 |
| KYC, individual | 7 | 121 | 12 | 109 | 122 | 0 | 0 | 2 |
| KYC, company | 7 | 110 | 8 | 102 | 60 | 0 | 0 | 1 |
| **Total** | **42** | **555** | **112** | **423** | **227** | **8** | **21** | **16** |

Schema fields include hidden derived values, name components and workflow controls; they are not a count of independent printed questions. Paper answer fields count mapped text/choice definitions, including hidden full-name destinations, but exclude printed static amounts and name controls which join into another destination. Mirrored bilingual answers and individual digit cells are additional physical placements.

## Page inventory and intended exclusions

| Document / page | Paper content and corresponding editor | Deliberate exclusions or differences |
| --- | --- | --- |
| Signature 1 | Date; client name/number; account number; client/authorized role; signatory name; ID number/type; joint/individual and limited/unlimited signing instructions; specimen signature | Company-use branch, witnessed-signature statement, reviewer and account-manager fields remain on paper for staff. No fingerprint image control is invented. |
| Individual subscription 1 | Undertaking; client/account; title; Arabic/current full name; English full name; nationality and ID; telephone/mobile; national/mailing address including optional P.O. box | Original mixed individual/company identity area split by audience as requested. Four name controls join into each original-style full-name answer space. |
| Individual subscription 2 | Subscription type; payment method; fixed fund/currency/unit price; units; investment, 2% fee, total and Arabic words; full risk/receipt declaration; applicant name/date/signature | Original duplicate percentage/fee-amount inputs consolidated per user rule. Staff verification, branch/date, account manager, entered-by and approval/signature lines retained for manual staff completion. |
| Company subscription 1–2 | Same undertaking, address, complete subscription and applicant/business declarations; company legal/English names, incorporation country, registration type/number, authorized signatory and ID | Individual-only identity inputs omitted by design. Company names remain unrestricted organization names; human signatory names use four parts. |
| Individual KYC 1 | Request, title, gender, four-part name, birth date, marital/dependents, ID/expiry/place/nationality, education, address/contact/language, income sources, correspondence choices | Printed two name boxes receive the first two and remaining two components respectively, starting from the right for Arabic and the left for English. Mixed-script chunks use one whole-name direction to avoid colliding. The printed city/district question has a single shared answer box. |
| Individual KYC 2 | Eight income bands; eight wealth bands; employment/sector; bank and IBAN; branch/country/currency; two financial-sector experience questions | Both language-side yes/no boxes are mirrored rather than separate contradictory questions. |
| Individual KYC 3 | Listed-company/public-role/beneficial-owner disclosures; financial-information boxes; all five special-case choices; representative name, identity, dates, issue place, contact and signature | Optional representative signing is separate from the customer's final signature. |
| Individual KYC 4 | Investment knowledge, years, products, certificates, loan ratio, margin/overseas transactions and countries, risk tolerance, seven objectives plus other, restrictions | All paper questions remain available; no answer is hidden merely because another answer was selected. |
| Individual KYC 5 | Preferred currencies; horizon; seven ideal/current portfolio rows; custodian account/name/address; three recipient/instructions rows | Portfolio arithmetic uses printed rules only. |
| Individual KYC 6 | Relationship manager, internal process, client classification/risk rating, senior approval | Staff-only page is intentionally left unchanged for manual completion. |
| Individual KYC 7 | Five suitability questions, 19 answer options, arithmetic score, desired funds, client name and signature | Printed scoring bands/recommendation text remain unchanged; no generated investment recommendation is added. |
| Company KYC 1 | Request; legal entity, unified number, commercial registration (or similar), dates, complete company address, registration/incorporation countries, business, staffing, capital, turnover, contact/correspondence | Unified number and registration number remain separate. |
| Company KYC 2 | Contact person/phone/email/mobile/address; bank/owner/account; branch/country/currency; listed status; owners, directors and financial details | Multi-person owner/director boxes remain free-text lists, not incorrectly split as one person's name. |
| Company KYC 3 | Authorized person/name/relationship/nationality; four source ID choices; ID/issue/expiry; authorized-person address/contact; custodian details and recipient instructions | Authorized person's personal address is independent from company shared address. |
| Company KYC 4 | Knowledge/experience, investing history, products, borrowing/margin/overseas activity, risk, objectives and restrictions | No professional-certificate field is added: that extra row exists only in individual KYC. |
| Company KYC 5 | Currencies, horizon and seven ideal/current portfolio rows | Custodian fields correctly belong on company page 3, rather than page 5. |
| Company KYC 6 | Relationship manager, internal process, classification/risk and senior approval | Staff-only page unchanged. |
| Company KYC 7 | Same five printed suitability questions and 19 choices, result, desired funds, client name/signature | Even the age question remains as the corporate source prints it; company client name stays an organization-name field. |
| Individual FATCA 1 | Separate Arabic/English first/middle/last paper names; DOB/gender/birthplace; Saudi/foreign/mailing addresses; US person, citizenship, immigration and tax questions; SSN/ITIN/ATIN | UI second/third name parts join into each printed middle cell; no added PDF column. Foreign-only address country remains distinct from domestic address. |
| Individual FATCA 2 | Three mirrored tax-residence/TIN/reason rows; three reason-B explanations; unchanged declaration; Arabic/English signatory name; capacity, other capacity, date and signature | Paper has no checkbox beside “Other”; selecting Other uses its printed specification line. |
| Individual FATCA 3 | Account-holder name, staff signature, employee ID and 15-cell CIF; definitions | Optional staff block explicitly requested by the user is available; static definitions are unchanged. |
| Individual FATCA 4 | Definitions only | No fabricated customer input. |
| Company FATCA 1 | Entity/incorporation; residence/head-office addresses; three tax residence/TIN/reason rows | Additional tax rows require the source's separate sheet; the app does not silently add pages. |
| Company FATCA 2 | Instructions identifying EFG Hermes KSA | This exact source was explicitly approved unchanged. |
| Company FATCA 3 | Eleven FATCA choices, US TIN and three GIIN rows | Single classification; all requested data rows available. |
| Company FATCA 4 | Eight CRS classifications and stock-exchange name | Source numbering 12–19 retained. Referenced appendices are absent from the supplied original. |
| Company FATCA 5 | Five controlling-person rows: name, address, DOB/place, nationality, tax countries, ownership and TIN/reason | Four-part names join within each existing name cell. No inferred owner/customer identity is substituted. |
| Company FATCA 6 | Declaration; two signatory names/capacities/signatures; date | Company account-officer number/name/signature block stays blank for staff. |
| Terms 1–10 | Original bilingual legal text, no customer answer areas | All pages unchanged, including existing dense source typography. |
| Terms 11 | Statement-only-on-request yes/no; three customer/signature rows; date | Document checklists, company acceptance/branch/date/staff signatures are staff-only. |
| Terms 12 | Telephone/fax authorization wording | No answer fields. |
| Terms 13 | Continuation, service-consent yes/no; three customer/signature rows; date | Company acceptance and staff lines remain unchanged. |
| Consent 1 | Exact photographed declaration, customer name/signature/date and two officer names | Intentionally download-only; editable Word reconstruction and generated PDF, no raster photograph; page number 38 removed as instructed. |

## Source and structure checks

- All nine supplied PDF uploads, including duplicate signature and terms files, still match the stored references byte for byte.
- The six unchanged active originals match the public PDFs byte for byte. The original one-page subscription remains preserved as a separate public/reference file; the active two-page versions are the explicitly requested editable rebuilds.
- The consent public PDF matches its approved reconstructed reference. Its Word source remains available in `output/documents/al-naeem-terms-consent.docx`.
- Fresh printed-letter intersection check passed across all mapped text rectangles, including split date/character cells, mirrored positions and RTL-specific positions. This is supplemented by the independently generated filled-PDF audit; geometry alone is not a semantic guarantee.
- 145 Arabic, English, mixed-script and optional-third-name normalization cases passed across the current person-name groups and subscription full/applicant names. No missing or duplicated name component was detected.
- Existing original paper labels/options remain authoritative. Catalogue titles and approved subscription workflow choices intentionally follow the user's requested wording. Website language labels and preserved bilingual paper options are separate concerns.

## Shared-data findings for this run

The paper review confirmed the meaning of two missing shared bindings found in this run: individual KYC nationality and company KYC commercial registration (or similar). Both are now fixed. The individual KYC combined city/district answer was also checked and was already correctly joined; it is not a third defect. A company unified number remains separate from its registration number. The root regression report records the fixes and final behavioral retest.

## Independent filled-document review and final fixes

Second visual review of the English/Arabic long-input PDFs checked every form family, including both approved subscription rebuilds. It identified two output-direction defects: the two individual KYC Arabic name chunks were in English reading order, and the `+` in Arabic-digit telephone numbers moved to the end. The KYC schema now assigns the two boxes using the direction of the complete name; telephone/email/URL rendering keeps left-to-right direction. No source paper text was changed.

Fresh final PDFs were independently rendered and inspected for pure Arabic, pure English, Arabic-first mixed names and English-first mixed names. All four place both name chunks in separate, correct boxes. Phone numbers retain their leading `+`, and email stays left-to-right. The focused PDF audit also exercises these cases in Chrome, Firefox and WebKit; the independent human-style visual review described here used the Chrome outputs.

The corporate KYC shared national-address failure was checked against measured original text. Its writing area was widened within the same blank row to `[60,181,382,14]`, ending before the printed label. The regenerated full address `1122 King Faisal Street Al Nakheel Company City 03456 0078 United Arab Emirates` fits without truncation or touching the label. The PDF audit separately records the narrow individual FATCA street fitting correction.

Final compact evidence is `tmp/pdfs/paper-field-match-20260920/direction-final-contact.png` for four name directions, English/Arabic-digit phones, and `direction-corporate-address-crop.png` for the complete company address. Corresponding full-page renders have the `direction-` prefix. Fresh geometry verification after these changes still passes for all mapped rectangles. The eight person-name unit tests also pass, including a new mixed-script, paired-destination regression.

## Evidence and limits

Reproduce source/structure checks with `node scripts/paper-field-match-audit.mjs`. Detailed inventory, fresh page renders, extracted source text and original hashes are under `tmp/pdfs/paper-field-match-20260920/`; `structure-report.json` records every field ID and signature slot per page. `printed-overlaps.log` records the geometry result. Full filled-PDF rendering, shared-account persistence, signing and management lifecycle results are reported separately for this same run.

This is software/paper consistency testing, not regulatory certification. It verifies the existing curated forms, not arbitrary imported PDFs. Original answer spaces are finite, so excessively long free text may still require correction; the generator must reject overflow rather than obscure paper text. Legal text is preserved and compared, not independently certified as legally sufficient.
