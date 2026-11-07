# Bilinen sınırlar

- Sürüm adayıdır. Tüm manga siteleri, bağımsız Edge ve çok saatli oturumlar doğrulanmadı.
- OCR İngilizce içindir; dikey Japonca desteklenmez. Tesseract balon/panel algılama modeli değildir. Yakın balonlar, çizim içi yazı ve parça sınırları hataya yol açabilir.
- 24.000 piksel programatik test ve bir gerçek manga görselinin sınırlı grubu test edildi; geniş manga veri kümesi değildir.
- Qwen/Ollama bağlantısı 0.3.1'de gerçek Chrome'da doğrulandı; 1.5B model basit cümlelerde bile anlam hatası yapabilir. “Kaliteli” etiketi kalite garantisi değildir.
- WebGPU Qwen'in gerçek denemesinde geçerli çıktı alınmadı. Ön bellek/donanım kontrolü başarılı çıkarım garantisi vermez; isteğe bağlıdır.
- JSON, kimlik, sıra, sayı ve sözlük doğrulaması anlamsal halüsinasyonu kesin dışlamaz. Doğru sayının yazıyla çevrilmesi de reddedilebilir.
- OPUS terim koruması çevre ifadeleri ayrı çevirebilir ve akıcılığı azaltabilir. Büyük harfli OCR'den otomatik özel ad kestirimi sınırlıdır; sözlük kullanın.
- Önceki bağlam yalnızca tamamlanmış önceki görseller ve aynı istekteki önceki balonlardan alınır. Eksik bağlam uydurulmaz. OPUS modele önceki konuşmayı vermez.
- Tam bitmap çözülür; OCR canvas'ı parçalansa da model/bitmap belleği önemlidir. 24 MB veri, 8192 px genişlik ve 180 milyon piksel sınırı vardır. GPU VRAM miktarı evrensel bir API ile ölçülmez; `deviceMemory` yaklaşık göstergedir.
- Inpainting yoktur. Beyaz kaplama çizim veya renkli balonları örtebilir. Karmaşık CSS dönüşümleri ve her object-fit durumu doğrulanmadı. Manuel düzeltme Türkçe katmanla ve oturumla sınırlıdır.
- IndexedDB site kökenindedir; önbellek temizliği mevcut siteyi etkiler. DOM/load olayı olmadan aynı URL'de sessiz sunucu değişimi sürekli sorgulanmaz.
- Desteklenmeyen görsel biçimi, korumalı CDN ve erişim kısıtları hata verebilir. Güvenlik mekanizmaları aşılmaz. Canvas/background-image ve tarayıcı iç sayfaları desteklenmez.
