# VPS'e kurulum

Uygulama derlendiğinde ortaya sadece statik dosyalar çıkar (`dist/`). Veritabanı,
arka uç servisi ya da çalışan bir Node süreci **yok** — veri kullanıcının kendi
cihazında duruyor. Dolayısıyla VPS'in tek işi bu dosyaları HTTPS üzerinden
sunmak.

İki yol var. Hostinger'da düz bir Ubuntu VPS'iniz varsa **A yolu** en kısası.

---

## Önce: alan adı ve HTTPS

PWA'nın telefona "uygulama" olarak kurulabilmesi ve çevrimdışı çalışması için
**HTTPS zorunludur**. Düz IP üzerinden (`http://1.2.3.4`) açılırsa uygulama
çalışır ama ana ekrana eklenemez ve servis çalışanı devreye girmez.

1. Alan adınızın (veya bir alt alan adının, örn. `program.alanadiniz.com`) `A`
   kaydını VPS'in IP adresine yöneltin.
2. DNS yayılana kadar bekleyin (`dig +short program.alanadiniz.com` IP'yi
   göstermeli).

---

## A yolu — nginx (önerilen)

### 1. Sunucuyu hazırlayın

VPS'e SSH ile bağlanıp:

```bash
sudo apt update
sudo apt install -y nginx rsync
sudo mkdir -p /var/www/muay-thai/releases
```

### 2. nginx yapılandırmasını koyun

İki dosya kopyalanır: sunucu bloğu ve güvenlik başlıkları parçacığı.

```bash
# yerelden:
scp deploy/nginx.conf         root@SUNUCU_IP:/etc/nginx/sites-available/muay-thai
scp deploy/nginx-headers.conf root@SUNUCU_IP:/etc/nginx/snippets/muay-thai-headers.conf

# sunucuda:
sudo nano /etc/nginx/sites-available/muay-thai     # server_name satırını düzenleyin
sudo ln -sf /etc/nginx/sites-available/muay-thai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

> `/etc/nginx/snippets/` yoksa önce `sudo mkdir -p /etc/nginx/snippets` deyin.

### 3. HTTPS sertifikası alın

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d program.alanadiniz.com
```

Certbot yapılandırmayı kendisi düzenler ve yenilemeyi otomatiğe bağlar.

### 4. Yayınlayın

Kendi bilgisayarınızda, depo klasöründe:

```bash
VPS_HOST=program.alanadiniz.com ./deploy/deploy.sh
```

Betik sırasıyla: bağımlılıkları kurar → testleri çalıştırır → derler →
sunucuya kopyalar → yayını **atomik olarak** değiştirir. Yeni sürüm tamamen
yüklenmeden yayına geçmez, yani kullanıcı hiçbir an yarım siteye denk gelmez.

Ayarlanabilir değişkenler:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `VPS_HOST` | — | **Zorunlu.** Sunucu adresi |
| `VPS_USER` | `root` | SSH kullanıcısı |
| `VPS_PORT` | `22` | SSH portu |
| `DEPLOY_PATH` | `/var/www/muay-thai` | Hedef dizin |
| `KEEP` | `5` | Saklanacak eski sürüm sayısı |
| `SKIP_BUILD` | `0` | `1` ise mevcut `dist/` yüklenir |

---

## B yolu — Docker

VPS'inizde Docker kuruluysa:

```bash
git clone https://github.com/catikur/Claude_code_2.git
cd Claude_code_2
docker compose -f deploy/docker-compose.yml up -d --build
```

Uygulama `127.0.0.1:8080` üzerinde yayınlanır — yalnız yerel arayüze bağlanır,
doğrudan internete açılmaz. Önüne bir ters vekil koyup HTTPS'i orada bitirin
(Nginx Proxy Manager, Caddy veya Traefik). Caddy ile en kısası:

```
program.alanadiniz.com {
    reverse_proxy 127.0.0.1:8080
}
```

Güncelleme:

```bash
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

---

## Güncelleme ve geri alma

**Güncelleme (A yolu):** Kod değiştikten sonra tekrar `./deploy/deploy.sh`.
Tarayıcı yeni sürümü kendiliğinden alır — servis çalışanı `autoUpdate` modunda.
Kullanıcı bir kez sayfayı kapatıp açtığında yeni sürüm devrededir.

**Geri alma:** Sunucuda eski sürümler `releases/` altında duruyor:

```bash
cd /var/www/muay-thai
ls releases/                       # mevcut sürümler
ln -sfn releases/20260804-101500 current.tmp && mv -T current.tmp current
```

---

## Erişim ve gizlilik

Uygulamanın giriş ekranı yok, ama **veri sunucuda tutulmuyor**: her tarayıcı
kendi yerel veritabanını görür. Yani adresi bilen biri siteyi açsa bile hocanın
öğrenci listesini göremez — bomboş bir uygulama görür.

Yine de adresi tamamen kapatmak isterseniz nginx'e basit parola koyabilirsiniz:

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd hoca
```

Ardından `deploy/nginx.conf` içindeki `location / { ... }` bloğuna ekleyin:

```nginx
auth_basic "Muay Thai Program";
auth_basic_user_file /etc/nginx/.htpasswd;
```

> Not: Tarayıcı parolası isteyen sayfalar bazı telefonlarda ana ekrana
> eklendikten sonra her açılışta parola sorar. Kullanım rahatlığı için genelde
> gerek yoktur.

---

## Yedekleme hatırlatması

Veri sunucuda değil, hocanın telefonunda/tarayıcısında. Sunucuyu yedeklemek
veriyi yedeklemez. Düzenli olarak uygulama içinden **Ayarlar → Yedek indir**
yapılmalı ve bu JSON dosyası güvenli bir yere konmalı.

---

## Sorun giderme

| Belirti | Sebep / çözüm |
| --- | --- |
| "Ana ekrana ekle" çıkmıyor | Site HTTPS değil, ya da sertifika geçersiz. `certbot` adımını tekrarlayın. |
| Güncelleme kullanıcıya ulaşmıyor | `index.html` veya `sw.js` önbelleklenmiş. `deploy/nginx.conf` içindeki `no-cache` blokları duruyor mu kontrol edin. |
| Sayfa boş açılıyor | Tarayıcı konsoluna bakın. Alt dizinde sunuyorsanız `vite.config.ts` içindeki `base: './'` ayarı zaten göreli yol kullanır, sorun genelde eksik dosyadır — `dist/` tam kopyalanmış mı bakın. |
| `deploy.sh` "Permission denied" | SSH anahtarınız sunucuda yetkili değil: `ssh-copy-id root@SUNUCU_IP`. |
| nginx 403 veriyor | `current` symlink'i yok ya da kırık: `ls -l /var/www/muay-thai/`. |
