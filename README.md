# MangaFlow

İngilizce manga ve webtoon görsellerindeki metni Tesseract OCR ile okuyup Türkçeye çeviren Chrome/Edge Manifest V3 eklentisi. Çeviri yerel OPUS-MT, isteğe bağlı yerel Ollama/Qwen veya deneysel WebGPU/Qwen üzerinden yapılır.

**Sürüm: 0.3.1-rc1 — geliştirmeye açık sürüm adayı.** Genel çeviri kalitesi ve tüm manga sitelerinde kararlılık garanti edilmez.

| Bileşen | Doğrulanan durum |
|---|---|
| Tesseract İngilizce OCR | Gerçek metin, 24.000 piksel programatik görsel ve sınırlı gerçek manga testi yapıldı |
| OPUS-MT İngilizce → Türkçe | Gerçek çıkarım, önbellek ve katman bağlantısı test edildi |
| Ollama / Qwen | Gerçek Chrome bağlantısı ve kısa çeviri isteği test edildi; 1.5B modelde anlam hataları gözlendi |
| Tarayıcıda Qwen / WebGPU | Deneysel; gerçek denemede çıktı doğrulaması başarısız oldu. Tamamlanmış mod değildir |

## Hızlı başlangıç

Node.js 24 ve npm gereklidir. Kaynağı klonlayıp proje klasöründe çalıştırın:

```sh
npm ci
npm test
npm run check
npm run assets:install
npm run test:assets
npm run verify
npm run build
```

`assets:install` paket içi worker, WASM, İngilizce OCR dili ve OPUS modelini hazırlar. Yaklaşık 600 MB veri indirir; kullanılan npm paketleri kilitlidir, indirmeler boyut/SHA-256 kontrolünden geçer. İndirmeler **geliştirme/paket hazırlama** sırasında yapılır. Çalışan eklenti uzaktan JavaScript veya model yüklemez. Node/npm yalnızca geliştirici kurulumunda gerekir.

`dist/MangaFlow-0.3.1.zip` dosyasını çıkartın. Chrome'da `chrome://extensions`, Edge'de `edge://extensions` sayfasında geliştirici modunu açıp çıkarttığınız, `manifest.json` içeren klasörü **Paketlenmemiş öğe yükle** ile seçin. ZIP doğrudan yüklenmez. Manga bölümünde araç çubuğundaki MangaFlow simgesinden etkinleştirin. `popup.html` dosyasını doğrudan açmayın.

Sayfa ve gerekiyorsa görsel CDN'i için izin verin. Ardından **Geçerli sayfayı çevir** veya otomatik çeviriyi kullanın. Orijinal/Türkçe geçişi, yazı boyutu ve RTL/LTR okuma yönü vardır. Katmana çift tıklayarak oturumluk Türkçe düzeltme yapılabilir.

### Deneysel tarayıcı Qwen dosyaları

```sh
npm run assets:install -- --with-qwen
npm run verify
npm run build
```

Ek yaklaşık 483 MB ağırlık indirilir. WebGPU, shader-f16, bildirilen sistem belleği ve GPU tampon sınırları kontrol edilir; uygun olmayan cihazda seçenek kapatılır. Bu ön kontrol başarılı/kaliteli çıkarım garantisi değildir. Varsayılan paket bu modeli indirmez. Yarım kalan isteğe bağlı indirmeyi aynı komutla tamamlayın.

### Yerel varlıklardan çevrimdışı hazırlama

Elinizde daha önce hazırlanmış tam bir eklenti klasörü varsa:

```sh
npm run assets:install -- --from "/yerel/tam-eklenti-klasoru" --offline
```

Bu klasörden yalnızca beklenen varlık yolları okunur; her dosyanın özeti doğrulanır. Qwen için ayrıca `--with-qwen` verin. İlk `npm ci` için npm önbelleği/ağ gereksinimi ayrıdır.

## Ollama modu

