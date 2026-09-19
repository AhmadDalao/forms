import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedSync} from '../src/shared-sync.js';
import {cleanShared} from '../src/shared-fields.js';
const disk=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function harness({remote={},revision=0,local={},storage=disk(),audience='individual',account='owner',api:override}={}){
 let profile=cleanShared(audience,local),server={profile:structuredClone(remote),revision,updated_at:null},writes=0,offline=false,nextSave=null;
 const api=async(action,body)=>{if(offline)throw Error('connection_failed');if(action==='shared_profile')return{shared:structuredClone(server)};
  writes++;if(nextSave){const wait=nextSave;nextSave=null;await wait.promise;}
  if(body.expectedRevision!==server.revision)throw Error('shared_profile_conflict');for(const [id,v]of Object.entries(body.changes))if(v===null)delete server.profile[id];else server.profile[id]=v;server.revision++;server.updated_at='now';return{shared:structuredClone(server)};};
 const drafts={basePrefix:'test.'+account+'.'+audience+'.',get profile(){return profile},setShared:p=>profile=cleanShared(audience,p)};
 const sync=createSharedSync({account,audience,drafts,api:override||api,storage:()=>storage,events:null,delay:100000});
 return{sync,drafts,storage,get server(){return server},get writes(){return writes},get profile(){return profile},set offline(v){offline=v},delaySave:()=>nextSave=defer(),edit:changes=>{drafts.setShared({...profile,...changes});sync.change(profile);},replace:p=>{drafts.setShared(p);sync.change(profile);}};
}
test('first account profile imports existing browser details and restores from a fresh browser',async()=>{
 const h=harness({local:{en_first:'Ahmad',en_second:'Ali',en_third:'',en_last:'Dalao',also_residence:false,country:''}});await h.sync.start();assert.equal(h.sync.state.canInitialize,true);await h.sync.flush();assert.equal(h.server.revision,1);assert.equal(h.server.profile.en_third,'');assert.equal(h.server.profile.also_residence,false);assert.equal(h.server.profile.en_middle,undefined);
 const fresh=harness({remote:h.server.profile,revision:1});await fresh.sync.start();assert.equal(fresh.profile.en_first,'Ahmad');assert.equal(fresh.sync.state.canInitialize,false);assert.equal(fresh.writes,0);h.sync.dispose();fresh.sync.dispose();
});
test('established cloud data replaces stale browser cache; empty tombstone does not reseed',async()=>{
 for(const remote of [{en_first:'Current'},{}]){const h=harness({remote,revision:4,local:{en_first:'Old'}});await h.sync.start();assert.deepEqual(h.profile,remote);assert.equal(h.sync.state.canInitialize,false);assert.equal(h.writes,0);h.sync.dispose();}
});
test('save acknowledgements cannot replace newer edits made while request is pending',async()=>{
 const h=harness({remote:{en_first:'Old'},revision:1});await h.sync.start();h.edit({en_first:'First'});const wait=h.delaySave(),saving=h.sync.flush();h.edit({en_first:'Newest',city:'Riyadh'});wait.resolve();await saving;assert.equal(h.profile.en_first,'Newest');assert.equal(h.sync.state.status,'saving');await h.sync.flush();assert.equal(h.server.profile.en_first,'Newest');assert.equal(h.server.profile.city,'Riyadh');assert.equal(h.sync.state.status,'saved');h.sync.dispose();
});
test('stale disjoint edits merge while same-field conflicts require an explicit decision',async()=>{
 const h=harness({remote:{en_first:'Old',city:'Old city'},revision:1});await h.sync.start();h.edit({city:'Local city'});h.server.profile.en_first='Remote';h.server.revision++;await h.sync.flush();assert.equal(h.sync.state.status,'saving');await h.sync.flush();assert.equal(h.server.profile.en_first,'Remote');assert.equal(h.server.profile.city,'Local city');
 h.edit({en_first:'Local'});h.server.profile.en_first='Elsewhere';h.server.revision++;await h.sync.flush();assert.equal(h.sync.state.status,'conflict');assert.equal(h.profile.en_first,'Local');assert.equal(h.server.profile.en_first,'Elsewhere');await h.sync.refresh();assert.equal(h.sync.state.status,'conflict');await h.sync.flush();assert.equal(h.server.profile.en_first,'Elsewhere');await h.sync.resolve('remote');assert.equal(h.profile.en_first,'Elsewhere');
 h.edit({en_first:'My correction'});h.server.profile.en_first='Latest';h.server.revision++;await h.sync.flush();await h.sync.resolve('local');assert.equal(h.server.profile.en_first,'My correction');h.sync.dispose();
});
test('offline edits remain queued across reopening and blanks/clear survive new devices',async()=>{
 const h=harness({remote:{en_first:'Name',email:'old@example.com'},revision:1});await h.sync.start();h.offline=true;h.edit({email:'',en_first:'New'});await h.sync.flush();assert.equal(h.sync.state.status,'offline');h.sync.dispose();
 const reopened=harness({remote:h.server.profile,revision:1,local:h.profile,storage:h.storage});await reopened.sync.start();await reopened.sync.flush();assert.equal(reopened.server.profile.en_first,'New');assert.equal(reopened.server.profile.email,undefined);reopened.replace({});await reopened.sync.flush();assert.deepEqual(reopened.server.profile,{});assert.ok(reopened.server.revision>1);reopened.sync.dispose();
});
test('clearing an unsaved initial profile records an empty cloud tombstone',async()=>{
 const h=harness({local:{en_first:'Imported'}});await h.sync.start();h.replace({});await h.sync.flush();assert.equal(h.server.revision,1);assert.deepEqual(h.server.profile,{});h.sync.dispose();
});
test('an offline first visit keeps new edits without blindly uploading an old browser profile',async()=>{
 const h=harness({local:{en_first:'Stale'},remote:{en_first:'Cloud',city:'Riyadh'},revision:3});h.offline=true;await h.sync.start();assert.equal(h.sync.state.canInitialize,false);h.edit({mobile:'0551234567'});await h.sync.flush();h.sync.dispose();
 const reopened=harness({storage:h.storage,local:h.profile,remote:h.server.profile,revision:3});await reopened.sync.start();await reopened.sync.flush();assert.equal(reopened.server.profile.en_first,'Cloud');assert.equal(reopened.server.profile.mobile,'0551234567');reopened.sync.dispose();
});
test('disposed account controllers ignore late responses and profile scopes stay separate',async()=>{
 const wait=defer(),h=harness({api:async()=>{await wait.promise;return{shared:{profile:{en_first:'A'},revision:1,updated_at:null}}}});const started=h.sync.start();h.sync.dispose();wait.resolve();await started;assert.equal(h.profile.en_first,undefined);
 const storage=disk(),a=harness({storage,account:'A',local:{en_first:'A'}}),b=harness({storage,account:'B'}),company=harness({storage,account:'A',audience:'corporate'});await a.sync.start();await a.sync.flush();await b.sync.start();await company.sync.start();assert.deepEqual(b.profile,{});assert.deepEqual(company.profile,{});for(const s of [a,b,company])s.sync.dispose();
});
test('closing during an active save drains newer queued edits without relying on another timer',async()=>{
 const h=harness({remote:{en_first:'Old'},revision:1});await h.sync.start();h.edit({en_first:'First'});const wait=h.delaySave(),saving=h.sync.flush();h.edit({en_first:'Final'});const closing=h.sync.flush({keepalive:true});wait.resolve();await Promise.all([saving,closing]);assert.equal(h.server.profile.en_first,'Final');assert.equal(h.sync.state.status,'saved');h.sync.dispose();
});
test('same-field conflicts survive reopening until an explicit choice',async()=>{
 const h=harness({remote:{city:'Old'},revision:1});await h.sync.start();h.edit({city:'Local'});h.server.profile.city='Elsewhere';h.server.revision++;await h.sync.flush();h.sync.dispose();
 const reopened=harness({remote:h.server.profile,revision:2,local:h.profile,storage:h.storage});await reopened.sync.start();assert.equal(reopened.sync.state.status,'conflict');await reopened.sync.refresh();assert.equal(reopened.sync.state.status,'conflict');await reopened.sync.resolve('local');assert.equal(reopened.server.profile.city,'Local');reopened.sync.dispose();
});
