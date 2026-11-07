import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,RUNTIME,filesUnder,within} from './project.mjs';
import {verifyAssets} from './verify.mjs';
import {zipFiles} from './archive.mjs';
import {digest} from './setup-assets.mjs';
const records=await verifyAssets();const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'manifest.json'),'utf8'));
const files=[...RUNTIME,'LICENSE','THIRD_PARTY_NOTICES.md','asset-integrity.json',...(await filesUnder(ROOT,'assets')),...(await filesUnder(ROOT,'popup')),...(await filesUnder(ROOT,'licenses')),...records.map(a=>a.path)];
// A fresh stage prevents files from an old optional Qwen build leaking into a base package.
const stage=await fs.mkdtemp(path.join(ROOT,'.cache-build-'));
try{for(const file of files){const destination=within(stage,file);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(within(ROOT,file),destination);}const target=path.join(ROOT,'dist',`MangaFlow-${manifest.version}.zip`);await zipFiles(stage,files,target);console.log('Hazır: '+path.relative(ROOT,target));await fs.writeFile(target+'.sha256',await digest(target)+'  '+path.basename(target)+'\n');}
finally{if(path.dirname(path.resolve(stage))!==ROOT||!path.basename(stage).startsWith('.cache-build-'))throw Error('Güvensiz temizleme hedefi');await fs.rm(stage,{recursive:true,force:true});}
