import './translation-contract.js';
const C = globalThis.MangaFlowTranslation;
export class OllamaClient {
  constructor(fetcher = (...args) => globalThis.fetch(...args)) { this.fetcher = fetcher; }
  async json(endpoint, path, body, signal) {
    const timeout = AbortSignal.timeout(body ? 180000 : 5000);
    let response;
    try { response = await this.fetcher(endpoint + path, { method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', mode: 'cors', targetAddressSpace: 'loopback', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: signal ? AbortSignal.any([signal, timeout]) : timeout }); }
    catch (e) { if (signal?.aborted) throw new DOMException('İptal edildi', 'AbortError'); if (timeout.aborted) throw Error('Ollama yanıtı zaman aşımına uğradı (' + (body ? '180' : '5') + ' saniye).'); throw Error('Ollama bağlantısı kurulamadı. Adresi ve tarayıcının yerel ağ erişimini kontrol edin. Teknik ayrıntı: ' + e.name + ': ' + e.message); }
    if (response.status === 403) throw Error('Ollama erişimi reddetti (403). OLLAMA_ORIGINS içine yalnızca bu eklentinin chrome-extension:// kimliğini ekleyip Ollama’yı yeniden başlatın.');
    if (!response.ok) throw Error('Ollama HTTP ' + response.status + (response.status === 404 ? ': Seçilen Qwen modeli yüklü değil; önce ollama pull komutunu çalıştırın.' : '')); 
    const text = await response.text(); if (text.length > 1024 * 1024) throw Error('Ollama yanıtı güvenli boyut sınırını aştı.');
    try { return JSON.parse(text); } catch { throw Error('Ollama geçerli JSON yanıtı döndürmedi.'); }
  }
  async describe(raw, signal) {
    const o = C.options(raw); if (!o.ollamaEnabled) throw Error('Ollama bağlantısı kapalı. Önce ayarlardan açıkça etkinleştirin.');
    const result = await this.json(o.ollamaEndpoint, '/api/tags', null, signal);
    const model = result.models?.find(m => m.name === o.ollamaModel || m.model === o.ollamaModel);
    if (!model || !/^(?:sha256:)?[a-f0-9]{64}$/i.test(model.digest || '')) throw Error('Seçilen Qwen modeli kurulu değil veya model özeti doğrulanamadı. Önce ollama pull ' + o.ollamaModel + ' çalıştırın.');
    return { id: 'ollama', model: o.ollamaModel, version: model.digest };
  }
  async translate(raw, settings, signal, expected) {
    const o = C.options(settings), request = C.normalizeRequest(raw), engine = await this.describe(o, signal);
    if (expected && expected.version !== engine.version) throw Error('Ollama model sürümü değişti; çeviriyi yeniden başlatın.');
    const started = performance.now();
    const reply = await this.json(o.ollamaEndpoint, '/api/chat', { model: o.ollamaModel, stream: false, format: C.schema(request), messages: C.messages(request), keep_alive: '5m', options: { temperature: 0, seed: 42, num_ctx: 4096, num_predict: 768 } }, signal);
    if (reply.done === false || reply.done_reason === 'length') throw Error('Ollama çevirisi tamamlanmadan kesildi.');
    return { translations: C.validate(reply.message?.content, request), engine, warnings: [], metrics: { elapsedMs: performance.now() - started, loadMs: (reply.load_duration || 0) / 1e6, evalMs: (reply.eval_duration || 0) / 1e6 } };
  }
  async dispose() {}
}
