import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import yazl from 'yazl';
import {within} from './project.mjs';
export async function zipFiles(root,files,destination,prefix=''){await fs.mkdir(path.dirname(destination),{recursive:true});const zip=new yazl.ZipFile();const writing=pipeline(zip.outputStream,createWriteStream(destination+'.tmp'));try{for(const file of [...files].sort())zip.addFile(within(root,file),prefix+file,{mtime:new Date('2026-01-01T00:00:00Z'),mode:0o100644});zip.end();await writing;await fs.rename(destination+'.tmp',destination);}catch(e){zip.outputStream.destroy(e);await writing.catch(()=>{});await fs.rm(destination+'.tmp',{force:true});throw e;}}
