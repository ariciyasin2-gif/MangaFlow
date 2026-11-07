import './translation-contract.js';
import { pipeline, env, MarianTokenizer } from './vendor/transformers.min.js';
const C = globalThis.MangaFlowTranslation;
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = new URL('./models/', import.meta.url).href;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let webgpuFailure = null;

export async function browserCapabilities() {
  const memoryGB = navigator.deviceMemory || null;
  if (webgpuFailure) return { supported: false, reason: 'WebGPU model başlatma başarısız: ' + webgpuFailure + ' Yeniden denemek için eklentiyi yenileyin.', memoryGB };
  if (!navigator.gpu) return { supported: false, reason: 'WebGPU bu tarayıcıda kullanılamıyor.', memoryGB };
  let adapter;
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); } catch { /* reported below */ }
  if (!adapter) return { supported: false, reason: 'Kullanılabilir WebGPU bağdaştırıcısı bulunamadı.', memoryGB };
  const limits = { maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize };
  const f16 = adapter.features.has('shader-f16');
  const hardware = !adapter.info?.isFallbackAdapter && !/swiftshader|software|llvmpipe/i.test([adapter.info?.vendor, adapter.info?.device, adapter.info?.description].join(' '));
  const sufficient = memoryGB !== null && memoryGB >= 8 && limits.maxBufferSize >= 512 * 1024 * 1024 && limits.maxStorageBufferBindingSize >= 384 * 1024 * 1024 && f16 && hardware;
  const assets = await fetch(new URL('./models/' + C.QWEN.model + '/config.json', import.meta.url)).then(r => r.ok).catch(() => false);
  return { supported: sufficient && assets, memoryGB, shaderF16: f16, hardware, limits, assets, reason: !assets ? 'Paket içinde Qwen model dosyaları eksik.' : !sufficient ? 'Deneysel Qwen için en az 8 GB bildirilen sistem belleği, donanım WebGPU, shader-f16 ve yeterli GPU tampon sınırı gerekli.' : 'Ön kontroller geçti. GPU belleğinin yeterliliği çalışma sırasında ayrıca sınanır; kalite henüz garanti edilmez.' };
}

export class OpusTranslator {
  constructor(progress) { this.progress = progress; this.model = null; }
  async describe() { return C.OPUS; }
  async load() {
    this.model ??= pipeline('translation', C.OPUS.model, { revision: 'ce128ea834a090aca240e4e113e7756e06cc78e0', device: 'wasm', dtype: 'q8', progress_callback: this.progress }).then(async model => {
      const [j, config] = await Promise.all(['tokenizer-fixed.json', 'tokenizer_config.json'].map(f => fetch(new URL('./vendor/' + f, import.meta.url)).then(r => r.json())));
      model.tokenizer = new MarianTokenizer(j, config);
      return model;
    }).catch(e => { this.model = null; throw e; });
    return this.model;
  }
  async translate(raw) {
    const request = C.normalizeRequest(raw), model = await this.load(), dictionary = C.protectedGlossary(request), out = [], started = performance.now();
    for (const { text } of request.balloons) {
      const entries = C.terms(text, dictionary).sort(([a], [b]) => b.length - a.length);
      if (!entries.length) { const result = await model(text, { max_new_tokens: 192 }); out.push(result[0].translation_text); continue; }
      // Translate the surrounding phrases while preserving literal glossary spans.
      const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(entries.map(([s]) => escape(s)).join('|'), 'gi');
      let from = 0, translated = '';
      for (const match of text.matchAll(regex)) {
        const prefix = text.slice(from, match.index);
        if (/[A-Za-z]/.test(prefix)) translated += (await model(prefix, { max_new_tokens: 192 }))[0].translation_text + ' ';
        else translated += prefix;
        translated += entries.find(([s]) => s.toLowerCase() === match[0].toLowerCase())[1];
        from = match.index + match[0].length;
      }
      const suffix = text.slice(from);
      translated += /[A-Za-z]/.test(suffix) ? ' ' + (await model(suffix, { max_new_tokens: 192 }))[0].translation_text : suffix;
      out.push(translated.replace(/\s+([,!.?])/g, '$1').trim());
    }
    return { translations: C.validate(out, request, false), engine: C.OPUS, warnings: [], metrics: { elapsedMs: performance.now() - started } };
  }
  async dispose() { if (this.model) await (await this.model).dispose(); this.model = null; }
}

