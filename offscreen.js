import {recognize,cancelOcr,interrupted} from './ocr-engine.js';
let waiting=0,chain=Promise.resolve(),seq=0,state='Motorlar ilk kullanımda yüklenir',activeId=null,webgpuDisabledReason=null;
const pending=new Map(),jobs=new Map();let tw;
function spawn(){tw=new Worker('translation-worker.js',{type:'module'});const worker=tw;
tw.onmessage=async({data:m})=>{if(m.rpcId){const requestId=activeId;try{const r=await chrome.runtime.sendMessage({type:'ollamaRpc',operation:m.operation,...m.payload,requestId});if(tw===worker)worker.postMessage({rpcId:m.rpcId,...(r.ok?{result:r.result}:{error:r.error})});}catch(e){if(tw===worker)worker.postMessage({rpcId:m.rpcId,error:e.message});}return;}
if(m.progress){const p=m.progress;state='Model yükleniyor: '+(p.file||'hazırlanıyor')+' '+(p.progress?Math.round(p.progress)+'%':'');return;}
const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);state=m.error||'Çeviri hazır';}};
tw.onerror=e=>{for(const p of pending.values())p.reject(Error('Çeviri worker başlatılamadı: '+(e.message||'ayrıntı yok')));pending.clear();};}
function cancelTranslation(requestId){void chrome.runtime.sendMessage({type:'ollamaCancel',requestId}).catch(()=>{});tw?.terminate();for(const p of pending.values())p.reject(new DOMException('İptal edildi','AbortError'));pending.clear();tw=null;}
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.target!=='engine')return false;
if(m.op==='state'){reply({ok:true,result:state});return false;}
if(m.op==='capabilities'&&webgpuDisabledReason){reply({ok:true,result:{supported:false,reason:webgpuDisabledReason}});return false;}
if(m.op==='cancel'){jobs.get(m.requestId)?.abort();reply({ok:true});return false;}
if(!['ocr','translate','describe','capabilities'].includes(m.op)){reply({ok:false,error:'Bilinmeyen motor işlemi'});return false;}
if(waiting>=8){reply({ok:false,error:'Motor kuyruğu dolu; daha sonra yeniden deneyin'});return false;}
const controller=new AbortController(),signal=controller.signal,id=m.requestId||crypto.randomUUID();jobs.set(id,controller);waiting++;
chain=chain.catch(()=>{}).then(async()=>{let abort,deadline,timedOut=false;try{if(signal.aborted)throw new DOMException('İptal edildi','AbortError');activeId=id;
abort=()=>{if(m.op==='ocr')cancelOcr();else cancelTranslation(id);state='İşlem iptal edildi';};signal.addEventListener('abort',abort,{once:true});
deadline=setTimeout(()=>{timedOut=true;if(m.options?.translationMode==='webgpu')webgpuDisabledReason='WebGPU Qwen zaman sınırında tamamlanamadı; bu oturumda devre dışı. Yeniden denemek için eklentiyi yenileyin.';controller.abort();},m.op==='ocr'?300000:m.op==='translate'?180000:60000);
let result;if(m.op==='ocr')result=await recognize(m.data,signal,s=>state=s);else{let options=m.options,warning;if(options?.translationMode==='webgpu'&&webgpuDisabledReason){if(!options.allowOpusFallback)throw Error(webgpuDisabledReason);options={...options,translationMode:'opus'};warning=webgpuDisabledReason+' İzninizle OPUS-MT kullanıldı.';}if(!tw)spawn();result=await interrupted(new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});tw.postMessage({id,op:m.op,texts:m.texts,request:m.request,options,expected:m.expected,legacy:!m.request&&!m.options&&m.op==='translate'});}),signal);if(warning)result.warnings=[...(result.warnings||[]),warning];}
if(signal.aborted)throw new DOMException('İptal edildi','AbortError');reply({ok:true,result});
}catch(e){reply({ok:false,error:timedOut?'İşlem zaman aşımına uğradı; çalışan motor durduruldu.':(m.op==='ocr'?'OCR: ':'')+(e.message||String(e))});}finally{clearTimeout(deadline);signal.removeEventListener('abort',abort);jobs.delete(id);activeId=null;waiting--;}});return true;});
