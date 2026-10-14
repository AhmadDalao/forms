import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,copyFileSync,mkdirSync,rmSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const source=JSON.parse(readFileSync('scripts/pdf-design/national-address.json','utf8'));
const parts=source.text.split(' | '),defaultAddress=parts[0]+'\n'+parts.slice(1,3).join(' · ')+'\n'+parts.slice(3).join(' · ');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'forms-website-settings-')),api=join(dir,'api'),privateDir=join(dir,'management');
 mkdirSync(api);mkdirSync(privateDir);
 copyFileSync('public/api/website-settings.php',join(api,'website-settings.php'));
 writeFileSync(join(api,'national-address.json'),JSON.stringify(source));
 const catalogue={documents:[{id:'preserved-template'}],orders:{individual:['preserved-template'],corporate:[]}};
 writeFileSync(join(api,'defaults.json'),JSON.stringify(catalogue));
 const call=(code,args=[])=>JSON.parse(execFileSync('php',['-r',`require $argv[1];$directory=$argv[2];${code}`,join(api,'website-settings.php'),privateDir,...args],{encoding:'utf8'}));
 const read=()=>call('echo json_encode(websiteSettings($directory));');
 const save=(address,revision)=>call('try{echo json_encode(saveWebsiteSettings($directory,json_decode($argv[3],true),"superadmin"));}catch(DomainException $e){echo json_encode(["error"=>$e->getMessage()]);}',[JSON.stringify({national_address:address,revision})]);
 return {dir,api,privateDir,catalogue,call,read,save,close:()=>rmSync(dir,{recursive:true,force:true})};
}

test('website defaults use the canonical three lines and public reads expose only the address',()=>{
 const f=fixture();try{
  assert.deepEqual(f.read(),{national_address:defaultAddress,revision:0,updated_at:null,updated_by:null});
  assert.deepEqual(f.call('echo json_encode(websitePublicSettings($directory));'),{national_address:defaultAddress});
  assert.equal(existsSync(join(f.privateDir,'state.json')),false);
  assert.deepEqual(f.call('echo json_encode(websiteSettings($directory."/absent"));'),f.read());
  assert.equal(existsSync(join(f.privateDir,'absent')),false);
 }finally{f.close();}
});

test('website address normalization preserves Unicode and rejects blank, overlong or excessive-line values',()=>{
 const f=fixture();try{
  assert.equal(f.save('  حي الزهراء  \r\n\r\n  Jeddah \r Saudi Arabia  ',0).national_address,'حي الزهراء\nJeddah\nSaudi Arabia');
  for(const address of ['', ' \n\t ',null,123,{},'x'.repeat(1001),'س'.repeat(1001),Array(9).fill('Line').join('\n'),'nul\0byte']){
   assert.equal(f.save(address,1).error,'website_address_invalid');
  }
  assert.equal(f.read().revision,1);
  assert.equal(f.save('س'.repeat(1000),1).national_address.length,1000);
 }finally{f.close();}
});

test('website saves preserve catalogue state, own their revision and safely retry identical saves',()=>{
 const f=fixture();try{
  const original={revision:37,draft:f.catalogue,published:{...f.catalogue,title:'Published'},history:[{unchanged:true}],custom:{untouched:true}};
  writeFileSync(join(f.privateDir,'state.json'),JSON.stringify(original));
  const saved=f.save('New website address',0);
  assert.equal(saved.revision,1);assert.equal(saved.updated_by,'superadmin');assert.match(saved.updated_at,/^\d{4}-\d\d-\d\dT/);
  const bytes=readFileSync(join(f.privateDir,'state.json'));
  assert.deepEqual(JSON.parse(bytes),{...original,website:saved});
  assert.equal(statSync(join(f.privateDir,'state.json')).mode&0o777,0o600);
  assert.deepEqual(f.save('New website address',0),saved);
  assert.deepEqual(f.save('New website address',1),saved);
  assert.deepEqual(readFileSync(join(f.privateDir,'state.json')),bytes,'No-op retry does not rewrite state');
  assert.equal(f.save('Stale competing address',0).error,'website_settings_conflict');
  assert.equal(f.save('New website address',2).error,'website_settings_conflict');
  for(const revision of [-1,'1',null,1.5])assert.equal(f.save('Another address',revision).error,'website_address_invalid');
  assert.deepEqual(readFileSync(join(f.privateDir,'state.json')),bytes);
  assert.equal(f.save('Next address',1).revision,2);
  assert.deepEqual(f.call('echo json_encode(websitePublicSettings($directory));'),{national_address:'Next address'});
 }finally{f.close();}
});

test('a first website edit initializes complete catalogue state without changing catalogue revision',()=>{
 const f=fixture();try{
  f.save(defaultAddress,0);assert.equal(existsSync(join(f.privateDir,'state.json')),false);
  const saved=f.save('First custom address',0),state=JSON.parse(readFileSync(join(f.privateDir,'state.json')));
  assert.deepEqual(state,{revision:0,draft:f.catalogue,published:f.catalogue,history:[],website:saved});
 }finally{f.close();}
});

test('simultaneous website writers cannot overwrite one another with the same revision',async()=>{
 const f=fixture();try{
  const code='require $argv[1];try{echo json_encode(saveWebsiteSettings($argv[2],["national_address"=>$argv[3],"revision"=>0],"superadmin"));}catch(DomainException $e){echo json_encode(["error"=>$e->getMessage()]);}';
  const run=value=>new Promise((resolve,reject)=>{const p=spawn('php',['-r',code,join(f.api,'website-settings.php'),f.privateDir,value]);let out='',error='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>error+=x);p.on('error',reject);p.on('exit',code=>code?reject(Error(error)):resolve(JSON.parse(out)));});
  const results=await Promise.all([run('Address A'),run('Address B')]);
  assert.equal(results.filter(r=>r.revision===1).length,1);assert.equal(results.filter(r=>r.error==='website_settings_conflict').length,1);
  assert.equal(f.read().national_address,results.find(r=>r.revision===1).national_address);
 }finally{f.close();}
});

test('malformed existing state is never replaced with fresh settings',()=>{
 const f=fixture();try{
  const file=join(f.privateDir,'state.json');writeFileSync(file,'{"preserve":"broken"');
  const result=f.call('try{saveWebsiteSettings($directory,["national_address"=>"Unsafe reset","revision"=>0],"superadmin");echo json_encode(false);}catch(Throwable){echo json_encode(true);}');
  assert.equal(result,true);assert.equal(readFileSync(file,'utf8'),'{"preserve":"broken"');
 }finally{f.close();}
});
