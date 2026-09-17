import fs from 'node:fs/promises';
const html=await fs.readFile('dist/index.html','utf8');
for(const folder of ['individuals','companies']){
 await fs.mkdir(`dist/${folder}`,{recursive:true});
 await fs.writeFile(`dist/${folder}/index.html`,html.replace('<head>','<head>\n    <base href="../">').replace('href="https://forms.ahmaddalao.com/"',`href="https://forms.ahmaddalao.com/${folder}/"`));
}
