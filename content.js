(function() {
  "use strict";
  const DEFAULT_SETTINGS = {
    autoTranslate: true,
    showOriginal: false,
    fontScale: 1,
    profile: "balanced",
    readingDirection: "ltr",
    translationMode:'opus',ollamaEnabled:false,ollamaEndpoint:'http://127.0.0.1:11434',ollamaModel:'qwen2.5:1.5b',allowOpusFallback:false,glossary:{},storyContext:'',
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
  function concurrencyFor(profile) {
    return profile === "fast" ? 2 : 1;
  }
  class PermanentError extends Error {
    constructor(message) {
      super(message);
      this.name = "PermanentError";
    }
  }
  class TaskQueue {
    constructor(concurrency = 1, onError = () => {
    }) {
      this.concurrency = concurrency;
      this.onError = onError;
    }
    tasks = /* @__PURE__ */ new Map();
    running = 0;
    seq = 0;
    get pendingCount() {
      let n = 0;
      for (const t of this.tasks.values()) if (!t.started) n++;
      return n;
    }
    get runningCount() {
      return this.running;
    }
    has(key) {
      return this.tasks.has(key);
    }
    setConcurrency(n) {
      this.concurrency = Math.max(1, Math.floor(n));
      this.pump();
    }
    /** Aynı anahtar zaten kuyrukta/çalışıyorsa yeni görev oluşturmaz; yalnızca önceliği yükseltir. */
    enqueue(key, priority, fn) {
      const existing = this.tasks.get(key);
      if (!existing && this.tasks.size >= 8) return Promise.resolve("full");
      if (existing) {
        if (!existing.started && priority < existing.priority) existing.priority = priority;
        return existing.promise;
      }
      let resolve;
      const promise = new Promise((r) => resolve = r);
      const task = {
        key,
        priority,
        seq: this.seq++,
        fn,
        controller: new AbortController(),
        started: false,
        promise,
        resolve
      };
      this.tasks.set(key, task);
      this.pump();
      return promise;
    }
    reprioritize(key, priority) {
      const t = this.tasks.get(key);
      if (t && !t.started) t.priority = priority;
    }
    /** Bekleyen görevi kaldırır; çalışan görevin sinyalini iptal eder. */
    cancel(key) {
      const t = this.tasks.get(key);
      if (!t) return false;
      t.controller.abort();
      if (!t.started) {
        this.tasks.delete(key);
        t.resolve("cancelled");
      }
      return true;
    }
    /** Yalnızca henüz başlamamış görevleri iptal eder (çalışanlara dokunmaz) veya hepsini. */
    cancelAll(opts = {}) {
      for (const t of [...this.tasks.values()]) {
        if (!t.started || opts.includeRunning) this.cancel(t.key);
      }
    }
    pump() {
      while (this.running < this.concurrency) {
        let best;
        for (const t of this.tasks.values()) {
          if (t.started) continue;
          if (!best || t.priority < best.priority || t.priority === best.priority && t.seq < best.seq) best = t;
        }
        if (!best) return;
        this.start(best);
      }
    }
    start(t) {
      t.started = true;
      this.running++;
      let result = "done";
      Promise.resolve().then(() => t.fn(t.controller.signal)).catch((err) => {
        if (t.controller.signal.aborted) result = "cancelled";
        else {
          result = "error";
          try {
            this.onError(t.key, err);
          } catch {
          }
        }
      }).finally(() => {
        if (t.controller.signal.aborted && result === "done") result = "cancelled";
        this.running--;
        if (this.tasks.get(t.key) === t) this.tasks.delete(t.key);
        t.resolve(result);
        this.pump();
      });
    }
  }
  const DEFAULT_LIMITS = {
    ocr: { maxEntries: 3e3, maxBytes: 30 * 1024 * 1024 },
    tr: { maxEntries: 2e4, maxBytes: 20 * 1024 * 1024 }
  };
  function req(r) {
    return new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function done(tx) {
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error ?? new Error("IndexedDB işlemi iptal edildi"));
    });
  }
  class Cache {
    constructor(name = "mangaflow", idb = indexedDB, limits = DEFAULT_LIMITS) {
      this.name = name;
      this.idb = idb;
      this.limits = limits;
    }
    dbp;
    putsSincePrune = 0;
    db() {
      if (!this.dbp) {
        this.dbp = new Promise((res, rej) => {
          const open = this.idb.open(this.name, 1);
          open.onupgradeneeded = () => {
            const db = open.result;
            for (const s of ["ocr", "tr"]) {
              const store = db.createObjectStore(s, { keyPath: "key" });
              store.createIndex("lastUsed", "lastUsed");
            }
          };
          open.onsuccess = () => res(open.result);
          open.onerror = () => rej(open.error);
        });
        this.dbp.catch(() => this.dbp = void 0);
      }
      return this.dbp;
    }
    async get(store, key, version) {
      const db = await this.db();
      const tx = db.transaction(store, "readwrite");
      const s = tx.objectStore(store);
      const rec = await req(s.get(key));
      if (!rec) return void 0;
      if (rec.version !== version) {
        s.delete(key);
        await done(tx);
        return void 0;
      }
      rec.lastUsed = Date.now();
      s.put(rec);
      await done(tx);
      return rec.value;
    }
    async put(store, key, value, version) {
      const db = await this.db();
      const tx = db.transaction(store, "readwrite");
      const rec = { key, value, version, size: JSON.stringify(value).length + key.length, lastUsed: Date.now() };
      tx.objectStore(store).put(rec);
      await done(tx);
      if (++this.putsSincePrune >= 50) {
        this.putsSincePrune = 0;
        await this.prune(store).catch(() => {
        });
      }
    }
    /** En az kullanılan kayıtları, limitler içine girene kadar siler. */
    async prune(store, limits = this.limits[store]) {
      const db = await this.db();
      const tx = db.transaction(store, "readwrite");
      const s = tx.objectStore(store);
      const all = await req(s.index("lastUsed").getAll());
      let count = all.length;
      let bytes = all.reduce((n, r) => n + r.size, 0);
      let removed = 0;
      for (const r of all) {
        if (count <= limits.maxEntries && bytes <= limits.maxBytes) break;
        s.delete(r.key);
        count--;
        bytes -= r.size;
        removed++;
      }
      await done(tx);
      return removed;
    }
    async clear() {
      const db = await this.db();
      const tx = db.transaction(["ocr", "tr"], "readwrite");
      tx.objectStore("ocr").clear();
      tx.objectStore("tr").clear();
      await done(tx);
    }
    async stats() {
      const db = await this.db();
      const tx = db.transaction(["ocr", "tr"], "readonly");
      const out = {};
      for (const s of ["ocr", "tr"]) {
        const all = await req(tx.objectStore(s).getAll());
        out[s] = { entries: all.length, bytes: all.reduce((n, r) => n + r.size, 0) };
      }
      return out;
    }
    async close() {
      if (!this.dbp) return;
      (await this.dbp).close();
      this.dbp = void 0;
    }
  }
  async function engine(op,payload,signal){const requestId=crypto.randomUUID();const cancel=()=>{void chrome.runtime.sendMessage({type:'engine',op:'cancel',requestId}).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});try{if(signal)abortIfNeeded(signal);const r=await chrome.runtime.sendMessage({type:'engine',op,requestId,...payload});if(signal)abortIfNeeded(signal);if(!r?.ok)throw new PermanentError(r?.error||'Motor yanıt vermedi');return r.result;}finally{signal?.removeEventListener('abort',cancel);}}
  class RealOcr {id='Tesseract.js 6 / İngilizce';version='tess6-eng-v2';async recognize(img,signal){abortIfNeeded(signal);const r=await engine('ocr',{data:img.__mfData},signal);abortIfNeeded(signal);return r;}}
  const Contract=globalThis.MangaFlowTranslation;
  class RealTranslator {constructor(settings){this.settings=settings;this.id={opus:'Hızlı: OPUS-MT',ollama:'Kaliteli: Ollama / Qwen',webgpu:'Deneysel: WebGPU / Qwen'}[settings.translationMode];this.version='router-v3';}
    async describe(signal){return engine('describe',{options:this.settings},signal);}
    async translate(request,signal,expected){return engine('translate',{request,options:this.settings,expected},signal);}}
  class ImageWatcher {
    constructor(opts) {
      this.opts = opts;
      this.minW = opts.minWidth ?? 300;
      this.minH = opts.minHeight ?? 300;
    }
    states = /* @__PURE__ */ new Map();
    ioVisible;
    ioNear;
    mo;
    pruneTimer;
    minW;
    minH;
    start() {
      if (this.ioVisible) return;
      this.ioVisible = new IntersectionObserver((es) => this.onIo(es, "visible"), { rootMargin: "0px" });
      this.ioNear = new IntersectionObserver((es) => this.onIo(es, "near"), { rootMargin: "100% 0px 300% 0px" });
      this.mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "attributes") {
            const t = m.target;
            if (t instanceof HTMLImageElement) this.reset(t);
          } else {
            m.addedNodes.forEach((n) => this.scanNode(n));
            m.removedNodes.forEach((n) => this.forgetNode(n));
          }
        }
      });
      this.mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "data-src"]
      });
      document.querySelectorAll("img").forEach((i) => this.consider(i));
      this.pruneTimer = window.setInterval(() => this.prune(), 3e4);
    }
    stop() {
      this.ioVisible?.disconnect();
      this.ioNear?.disconnect();
      this.mo?.disconnect();
      this.ioVisible = this.ioNear = void 0;
      this.mo = void 0;
      if (this.pruneTimer) clearInterval(this.pruneTimer);
      for (const [img,s] of this.states){img.removeEventListener("load",s.onLoad);this.opts.onRemove(img);}
      this.states.clear();
    }
    /** İzlenen görseller ve güncel öncelikleri. */
    tracked() {
      return [...this.states].map(([img, s]) => ({ img, priority: s.prio }));
    }
    get size() {
      return this.states.size;
    }
    isCandidate(img) {
      if (this.opts.ignore?.(img)) return false;
      return img.complete && img.naturalWidth >= this.minW && img.naturalHeight >= this.minH;
    }
    consider(img) {
      if (this.states.has(img)) return;
      if (!this.isCandidate(img)) {
        if (!img.complete && !this.opts.ignore?.(img)) {
          img.addEventListener("load", () => this.consider(img), { once: true });
        }
        return;
      }
      const onLoad=()=>{this.drop(img);this.consider(img);};img.addEventListener('load',onLoad);
      this.states.set(img, { onLoad, visible: false, near: false, prio: null, src: img.currentSrc || img.src });
      this.ioVisible?.observe(img);
      this.ioNear?.observe(img);
    }
    reset(img) {
      const s = this.states.get(img);
      if (s && s.src === (img.currentSrc || img.src)) return;
      this.drop(img);
      if (img.complete) this.consider(img);
      else img.addEventListener("load", () => this.consider(img), { once: true });
    }
    drop(img) {
      const state=this.states.get(img);if(!state)return;img.removeEventListener("load",state.onLoad);this.states.delete(img);
      this.ioVisible?.unobserve(img);
      this.ioNear?.unobserve(img);
      this.opts.onRemove(img);
    }
    scanNode(n) {
      if (n instanceof HTMLImageElement) this.consider(n);
      else if (n instanceof Element) n.querySelectorAll("img").forEach((i) => this.consider(i));
    }
    forgetNode(n) {
      if (n instanceof HTMLImageElement) {
        if (!n.isConnected) this.drop(n);
      } else if (n instanceof Element) {
        n.querySelectorAll("img").forEach((i) => {
          if (!i.isConnected) this.drop(i);
        });
      }
    }
    prune() {
      for (const img of [...this.states.keys()]) if (!img.isConnected) this.drop(img);
    }
    onIo(entries, kind) {
      for (const e of entries) {
        const img = e.target;
        const s = this.states.get(img);
        if (!s) continue;
        s[kind] = e.isIntersecting;
        const prio = s.visible ? 0 : s.near ? 1 : null;
        if (prio !== s.prio) {
          s.prio = prio;
          this.opts.onChange(img, prio);
        }
      }
    }
  }
  const {OverlayRenderer,HOST_ID}=globalThis.MangaFlowOverlay;
  function normalizeText(t) {
    return t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  }
  function unionBox(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }
  function iou(a, b) {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = ix * iy;
    const uni = a.w * a.h + b.w * b.h - inter;
    return uni > 0 ? inter / uni : 0;
  }
  function verticalOverlap(a, b) {
    return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  }
  function horizontalOverlap(a, b) {
    return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  }
  class UnionFind {
    p;
    constructor(n) {
      this.p = Array.from({ length: n }, (_, i) => i);
    }
    find(i) {
      let r = i;
      while (this.p[r] !== r) r = this.p[r];
      while (this.p[i] !== r) {
        const next = this.p[i];
        this.p[i] = r;
        i = next;
      }
      return r;
    }
    union(a, b) {
      const ra = this.find(a);
      const rb = this.find(b);
      if (ra !== rb) this.p[ra] = rb;
    }
  }
  function groupLines(lines, opts = {}) {
    const { minConfidence = 45, minLineConfidence = 30, minLetters = 2, gapFactor = 0.9, overlapRatio = 0.25 } = opts;
    const ls = lines.filter((l) => l.text.trim().length > 0 && l.confidence >= minLineConfidence && l.box.w > 0 && l.box.h > 0);
    const uf = new UnionFind(ls.length);
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i].box;
        const b = ls[j].box;
        const ho = horizontalOverlap(a, b);
        if (ho / Math.min(a.w, b.w) < overlapRatio) continue;
        const gap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
        if (gap <= gapFactor * Math.min(a.h, b.h) && Math.abs((a.x+a.w/2)-(b.x+b.w/2)) < Math.max(a.w,b.w)*0.35 && Math.abs(a.y-b.y)>Math.min(a.h,b.h)*0.4) uf.union(i, j);
      }
    }
    const clusters = /* @__PURE__ */ new Map();
    ls.forEach((l, i) => {
      const r = uf.find(i);
      const arr = clusters.get(r);
      if (arr) arr.push(l);
      else clusters.set(r, [l]);
    });
    const out = [];
    for (const group of clusters.values()) {
      group.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
      let box = group[0].box;
      let chars = 0;
      let weighted = 0;
      for (const l of group) {
        box = unionBox(box, l.box);
        const n = Math.max(1, l.text.trim().length);
        chars += n;
        weighted += l.confidence * n;
      }
      const text = group.map((l) => l.text.trim()).join(" ").replace(/\s+/g, " ").trim();
      const confidence = weighted / chars;
      const letters = (text.match(/\p{L}/gu) ?? []).length;
      if (confidence < minConfidence || letters < minLetters) continue;
      out.push({ box, text, confidence, lineCount: group.length });
    }
    return sortReadingOrder(out, opts.rtl);
  }
  function sortReadingOrder(items, rtl = false) {
    const byY = [...items].sort((a, b) => a.box.y - b.box.y);
    const rows = [];
    let rowTop = -Infinity;
    let rowH = 0;
    for (const it of byY) {
      if (rows.length && it.box.y < rowTop + 0.5 * rowH) {
        rows[rows.length - 1].push(it);
      } else {
        rows.push([it]);
        rowTop = it.box.y;
        rowH = it.box.h;
      }
    }
    return rows.flatMap((r) => r.sort((a, b) => rtl ? b.box.x - a.box.x : a.box.x - b.box.x));
  }
  function dedupeBubbles(items) {
    const kept = [];
    for (const it of items) {
      const n = normalizeText(it.text);
      let merged = false;
      for (let k = 0; k < kept.length; k++) {
        const other = kept[k];
        const on = normalizeText(other.text);
        const o = iou(it.box, other.box);
        const same = n === on && verticalOverlap(it.box, other.box) > 0 && horizontalOverlap(it.box, other.box) > 0;
        const contained = o > 0.2 && n.length > 0 && on.length > 0 && (n.includes(on) || on.includes(n));
        if (o > 0.5 || same || contained) {
          if (n.length > on.length) kept[k] = it;
          merged = true;
          break;
        }
      }
      if (!merged) kept.push(it);
    }
    return kept;
  }
  function normalizeBox(b, imgW, imgH) {
    return { x: b.x / imgW, y: b.y / imgH, w: b.w / imgW, h: b.h / imgH };
  }
  function hash53(str, seed = 0) {
    let h1 = 3735928559 ^ seed;
    let h2 = 1103547991 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
    h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }
  function imageKey(url, naturalWidth, naturalHeight) {
    const clean = url.split("#")[0] ?? url;
    return `${hash53(clean)}-${naturalWidth}x${naturalHeight}`;
  }
  function textKey(text) {
    return hash53(text.trim().replace(/\s+/g, " "));
  }
  function abortIfNeeded(signal) {
    if (signal.aborted) throw new DOMException("İptal edildi", "AbortError");
  }
  class Pipeline {
    constructor(deps) {
      this.deps = deps;
    }
    keyFor(img) {
      return imageKey(img.currentSrc || img.src, img.naturalWidth, img.naturalHeight);
    }
    async process(img, signal) {
      const timing={started:performance.now(),ocrMs:0,translationMs:0,ocrCacheHit:false};
      const { ocr, translator, cache } = this.deps;
      if(img.naturalWidth>8192||img.naturalWidth*img.naturalHeight>180000000)throw new PermanentError("Görsel güvenli bellek sınırını aşıyor");
      let data;try {const r=await fetch(img.currentSrc||img.src,{cache:'no-cache',signal});if(!r.ok)throw Error('HTTP '+r.status);const blob=await r.blob();if(blob.size>24*1024*1024)throw new PermanentError('Görsel 24 MB sınırını aşıyor');data=await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(f.error);f.readAsDataURL(blob);});}catch(e){abortIfNeeded(signal);const r=await chrome.runtime.sendMessage({type:'imageData',url:img.currentSrc||img.src});if(!r?.ok)throw new PermanentError(r?.error||String(e));data=r.result;}
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),b=>b.toString(16).padStart(2,'0')).join('');
      const key=digest;
      abortIfNeeded(signal);
      let bubbles = await cache.get("ocr", key, ocr.version);
      timing.ocrCacheHit=!!bubbles;const ocrStart=performance.now();
      if (!bubbles) {
        let res;img.__mfData=data;try{res = await ocr.recognize(img, signal);}finally{delete img.__mfData;}
        abortIfNeeded(signal);
        const grouped = dedupeBubbles(groupLines(dedupeBubbles(res.lines), {rtl: this.deps.rtl}));
        bubbles = grouped.map((g, i) => ({
          id: `${hash53(key)}-${i}`,
          box: normalizeBox(g.box, res.width, res.height),
          text: g.text,
          confidence: g.confidence
        }));
        await cache.put("ocr", key, bubbles, ocr.version);
      }
      delete img.__mfData;timing.ocrMs=performance.now()-ocrStart;
      bubbles=sortReadingOrder(bubbles,this.deps.rtl);
      if (bubbles.length === 0){this.deps.onTiming?.({...timing,totalMs:performance.now()-timing.started});return [];}
      const previous=this.deps.getContext?.(img)||[];
      const request=Contract.normalizeRequest({balloons:bubbles.map(b=>({id:b.id,text:b.text})),previous,glossary:this.deps.settings.glossary,context:this.deps.settings.storyContext});
      const description=await translator.describe(signal);abortIfNeeded(signal);
      for(const warning of description.warnings)this.deps.onWarning?.(warning);
      const identity=Contract.cacheIdentity(description.engine,request),tver=description.engine.version;
      const trStart=performance.now();let response=await cache.get('tr',identity,tver);
      timing.translationCacheHits=response?bubbles.length:0;
      if(!response){response=await translator.translate(request,signal,description.engine);abortIfNeeded(signal);Contract.validate(response.translations,request,false);
        const actualIdentity=Contract.cacheIdentity(response.engine,request);await cache.put('tr',actualIdentity,response,response.engine.version);}
      for(const warning of response.warnings||[])this.deps.onWarning?.(warning);
      const result=bubbles.map((b,i)=>({...b,tr:response.translations[i],engine:response.engine.id}));
      abortIfNeeded(signal);this.deps.onResult?.(img,result);timing.engine=response.engine;timing.providerMetrics=timing.translationCacheHits?null:response.metrics;
      timing.translationMs=performance.now()-trStart;this.deps.onTiming?.({...timing,totalMs:performance.now()-timing.started});return result;
    }
  }
  const MAX_ATTEMPTS = 3;
  const MAX_ERRORS = 20;
  function start() {
    window.__mangaflow?.destroy();
    let settings = { ...DEFAULT_SETTINGS };
    const cache = new Cache();
    const overlay = new OverlayRenderer();
    let ocr = new RealOcr();
    let translator = new RealTranslator(settings);
    let pageContext=new WeakMap();let lastEngine='Henüz çeviri yapılmadı';const warnings=[];
    function contextFor(img){return [...document.images].filter(i=>i!==img&&(i.compareDocumentPosition(img)&Node.DOCUMENT_POSITION_FOLLOWING)&&pageContext.has(i)).slice(-3).flatMap(i=>pageContext.get(i)).slice(-12);}
    const onResult=(img,result)=>{pageContext.set(img,result.map(b=>({source:b.text,translation:b.tr})));lastEngine=result[0]?.engine||lastEngine;};
    const onWarning=message=>{if(!warnings.includes(message)){warnings.push(message);if(warnings.length>10)warnings.shift();}};
    const timings=[];const onTiming=t=>{timings.push(t);if(timings.length>100)timings.shift();};
    let pipeline = new Pipeline({ ocr, translator, cache, rtl: settings.readingDirection === "rtl", onTiming, settings, getContext:contextFor, onResult, onWarning });
    let engineState='Motorlar ilk görselde yüklenir';
    const stateTimer=setInterval(()=>{chrome.runtime.sendMessage({type:'engine',op:'state'}).then(r=>{engineState=r?.result||r?.error||'Motor yanıt vermiyor';}).catch(e=>engineState=e.message);},1500);
    const errors = [];
    const attempts = /* @__PURE__ */ new Map();
    let manualRun=false;
    let completedElements = new WeakSet();
    const finished = /* @__PURE__ */ new Set();
    const doneKeys = /* @__PURE__ */ new Set();
    let failed = 0;
    let generation = 0;
    const permanentKeys = /* @__PURE__ */ new Set();
    const queue = new TaskQueue(1, (key, err) => {
      if (err instanceof PermanentError) permanentKeys.add(key);
      pushError(key, err);
    });
    function pushError(src, err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ src: src.slice(0, 80), message, time: Date.now() });
      if (errors.length > MAX_ERRORS) errors.shift();
    }
    function applySettings(next) {
      const prevTranslation=JSON.stringify(Contract.options(settings));
      const prevMock = settings.debugMock;
      const prevDirection=settings.readingDirection;
      const wasAuto=settings.autoTranslate;settings = sanitizeSettings(next);
      if(wasAuto&&!settings.autoTranslate){manualRun=false;generation++;queue.cancelAll({includeRunning:true});}
      if(!wasAuto&&settings.autoTranslate){for(const t of watcher.tracked())if(t.priority!==null)schedule(t.img,t.priority);}
      queue.setConcurrency(concurrencyFor(settings.profile));
      overlay.setShowOriginal(settings.showOriginal);
      overlay.setFontScale(settings.fontScale);
      if (settings.debugMock !== prevMock || settings.readingDirection!==prevDirection || JSON.stringify(Contract.options(settings))!==prevTranslation || generation === 0) {
        generation++;queue.cancelAll({includeRunning:true});
        ocr = new RealOcr();
        translator = new RealTranslator(settings);
        pipeline = new Pipeline({ ocr, translator, cache, rtl: settings.readingDirection === "rtl", onTiming, settings, getContext:contextFor, onResult, onWarning });
        pageContext=new WeakMap();warnings.length=0;
        completedElements=new WeakSet();
      finished.clear();
        doneKeys.clear();
        attempts.clear();
        permanentKeys.clear();
        failed = 0;
        overlay.clear();
        for (const t of watcher.tracked()) if (t.priority !== null && settings.autoTranslate) schedule(t.img, t.priority);
      }
    }
    function schedule(img, prio) {
      const key = pipeline.keyFor(img);
      if (completedElements.has(img) || overlay.has(img) || permanentKeys.has(key)) return;
      const gen = generation;
      void queue.enqueue(key, prio, async (signal) => {
        const result = await pipeline.process(img, signal);
        if (gen !== generation || signal.aborted) return;
        for(const t of watcher.tracked())if(pipeline.keyFor(t.img)===key){overlay.render(t.img,result);completedElements.add(t.img);}
        finished.add(key);
        doneKeys.add(key);if(doneKeys.size>5000)doneKeys.delete(doneKeys.values().next().value);
      }).then((res) => {
        if (res !== "error") return;
        const n = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, n);
        const permanent = permanentKeys.has(key);
        if (permanent || n >= MAX_ATTEMPTS) {
          finished.add(key);if(finished.size>5000)finished.delete(finished.values().next().value);
          failed++;
        } else if (gen === generation) {
          setTimeout(() => {
            if (gen === generation && img.isConnected) schedule(img, 2);
          }, 1e3 * 2 ** n);
        }
      });
    }
    const watcher = new ImageWatcher({
      ignore: (img) => !!img.closest(`#${HOST_ID}`),
      onChange: (img, prio) => {
        if (prio === null) {
          queue.cancel(pipeline.keyFor(img));
          return;
        }
        if (settings.autoTranslate) schedule(img, prio);
        else queue.reprioritize(pipeline.keyFor(img), prio);
      },
      onRemove: (img) => {
        completedElements.delete(img);delete img.__mfData;
        queue.cancel(pipeline.keyFor(img));
        overlay.remove(img);
      }
    });
    function onNavigate() {
      generation++;manualRun=false;pageContext=new WeakMap();warnings.length=0;
      permanentKeys.clear();
      queue.cancelAll({ includeRunning: true });
      overlay.clear();
      completedElements=new WeakSet();
      finished.clear();
      doneKeys.clear();
      attempts.clear();
      failed = 0;
      errors.length = 0;
      for (const t of watcher.tracked()) if (t.priority !== null && settings.autoTranslate) schedule(t.img, t.priority);
    }
    const feeder=setInterval(()=>{if(!settings.autoTranslate&&!manualRun)return;for(const t of watcher.tracked().filter(t=>(manualRun||t.priority!==null)&&!completedElements.has(t.img)&&!permanentKeys.has(pipeline.keyFor(t.img))&&!queue.has(pipeline.keyFor(t.img))).sort((a,b)=>(a.priority??2)-(b.priority??2)).slice(0,5))schedule(t.img,t.priority??2);},1500);
    const nav = window.navigation;
    const onNavEvent = () => setTimeout(onNavigate, 300);
    nav?.addEventListener("navigatesuccess", onNavEvent);
    window.addEventListener("popstate", onNavEvent);
    function status() {
      return {
        active: true,
        total: watcher.size,
        queued: queue.pendingCount,
        running: queue.runningCount,
        done: doneKeys.size,
        failed,
        ocrEngine: ocr.id,
        translator: translator.id,
        engineState,
        timings: [...timings],
        warnings:[...warnings],lastEngine,
        errors: [...errors],
        settings
      };
    }
    function onMessage(msg, _s, reply) {
      try {
        switch (msg.type) {
          case "getStatus":
            reply({ ok: true, status: status() });
            break;
          case "translateNow":
            manualRun=true;permanentKeys.clear();attempts.clear();
            for (const t of watcher.tracked()) schedule(t.img, t.priority === 0 ? 0 : t.priority === 1 ? 1 : 2);
            reply({ ok: true, status: status() });
            break;
          case "settingsChanged":
            applySettings(msg.settings);
            reply({ ok: true, status: status() });
            break;
          case "clearCache":
            generation++;pageContext=new WeakMap();queue.cancelAll({includeRunning:true});
            void cache.clear().then(() => {
              attempts.clear();permanentKeys.clear();failed=0;
              pageContext=new WeakMap();warnings.length=0;
        completedElements=new WeakSet();
      finished.clear();
              doneKeys.clear();
              overlay.clear();
              reply({ ok: true, status: status() });
            }).catch((e) => reply({ ok: false, error: String(e) }));
            return true;
          case "deactivate":
            destroy();
            reply({ ok: true });
            break;
        }
      } catch (e) {
        reply({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return false;
    }
    chrome.runtime.onMessage.addListener(onMessage);
    function destroy() {
      generation++;
      chrome.runtime.onMessage.removeListener(onMessage);
      nav?.removeEventListener("navigatesuccess", onNavEvent);
      window.removeEventListener("popstate", onNavEvent);
      watcher.stop();
      queue.cancelAll({ includeRunning: true });
      clearInterval(feeder);clearInterval(stateTimer);
      overlay.destroy();
      void cache.close();
      delete window.__mangaflow;
    }
    window.__mangaflow = { destroy };
    void loadSettings().catch(() => DEFAULT_SETTINGS).then((s) => {
      applySettings(s);
      watcher.start();
    });
  }
  start();
})();

