# Üçüncü taraf lisans ve atıfları

MangaFlow uygulama kodu [MIT](LICENSE) lisanslıdır. Aşağıdaki motorlar/modeller kendi lisanslarına tabidir. Kaynak deposu, üretilmiş motorları ve model ağırlıklarını içermez; hazırlanan dağıtım paketinde bu dosya ve `licenses/` korunur.

| Bileşen | Sürüm / kaynak | Lisans |
|---|---|---|
| Tesseract.js | 6.0.1 — [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 |
| Tesseract.js-core | 6.1.2 — [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core) | Apache-2.0 ve paket bildirimleri |
| İngilizce OCR dili | [eng.traineddata.gz 4.0.0](https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz), [tessdata](https://github.com/tesseract-ocr/tessdata) | Apache-2.0 |
| Transformers.js | 3.8.1 — [huggingface/transformers.js](https://github.com/huggingface/transformers.js) | Apache-2.0 |
| ONNX Runtime | npm paketinin getirdiği sabit Web sürümü — [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | MIT ve ThirdPartyNotices |
| OPUS-MT İngilizce→Türkçe | Helsinki-NLP / OPUS-MT ekibi — [model kartı](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-tr) | CC BY 4.0 |
| OPUS ONNX kuantize dönüşümü | ONNX Community — [dönüşüm](https://huggingface.co/onnx-community/opus-mt-tc-big-en-tr) | CC BY 4.0 |
| Qwen2.5-0.5B-Instruct | Qwen ekibi — [model kartı](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) | Apache-2.0 |
| İsteğe bağlı Qwen ONNX dönüşümü | ONNX Community — [dönüşüm](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) | Temel modelin Apache-2.0 koşulları; dönüştürüm kaynağı korunur |

## Sabit sürümler ve değişiklik bildirimi

OPUS ONNX revizyonu: `ce128ea834a090aca240e4e113e7756e06cc78e0`. Ağırlıklar değiştirilmez. Yayımlanan `tokenizer.json` sözcük sırası aynı revizyondaki `vocab.json` kimlikleriyle yeniden eşleştirilir; unigram skorları korunur ve `unk_id` düzeltilir. Dönüşüm `tools/setup-assets.mjs` içinde açıktır. Oluşan dosya ayrıca sabit SHA-256 ile sınanır. Düzeltilmiş tokenizer türevinde de kaynak, atıf, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) bağlantısı ve bu değişiklik bildirimi korunmalıdır. Helsinki-NLP veya ONNX Community'nin MangaFlow'u onayladığı ima edilmez.

Qwen ONNX revizyonu: `22942cb7d7ba4cc81bb4673549ca4d4614469b5e`. `q4f16` ağırlığı ve tokenizer değiştirilmez. SHA-256 değerleri `tools/assets.lock.json` içindedir.

Tam lisanslar `licenses/` içindedir. Minify edilmiş Tesseract bildirimleri ve ONNX'in üçüncü taraf bildirimleri de korunur. npm geliştirme bağımlılıklarının kendi lisansları kurulan paketlerinde bulunur; hepsi eklentiye dağıtılmaz.

Ollama uygulaması ve Ollama modelleri bu kaynak/depo paketinde dağıtılmaz. Kullanıcı resmi dağıtımı ve istediği modeli ayrı kurar. Desteklenen model etiketi, tek başına bütün model ailelerine genel lisans izni anlamına gelmez; farklı model eklerken onun kartını/lisansını inceleyin.

Telifli manga sayfaları, test sırasında yerel okunan görseller veya tam OCR/çeviri dökümleri bu depoya dahil edilmez. Programatik test görselleri test koduyla üretilir.
