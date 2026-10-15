# Terms preview fix — 15 October 2026

A late shared-account response invalidated the original PDF load and destroyed its renderer while the terms document step remained open. The canvas placeholders stayed empty without an error. The earlier release audit waited for account data before opening the document, so it missed this timing condition.

`sharedProfileChanged()` now leaves the original document load/render alive. Account answers still synchronize. Generated filled previews still become invalid when their underlying answers change, so they cannot show stale data.

The approved PDF, its 38 pages, fields, signatures, national address and stored submissions are unchanged. The regression uses delayed network responses and inspects actual body pixels on every page; merely having a canvas is insufficient.

Run `npm test`, `npm run build`, and `node scripts/terms-preview-race-audit.mjs` with disposable local fixtures. `scripts/approved-terms-audit.mjs` also checks body pixels in its preview helper. Reports in this folder distinguish the reproduced failure, fixed local cases, high-DPI checks and read-only live-asset checks.

Deployed application commit: `035cb95783d1555aec6e48158401ddd533cb743b` at `20261015T163506Z`. The static-only deployment backed up eight replaced HTML files and added two hashed JavaScript assets. PHP, PDF assets and private storage are unchanged. The live test first reproduced 38 blank pages on the old build, then verified every original/review page on the new build for both audiences, using browser-only synthetic client replies and real hosted assets. No client accounts or submissions were written.

Verification: 276 unit tests; 12 original-preview cases across Chrome, Firefox and WebKit; two filled-review invalidation cases; four high-DPI Chrome/WebKit desktop/mobile cases; four live original/review cases. Firefox emits existing embedded-font maxZones warnings, recorded in the report; all tested pages contain visible body content. These are browser-engine tests, not physical-phone tests.
