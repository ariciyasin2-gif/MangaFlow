# Test kapsamı

## Kaynak deposu / CI

```sh
npm ci
npm test
npm run check
```

Model gerekmez. Gerçek çıkarım taklidi yapılmaz. Kuyruk, iptal, IndexedDB, gruplama, çeviri sözleşmesi, önbellek kimliği, yerel istemci izinleri ve asset araçları test edilir. HTTP yanıtı taklit eden testler **protokol testi** olarak adlandırılır.

## Varlık / paket

```sh
npm run assets:install
npm run test:assets
npm run verify
npm run build
```

Varlıklar boyut ve SHA-256 ile doğrulanır. Tokenizer'ın OPUS sözlüğüyle kimlik eşleşmesi ayrıca sınanır. Model dosyaları Git'e eklenmez. Derleme yalnızca açık çalışma dosyası listesi, lisanslar ve doğrulanmış varlıkları paketler; kişisel raporları veya geliştirme araçlarını almaz.

## Gerçek tarayıcı

```sh
npx playwright install chromium
npm run test:browser
```

Ayrı geçici profilde gerçek Manifest V3, Tesseract WASM, OPUS, IndexedDB ve metin katmanı çalışır. Yerel HTTP test görselleri üretilir; 24.000 piksel OCR, kaydırma, iptal ve gezinme sınanır. Linux'ta Playwright sistem bağımlılıkları gerekebilir (`npx playwright install --with-deps chromium`).

Ollama testi varsayılan kapalıdır. İsteğe bağlı örnek PowerShell:

```powershell
$env:MANGAFLOW_TEST_OLLAMA = "1"
npm run test:browser
```

Geçici eklenti kimliği gerçek eklentiden farklıdır. Başarılı CORS testi için o geçici kimliğe dar izin gerekebilir; joker yıldız kullanmayın. Bağlantı reddi testini başarılı model çıkarımı diye raporlamayın.

İzinli bir gerçek görsel için `MANGAFLOW_REFERENCE` tam yolunu verin. Bu değişken verilmezse gerçek manga/WebGPU kalite testi çalıştırılmış sayılmaz. Deneysel çıkarım başarısız olursa komut başarısız çıkış kodu verir.

## Ölçüm ve geçmiş sonuçlar

`npm run test:engine`: gerçek OCR ve yerel OPUS Node testidir; npm kurulum script'lerini kapattıysanız yerel ONNX bağımlılığı ayrıca eksik olabilir. `npm run test:performance`: gerçek tarayıcı modelinde soğuk/sıcak çağrıları ölçer. Windows süreç belleği ölçümü isteğe bağlı ve tarayıcı toplamıdır; model VRAM'i değildir.

0.3.0–0.3.1 geliştirme sırasında gerçek OCR/OPUS, kısa Chrome/Ollama bağlantısı ve başarısız WebGPU çıkarımı görüldü. Bu geçmiş gözlemler yeni klonda bütün testlerin otomatik geçtiği anlamına gelmez. Makineye özel ham raporlar ve tarayıcı kimlikleri bu depoya taşınmadı. Testleri kendi ortamınızda yeniden çalıştırın; **geçti / başarısız / çalıştırılamadı** ayrımını koruyun.

CI temel iş akışı model indirmez. Ağır varlık ve tarayıcı testi yalnızca Actions'taki elle başlatılan iş akışındadır. GitHub üzerinde bu iş akışının uzaktan çalıştığı henüz doğrulanmış sayılmaz.
