import {session,language,errorText} from './api.js';
import {appRoot,audience,accountFolder,canUseAudience} from '../routes.js';

export let formSession;
export async function allowFormPage(){
 try{
  formSession=await session();
  if(audience&&!canUseAudience(formSession.user,audience)){
   location.replace(appRoot+accountFolder(formSession.user)+'/');return false;
  }
  return true;
 }catch(err){
  // Vite alone serves the anonymous editor without a PHP account server.
  // Production always requires a successful session check before opening forms.
  if(import.meta.env.DEV){formSession={user:null};return true;}
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
 try{const fresh=await session();if(fresh.user?.id!==formSession?.user?.id||fresh.user?.account_type!==formSession?.user?.account_type)location.reload();else formSession=fresh;}
 catch{/* Keep the local draft available during a network failure; submission rechecks access. */}
 finally{checking=false;}
}
