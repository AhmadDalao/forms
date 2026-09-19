import {appRoot} from './routes.js';
import './branding.css';
// Original embedded artwork from the owner's presentation, with no redrawing.
export function brandLockup(){
 return `<span class="brand-lockup"><img class="brand-wessal" src="${appRoot}branding/wessal.png" width="357" height="330" alt="Wessal · وصال"><span class="brand-logo-divider" aria-hidden="true"></span><img class="brand-itqan" src="${appRoot}branding/itqan.png" width="1456" height="552" alt="Itqan Capital · إتقان كابيتال"></span>`;
}