export class OllamaTranslator {
  constructor(rpc) { this.rpc = rpc; }
  describe(options) { return this.rpc('describe', { options }); }
  translate(request, options, expected) { return this.rpc('translate', { request, options, expected }); }
  async dispose() {}
}

export class BrowserQwenTranslator {
  constructor(progress) { this.progress = progress; this.model = null; }
  async describe() { const caps = await browserCapabilities(); if (!caps.supported) throw Error(caps.reason); return C.QWEN; }
  async load() {
    await this.describe();
    this.model ??= pipeline('text-generation', C.QWEN.model, { device: 'webgpu', dtype: 'q4f16', progress_callback: this.progress }).catch(e => { this.model = null; webgpuFailure = String(e.message || e); throw Error('WebGPU Qwen yüklenemedi: ' + webgpuFailure); });
    return this.model;
  }
  async translate(raw) {
    const request = C.normalizeRequest(raw), model = await this.load(), started = performance.now();
    const reply = await model(C.messages(request), { max_new_tokens: 256, do_sample: false, repetition_penalty: 1.1, return_full_text: false });
    let output = reply[0]?.generated_text;
    if (Array.isArray(output)) output = output.at(-1)?.content;
    return { translations: C.validate(output, request), engine: C.QWEN, warnings: ['Deneysel Qwen: küçük modelin Türkçe ve anlam doğruluğu sınırlı olabilir.'], metrics: { elapsedMs: performance.now() - started } };
  }
  async dispose() { if (this.model) await (await this.model).dispose(); this.model = null; }
}

export class TranslatorRouter {
  constructor(progress, rpc) { this.providers = { opus: new OpusTranslator(progress), ollama: new OllamaTranslator(rpc), webgpu: new BrowserQwenTranslator(progress) }; this.active = null; }
  async activate(mode) { if (this.active && this.active !== mode) await this.providers[this.active].dispose(); this.active = mode; }
  async describe(raw) {
    const options = C.options(raw);
    try { await this.activate(options.translationMode); return { engine: await this.providers[options.translationMode].describe(options), warnings: [] }; }
    catch (e) { if (!options.allowOpusFallback || options.translationMode === 'opus') throw e; await this.activate('opus'); return { engine: C.OPUS, warnings: ['Seçilen motor kullanılamadı; izninizle OPUS-MT kullanıldı. ' + e.message] }; }
  }
  async translate(raw, rawOptions, expected) {
    const options = C.options(rawOptions), request = C.normalizeRequest(raw), description = await this.describe(options);
    let mode = description.engine.id;
    const run = async () => {
      const output = [], warnings = [...description.warnings], metrics = { elapsedMs: 0 };
      // Six ordered balloons per request, previous translated balloons become context for the next group.
      let previous = [...request.previous];
      const chunkSize = mode === 'webgpu' ? 3 : 6;
      for (let start = 0; start < request.balloons.length; start += chunkSize) {
        const balloons = request.balloons.slice(start, start + chunkSize), chunk = { ...request, balloons, previous: previous.slice(-12) };
        const result = await this.providers[mode].translate(chunk, options, mode === expected?.id ? expected : description.engine);
        output.push(...result.translations); warnings.push(...result.warnings); metrics.elapsedMs += result.metrics?.elapsedMs || 0;
        previous.push(...balloons.map((b, i) => ({ source: b.text, translation: result.translations[i] })));
      }
      return { translations: C.validate(output, request, false), engine: mode === 'opus' ? C.OPUS : description.engine, warnings: [...new Set(warnings)], metrics };
    };
    try { return await run(); }
    catch (e) {
      if (!options.allowOpusFallback || mode === 'opus') throw e;
      await this.activate('opus'); mode = 'opus';
      const result = await this.providers.opus.translate(request);
      result.warnings.push('Seçilen motorun çıktısı kullanılamadı; izninizle OPUS-MT kullanıldı. ' + e.message);
      return result;
    }
  }
}
