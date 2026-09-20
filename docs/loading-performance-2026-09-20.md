# Initial loading performance — 20 September 2026

Sign-in and other ordinary pages eagerly loaded both PDF engines and the complete form-field catalogue. These imports were unnecessary until a PDF operation or saved-detail preview. The PDF engines now load through native dynamic imports at generation, preview or uploaded-document signing; saved-field definitions load when a saved PDF is opened. My applications reuses the initial session response instead of requesting it twice. Authentication, account/category boundaries, document content and stored records are unchanged.

Observed initial JavaScript (uncompressed bytes downloaded by the browser):

| Page | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Sign-in / registration | 1,074,698 | 95,329 | 91.1% |
| Management sign-in | 1,107,980 | 258,300 | 76.7% |
| Document centre | 1,100,270 | 249,703 | 77.3% |

Before measurements used the live site; initial after measurements used an isolated local copy. Byte counts are comparable; local and live elapsed times are not. All measured initial pages made zero PDF-engine/worker requests after the change. Opening the Signature Form did not need those engines either. A first PDF operation downloads them on demand, and successful modules are reused thereafter.

The live cold automated-browser baseline also observed a Hostinger challenge taking approximately 3.7–4.0 seconds before navigation restarted. This hosting delay is separate from the application payload; no security settings were disabled. Live session API requests took approximately 99–142 ms in that run.

Validation: production build and 194 unit tests passed. Focused browser workflows cover individual/company forms in English and Arabic, generated PDF previews/downloads/saves, saved-account PDF previews, uploaded-PDF signing, and management native-widget import/sample generation. Initial My applications visits make one session request.

Evidence is private and excluded from deployment: `tmp/performance-before/report.json`, `tmp/performance-after-local/report.json`, and `tmp/performance-unit.log`.
