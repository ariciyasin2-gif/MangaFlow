(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const DEFAULT_SETTINGS = {
  autoTranslate: true,
  showOriginal: false,
  fontScale: 1,
  profile: "balanced",
  readingDirection:'ltr',translationMode:'opus',ollamaEnabled:false,ollamaEndpoint:'http://127.0.0.1:11434',ollamaModel:'qwen2.5:1.5b',allowOpusFallback:false,glossary:{},storyContext:'',
  debugMock: false
};
const KEY = "mangaflow.settings";
function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...raw ?? {} };
  s.fontScale = Math.min(1.6, Math.max(0.6, Number(s.fontScale) || 1));
  if (s.profile !== "fast" && s.profile !== "balanced") s.profile = "balanced";
  s.autoTranslate = !!s.autoTranslate;
  s.showOriginal = !!s.showOriginal;
  s.debugMock = !!s.debugMock;
  return {...s,...globalThis.MangaFlowTranslation.options(s)};
}
async function loadSettings() {
  const r = await chrome.storage.local.get(KEY);
  return sanitizeSettings(r[KEY]);
}
async function saveSettings(patch) {
  const next = sanitizeSettings({ ...await loadSettings(), ...patch });
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
const $ = (id) => document.getElementById(id);
let tabId;
let timer;let capabilities=null;
async function send(msg) {
  if (tabId === void 0) return { ok: false, error: "Sekme bulunamadı" };
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    return { ok: false, error: "Bu sayfada MangaFlow etkin değil" };
  }
}
function render(status) {
  $("badge").textContent = status ? "Açık" : "Kapalı";
  $("badge").classList.toggle("on", !!status);
  $("controls").hidden = !status;
  $("activate").hidden = !!status;
  $("permNote").hidden = !!status;
  if (!status) return;
  const s = status.settings;
  renderTranslationSettings(s);
  $("auto").checked = s.autoTranslate;
  $("showOriginal").checked = s.showOriginal;
  $("fontScale").value = String(s.fontScale);
  $("profile").value = s.profile;
  $("readingDirection").value = s.readingDirection || "ltr";
  $("status").textContent = `Görsel: ${status.total} · Kuyrukta: ${status.queued} · İşleniyor: ${status.running} · Tamamlanan: ${status.done} · Başarısız: ${status.failed}
OCR: ${status.ocrEngine}
Çeviri: ${status.translator}
${status.engineState||""}
Son kullanılan motor: ${status.lastEngine||"henüz yok"}
${(status.warnings||[]).join("\n")}`;
  $("status").style.whiteSpace = "pre-line";
  const ul = $("errors");
  ul.replaceChildren(
    ...status.errors.slice(-10).map((e) => {
      const li = document.createElement("li");
      li.textContent = `${new Date(e.time).toLocaleTimeString("tr-TR")} — ${e.message}`;
      return li;
    })
  );
}
async function refresh() {
  const r = await send({ type: "getStatus" });
  render(r.ok ? r.status : null);
}
async function change(patch) {
  try {
  const next = await saveSettings(patch);
  const r = await send({ type: "settingsChanged", settings: next });
  render(r.ok ? r.status : null);
  }catch(e){$("errors").textContent=e.message;}
}
async function activate() {
  if (tabId === void 0) return;
  const tab=await chrome.tabs.get(tabId);const origin=new URL(tab.url).origin;const granted = await chrome.permissions.request({ origins: [origin+'/*'] });
  if (!granted) {
    $("permNote").textContent = "İzin verilmedi. İzin olmadan başka alan adlarındaki görseller okunamayabilir.";
  }
  const r = await chrome.runtime.sendMessage({ type: "inject", tabId });
  if (!r?.ok) {
    $("permNote").textContent = `Etkinleştirilemedi: ${r?.error ?? "bilinmeyen hata"}`;
    return;
  }
  await new Promise((res) => setTimeout(res, 300));
  const s = await loadSettings();
  await send({ type: "settingsChanged", settings: s });
  await refresh();
}
function renderTranslationSettings(s){
 $('translationMode').value=s.translationMode||'opus';$('ollamaEnabled').checked=s.ollamaEnabled;$('allowOpusFallback').checked=s.allowOpusFallback;
 const active=document.activeElement;for(const id of ['ollamaEndpoint','ollamaModel','storyContext'])if(active!==$(id))$(id).value=s[id]||DEFAULT_SETTINGS[id];
 if(active!==$('glossary'))$('glossary').value=Object.entries(s.glossary||{}).map(([a,b])=>a+' = '+b).join('\n');
 const ollamaOption=$('translationMode').querySelector('[value="ollama"]');
 ollamaOption.disabled=!s.ollamaEnabled;
 ollamaOption.textContent=s.ollamaEnabled?'Kaliteli — Ollama / Qwen':'Kaliteli — Ollama / Qwen (bağlantı kapalı)';
 $('translationMode').querySelector('[value="webgpu"]').disabled=!capabilities?.supported;
 $('testOllama').disabled=!s.ollamaEnabled;
}
async function updateCapabilities(){try{const r=await chrome.runtime.sendMessage({type:'engine',op:'capabilities'});capabilities=r.ok?r.result:{supported:false,reason:r.error};}catch(e){capabilities={supported:false,reason:e.message};}
 $('capabilityNote').textContent=capabilities.reason+(capabilities.supported?' Bu sürümün gerçek manga testinde Qwen çıktısı doğrulanamadı; çalışan sürüm olarak sunulmaz.':'');$('translationMode').querySelector('[value="webgpu"]').textContent=capabilities.supported?'Deneysel — Qwen (son çeviri testi başarısız)':'Deneysel — bu cihazda kullanılamıyor';renderTranslationSettings(await loadSettings());}
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  $("activate").addEventListener("click", () => void activate().catch(e=>{$("permNote").textContent=e.message;}));
  $("translateNow").addEventListener("click", async () => {
    const r = await send({ type: "translateNow" });
    render(r.ok ? r.status : null);
  });
  $("auto").addEventListener("change", (e) => void change({ autoTranslate: e.target.checked }));
  $("showOriginal").addEventListener("change", (e) => void change({ showOriginal: e.target.checked }));
  $("fontScale").addEventListener("change", (e) => void change({ fontScale: Number(e.target.value) }));
  $("profile").addEventListener("change", (e) => void change({ profile: e.target.value }));
  $("readingDirection").addEventListener("change", (e) => void change({ readingDirection: e.target.value }));
  $("clearCache").addEventListener("click", async () => {
    const r = await send({ type: "clearCache" });
    render(r.ok ? r.status : null);
  });
  $('deactivate').addEventListener('click',async()=>{await send({type:'deactivate'});await refresh();});
  $('grantImageOrigin').addEventListener('click',async()=>{try{const u=new URL($('imageOrigin').value);if(!['http:','https:'].includes(u.protocol))throw Error('HTTP veya HTTPS adresi girin');const granted=await chrome.permissions.request({origins:[u.origin+'/*']});$('errors').textContent=granted?'İzin verildi. Geçerli sayfayı çevir düğmesiyle yeniden deneyin.':'İzin verilmedi';}catch(e){$('errors').textContent=e.message;}});
  $('extensionOrigin').textContent='chrome-extension://'+chrome.runtime.id;
  $('translationMode').addEventListener('change',e=>void change({translationMode:e.target.value}));
  $('allowOpusFallback').addEventListener('change',e=>void change({allowOpusFallback:e.target.checked}));
  $('ollamaEnabled').addEventListener('change',async e=>{try{if(e.target.checked){const current=globalThis.MangaFlowTranslation.options({ollamaEndpoint:$('ollamaEndpoint').value,ollamaModel:$('ollamaModel').value});const granted=await chrome.permissions.request({origins:[current.ollamaEndpoint+'/*']});if(!granted)throw Error('Yerel Ollama izni verilmedi.');await change({ollamaEndpoint:current.ollamaEndpoint,ollamaModel:current.ollamaModel,ollamaEnabled:true});}else await change({ollamaEnabled:false,translationMode:'opus'});}catch(error){e.target.checked=false;$('ollamaNote').textContent=error.message;}});
  for(const id of ['ollamaEndpoint','ollamaModel'])$(id).addEventListener('change',async()=>{await change({[id]:$(id).value,ollamaEnabled:false,translationMode:'opus'});$('ollamaNote').textContent='Ayar değişti. Bağlantıyı yeniden etkinleştirin.';});
  $('testOllama').addEventListener('click',async()=>{try{const r=await chrome.runtime.sendMessage({type:'ollamaProbe'});$('ollamaNote').textContent=r.ok?'Ollama hazır: '+r.result.model+' / '+r.result.version.slice(0,12):r.error;}catch(e){$('ollamaNote').textContent=e.message;}});
  $('saveTranslationContext').addEventListener('click',()=>void change({glossary:$('glossary').value,storyContext:$('storyContext').value}));
  renderTranslationSettings(await loadSettings());void updateCapabilities();
  await refresh();
  timer = window.setInterval(() => void refresh(), 1e3);
  window.addEventListener("unload", () => timer && clearInterval(timer));
}
void init().catch(e=>{$('permNote').hidden=false;$('permNote').textContent=e.message;});


