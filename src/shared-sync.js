import {cleanShared,sharedGroups} from './shared-fields.js';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const difference=(base,next)=>Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(next)])].filter(key=>!equal(base[key],next[key])).map(key=>[key,own(next,key)?next[key]:null]));
const patched=(base,changes)=>{const next={...base};for(const [key,value]of Object.entries(changes))if(value===null)delete next[key];else next[key]=value;return next;};
const absent=value=>value===undefined?null:value;

// Each editable field has its own durable pending record. Only an explicit edit
// replaces it; background responses write separate receipts for the saved token.
// This keeps independent offline tabs from overwriting each other's queued work.
export function createSharedSync({account,audience,drafts,api,onChange=()=>{},onStatus=()=>{},storage=()=>localStorage,events=globalThis.window,delay=400}){
 const allowed=new Set(sharedGroups(audience).flatMap(group=>group.fields.filter(field=>(!field.hidden||field.sync)).map(field=>field.id)));
 const project=profile=>Object.fromEntries(Object.entries(cleanShared(audience,profile)).filter(([id])=>allowed.has(id)));
 const key=drafts.basePrefix+'shared-sync',volatile=new Map(),listeners=[];
 function read(name){if(volatile.has(name))return volatile.get(name);try{return JSON.parse(storage().getItem(name)||'null');}catch{return null;}}
 function write(name,value){try{storage().setItem(name,JSON.stringify(value));volatile.delete(name);}catch{volatile.set(name,value);}}
 let cache=read(key);if(cache?.account!==account||cache?.audience!==audience)cache=null;
 let base=cache?.base?project(cache.base):null,revision=Number.isInteger(cache?.revision)?cache.revision:null;
 let view=project(drafts.profile),pending={},records={},status='loading',updatedAt=null,conflicts=[],canInitialize=false,disposed=false,timer=null,storageTimer=null,flight=null,forceSave=false;
 const recordKey=id=>key+'.pending.'+id,receiptKey=id=>key+'.settled.'+id;
 function record(id){const value=read(recordKey(id));return value&&typeof value.token==='string'&&own(value,'value')?value:null;}
 function unsettled(id){const value=record(id);return value&&read(receiptKey(id))?.token!==value.token?value:null;}
 function edit(id,value,{resolve=false}={}){
  const previous=!resolve&&conflicts.includes(id)?unsettled(id):null;
  const entry={token:globalThis.crypto.randomUUID(),value,expected:previous?previous.expected:absent(base?.[id]),baseRevision:previous?previous.baseRevision:revision};
  write(recordKey(id),entry);return entry;
 }
 function settle(id,entry,value,atRevision){
  const previous=read(receiptKey(id));
  if(!previous||previous.revision<=atRevision)write(receiptKey(id),{token:entry.token,value:absent(value),revision:atRevision});
 }
 function collect({acknowledge=false}={}){
  const next={},queued={},collisions=[];
  for(const id of allowed){
   const entry=unsettled(id);if(!entry)continue;
   const actual=absent(base?.[id]),receipt=read(receiptKey(id));
   if(acknowledge&&equal(actual,entry.value)){settle(id,entry,actual,revision);continue;}
   next[id]=entry.value;queued[id]=entry;
   // An earlier save from this browser may complete after a newer edit. Its
   // receipt advances the expected value without modifying the newer record.
   const ownSave=receipt&&receipt.revision>(entry.baseRevision??-1)&&equal(actual,receipt.value);
   if(base!==null&&!equal(actual,entry.expected)&&!ownSave)collisions.push(id);
  }
  const empty=unsettled('$empty');
  if(acknowledge&&empty&&revision>0)settle('$empty',empty,null,revision);
  forceSave=Boolean(empty&&revision===0);
  pending=next;records=queued;conflicts=collisions;
 }
 function emit(){if(!disposed)onStatus(controller.state);}
 function persist(){
  const previous=read(key);
  if(!previous||previous.account!==account||previous.audience!==audience||(previous.revision??-1)<=(revision??-1))write(key,{account,audience,base,revision,initialized:true});
 }
 function apply(next){
  view=project(next);
  if(!equal(project(drafts.profile),view)){drafts.setShared(view);if(!disposed)onChange(drafts.profile);}
 }
 function updateStatus(){status=conflicts.length?'conflict':(Object.keys(pending).length||forceSave)?'saving':base===null?'offline':'saved';emit();}
 function schedule(){clearTimeout(timer);if(!disposed&&status!=='conflict'&&(Object.keys(pending).length||forceSave))timer=setTimeout(()=>controller.flush(),delay);}
 function adopt(remote,{initial=false}={}){
  canInitialize=initial&&remote.revision===0&&!cache;
  if(initial&&base===null&&remote.revision===0)for(const [id,value]of Object.entries(difference({},view)))if(!record(id))edit(id,value);
  base=project(remote.profile);revision=remote.revision;updatedAt=remote.updated_at;
  collect({acknowledge:true});apply(patched(base,pending));persist();updateStatus();
 }
 async function fetchLatest(initial=false){
  const result=await api('shared_profile',undefined,{params:{account,audience}});if(disposed)return;
  adopt(result.shared,{initial});
 }
 function failed(error){
  if(disposed)return;
  status='offline';persist();emit();
  if(['account_changed','account_type_restricted','login_required'].includes(error?.message))clearTimeout(timer);
 }
 const controller={
  get state(){return {status,conflicts:[...conflicts],updatedAt,canInitialize};},
  async start(){
   if(disposed)return;if(flight){await flight;return controller.state;}
   collect();apply(patched(base??view,pending));
   flight=(async()=>{try{await fetchLatest(true);}catch(error){canInitialize=false;failed(error);}})();
   try{await flight;}finally{flight=null;}
   schedule();return controller.state;
  },
  change(profile){
   if(disposed)return;
   const next=project(profile);
   for(const [id,value]of Object.entries(difference(view,next)))edit(id,value);
   if(revision===0&&Object.keys(next).length===0)edit('$empty',true);
   view=next;collect();apply(patched(base??view,pending));persist();updateStatus();schedule();
  },
  async flush({keepalive=true}={}){
   clearTimeout(timer);if(disposed)return;
   if(flight){await flight;if(!disposed&&status==='saving')return controller.flush({keepalive});return;}
   collect();if(conflicts.length){updateStatus();return;}
   if(!Object.keys(pending).length&&!forceSave)return;
   flight=(async()=>{
    try{
     if(base===null){await fetchLatest(true);if(disposed||conflicts.length||(!Object.keys(pending).length&&!forceSave))return;}
     const sent={...records},empty=unsettled('$empty');
     const result=await api('shared_profile_save',{account,audience,expectedRevision:revision,changes:{...pending}},{keepalive});if(disposed)return;
     for(const [id,entry]of Object.entries(sent))settle(id,entry,result.shared.profile[id],result.shared.revision);
     if(empty)settle('$empty',empty,null,result.shared.revision);
     adopt(result.shared);
    }catch(error){
     if(error.message==='shared_profile_conflict'){
      try{await fetchLatest();}catch(next){failed(next);}
     }else failed(error);
    }
   })();
   try{await flight;}finally{flight=null;}
   if(status==='saving')schedule();
  },
  async refresh(){
   if(disposed)return;if(flight){await flight;return;}
   flight=(async()=>{try{await fetchLatest(base===null);}catch(error){failed(error);}})();
   try{await flight;}finally{flight=null;}
   if(status==='saving')schedule();
  },
  async retry(){await controller.refresh();if(status!=='conflict')await controller.flush();},
  async resolve(choice){
   if(disposed||status!=='conflict'||!['remote','local'].includes(choice))return;
   for(const id of conflicts){const entry=unsettled(id);if(!entry)continue;if(choice==='remote')settle(id,entry,base?.[id],revision);else edit(id,entry.value,{resolve:true});}
   collect();apply(patched(base,pending));persist();updateStatus();await controller.flush();
  },
  dispose(){disposed=true;clearTimeout(timer);clearTimeout(storageTimer);for(const [target,event,listener]of listeners)target.removeEventListener(event,listener);},
 };
 for(const [event,listener]of [['online',()=>controller.retry()],['focus',()=>controller.refresh()],['pageshow',()=>controller.refresh()],['pagehide',()=>controller.flush({keepalive:true})]])if(events){events.addEventListener(event,listener);listeners.push([events,event,listener]);}
 if(events){
  const listener=event=>{
   if(event.key!==null&&event.key!==drafts.basePrefix+'shared-fields'&&!event.key?.startsWith(key))return;
   // Other tabs write the pending journal before the account save completes.
   // Refresh adopts those edits too; do not re-publish this tab's stale profile.
   clearTimeout(storageTimer);storageTimer=setTimeout(()=>controller.refresh(),60);
  };
  events.addEventListener('storage',listener);listeners.push([events,'storage',listener]);
 }
 if(events?.document){const listener=()=>{if(events.document.visibilityState==='hidden')controller.flush({keepalive:true});else controller.refresh();};events.document.addEventListener('visibilitychange',listener);listeners.push([events.document,'visibilitychange',listener]);}
 return controller;
}
