import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {ROOT,RUNTIME,within} from './project.mjs';
import {valid,validateLock} from './setup-assets.mjs';
export async function verifyAssets(root=ROOT){const lock=validateLock(JSON.parse(await fs.readFile(path.join(ROOT,'tools/assets.lock.json'),'utf8')));const qwen=await fs.stat(path.join(root,'models/onnx-community/Qwen2.5-0.5B-Instruct')).then(()=>true,()=>false);const records=lock.assets.filter(a=>qwen||a.group==='base');for(const a of records)if(!await valid(within(root,a.path),a))throw Error('Eksik/bozuk varlık: '+a.path+' — npm run assets:install'+(qwen?' -- --with-qwen':''));for(const f of [...RUNTIME,'popup/popup.html','assets/popup.css','LICENSE','THIRD_PARTY_NOTICES.md'])await fs.access(within(root,f));return records;}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)verifyAssets().then(a=>console.log(a.length+' varlık ve çalışma dosyaları doğrulandı.')).catch(e=>{console.error(e.message);process.exitCode=1;});
