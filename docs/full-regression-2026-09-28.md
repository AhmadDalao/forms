# Full regression verification — 28 September 2026

**Passed after fixing one management navigation defect.** A delayed Administrators response could replace the Submissions page after switching tabs. Reproduced it on the previous live release, added an isolated regression, and fixed stale-response handling for Administrators and Documents. Published the frontend fix from `bee654a`; PDF templates and backend behavior were unchanged.

| Area | Result |
|---|---|
| Unit tests, production build, PHP syntax | 225 tests passed; build passed; all 26 PHP files passed |
| Every editable form | All eight completed through their actual browser controls, reloaded, submitted and checked against management answers/downloads |
| Saved answers | 556 captured values matched management records; KYC risk answers survived reload, edit and resubmission |
| PDF generation | 106 files / 762 pages independently rendered; 423 mapped fields, 227 checkbox options and 16 signature slots covered |
| PDF layout | No missing answer ink, clipped answers, original-paper erasure or ink outside mapped spaces in the tested samples; five full fills per form plus blank, partial, shared and option cases |
| Browser previews | All 55 template pages checked in Chrome, Firefox and WebKit: 165 Arabic/English direction comparisons, 159 exact and six within the existing pixel tolerance |
| Management previews | Both preview entry points, current/archived documents, individual/company profiles, three admin roles and mobile long-document rendering passed |
| Recovery | Slow/interrupted loads, retry, repeated preview clicks, closing a pending preview and expired sessions passed |
| Navigation fix | All 12 delayed Administrators/Documents cases passed in both languages and all three engines; reopening the selected tab also passed |
| Shared data | Arabic/English separation, company separation, address joining, browser/account reload, multiple tabs, offline retry and deliberate clearing passed |
| Submission cycle | Unsigned submission, duplicate/lost-response retry, signed replacement, archived versions, version conflicts, consent upload and PDF/ZIP downloads passed |
| Access | Anonymous access denied; individual/company separation, forged cookies, reset-required accounts and logout/session revocation passed |
| Administration | Superadmin-only creation and permissions; chosen eight-character password resets; previous sessions revoked; ordinary admins restricted |
| Uploaded forms | Five native fields covering text, checkbox, radio and dropdown inputs imported; bilingual sample review, card 7 for both categories, sharing and submission passed; invalid/overlapping layouts rejected; removal preserved submitted copies |
| Catalogue | Arabic/English titles, order, private draft, publication, rollback and stale revision protection passed |
| Loading | Document centre/editor usable while shared-profile response was deliberately held; account edits preserved; PDF downloads/engines remained deferred |
| Live site | Nine final smoke checks passed, including existing management preview, current PDF hashes and protected routes |
| Data preservation | Four clients, 15 PDF versions, nine archived versions, five shared profiles and two historical decisions unchanged across deployment; all 15 PDFs byte-identical |
| Developer delivery | Clean package checksums and empty databases passed; private migration restored with database integrity, foreign-key and PDF checks |

The 38 redesigned KYC/FATCA/consent pages also passed content and geometry checks, including 23 preserved legal fragments, full-width purple bars, inline short bilingual choices, no repeated group labels and aligned name/signature fields. Fresh visual spot checks covered long Arabic/English answers, original signature, subscription amounts and the KYC risk section. The original signature and Terms & Conditions files remain byte-identical to their approved originals.

Four cold live login/signup checks reached usable controls in **732–1,254 ms**; branded content and fonts were ready in **877–2,002 ms** on the tested connection. These are observed timings, not a guarantee for every device or network.

The handoff was refreshed at `output/developer-handoff-2026-09-28-full-tested/` with the final public build, source, new regression scripts, bilingual installation instructions, seven current Word sources and nine PDFs. Existing clients and forms are in the separate private migration ZIP, which must stay outside public download paths.

Detailed machine-readable evidence is in `full-regression-verification.json`. Tests changing accounts, passwords, documents and submissions used isolated local fixtures. Live checks did not edit client records. This pass verifies software behavior and document matching; it does not certify legal compliance or server capacity under high concurrent load.
