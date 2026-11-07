import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,filesUnder,sourceFile} from './project.mjs';
import {zipFiles} from './archive.mjs';
import {digest} from './setup-assets.mjs';
const files=await filesUnder(ROOT,'',sourceFile),target=path.join(ROOT,'dist','MangaFlow-GitHub-Kaynak.zip');await zipFiles(ROOT,files,target,'MangaFlow/');await fs.writeFile(target+'.sha256',await digest(target)+'  '+path.basename(target)+'\n');console.log('Kaynak paketi: '+files.length+' dosya, '+path.relative(ROOT,target));