[Resmî Ollama](https://ollama.com/download) kurulumundan sonra modeli kendiniz indirin:

```sh
ollama pull qwen2.5:1.5b
```

Desteklenen seçenekler `qwen2.5:0.5b`, `qwen2.5:1.5b`, `qwen2.5:7b` ile sınırlıdır. Yalnızca gerçekten kurduğunuz modeli seçin. Daha büyük model daha fazla bellek gerektirir; modun “Kaliteli” adı ölçülmüş kalite garantisi değildir.

Eklentide **Ollama / Qwen ayarları** bölümünü açın; varsayılan adres `http://127.0.0.1:11434`. Yerel bağlantıyı açıkça etkinleştirip tarayıcının istediği ilgili erişim iznini değerlendirin. **Ollama bağlantısını sınayın** ile kontrol edin. Bağlantı kapalıyken Ollama'ya istek yapılmaz. Görsel değil, yalnızca konuşma metni/sözlük/bağlam yerel servise gönderilir.

Gerekirse Ollama'yı durdurup aynı terminal oturumunda yalnızca kendi eklenti kimliğinize izin vererek yeniden başlatın. PowerShell örneği:

```powershell
$env:OLLAMA_HOST = "127.0.0.1:11434"
$env:OLLAMA_ORIGINS = "chrome-extension://EKLENTI_KIMLIGINIZ"
ollama serve
```

Eklenti kimliği ayarlar ekranında ve tarayıcının eklenti ayrıntılarında gösterilir. Kaynak klasörünü değiştirerek yeniden yükleme kimliği değiştirebilir. CORS için joker yıldız kullanmayın; servisi tüm ağ arayüzlerine açmayın. Eklenti CORS'u devre dışı bırakmaz. Bağlantı ve model değişiminde yeniden sınayın. Yalnızca izin verirseniz OPUS geri dönüşü yapılır; gerçek kullanılan motor durum alanında gösterilir.

## Modüller

- `content.js`: gözlemciler, sınırlı görev kuyruğu, Pipeline ve IndexedDB.
- `ocr-engine.js`: tekrar kullanılan Tesseract, örtüşmeli parçalar ve iptal.
- `overlay-renderer.js`: ölçeklenen metin katmanı.
- `translation-contract.js`, `translator.d.ts`: ortak çeviri arayüzü, sıralı balonlar, sözlük, bağlam ve doğrulama.
- `translator-providers.js`: OPUS, Ollama ve WebGPU sağlayıcıları.
- `ollama-client.js`: kullanıcı izinli loopback istemcisi, model digest'i ve hata yönetimi.
- `offscreen.js`, `translation-worker.js`, `service-worker.js`: motor yaşam döngüsü ve güvenli iletişim.
- `tools/`: doğrulanmış varlık hazırlama, test ve paketleme araçları.

OCR kayıtları motorlardan bağımsızdır. Çeviri önbelleği model kimliği/sürümü, istem sürümü, sözlük ve önceki konuşma bağlamıyla ayrılır. Qwen'e balonlar okuma sırasıyla ve tamamlanmış önceki konuşmalarla verilir. OPUS önceki konuşmaları modele katmaz. JSON/kimlik/sayı/isim kontrolleri eklenmiştir; **anlamsal halüsinasyonu kesin saptamazlar**.

## Testler ve katkı

`npm test` model indirmeden kuyruk, önbellek, çeviri sözleşmesi, global `fetch` alıcısı ve depo araçlarını sınar. `npm run test:assets` hazırlanmış tokenizer kimliklerini sınar.

Gerçek OCR/OPUS için varlıkları hazırladıktan sonra:

```sh
npx playwright install chromium
npm run test:browser
```

Tarayıcı testi ayrı geçici profil kullanır; gerçek Chrome profilini değiştirmez. Ollama testine açıkça katılmak için `MANGAFLOW_TEST_OLLAMA=1` verin ve geçici test eklentisinin kökeni/izinleri için CORS koşullarını ayrıca değerlendirin. Kullanma hakkınız olan manga görselini `MANGAFLOW_REFERENCE` ortam değişkeniyle tam dosya yolu olarak verebilirsiniz. Telifli manga görsellerini bu depoya eklemeyin. Başarısız test sıfır çıkış koduyla gizlenmez.

`npm run test:engine` ve `npm run test:performance` isteğe bağlı ağır ölçümlerdir. Tek örnek veya sentetik görsel sonuçlarını genel manga kalitesi diye raporlamayın. Ayrıntılar [TESTING.md](TESTING.md) içinde.

[Katkı rehberi](CONTRIBUTING.md) · [Yol haritası](ROADMAP.md) · [Bilinen sınırlar](docs/LIMITATIONS.md) · [Lisans bildirimleri](THIRD_PARTY_NOTICES.md) · [GitHub'da paylaşma](GITHUB-YAYINLAMA.md)

## Lisans

MangaFlow kaynakları [MIT](LICENSE) lisanslıdır. Tesseract/Transformers/Qwen ve OPUS modelinin kendi lisansları ayrıdır. OPUS modeli ve düzeltilmiş tokenizer CC BY 4.0 atıf koşullarıyla kullanılır; kaynak ve değişiklik bildirimi paketlerde korunur. Model ağırlıkları ve derlenmiş motorlar Git geçmişine dahil değildir.
