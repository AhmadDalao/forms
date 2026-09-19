import test from 'node:test';
import assert from 'node:assert/strict';
import {docs} from '../src/forms/index.js';
import {createDraftStore} from '../src/drafts.js';
import {personNameGroups,joinPersonName} from '../src/person-names.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const store=(disk,audience='individual',revision=null)=>createDraftStore(docs,()=>disk,audience,'a'.repeat(32),revision);
const profile={en_first:'Abdul Rahman',en_second:'Mohammed',en_third:'',en_last:'Al Ghamdi',ar_first:'عبد الرحمن',ar_second:'محمد',ar_third:'',ar_last:'الغامدي',name_language:'ar'};
test('English and Arabic shared name boundaries remain exact across matching forms, edits, clearing and reload',()=>{
 const disk=storage(),s=store(disk);s.setShared(profile);
 assert.equal(s.get('subscription-form').values.en_first,'Abdul Rahman');assert.equal(s.get('subscription-form').values.en_last,'Al Ghamdi');
 assert.equal(s.get('signature-form').values.client_name_first,'عبد الرحمن');
 assert.equal(s.get('kyc-individual').values.name_1,'عبد الرحمن محمد');assert.equal(s.get('kyc-individual').values.name_2,'الغامدي');
 s.save('signature-form',{...s.get('signature-form').values,client_name_second:'أحمد'},0,{},'client_name_second');
 s.setShared({...profile,ar_last:'الدوسري'});
 assert.equal(s.get('signature-form').values.client_name,'عبد الرحمن أحمد الدوسري');
 s.save('signature-form',{...s.get('signature-form').values,client_name_second:''},0,{},'client_name_second');
 let reopened=store(disk);assert.equal(reopened.get('signature-form').values.client_name_second,'');assert.equal(reopened.get('signature-form').values.client_name,'عبد الرحمن الدوسري');
 reopened.setShared({...profile,ar_second:'علي'});assert.equal(reopened.get('signature-form').values.client_name_second,'');
 reopened.useShared('signature-form','client_name');assert.equal(reopened.get('signature-form').values.client_name,'عبد الرحمن علي الغامدي');
});
test('company authorized names reuse four parts without converting company names or crossing audiences',()=>{
 const disk=storage(),c=store(disk,'corporate'),i=store(disk);c.setShared({company_name:'The Investment Company',auth_first:'Abdul Rahman',auth_second:'Mohammed',auth_third:'',auth_last:'Al Ghamdi'});
 assert.equal(c.profile.auth_name,'Abdul Rahman Mohammed Al Ghamdi');
 for(const [doc,prefix] of [['subscription-company','auth_name'],['kyc-corporate','auth_name'],['fatca-crs-corporate','signer_0_name']]){assert.equal(c.get(doc).values[prefix+'_first'],'Abdul Rahman');assert.equal(c.get(doc).values[prefix+'_last'],'Al Ghamdi');}
 assert.equal(c.get('signature-form').values.client_name,'The Investment Company');assert.equal(c.get('signature-form').values.client_name_first,undefined);
 assert.equal(i.profile.auth_first,undefined);assert.equal(i.get('subscription-form').values.en_first,undefined);
 const reopened=store(disk,'corporate');assert.equal(reopened.profile.auth_third,'');
});
test('legacy full names hydrate without losing words and all four deliberate blanks survive reopening',()=>{
 for(const audience of ['individual','corporate'])for(const doc of docs.filter(d=>d.group===audience||d.group==='shared'))for(const group of personNameGroups(doc,audience)){
  const disk=storage(),s=store(disk,audience),full='Abdul Rahman Mohammed Ali Al Ghamdi';
  disk.setItem(s.prefix+doc.id,JSON.stringify({values:{[group.targets[0].id]:full},overrides:[group.targets[0].id]}));
  let reopened=store(disk,audience),r=reopened.get(doc.id);assert.equal(joinPersonName(group.targets.map(target=>r.values[target.id])),full,doc.id+'/'+group.id);
  for(const id of group.partIds)reopened.save(doc.id,{...reopened.get(doc.id).values,[id]:''},0,{},id);
  reopened=store(disk,audience);for(const id of group.partIds)assert.equal(reopened.get(doc.id).values[id],'',id);
  for(const target of group.targets)assert.equal(reopened.get(doc.id).values[target.id],'',target.id);
 }
});
test('archived snapshot edits isolate old names from current shared data and preserve original snapshot',()=>{
 const disk=storage(),normal=store(disk);normal.setShared(profile);
 const snapshot={id:'b'.repeat(32),current_id:'b'.repeat(32),version:1,answers:{client_name:'Old Ali Family'},profile:{},signatures:{}},before=JSON.stringify(snapshot);
 const edit=store(disk,'individual',snapshot.id);edit.loadSubmission('signature-form',snapshot);
 assert.equal(edit.get('signature-form').values.client_name_first,'Old');
 edit.setShared({...profile,en_first:'New'});assert.equal(edit.get('signature-form').values.client_name,'Old Ali Family');
 edit.save('signature-form',{...edit.get('signature-form').values,client_name_second:'Changed'},0,{},'client_name_second');
 assert.equal(edit.get('signature-form').values.client_name,'Old Changed Family');assert.equal(JSON.stringify(snapshot),before);
 assert.equal(normal.get('signature-form').values.client_name,'عبد الرحمن محمد الغامدي');
});

test('identical full text never switches the explicitly chosen language part boundaries',()=>{
 const s=store(storage());s.setShared({en_first:'Abdul',en_second:'Rahman',en_third:'Ali',en_last:'Family',ar_first:'Abdul Rahman',ar_second:'Ali',ar_third:'',ar_last:'Family',name_language:'ar'});
 s.save('fatca-crs-individual',{...s.get('fatca-crs-individual').values,capacity:'holder'},3,{},'capacity');
 assert.equal(s.get('fatca-crs-individual').values.signer_ar_first,'Abdul Rahman');assert.equal(s.get('fatca-crs-individual').values.signer_en_first,'Abdul');
 assert.equal(s.get('signature-form').values.client_name_first,'Abdul Rahman');assert.equal(s.get('kyc-individual').values.name_1,'Abdul Rahman Ali');
});
