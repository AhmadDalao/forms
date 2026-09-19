import fs from 'node:fs/promises';
import {signatureSlots} from '../src/signatures.js';
import {docs} from '../src/forms/index.js';
import {catalogueFor} from '../src/catalogue.js';
import {sharedGroups} from '../src/shared-fields.js';
const all=[...new Map(['individual','corporate'].flatMap(a=>catalogueFor(docs,a)).map(d=>[d.id,d])).values()];
const documents=all.map(({id,title,ar,group,pages,number,description,arDescription,downloadOnly,pdfVersion})=>({id,title,ar,group,pages,number,description,arDescription,downloadOnly:!!downloadOnly,pdfVersion,builtin:true,reviewed:true}));
const orders=Object.fromEntries(['individual','corporate'].map(a=>[a,catalogueFor(docs,a).map(d=>d.id)]));
await fs.mkdir('dist/api',{recursive:true});
await fs.writeFile('dist/api/defaults.json',JSON.stringify({documents,orders}));

await fs.writeFile('dist/api/portal-defaults.json',JSON.stringify(Object.fromEntries(docs.map(d=>[d.id,{id:d.id,workflow:d.workflow,fields:d.fields,sections:d.sections.map(s=>({id:s.id,title:s.title,ar:s.ar,field_ids:s.fields.map(f=>f.id)})),signatureSlots:signatureSlots(d)}]))));
await fs.writeFile('dist/api/client-profile-defaults.json',JSON.stringify(Object.fromEntries(['individual','corporate'].map(audience=>[audience,sharedGroups(audience).flatMap(group=>group.fields.map(({id,label,ar,type,options})=>({id,label,ar,type,options})))]))));
