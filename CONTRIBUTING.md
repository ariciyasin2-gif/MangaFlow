# Katkıda bulunma

Hata düzeltmeleri, OCR/balon gruplama, Türkçe çeviri değerlendirmesi, erişilebilirlik, test ve belgeler için katkı kabul edilir.

1. Depoyu fork edin ve yeni bir dal açın.
2. Node.js 24 ile `npm ci`, `npm test` ve `npm run check` çalıştırın. Bu aşama model gerektirmez.
3. Gerçek motor veya arayüz değişikliği için `npm run assets:install`, `npm run verify` ve ilgili tarayıcı testlerini çalıştırın.
4. Küçük ve tek amaçlı değişiklik hazırlayın; mevcut çalışan OCR/OPUS akışını koruyun.
5. Pull request'te sorun, değişiklik, gerçekten çalıştırılmış testler ve bilinen sınırları yazın. Başarısız veya çalıştırılamayan testleri gizlemeyin.

## Kurallar

- `vendor/`, `models/`, `node_modules/`, `.cache/`, `dist/`, gerçek tarayıcı profilleri ve kişisel günlükleri commit etmeyin.
- Kullanıcı görsellerini/metinlerini izinsiz uzak servise göndermeyin. Ollama kullanıcı etkinleştirmeden bağlanmamalıdır. Loopback, CORS ve iptal sınırlarını koruyun.
- Sahte OCR/çeviri yanıtlarını gerçek model sonucu diye sunmayın. Protokol mock testlerini ayrı adlandırın.
- Sözlük, bağlam, istem, model sürümü veya decode davranışı değişiyorsa önbellek kimliğini de değerlendirin. İstem değişiminde `PROMPT_VERSION` güncelleyin.
- Konuşma sayısı, sıra, isim ve sayı korumasını test edin. Bu kontroller anlamsal doğruluk kanıtı değildir; gerekirse insan değerlendirmesi ekleyin.
- Varlık sürümü değiştirirken `tools/assets.lock.json`, paket kilidi, lisans bildirimleri ve gerçek motor testlerini birlikte güncelleyin. Yeni SHA-256 değerini yalnızca indirdiğiniz rastgele dosyadan kabul etmeyin; resmî kaynak/sürüm ve dönüşüm adımlarını inceleyin.
- Telifli manga sayfalarını, kişisel içerikleri veya erişim engeli aşan çözümleri eklemeyin. Test görsellerini programatik üretin veya açık lisans/izinle kullanın.
- Türkçe arayüzü koruyun. Kaynak açıklamaları Türkçe veya mevcut teknik bağlama uygun İngilizce olabilir.

İletişimde saygılı olun, kişileri değil değişikliği değerlendirin. Güvenlik bulguları için [SECURITY.md](SECURITY.md) dosyasını izleyin.
