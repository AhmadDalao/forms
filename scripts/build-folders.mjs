import fs from 'node:fs/promises';
const siteURL=new URL(process.env.FORMS_SITE_URL||'https://forms.ahmaddalao.com/');
if(!['http:','https:'].includes(siteURL.protocol)||siteURL.username||siteURL.password||siteURL.search||siteURL.hash)throw Error('FORMS_SITE_URL must be a public HTTP(S) URL.');
if(!siteURL.pathname.endsWith('/'))siteURL.pathname+='/';
const canonical=siteURL.href.replaceAll('&','&amp;').replaceAll('"','&quot;');
const html=(await fs.readFile('dist/index.html','utf8')).replace(/<link rel="canonical" href="[^"]*" \/>/,`<link rel="canonical" href="${canonical}" />`);
// Fetch the selected page's static dependencies while HTML is being parsed.
// Module preloads do not execute the editor or bypass its authenticated gate.
const manifest=JSON.parse(await fs.readFile('dist/.vite/manifest.json','utf8'));
function preloadPage(html,entry){
 const visited=new Set(),scripts=new Set(),styles=new Set();
 function visit(key){if(visited.has(key))return;visited.add(key);const chunk=manifest[key];if(!chunk)throw Error('Missing build entry: '+key);for(const key of chunk.imports||[])visit(key);scripts.add(chunk.file);for(const css of chunk.css||[])styles.add(css);}
 visit(entry);
 const links=[...scripts].filter(file=>!html.includes(`href="./${file}"`)).map(file=>`<link rel="modulepreload" crossorigin href="./${file}">`);
 links.push(...[...styles].map(file=>`<link rel="stylesheet" crossorigin href="./${file}">`));
 return html.replace('</head>',links.join('\n    ')+'\n  </head>');
}
await fs.writeFile('dist/index.html',preloadPage(html,'src/main.js'));
for(const folder of ['individuals','companies','management','login','register','account','my-applications']){
 await fs.mkdir(`dist/${folder}`,{recursive:true});
 const entry=folder==='management'?'src/management/main.js':['individuals','companies'].includes(folder)?'src/main.js':'src/portal/main.js';
 await fs.writeFile(`dist/${folder}/index.html`,preloadPage(html,entry).replace('<head>','<head>\n    <base href="../">').replace(`href="${canonical}"`,`href="${canonical}${folder}/"`));
}
await fs.rm('dist/.vite',{recursive:true});

await import('./management-defaults.mjs');
