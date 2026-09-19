# Portal logos

The portal uses only the original Itqan Capital logo, extracted unchanged from the user-supplied `صندوق النعيم العقاري- دلعو.pptx`.

| Portal asset | Presentation entry | SHA-256 |
| --- | --- | --- |
| `public/branding/itqan.png` | `ppt/media/image5.png` | `e0c0369f0ab19fdf7baaa69ab284bf9f9a449aa473c0ff6208454f27bbeccdb0` |

`src/branding.js` displays the Itqan Capital logo in its original proportions on a white background. The same component is used for registration, login, client forms, My applications, and all management screens. The compact logo area follows the page's English/Arabic direction on desktop and mobile. Page titles and footers also use Itqan Capital branding. The uploaded presentation is not modified.

The client submission history lives at `/my-applications/` with the English title “My applications” and Arabic title “طلباتي”. `/account/` remains a compatible alias. The existing preview, download, edit/resubmit and archive functions are unchanged.
