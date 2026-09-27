import fs from 'node:fs/promises';
const siteURL=new URL(process.env.FORMS_SITE_URL||'https://forms.ahmaddalao.com/');
if(!['http:','https:'].includes(siteURL.protocol)||siteURL.username||siteURL.password||siteURL.search||siteURL.hash)throw Error('FORMS_SITE_URL must be a public HTTP(S) URL.');
if(!siteURL.pathname.endsWith('/'))siteURL.pathname+='/';
const canonical=siteURL.href.replaceAll('&','&amp;').replaceAll('"','&quot;');
const html=(await fs.readFile('dist/index.html','utf8')).replace(/<link rel="canonical" href="[^"]*" \/>/,`<link rel="canonical" href="${canonical}" />`);
await fs.writeFile('dist/index.html',html);
for(const folder of ['individuals','companies','management','login','register','account','my-applications']){
 await fs.mkdir(`dist/${folder}`,{recursive:true});
 await fs.writeFile(`dist/${folder}/index.html`,html.replace('<head>','<head>\n    <base href="../">').replace(`href="${canonical}"`,`href="${canonical}${folder}/"`));
}

await import('./management-defaults.mjs');
