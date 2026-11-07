# GitHub'da paylaşma

Bu paket **kaynak deposudur**. Hazır eklentinin yüzlerce MB model/WASM dosyaları Git'e konulmaz; hazırlama komutları bunları doğrulayarak üretir. GitHub, normal Git dosyalarında [100 MiB üzerini engeller](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). Bu kaynak paketinde böyle bir dosya yoktur.

## Kolay yol: GitHub web arayüzü

1. `MangaFlow-GitHub-Kaynak.zip` dosyasını çıkartın. İçinde README, LICENSE, `.github`, `.gitignore`, kod ve tools bulunan **MangaFlow** klasörü oluşur.
2. GitHub hesabınızda **New repository** seçin. Adı `MangaFlow`, açıklaması “Yerel OCR ve çoklu çeviri motoru destekli manga çeviri eklentisi” olabilir. İnsanların katkı verebilmesi için **Public** seçin.
3. Bu pakette zaten README, lisans ve gitignore bulunduğundan yeni depo oluştururken bunları ayrıca oluşturmayın.
4. Boş depoda **uploading an existing file** / **Add file → Upload files** seçin. Çıkartılan MangaFlow klasörünün **içeriğini** yükleyin; ZIP'i tek dosya olarak yüklemeyin. `.github`, `.gitignore` ve `.gitattributes` dahil olsun.
5. Değişiklik açıklamasını yazıp kendi hesabınızdan commit edin. Hesap açma veya şart kabulü işlemlerini kendiniz tamamlayın.
6. **Actions** sekmesindeki temel test sonuçlarını kontrol edin. Bu hazırlık sırasında hesabınıza yükleme veya uzaktan iş akışı çalıştırması yapılmadı.

Kaynak ZIP'i `.git`, model, node_modules, kullanıcı günlükleri ve kişisel tarayıcı ayarlarını içermez. Windows nokta ile başlayan dosyaları gizliyorsa **gizli öğeler** görünümünü kontrol edin.

## Git ile yükleme

Git kurulu ve GitHub kimlik doğrulamanız hazırsa, ZIP'ten çıkarttığınız proje klasöründe:

```sh
git init -b main
git add .
git commit -m "Initial open-source release"
git remote add origin https://github.com/KULLANICI_ADINIZ/MangaFlow.git
git push -u origin main
```

Yer tutucuyu kendi GitHub adınızla değiştirin. Git kimlik bilgisi istiyorsa yalnızca kendi adınız/e-postanızla yapılandırın; bu pakette sizin adınıza kimlik veya erişim anahtarı üretilmedi. GitHub Desktop ile de yerel depoyu ekleyip kendi hesabınızdan yayımlayabilirsiniz.

## Kullanıcıların indireceği hazır eklenti

Geliştirici kaynak kodu klonlar; son kullanıcıya hazır paket sunmak isterseniz:

```sh
npm ci
npm run assets:install
npm run verify
npm run build
```

Oluşan `dist/MangaFlow-0.3.1.zip` ve `.sha256` dosyasını **Releases** sayfasına sürüm eki olarak kendiniz yükleyin. Model/WASM dosyalarını commit etmeyin. İsteğe bağlı Qwen için `assets:install -- --with-qwen` kullanın; mevcut başarısız deneysel durumunu sürüm notunda saklamayın. Release paketinde lisans/atıflar korunur. Kaynak ZIP'i ile hazır eklenti ZIP'ini farklı adlandırın.

## Katkı almayı kolaylaştırma

- **Issues** ve **Pull requests** açık olsun; şablonlar bu pakette hazırdır.
- Ayarlardan **Discussions** ve özel güvenlik bildirimi özelliğini ihtiyacınıza göre etkinleştirebilirsiniz.
- README'ye kendi depo bağlantınızı ve gerçek iletişim kanalınızı ekleyin. Sahte bakımcı/e-posta eklenmedi.
- İyi başlangıç görevlerini `good first issue` ile etiketleyin; [ROADMAP.md](ROADMAP.md) hazır başlangıç listesi sunar.
- Yeni katkı sahibinin PR'ını birleştirmeden önce CI ve gerçek motor test kapsamını inceleyin. “Kaliteli” veya “kararlı” iddialarını ölçümle destekleyin.
