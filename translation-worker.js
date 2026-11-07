import { TranslatorRouter, browserCapabilities } from './translator-providers.js';
const C = globalThis.MangaFlowTranslation;
let sequence = 0, chain = Promise.resolve();
const pending = new Map();
const rpc = (operation, payload) => new Promise((resolve, reject) => { const rpcId = ++sequence; pending.set(rpcId, { resolve, reject }); postMessage({ rpcId, operation, payload }); });
const router = new TranslatorRouter(progress => postMessage({ progress }), rpc);
self.onmessage = ({ data: m }) => {
  if (m.rpcId) { const p = pending.get(m.rpcId); if (p) { pending.delete(m.rpcId); m.error ? p.reject(Error(m.error)) : p.resolve(m.result); } return; }
  chain = chain.catch(() => {}).then(async () => {
    try {
      if (m.op === 'capabilities') { postMessage({ id: m.id, result: await browserCapabilities() }); return; }
      if (m.op === 'describe') { postMessage({ id: m.id, result: await router.describe(m.options) }); return; }
      const request = m.request || { balloons: m.texts.map((text, i) => ({ id: String(i), text })), previous: [], glossary: {}, context: '' };
      const result = await router.translate(request, m.options || {}, m.expected);
      postMessage({ id: m.id, result: m.legacy ? result.translations : result });
    } catch (e) { postMessage({ id: m.id, error: 'Çeviri: ' + (e.message || String(e)) }); }
  });
};
