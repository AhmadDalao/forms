# Terms & Conditions restoration — 28 September 2026

The owner requested the earlier Terms & Conditions instead of the redesign. The active document is the exact original 13-page PDF from commit `b03c367`, SHA-256 `8bdd17efdfa24c71ed0e667c9bb142cbe68d77085ef7ab82386d3bd0b3433106`. All other public PDFs remain byte-for-byte unchanged.

Original fields, split dates, choices and six signature positions are restored on pages 11 and 13. Revision `20260928-original-2` prevents stale tabs from submitting against the retired 24-page layout. Original submissions use frozen original signing positions; submissions created during the 24-page release retain their saved layout snapshots; new submissions use the restored 13-page layout. Stored answers and PDF history are not rewritten.

The generator, installer and developer instructions explicitly exclude T&C from redesign. The previous modern Word/PDF files are retained as private historical references under `reference/documents/archived/`. There is no matching original Word source; the current handoff contains eight Word/PDF pairs plus the original T&C PDF.

## Verification

- 223 automated tests passed, including exact PDF hash and original/modern/restored signing compatibility.
- 10 synthetic T&C PDFs, 130 pages: five full Arabic/English/long/mixed fills plus blank, partial, shared data and every choice. All 10 mapped fields, four choice options and six signature slots exercised; no out-of-bounds ink or original content changes.
- Populated pages 11 and 13 visually inspected in Arabic and English, including split dates and signatures.
- All 13 pages compared in LTR/RTL previews in Chrome, Firefox and WebKit: 39 comparisons passed.
- Client/admin/superadmin management preview, details, archive, mobile, network-retry and expired-session checks passed in isolated fixtures.
- Direct submission, signed replacement, archive preservation, duplicate retry, PDF/ZIP downloads and account isolation passed. All eight current forms submitted in fixtures; 556 stored values and downloaded bytes matched. Seven unchanged PDFs reused the prior verified synthetic outputs; T&C was newly generated.
- Re-running the installer with stale 24-page output present retained the restored original and left every other PDF unchanged.

Live deployment and final private migration verification are recorded after publication in `terms-restoration-verification.json`. Earlier modern-family reports are historical and do not describe the current T&C template.
