import {nameParts} from './names.js';
import {joinedName} from './subscription/model.js';
import {draftStoragePrefix} from './routes.js';
import { hasValue } from './schema.js';
import { defaultDates } from './dates.js';
import {countryFields,defaultCountries,sharedCountryIds,saudiCountry} from './countries.js';
import { cleanSignatures, cleanSignatureModes, signatureSlots, requiredSignatureSlots } from './signatures.js';
import { cleanShared, reconcileShared, sharedCandidates } from './shared-fields.js';

export const DRAFT_PREFIX = draftStoragePrefix;

// Each audience owns its profile, drafts and signatures, including the two
// templates that appear in both folders. Unscoped mode reads legacy drafts.
export function createDraftStore(documents, getStorage = () => window.localStorage, audience = null, accountId = null, revisionId = null) {
  const scoped=['individual','corporate'].includes(audience);
  if(scoped)documents=documents.filter(d=>d.group===audience||d.group==='shared');
  const basePrefix=DRAFT_PREFIX+(accountId?'account.'+accountId+'.':'')+(scoped?audience+'.':'');
  const prefix=basePrefix+(accountId&&/^[a-f0-9]{32}$/.test(revisionId)?'revision.'+revisionId+'.':'');
  const memory=new Map(),failedKeys=new Set(),legacy=new Map();
  let preferences={},profile={},countryLanguage=null;
  const empty=()=>({values:{},signatures:{},signatureModes:{},step:0,shared:{},overrides:[]});
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
    if(doc.id==='fatca-crs-individual'&&record?.values)record={...record,values:nameParts(record.values)};
    // Adapt saved subscription names without changing unrelated document drafts.
    if(doc.workflow==='subscription'&&(record?.values?.ar_name||record?.values?.en_name)){
      const old=record.values, next={...old};
      if(!('english_name' in next)&&old.en_name)next.english_name=old.en_name;
      if(!('po_box' in next)&&old.pob)next.po_box=old.pob;
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
    const values={},shared={},countryDefaults={},countryIds=new Set(countryFields(doc).map(f=>f.id));
    for(const field of doc.fields){
      const value=record?.values?.[field.id];
      if(countryIds.has(field.id)&&value==='')values[field.id]='';
      if(typeof record?.shared?.[field.id]==='string')shared[field.id]=record.shared[field.id];
      if(field.sum||!hasValue(value))continue;
      if(field.type==='choice'){
        const allowed=field.options.map(o=>o.value);
        if(field.multiple&&Array.isArray(value))values[field.id]=value.filter(v=>allowed.includes(v));
        else if(allowed.includes(value))values[field.id]=value;
      }else if(typeof value==='string')values[field.id]=value;
      if(countryIds.has(field.id)&&record?.countryDefaults?.[field.id]===value)countryDefaults[field.id]=value;
    }
    const signatures=cleanSignatures(doc,record?.signatures),signatureModes=cleanSignatureModes(doc,record?.signatureModes,signatures);
    for(const [id,mode] of Object.entries(signatureModes))if(mode==='manual')delete signatures[id];
    return {...(record?.revision?{revision:record.revision}:{}),values,shared,...(Object.keys(countryDefaults).length?{countryDefaults}:{}),overrides:Array.isArray(record?.overrides)?record.overrides.filter(id=>doc.fields.some(f=>f.id===id)):[],signatures,signatureModes,step:Math.max(0,Math.min(doc.sections.length-1,Math.trunc(Number(record?.step))||0))};
  }
  function persist(doc,record){
    memory.set(doc.id,record);
    const populated=Object.values(record.values).some(hasValue)||Object.keys(record.signatures).length||Object.values(record.signatureModes||{}).includes('electronic');
    return write(doc.id,scoped||populated?{...record,updatedAt:Date.now()}:null);
  }
  function refresh(){
    if(scoped)profile=cleanShared(audience,read('shared-fields',basePrefix));
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
    prefix,basePrefix,
    get available(){return failedKeys.size===0;},
    get preferences(){return preferences;},
    get profile(){return {...profile};},
    get(id){return memory.get(id)||empty();},
    initializeDates(id){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      const record=this.get(id),values=defaultDates(doc,record);
      if(Object.keys(values).length===Object.keys(record.values).length)return true;
      return persist(doc,{...record,values});
    },
    initializeCountries(id,lang='en'){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      countryLanguage=lang;
      const record=this.get(id),next=defaultCountries(doc,record,lang);
      return JSON.stringify(next)===JSON.stringify(record)||persist(doc,next);
    },
    initializeSharedCountries(lang='en'){
      const next={...profile};
      for(const id of sharedCountryIds(audience))if(!(id in next))next[id]=saudiCountry(lang);
      return JSON.stringify(next)===JSON.stringify(profile)||this.setShared(next);
    },
    has(id){const r=this.get(id);return Object.values(r.values).some(hasValue)||Object.keys(r.signatures).length>0||Object.values(r.signatureModes||{}).includes('electronic');},
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
      const images=cleanSignatures(doc,signatures),signatureModes=cleanSignatureModes(doc,old.signatureModes,images);
      for(const [slot,mode] of Object.entries(signatureModes))if(mode==='manual')delete images[slot];
      const next=reconcileShared(doc,{...old,values:{...values},signatures:images,signatureModes,step,overrides},profile,audience);
      return persist(doc,countryLanguage?defaultCountries(doc,next,countryLanguage):next);
    },
    setSignatureMode(id,slot,mode){
      const doc=documents.find(d=>d.id===id);
      if(!doc||!signatureSlots(doc).some(s=>s.id===slot)||!['manual','electronic'].includes(mode))return false;
      const old=this.get(id),signatures={...old.signatures};if(mode==='manual')delete signatures[slot];
      return persist(doc,{...old,signatures,signatureModes:{...old.signatureModes,[slot]:mode}});
    },
    loadSubmission(id,snapshot){
      const doc=documents.find(d=>d.id===id);if(!doc)return false;
      if(this.get(id).revision?.sourceId===snapshot.id)return true;
      // Isolated edit drafts never replace the customer's normal working draft.
      // Blank submitted fields are deliberate too; shared data cannot refill them.
      const autoApplicant=doc.workflow==='subscription'&&snapshot.answers.applicant_name===(doc.group==='individual'?joinedName(snapshot.answers):snapshot.answers.auth_name);
      return persist(doc,clean(doc,{values:snapshot.answers,signatures:snapshot.signatures||{},step:0,overrides:doc.fields.map(f=>f.id).filter(id=>id!=='applicant_name'||!autoApplicant),revision:{sourceId:snapshot.id,expectedCurrent:snapshot.current_id,version:snapshot.version,legacySignatures:snapshot.signatures===null,profile:snapshot.profile}}));
    },
    beginSignatureRequest(id,reviewRevision){
      const doc=documents.find(d=>d.id===id),record=this.get(id);
      if(!doc||!record.revision||record.revision.signatureReviewRevision===reviewRevision)return;
      const signatures={...record.signatures},signatureModes={...record.signatureModes};
      for(const slot of requiredSignatureSlots(doc,record.values)){delete signatures[slot.id];signatureModes[slot.id]='electronic';}
      return persist(doc,{...record,signatures,signatureModes,revision:{...record.revision,signatureReviewRevision:reviewRevision}});
    },
    submitted(id,snapshot){
      const doc=documents.find(d=>d.id===id),record=this.get(id);if(!doc||!record.revision)return;
      memory.set(id,{...record,revision:{...record.revision,expectedCurrent:snapshot.id}});
      // A completed edit must not replace the original when opened from history again.
      write(id,null);
    },
    setShared(next){
      if(!scoped)return false;
      profile=cleanShared(audience,next);
      let ok=write('shared-fields',profile,basePrefix);
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
      const r={...empty(),...(this.get(id).revision?{revision:this.get(id).revision}:{})};
      if(scoped)r.overrides=Object.keys(sharedCandidates(doc,profile,{},audience));
      return persist(doc,r);
    },
    clearAll(){
      let ok=true;
      if(scoped){profile={};if(!write('shared-fields',null,basePrefix))ok=false;}
      if(accountId&&prefix===basePrefix){
        try{
          const storage=getStorage(),keys=Array.from({length:storage.length},(_,i)=>storage.key(i));
          for(const key of keys)if(key?.startsWith(basePrefix+'revision.'))storage.removeItem(key);
          failedKeys.delete('revision-cleanup');
        }catch{failedKeys.add('revision-cleanup');ok=false;}
      }
      for(const doc of documents)if(!persist(doc,empty()))ok=false;
      this.setPreferences({active:null});return ok&&this.available;
    },
    refresh,
  };
}
