# First-visit performance — 29 September 2026

The largest delay reproduced on the existing Hostinger site was its browser-verification challenge, before the application opened. Three fresh automated Chrome contexts received an initial challenge response, loaded `/hcdn-cgi/jschallenge`, completed validation and then loaded the login page.

| Measurement | Observed time |
|---|---|
| Fresh login usable, three runs | 4.54 / 4.55 / 4.87 seconds |
| Navigation restart after hosting challenge | About 3.8–4.1 seconds from the start |
| Fresh login fonts ready | 4.74–7.13 seconds total |
| Repeat login usable | 0.30 seconds |
| Authenticated management usable | 0.40–0.84 seconds |
| Individual catalogue using admin access | 0.90–1.00 seconds |
| Session/dashboard API requests on established connections | About 0.09–0.15 seconds |

These are observations from the current connection, not a guarantee for every client. Fresh automated browsers can receive different security treatment from ordinary visitors. The reported 20-second wait was not reproduced. No PDF downloads occurred on these opening screens. The form-list check used administrative access, not a new ordinary client session.

Font/logo downloads are a second contributor to first-load completion. Some Arabic font requests start after Latin font requests. The application already defers PDF engines and does not block the editor on the shared-profile autosave response. Avoid reintroducing eager PDF loads while changing the UI.

The first hosting follow-up is to inspect CDN security settings and whether Under Attack mode is active. Its exact trigger was not confirmed and no security settings were changed. Hostinger documents high security levels, attack protection and network reputation as possible triggers: https://www.hostinger.com/support/hostinger-cdn-the-browser-verification-page/

Next, measure font loading on the affected user's network and consider earlier loading of the required Arabic face or reducing unused weights. No performance fix is claimed in this handover. The raw, sanitized measurements are in `verification/live-loading-2026-09-29.json`. The simulated slow-network case in that file is supplementary; the table above uses unthrottled measurements.

On the new domain, repeat cold/warm navigation checks after configuring HTTPS, compression, static-asset caching and private API cache rules. Do not cache account/API responses publicly to improve a speed score.
