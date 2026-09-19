# Portal logos

The Wessal and Itqan Capital logos are the unchanged PNG files embedded in the user-supplied `صندوق النعيم العقاري- دلعو.pptx`.

| Portal asset | Presentation entry | SHA-256 |
| --- | --- | --- |
| `public/branding/wessal.png` | `ppt/media/image4.png` | `c5560fc2284593cd155ddbe358d3c59fb515bf75b45ff20c8421d69fe546e45b` |
| `public/branding/itqan.png` | `ppt/media/image5.png` | `e0c0369f0ab19fdf7baaa69ab284bf9f9a449aa473c0ff6208454f27bbeccdb0` |

`src/branding.js` places Wessal beside Itqan, vertically centred with a subtle divider, using their original proportions on a white background. The same component is used for registration, login, client forms, My applications, and all management screens. The logos remain side by side on mobile and follow the page's English/Arabic direction. The uploaded presentation is not modified.

The client submission history lives at `/my-applications/` with the English title “My applications” and Arabic title “طلباتي”. `/account/` remains a compatible alias. The existing preview, download, edit/resubmit and archive functions are unchanged.
