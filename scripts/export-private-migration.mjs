// Download an authorized superadmin snapshot over HTTPS; never print credentials or answers.
import fs from 'node:fs/promises';
import path from 'node:path';
import {request} from 'playwright';
const [site,credentialFile,destination]=process.argv.slice(2);
if(!site||!credentialFile||!destination)throw Error('Usage: node scripts/export-private-migration.mjs HTTPS_SITE_URL PRIVATE_CREDENTIALS.json DESTINATION.zip');
process.umask(0o077);
const base=new URL(site);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Use an HTTPS site URL without credentials.');
if(!base.pathname.endsWith('/'))base.pathname+='/';
if(await fs.stat(destination).then(()=>true,()=>false))throw Error('Destination exists; choose a new file.');
const credentials=JSON.parse(await fs.readFile(credentialFile,'utf8'));
if(typeof credentials.username!=='string'||typeof credentials.password!=='string')throw Error('Credentials need username and password.');
const ctx=await request.newContext({timeout:120000});let token='',authenticated=false;
const endpoint=action=>new URL('api/management.php?action='+action,base).href;
try{
 const session=await ctx.get(endpoint('session'));if(!session.ok())throw Error('Cannot reach management session.');token=(await session.json()).csrf;
 const login=await ctx.post(endpoint('login'),{data:{username:credentials.username,password:credentials.password},headers:{'X-CSRF-Token':token}});
 if(!login.ok())throw Error('Management sign-in failed.');const auth=await login.json();if(auth.role!=='superadmin')throw Error('Superadmin account required.');token=auth.csrf;authenticated=true;
 const response=await ctx.post(endpoint('export_backup'),{data:{},headers:{'X-CSRF-Token':token}});
 if(!response.ok()||!response.headers()['content-type']?.includes('application/zip'))throw Error('Private export failed (HTTP '+response.status()+').');
 const bytes=await response.body();if(bytes.subarray(0,2).toString()!=='PK')throw Error('Unexpected archive format.');
 await fs.mkdir(path.dirname(path.resolve(destination)),{recursive:true,mode:0o700});await fs.writeFile(destination,bytes,{flag:'wx',mode:0o600});
 console.log('Private snapshot saved. Verify with restore-installation.php before delivery.');
}finally{
 if(authenticated)await ctx.post(endpoint('logout'),{data:{},headers:{'X-CSRF-Token':token}}).catch(()=>{});
 await ctx.dispose();
}
