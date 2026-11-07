# Güvenlik

Bu proje sürüm adayıdır; güvenlik veya kararlılık garantisi sunulmaz. En güncel kaynak dalı incelenir; belirli bir düzeltme süresi taahhüt edilmez.

## Bildirim

Depo sahibi GitHub'ın özel güvenlik bildirimi özelliğini etkinleştirmişse **Security → Report a vulnerability** kullanın. Etkin değilse herkese açık issue'ya kişisel veri, manga sayfası, erişim bilgisi veya kullanılabilir saldırı ayrıntıları eklemeyin; yalnızca özel bildirim kanalı talep edin. Sahte iletişim adresi veya bakımcı e-postası tanımlanmamıştır.

## Korunacak sınırlar

- Manifest V3; çalışma sırasında uzaktan JavaScript yükleme yok.
- Görseller ve metinler izinsiz uzak çeviri servisine gönderilmez.
- Ollama varsayılan kapalıdır; yalnızca doğrulanan HTTP loopback kök adresine istek yapar; yönlendirme izlemez.
- Tarayıcı/sunucu güvenlik denetimleri devre dışı bırakılmaz. Geniş joker CORS ve tüm arayüzlerde servis açılması önerilmez.
- Varlık indirmeleri HTTPS, sabit sürüm ve SHA-256/boyut kontrolü kullanır. Model dosyası çalıştırılabilir JavaScript değildir; model çalışma zamanı da kendi güvenlik bakımını gerektirir.
- Pull request iş akışı salt okunur izinlerle ve install script'leri kapalı çalışır; sır veya dağıtım yetkisi istemez.
