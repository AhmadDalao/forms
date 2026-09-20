import {session,language,errorText} from './api.js';
import {appRoot,audience,accountFolder,canUseAudience} from '../routes.js';

export let formSession;
export async function allowFormPage(){
 try{
  formSession=await session();
  if(!formSession.user||(audience&&!canUseAudience(formSession.user,audience))){
   const response=await fetch(appRoot+'api/management.php?action=session',{cache:'no-store'});
   const management=response.ok?await response.json():null;
   if(management?.authenticated){formSession={...formSession,user:null,management:true};if(!audience){location.replace(appRoot+'management/');return false;}return true;}
   if(!formSession.user){location.replace(appRoot+'login/?lang='+language());return false;}
  }
  if(formSession.user.reset_required){location.replace(appRoot+'my-applications/');return false;}
  if(!audience){location.replace(appRoot+accountFolder(formSession.user)+'/');return false;}
  if(audience&&!canUseAudience(formSession.user,audience)){
   location.replace(appRoot+accountFolder(formSession.user)+'/');return false;
  }
  return true;
 }catch(err){
  const root=document.querySelector('#app'),message=document.createElement('p'),retry=document.createElement('button');
  message.setAttribute('role','alert');message.textContent=errorText(err,language());retry.textContent=language()==='ar'?'إعادة المحاولة':'Try again';retry.onclick=()=>location.reload();
  root.replaceChildren(message,retry);return false;
 }
}

// Re-evaluate an already open tab when the client returns after an owner change.
let checking=false;
export async function checkAccountAccess(){
 if(checking||document.hidden)return;
 checking=true;
 try{
  if(formSession?.management){
   const response=await fetch(appRoot+'api/management.php?action=session',{cache:'no-store'}),fresh=response.ok?await response.json():null;
   if(!fresh?.authenticated)location.reload();return;
  }
  const fresh=await session();if(fresh.user?.id!==formSession?.user?.id||fresh.user?.account_type!==formSession?.user?.account_type)location.reload();else formSession=fresh;
 }
 catch{/* Keep the local draft available during a network failure; submission rechecks access. */}
 finally{checking=false;}
}
