import { hasValue } from './schema.js';
import { cleanSignatures } from './signatures.js';
import { cleanShared, reconcileShared, sharedCandidates } from './shared-fields.js';

export const DRAFT_PREFIX = 'itqan.forms.v1.';

// Each audience owns its profile, drafts and signatures, including the two
// templates that appear in both folders. Unscoped mode reads legacy drafts.
export function createDraftStore(documents, getStorage = () => window.localStorage, audience = null, accountId = null) {
  const scoped=['individual','corporate'].includes(audience);
  if(scoped)documents=documents.filter(d=>d.group===audience||d.group==='shared');
  const prefix=DRAFT_PREFIX+(accountId?'account.'+accountId+'.':'')+(scoped?audience+'.':'');
  const memory=new Map(),failedKeys=new Set(),legacy=new Map();
  let preferences={},profile={};
  const empty=()=>({values:{},signatures:{},step:0,shared:{},overrides:[]});
  function read(key,base=prefix){
    let raw;
    try{raw=getStorage().getItem(base+key);}catch{failedKeys.add(key);return null;}
    try{return JSON.parse(raw||'null');}catch{return null;}
  }
  function write(key,value,base=prefix){
    try{
      if(value===null)getStorage().removeItem(base+key);
      else getStorage().setItem(base+key,JSON.stringify(value));
      failedKeys.delete(key);return true;
    }catch{failedKeys.add(key);return false;}
  }
  function clean(doc,record){
    // Adapt saved subscription names without changing unrelated document drafts.
    if(doc.workflow==='subscription'&&(record?.values?.ar_name||record?.values?.en_name)){
      const old=record.values, next={...old};
      const full=(profile.name_language==='en'?old.en_name||old.ar_name:old.ar_name||old.en_name).trim();
      if(doc.group==='individual'&&!next.first_name){
        const parts=full.split(/\s+/);next.first_name=parts.shift()||'';
        next.family_name=parts.length?parts.pop():'';next.second_name=parts.shift()||'';next.third_name=parts.join(' ');
      }else if(doc.group==='corporate'){
        next.company_name=next.company_name||full;next.auth_name=next.auth_name||old.applicant_name||'';
      }
      next.signature_mode=record.signatures?.applicant?'electronic':'manual';
      record={...record,values:next,overrides:[...(record.overrides||[]),...(old.applicant_name?['applicant_name']:[])]};
    }
    const values={},shared={};
    for(const field of doc.fields){
      const value=record?.values?.[field.id];
      if(field.sum||!hasValue(value))continue;
      if(field.type==='choice'){
        const allowed=field.options.map(o=>o.value);
        if(field.multiple&&Array.isArray(value))values[field.id]=value.filter(v=>allowed.includes(v));
        else if(allowed.includes(value))values[field.id]=value;
      }else if(typeof value==='string')values[field.id]=value;
      if(typeof record?.shared?.[field.id]==='string')shared[field.id]=record.shared[field.id];
    }
    return {values,shared,overrides:Array.isArray(record?.overrides)?record.overrides.filter(id=>doc.fields.some(f=>f.id===id)):[],signatures:cleanSignatures(doc,record?.signatures),step:Math.max(0,Math.min(doc.sections.length-1,Math.trunc(Number(record?.step))||0))};
  }
  function persist(doc,record){
    memory.set(doc.id,record);
    const populated=Object.values(record.values).some(hasValue)||Object.keys(record.signatures).length;
    return write(doc.id,scoped||populated?{...record,updatedAt:Date.now()}:null);
  }
  function refresh(){
    if(scoped)profile=cleanShared(audience,read('shared-fields'));
    legacy.clear();
    for(const doc of documents){
      let record=read(doc.id);
      // Keep legacy company subscription answers in their company folder.
      if(doc.id==='subscription-company'&&!record)record=read('subscription-form');
      if(scoped&&!accountId){
        const old=read(doc.id,DRAFT_PREFIX);
        if(old&&!record&&doc.group===audience){
          record=clean(doc,old);
          // Retain the old record if storage is unavailable during migration.
          if(write(doc.id,record))write(doc.id,null,DRAFT_PREFIX);
        }else if(old&&doc.group==='shared')legacy.set(doc.id,clean(doc,old));
      }
      memory.set(doc.id,reconcileShared(doc,clean(doc,record),profile,audience));
    }
    const saved=read('preferences')||(scoped&&!accountId?read('preferences',DRAFT_PREFIX):null);
    preferences={lang:['en','ar'].includes(saved?.lang)?saved.lang:null,active:documents.some(d=>d.id===saved?.active)?saved.active:null};
  }
  refresh();
  return {
    prefix,
    get available(){return failedKeys.size===0;},
    get preferences(){return preferences;},
    get profile(){return {...profile};},
    get(id){return memory.get(id)||empty();},
    has(id){const r=this.get(id);return Object.values(r.values).some(hasValue)||Object.keys(r.signatures).length>0;},
    hasLegacy(id){const r=legacy.get(id);return Boolean(r&&(Object.values(r.values).some(hasValue)||Object.keys(r.signatures).length));},
    restoreLegacy(id){
      const doc=documents.find(d=>d.id===id&&d.group==='shared');
      const old=doc&&read(id,DRAFT_PREFIX);
      if(!old)return false;
      const r=reconcileShared(doc,clean(doc,old),profile,audience);
      if(!persist(doc,r))return false;
      write(id,null,DRAFT_PREFIX);legacy.delete(id);return true;
    },
    save(id,values,step,signatures={},editedField=null){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      const old=this.get(id),overrides=[...old.overrides];
      if(editedField&&!overrides.includes(editedField))overrides.push(editedField);
      return persist(doc,reconcileShared(doc,{...old,values:{...values},signatures:cleanSignatures(doc,signatures),step,overrides},profile,audience));
    },
    setShared(next){
      if(!scoped)return false;
      profile=cleanShared(audience,next);
      let ok=write('shared-fields',profile);
      for(const doc of documents)if(!persist(doc,reconcileShared(doc,this.get(doc.id),profile,audience)))ok=false;
      return ok;
    },
    useShared(id,field){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      const r=this.get(id),next={...r,values:{...r.values},overrides:r.overrides.filter(k=>k!==field)};
      delete next.values[field];return persist(doc,reconcileShared(doc,next,profile,audience));
    },
    fillSharedBlanks(id){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      const r=this.get(id),next={...r,overrides:r.overrides.filter(key=>hasValue(r.values[key]))};
      return persist(doc,reconcileShared(doc,next,profile,audience));
    },
    setPreferences(next){preferences={...preferences,...next};return write('preferences',preferences);},
    clear(id){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      const r=empty();
      if(scoped)r.overrides=Object.keys(sharedCandidates(doc,profile,{},audience));
      return persist(doc,r);
    },
    clearAll(){
      let ok=true;
      if(scoped){profile={};if(!write('shared-fields',null))ok=false;}
      for(const doc of documents)if(!persist(doc,empty()))ok=false;
      this.setPreferences({active:null});return ok&&this.available;
    },
    refresh,
  };
}
