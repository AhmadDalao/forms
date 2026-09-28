// The server revision protects stale tabs during the direct-intake transition.
let current={review_enabled:false,revision:0};
export const workflowState=()=>({...current});
export const reviewEnabled=()=>current.review_enabled;
export function receiveWorkflow(value){
 if(typeof value?.review_enabled!=='boolean'||!Number.isInteger(value.revision)||value.revision<current.revision)return;
 const changed=value.revision!==current.revision||value.review_enabled!==current.review_enabled;
 current={review_enabled:value.review_enabled,revision:value.revision};
 if(changed&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('forms-workflow-change',{detail:workflowState()}));
}
export const formSaveLabel=lang=>lang==='ar'?'إرسال النموذج':'Submit form';
export const toolModeNotice=lang=>`<p class="notice" data-tool-mode>${lang==='ar'?'راجع النموذج ثم أرسله. يمكنك تنزيل نسختك من بطاقة النموذج.':'Review your form, then submit it. You can download your copy from its form card.'}</p>`;
