# Terms preview fix — 15 October 2026

A late shared-account response invalidated the original PDF load and destroyed its renderer while the terms document step remained open. The canvas placeholders stayed empty without an error. The earlier release audit waited for account data before opening the document, so it missed this timing condition.

`sharedProfileChanged()` now leaves the original document load/render alive. Account answers still synchronize. Generated filled previews still become invalid when their underlying answers change, so they cannot show stale data.

The approved PDF, its 38 pages, fields, signatures, national address and stored submissions are unchanged. The regression uses delayed network responses and inspects actual body pixels on every page; merely having a canvas is insufficient.

Run `npm test`, `npm run build`, and `node scripts/terms-preview-race-audit.mjs` with disposable local fixtures. `scripts/approved-terms-audit.mjs` also checks body pixels in its preview helper. Reports in this folder distinguish the reproduced failure, fixed local cases, high-DPI checks and read-only live-asset checks.
