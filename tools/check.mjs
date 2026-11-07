import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,RUNTIME,filesUnder,sourceFile} from './project.mjs';
for(const file of (await filesUnder(ROOT,'',sourceFile)).filter(f=>/\.(mjs|cjs|js)$/.test(f))){const result=spawnSync(process.execPath,['--check',path.join(ROOT,file)],{encoding:'utf8'});if(result.status!==0)throw Error(file+'\n'+result.stderr);}
const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8')),manifest=JSON.parse(await fs.readFile(path.join(ROOT,'manifest.json'),'utf8'));if(pkg.version!==manifest.version)throw Error('Paket/manifest sürümleri uyuşmuyor');for(const file of RUNTIME)await fs.access(path.join(ROOT,file));console.log('Kaynak sözdizimi, dosyalar ve sürümler doğrulandı.');
