# Subscription-style PDF release — 28 September 2026

The active document family now follows the approved subscription Word design: Itqan branding, purple section bars, bilingual label hierarchy, ruled answer areas and transparent blue answers. The two subscription templates remain unchanged. Editable Word and matching PDF sources accompany all nine documents.

| Document | Pages | Result |
| --- | ---: | --- |
| Individual subscription | 2 | Approved reference retained |
| Company subscription | 2 | Approved reference retained |
| Individual KYC | 14 | Rebuilt; all customer, suitability and internal-use areas retained |
| Company KYC | 11 | Rebuilt; company, contacts, suitability and internal-use areas retained |
| Signature form | 2 | Rebuilt; specimen and staff signing areas retained |
| Consent | 1 | Rebuilt from editable text; download-only; original page number 38 remains removed |
| Individual FATCA/CRS | 9 | Rebuilt; bilingual names, declarations, definitions and staff area retained |
| Company FATCA/CRS | 8 | Rebuilt; original English wording, five controllers and both signatories retained |
| Terms and conditions | 24 | Rebuilt; original clauses, appendix, multiple signers and internal-use areas retained |

Page counts grow where the original was dense. No legal translation or new customer answer choice is introduced by this release. Existing fields, required rules, calculations, shared-data meanings and signature identities are checked against the frozen pre-release schema. Original source PDFs remain in `reference/pdfs/` for comparison.

## Preservation and compatibility

- Existing submitted/archived PDFs and answers are not regenerated. New submissions carry a server-owned layout snapshot; older PDFs retain their original signature coordinates through a frozen compatibility map.
- Published management titles/order stay intact. Built-in page counts and template revisions update from the release.
- Old browser tabs cannot submit a PDF using obsolete geometry; they receive a reload/review message while their browser draft remains saved.
- No production client or application is created by the release checks. A private backup is restored and verified separately before publication.

## Verified locally

- **221 automated tests pass**, including field/option preservation, destination bounds, overlap detection, legacy signing, stale-template protection and catalogue-title preservation.
- All **69 rebuilt blank pages** were rendered and visually inspected. Final filled examples were checked for both languages, long names, checkmarks, signatures and LTR contact information.
- **49 source legal/instruction fragments** match the Word output; no coordinate markers or printed text intrude into answer areas.
- **106 synthetic PDFs / 957 pages** pass independent PDF checks. Coverage includes every mapped field, every selectable printed option and every signature slot, with five complete fills per editable form, blank/partial/shared fills and additional option cases. No verification failures.
- Real browser controls were filled, reloaded, submitted and compared with management. The submission audit matched **556 captured values** and exact PDF download hashes. KYC risk answers survive editing/resubmission; previous versions remain unchanged.
- Shared data was exercised across forms, tabs, offline retry, fresh sessions and separate individual/company accounts. Management preview/download/ZIP, consent upload, resubmission/archive, logout and access restrictions pass.
- Client/admin previews, including all 24 terms pages on a high-density phone, pass in Chrome, Firefox and WebKit. Network failure/retry, repeated preview clicks, closed dialogs and expired sessions are covered.
- Loading checks confirm the document centre/editor do not wait for shared-profile synchronization and do not fetch PDFs or the heavy PDF engine before needed. The management overview also defers document definitions and PDFs.
- Admin creation, chosen-password resets, permissions and private migration restoration pass on a disposable installation.
- The clean developer archive contains all nine Word/PDF pairs, original references, builders, mappings, tests and installation instructions. Its checksums and a source rebuild are verified separately from the private migration.

Machine-readable results: `modern-pdf-verification.json`. The developer guide explains regeneration, font requirements and compatibility handling. These are content-preservation and software checks, not legal certification of the supplied documents.
