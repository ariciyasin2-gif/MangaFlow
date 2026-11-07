import './translation-contract.js';
import {OllamaClient} from './ollama-client.js';
let opening;
async function ensureEngine(){if(!await chrome.offscreen.hasDocument()){opening??=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['WORKERS'],justification:'Yerel OCR ve çeviri worker motorlarını çalıştırmak'}).finally(()=>opening=undefined);await opening;}for(let attempt=0;attempt<60;attempt++){try{const ready=await chrome.runtime.sendMessage({target:'engine',op:'state'});if(ready?.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Yerel motor sayfası başlatılamadı.');}
async function inject(tabId){await chrome.scripting.executeScript({target:{tabId},files:['translation-contract.js','overlay-renderer.js','content.js']});}
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.target==='engine')return false;
const run=async()=>{if(m.type==='inject'){await inject(m.tabId);return {ok:true};}
if(m.type==='engine'){await ensureEngine();return chrome.runtime.sendMessage({...m,target:'engine'});}
if(m.type==='imageData'){const u=new URL(m.url);if(!['https:','http:'].includes(u.protocol))throw Error('Desteklenmeyen görsel adresi');if(!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('Görsel alan adı için erişim izni gerekli: '+u.origin);const r=await fetch(u.href,{credentials:'omit',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Görsel HTTP '+r.status);const b=await r.arrayBuffer();if(b.byteLength>24*1024*1024)throw Error('Görsel 24 MB sınırını aşıyor');let binary='';for(let i=0;i<b.byteLength;i+=32768)binary+=String.fromCharCode(...new Uint8Array(b,i,Math.min(32768,b.byteLength-i)));return {ok:true,result:'data:'+ (r.headers.get('content-type')||'image/png')+';base64,'+btoa(binary)};}return null;};
if(!['inject','engine','imageData'].includes(m.type))return false;run().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;});
async function register(){const p=await chrome.permissions.getAll();const matches=(p.origins||[]).filter(x=>/^https?:/.test(x)&&!x.includes('huggingface')&&!x.includes('xethub')&&!/localhost|127\.0\.0\.1|\[::1\]/.test(x));await chrome.scripting.unregisterContentScripts();if(matches.length)await chrome.scripting.registerContentScripts([{id:'mangaflow-sites',matches,js:['translation-contract.js','overlay-renderer.js','content.js'],runAt:'document_idle'}]);}
chrome.permissions.onAdded.addListener(()=>void register());chrome.permissions.onRemoved.addListener(()=>void register());chrome.runtime.onInstalled.addListener(()=>void register());
const ollamaClient=new OllamaClient(),ollamaJobs=new Map();
chrome.runtime.onMessage.addListener((m,s,reply)=>{
if(!['ollamaRpc','ollamaProbe','ollamaCancel'].includes(m.type))return false;
if(s.id!==chrome.runtime.id||!s.url?.startsWith(chrome.runtime.getURL(''))){reply({ok:false,error:'Ollama yalnızca eklenti arayüzünden veya yerel motorundan çağrılabilir.'});return false;}
if(m.type==='ollamaCancel'){ollamaJobs.get(m.requestId)?.abort();reply({ok:true});return false;}
(async()=>{const raw=(await chrome.storage.local.get('mangaflow.settings'))['mangaflow.settings']||{},o=globalThis.MangaFlowTranslation.options(raw);
if(!o.ollamaEnabled)throw Error('Ollama bağlantısı kapalı; açık onay olmadan bağlantı kurulmaz.');
if(m.options&&(m.options.ollamaEndpoint!==o.ollamaEndpoint||m.options.ollamaModel!==o.ollamaModel))throw Error('Ollama ayarları değişti; işlemi yeniden başlatın.');
const u=new URL(o.ollamaEndpoint);if(!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('Yerel Ollama için eklenti erişim izni verilmedi.');
const controller=new AbortController(),id=m.requestId||crypto.randomUUID();ollamaJobs.set(id,controller);
try{const result=m.type==='ollamaProbe'||m.operation==='describe'?await ollamaClient.describe(o,controller.signal):await ollamaClient.translate(m.request,o,controller.signal,m.expected);return {ok:true,result};}finally{ollamaJobs.delete(id);}
})().then(reply).catch(e=>reply({ok:false,error:e.message||String(e)}));return true;});

