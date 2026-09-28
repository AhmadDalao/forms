import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';

const id='fatca-crs-individual',target='staff_account_holder';
const keys=['first','second','third','last'].map(part=>target+'_'+part);
const disk=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const store=(storage,revision=null)=>createDraftStore(docs,()=>storage,'individual','staff-test',revision);
const profile={ar_first:'أحمد',ar_second:'محمد',ar_third:'',ar_last:'علي',en_first:'Ahmad',en_second:'Mohammed',en_third:'',en_last:'Ali'};
const entered={...Object.fromEntries(keys.map((key,i)=>[key,['أحمد','محمد','','علي'][i]])),[target]:'أحمد محمد علي'};
const assertBlank=values=>{for(const key of [target,...keys])assert.ok(!values[key],key+' must stay blank');};

for(const language of ['ar','en'])test(`staff names stay independent of customer sharing and persist when typed: ${language}`,()=>{
 const storage=disk(),s=store(storage);s.setShared({...profile,name_language:language});
 assertBlank(s.get(id).values);
 s.save(id,{...s.get(id).values,capacity:'holder'},3,{},'capacity');
 assert.equal(s.get(id).values.signer_ar,'أحمد محمد علي');
 assert.equal(s.get(id).values.signer_en,'Ahmad Mohammed Ali');
 assertBlank(s.get(id).values);
 const before=s.profile;
 for(const [i,key] of keys.entries())s.save(id,{...s.get(id).values,[key]:['Staff','Entered','','Name'][i]},3,{},key);
 assert.deepEqual(s.profile,before,'staff edits must not rename the customer');
 s.setShared({...s.profile,ar_first:'خالد',en_first:'Khalid'});
 assert.equal(s.get(id).values[target],'Staff Entered Name');
 assert.equal(store(storage).get(id).values[target],'Staff Entered Name');
});

test('only inherited staff names are cleared from old drafts, with other answers intact',()=>{
 const storage=disk(),s=store(storage);s.setShared({...profile,name_language:'ar'});
 const record={...s.get(id),values:{...s.get(id).values,...entered,staff_employee_id:'007',staff_cif:'000123'},shared:{...s.get(id).shared,...entered}};
 storage.setItem(s.prefix+id,JSON.stringify(record));
 const reopened=store(storage);assertBlank(reopened.get(id).values);
 assert.equal(reopened.get(id).values.ar_first,'أحمد');
 assert.equal(reopened.get(id).values.staff_employee_id,'007');
 assert.equal(reopened.get(id).values.staff_cif,'000123');
 reopened.save(id,reopened.get(id).values,3);assertBlank(store(storage).get(id).values);
});

for(const kind of ['override','untracked'])test(`deliberate old staff names survive even when identical to the customer: ${kind}`,()=>{
 const storage=disk(),s=store(storage);s.setShared({...profile,name_language:'ar'});
 storage.setItem(s.prefix+id,JSON.stringify({...s.get(id),values:{...s.get(id).values,...entered},shared:kind==='override'?entered:{},overrides:kind==='override'?[target,...keys]:[]}));
 const reopened=store(storage);assert.equal(reopened.get(id).values[target],entered[target]);
 reopened.setShared({...profile,ar_first:'خالد',name_language:'ar'});
 assert.equal(reopened.get(id).values[target],entered[target]);
});

test('historical submission edit snapshots keep their captured staff names',()=>{
 const storage=disk(),s=store(storage,'a'.repeat(32));
 const snapshot={id:'a'.repeat(32),current_id:'b'.repeat(32),version:1,answers:entered,signatures:{},profile};
 const original=JSON.stringify(snapshot);s.loadSubmission(id,snapshot);s.setShared({...profile,ar_first:'خالد'});
 assert.equal(s.get(id).values[target],entered[target]);
 assert.equal(store(storage,'a'.repeat(32)).get(id).values[target],entered[target]);
 assert.equal(JSON.stringify(snapshot),original);
});
