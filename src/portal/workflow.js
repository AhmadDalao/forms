// The server owns this setting. Default-on keeps standalone previews conservative.
let current={review_enabled:true,revision:0};
export const workflowState=()=>({...current});
export const reviewEnabled=()=>current.review_enabled;
export function receiveWorkflow(value){
 if(typeof value?.review_enabled!=='boolean'||!Number.isInteger(value.revision)||value.revision<current.revision)return;
 const changed=value.revision!==current.revision||value.review_enabled!==current.review_enabled;
 current={review_enabled:value.review_enabled,revision:value.revision};
 if(changed&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('forms-workflow-change',{detail:workflowState()}));
}
export const formSaveLabel=lang=>lang==='ar'?(reviewEnabled()?'إرسال النموذج':'حفظ النموذج'):(reviewEnabled()?'Submit form':'Save form');
export const toolModeNotice=lang=>`<p class="notice" data-tool-mode>${lang==='ar'?'احفظ النموذج في حسابك أو نزّل نسخة منه.':'Save this form to your account or download a copy.'}</p>`;
