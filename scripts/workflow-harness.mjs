// Shared support for the isolated workflow-toggle browser audit. Importing it
// performs no I/O; callers must wait for the final contract and ready build.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';

export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function fixture(){
 const out=path.resolve('tmp/workflow-toggle-'+Date.now()+'-'+randomBytes(3).toString('hex'));
 await fs.mkdir(out+'/sessions',{recursive:true,mode:0o700});
 await fs.cp('dist',out+'/site',{recursive:true});
 const baseline={head:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),created:new Date().toISOString(),build:{}};
 for(const name of ['portal.php','portal-workflow.php','portal-reviews.php','portal-versions.php'])baseline.build['api/'+name]=digest(await fs.readFile(out+'/site/api/'+name));
 for(const name of (await fs.readdir(out+'/site/assets')).filter(name=>/\.(js|css)$/.test(name)).sort())baseline.build['assets/'+name]=digest(await fs.readFile(out+'/site/assets/'+name));
 await fs.writeFile(out+'/baseline.json',JSON.stringify(baseline,null,2));
 const credentials={admin:{username:'qa.admin',password:randomBytes(24).toString('base64url')+'aA7!'},superadmin:{username:'superadmin',password:randomBytes(24).toString('base64url')+'aA7!'}};
 for(const [role,script] of [['admin','management-init.php'],['superadmin','management-superadmin-init.php']]){
  const result=spawnSync('php',['scripts/'+script,out+'/management',credentials[role].username],{input:credentials[role].password,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
 const nonce=randomBytes(16).toString('hex');
 await fs.writeFile(out+'/router.php',`<?php
 $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
 if($path==='/qa-health-${nonce}'){header('Content-Type: application/json');echo json_encode(['nonce'=>'${nonce}']);return;}
 if(preg_match('~(?:^|/)[._]~',rawurldecode($path))){http_response_code(404);exit;}
 $root=realpath(__DIR__.'/site');$target=realpath($root.$path);
 if($target===false||($target!==$root&&!str_starts_with($target,$root.'/'))){http_response_code(404);exit;}
 if(is_dir($target)){if(!str_ends_with($path,'/')){header('Location: '.$path.'/');exit;}readfile($target.'/index.html');return true;}
 return false;`);
 const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const base='http://127.0.0.1:'+port,log=await fs.open(out+'/server.log','a');let server;
 async function stop(){if(server&&server.exitCode===null){const done=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await done;}server=null;}
 async function start(){
  assert.equal(server,null);
  server=spawn('php',['-d','session.save_path='+out+'/sessions','-d','upload_max_filesize=20M','-d','post_max_size=24M','-S','127.0.0.1:'+port,'-t',out+'/site',out+'/router.php'],{env:{...process.env,FORMS_DATA_DIR:out+'/management',FORMS_PORTAL_DATA_DIR:out+'/portal'},stdio:['ignore',log.fd,log.fd]});
  let ready=false;for(let attempt=0;attempt<60;attempt++){assert.equal(server.exitCode,null,'Own PHP server exited before readiness');try{const result=await(await fetch(base+'/qa-health-'+nonce)).json();if(result.nonce===nonce){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'Own health nonce must match before any API call');
 }
 server=null;await start();
 const tokens=new WeakMap();
 async function call(ctx,area,action,{data,multipart,status=200,params={},headers={},method}={}){
  const response=await ctx.request[method||(data||multipart?'post':'get')](base+'/api/'+area+'.php?'+new URLSearchParams({action,...params}),{...(data?{data}:{}),...(multipart?{multipart}:{}),headers:{'X-CSRF-Token':tokens.get(ctx)?.[area]||'',...headers}});
  const text=await response.text();assert.equal(response.status(),status,area+'/'+action+' HTTP '+response.status()+': '+text.slice(0,300));const body=JSON.parse(text);
  if(body.csrf)tokens.set(ctx,{...tokens.get(ctx),[area]:body.csrf});return body;
 }
 async function login(ctx,role){await call(ctx,'management','session');const auth=await call(ctx,'management','login',{data:credentials[role]});assert.equal(auth.role,role);tokens.set(ctx,{...tokens.get(ctx),portal:auth.csrf});return auth;}
 const clientPassword=randomBytes(24).toString('base64url')+'aA7!';let accountNumber=0;
 async function client(ctx,audience){await call(ctx,'portal','session');const result=await call(ctx,'portal','register',{data:{first_name:'QA Workflow',last_name:audience,phone:'55198'+String(++accountNumber).padStart(4,'0'),account_type:audience,password:clientPassword,confirm:clientPassword},status:201});return result.user;}
 async function submit(ctx,user,{document='signature-form',values={client_name:user.name},expectedCurrent=null,editedFrom,source='online',signedConfirmed,signatures,signatureModes,workflowRevision,status=201,metadata:extra={}}={}){
  const image='data:image/png;base64,'+(await fs.readFile('tests/fixtures/signature.png')).toString('base64');
  const metadata={account:user.id,document,audience:user.account_type,values,source,expectedCurrent,requestKey:randomUUID(),...(source==='online'?{signatures:signatures||{specimen:image},signatureModes:signatureModes||{specimen:'electronic'}}:{signedConfirmed:signedConfirmed??true}),...(editedFrom?{editedFrom}:{}),...(workflowRevision===undefined?{}:{workflowRevision}),...extra};
  const bytes=await fs.readFile(out+'/site/pdfs/'+document+'.pdf');
  const result=await call(ctx,'portal','submit',{multipart:{metadata:JSON.stringify(metadata),pdf:{name:'qa-workflow.pdf',mimeType:'application/pdf',buffer:bytes}},status});return result.submission||result;
 }
 async function close(){await stop();await log.close();}
 return{out,base,baseline,credentials,call,login,client,submit,start,stop,close,tokens};
}
