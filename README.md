# Muay Thai Program

Muay Thai hocası için ders programı, yoklama ve raporlama uygulaması. Excel'deki
"günler × kişiler × saatler" tablosunun yerini alır: dersler sürüklenebilir
kartlar hâline gelir, her ders sonuçlanır (geldi / gelmedi / iptal) ve geçmiş
sorgulanabilir olur.

Tek kod tabanı; **Android, iOS ve web** üzerinde çalışır. Tarayıcıdan "Ana ekrana
ekle" denince uygulama gibi açılır ve internet olmadan da çalışır (PWA).

## Öğrenci tipleri

Uygulamanın tamamı hocanın gerçek hayattaki üç öğrenci grubunun üzerine kurulu:

| Tip | Anlamı | Takvimde nasıl görünür |
| --- | --- | --- |
| **Sabit gün + saat** | Her hafta aynı gün, aynı saat | Doğrudan ızgaraya düşer |
| **Gün sabit, saat esnek** | Günü belli, saati hafta hafta değişiyor | O günün "saat bekliyor" kartı olarak bekleme şeridinde çıkar; hoca boşluğa sürükleyip saatini verir |
| **Tamamen esnek** | Ne günü ne saati belli | Haftalık esnek havuzda bekler; hoca uygun gördüğü boşluğa bırakır |

Esnek öğrencilere haftalık hedef ders sayısı verilebilir; havuzda
"1/2 yerleşti" şeklinde takip edilir.

## Neler yapabilir

- **Takvim** — Gün / 3 Gün / Hafta görünümü. Kartlar sürükle-bırak ile başka
  güne veya saate taşınır. Çakışan dersler yan yana şeritlere ayrılır, kapasite
  aşılırsa kart kırmızı çerçeveyle uyarır. Gün başlıklarında doluluk çubuğu var.
- **Yoklama** — Gün sonunda tek ekranda o günün tüm derslerine tek dokunuşla
  durum atanır; "kalan herkes geldi" toplu düğmesi vardır.
- **Rapor** — Bu hafta / bu ay / geçen ay / son 90 gün / özel aralık. Öğrenci
  bazında geldi–gelmedi–iptal sayıları ve katılım oranı, saat yoğunluğu ısı
  haritası, aralıkta hiç gelmeyenler listesi, CSV dışa aktarma.
- **Çalışma saatleri** — Her gün için ayrı açılış/kapanış; kapalı günler
  taranmış görünür ve oraya ders bırakılamaz. Satır aralığı (30/45/60 dk),
  varsayılan ders süresi ve aynı saatteki kişi kapasitesi ayarlanabilir.
- **Yedekleme** — JSON olarak indir / geri yükle.

Öğrenciler uygulamayı **görmez**. Bu ilk sürüm tamamen hocaya aittir; öğrenci
tarafı ileriki bir faza bırakılmıştır.

