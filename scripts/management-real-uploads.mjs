import {request} from 'playwright';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'tmp/management-real-files'),data=path.join(out,'uploads-'+Date.now()),password=randomBytes(24).toString('hex');
const init=spawnSync('php',['scripts/management-superadmin-init.php',data,'qa.manager'],{input:password});assert.equal(init.status,0);
const server=spawn('php',['-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:8183','-t','dist','scripts/management-router.php'],{env:{...process.env,FORMS_DATA_DIR:data},stdio:'ignore'});
const base='http://127.0.0.1:8183';let owner,anon;const report=[];
try{
 for(let i=0;i<30;i++){try{await fetch(base+'/api/management.php?action=session');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 owner=await request.newContext({baseURL:base});anon=await request.newContext({baseURL:base});let csrf=(await (await owner.get('/api/management.php?action=session')).json()).csrf;
 csrf=(await (await owner.post('/api/management.php?action=login',{data:{username:'qa.manager',password},headers:{'X-CSRF-Token':csrf}})).json()).csrf;
 let state=await (await owner.get('/api/management.php?action=state')).json();
 const initial=await (await anon.get('/api/management.php?action=catalogue')).json();
 for(const record of JSON.parse(await fs.readFile(out+'/results.json','utf8'))){
  if(record.importError)continue;
  const buffer=await fs.readFile('public/pdfs/'+record.file),meta={title:record.file,ar:'اختبار استيراد مستند',description:'',arDescription:'',pageSizes:record.pageSizes,fields:record.fields,signatures:[],importedWidgets:record.importedWidgets,group:'shared',downloadOnly:false};
  const response=await owner.post('/api/management.php?action=upload',{headers:{'X-CSRF-Token':csrf},multipart:{pdf:{name:record.file,mimeType:'application/pdf',buffer},metadata:JSON.stringify(meta),revision:String(state.revision)}});assert.equal(response.status(),200,await response.text());state=await response.json();const doc=state.draft.documents.at(-1);
  const source=await owner.get('/api/management.php?action=document&id='+doc.id);assert.equal(source.status(),200);assert.equal(createHash('sha256').update(await source.body()).digest('hex'),createHash('sha256').update(buffer).digest('hex'));
  assert.equal((await anon.get('/api/management.php?action=document&id='+doc.id)).status(),404);
  const review=await owner.post('/api/management.php?action=review',{headers:{'X-CSRF-Token':csrf},data:{id:doc.id,revision:state.revision}});assert.equal(review.status(),400,'Incomplete import should not be approved');
  report.push({file:record.file,pages:doc.pages,fields:doc.fields.length,upload:'passed',originalBytesPreserved:true,unpublishedPrivate:true,unreviewedRejected:true});
  console.log('PASS upload/download/review protection',record.file);
 }
 assert.deepEqual(await (await anon.get('/api/management.php?action=catalogue')).json(),initial);
 await fs.writeFile(out+'/upload-checks.json',JSON.stringify(report,null,2));
}finally{await owner?.dispose();await anon?.dispose();server.kill();}