## Kurulum

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi (dist/)
npm run preview    # derlenmiş hâli yerelde çalıştır
npm test           # birim testleri
```

### Yayına alma

`npm run build` çıktısı `dist/` klasöründeki statik dosyalardır. Arka uç,
veritabanı ya da çalışan bir süreç gerektirmez.

**Kendi VPS'inize kurmak için:** adım adım anlatım [`deploy/README.md`](deploy/README.md)
içinde. Özet:

```bash
# sunucuda bir kerelik: nginx + alan adı + certbot (bkz. deploy/README.md)
# sonra her yayında, kendi bilgisayarınızdan:
VPS_HOST=program.alanadiniz.com ./deploy/deploy.sh
```

Betik derler, testleri koşar, dosyaları kopyalar ve yayını atomik olarak
değiştirir; eski sürümler geri alınabilsin diye sunucuda kalır.

Alternatif olarak Netlify, Vercel, Cloudflare Pages ya da GitHub Pages'e de
yüklenebilir — `vite.config.ts` içinde `base: './'` olduğu için alt dizinde de
sorunsuz çalışır.

Telefona kurulum: siteyi **HTTPS** üzerinden açın →
iOS'ta Safari "Paylaş → Ana Ekrana Ekle", Android'de Chrome "Uygulamayı yükle".
HTTPS olmadan ana ekrana ekleme ve çevrimdışı çalışma devreye girmez.

### İkonlar

`public/icon-*.png` dosyaları `scripts/make-icons.mjs` ile üretilir (harici
bağımlılık yok, saf Node):

```bash
node scripts/make-icons.mjs
```

## Veri nerede duruyor

Tüm veri **cihazın kendi tarayıcısında** (IndexedDB) saklanır. Sunucu, hesap ya
da abonelik yok; çevrimdışı çalışır.

> **Önemli:** Veri tek cihazdadır. Telefon değiştirmeden veya tarayıcı verilerini
> temizlemeden önce Ayarlar → Yedek indir ile yedek alın. Birden fazla cihazdan
> aynı programa erişim ileriki fazın konusudur (aşağıya bakın).

## Mimari

```
src/
  domain/     Saf iş mantığı — takvim motoru, istatistik, zaman yardımcıları (testler burada)
  db/         Dexie şeması + repo katmanı (UI'nin konuştuğu tek veri kapısı)
  components/ Takvim ızgarası, kartlar, bekleme şeridi, paneller
  pages/      Takvim / Öğrenciler / Rapor / Ayarlar
  ui/         Tasarım sistemi ilkelleri
```

### Tekrar kuralı + istisna modeli

Öğrencinin haftalık kuralları her hafta için **sanal** ders üretir; bu dersler
veritabanında yoktur. Hoca bir derse dokunduğu anda (sürükleme, yoklama, not)
kayıt gerçeğe dönüşür. Bunun iki sonucu var:

1. Öğrencinin programı değiştiğinde **gelecek haftalar kendiliğinden** güncellenir.
2. **Geçmiş haftalar** dokunulmuş kayıtlarla olduğu gibi kalır — rapor bozulmaz.

Bir ders başka güne taşındığında `date` değişir ama `originDate` sabit kalır;
böylece o haftanın kuralı "karşılandı" sayılır ve aynı ders ikinci kez üretilmez.

Kuraldan doğan bir ders silinemez (silinse kural onu yeniden üretirdi); onun
yerine "hoca iptal etti" olarak işaretlenir — hem takvimden çıkar hem raporda iz
bırakır.

### Katılım oranı nasıl hesaplanır

```
katılım = geldi / (geldi + gelmedi + öğrenci iptali)
```

Hocanın iptal ettiği dersler paydaya girmez — öğrenciyi cezalandırmamalı.
Geçmişte kalıp hiç işaretlenmemiş dersler ayrı bir "işaretsiz" sütununda
gösterilir ve orana dahil edilmez, böylece yüzde yanlış okunmaz.

## Sonraki fazlar

Aşağıdakiler bilinçli olarak bu sürümün dışında bırakıldı:

1. **Bulut senkron + çoklu cihaz** — Veri katmanı (`src/db/repo.ts`) tek kapı
   olarak soyutlandığı için ekleme işi katmanlıdır, yeniden yazım değildir.
2. **Öğrenci tarafı** — Öğrenci uygulamadan talep gönderir; talep **hoca
   onaylayana kadar kimse tarafından görülmez**, onaylanınca takvime düşer.
3. **Paket / ödeme takibi** — "10 derslik paket, 6'sı kullanıldı", ödeme
   hatırlatmaları, aylık gelir raporu.
4. **Bildirimler** — Derse birkaç saat kala hatırlatma, iptal edilince hocaya haber.
5. **Bekleme listesi** — Bir ders iptal olunca boşalan saati esnek havuzdaki
   uygun öğrencilere önerme.
6. **Grup dersleri** — Kapasite altyapısı hazır; üstüne katılımcı listesi ve
   grup bazlı rapor eklenebilir.
7. **Takvim dışa aktarma** — Programı iOS/Google Takvim'e (.ics) aktarma.
8. **Öğrenci gelişim notları** — Seviye, sakatlık ve ölçüm geçmişi.
