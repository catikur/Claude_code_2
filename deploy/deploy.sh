#!/usr/bin/env bash
#
# Muay Thai Program — VPS'e yayınlama betiği.
#
# Yerelde derler, çıktıyı sunucuya kopyalar ve yayını atomik olarak değiştirir:
# yeni sürüm tam olarak yüklendikten SONRA symlink çevrilir, böylece kullanıcı
# hiçbir an yarım bir siteye denk gelmez.
#
# Kullanım:
#   VPS_HOST=1.2.3.4 ./deploy/deploy.sh
#
# Değişkenler (hepsinin makul varsayılanı var, yalnız VPS_HOST zorunlu):
#   VPS_HOST      Sunucu adresi veya alan adı            (zorunlu)
#   VPS_USER      SSH kullanıcısı                        (varsayılan: root)
#   VPS_PORT      SSH portu                              (varsayılan: 22)
#   DEPLOY_PATH   Sunucudaki hedef dizin                 (varsayılan: /var/www/muay-thai)
#   KEEP          Saklanacak eski sürüm sayısı           (varsayılan: 5)
#   SKIP_BUILD    1 ise derlemeyi atlar, mevcut dist/'i yükler

set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/muay-thai}"
KEEP="${KEEP:-5}"
SKIP_BUILD="${SKIP_BUILD:-0}"

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "HATA: VPS_HOST tanımlı değil." >&2
  echo "Örnek:  VPS_HOST=1.2.3.4 ./deploy/deploy.sh" >&2
  exit 1
fi

for cmd in ssh rsync npm; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "HATA: '$cmd' bulunamadı." >&2; exit 1; }
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE="$(date +%Y%m%d-%H%M%S)"
SSH_OPTS=(-p "$VPS_PORT")
TARGET="${VPS_USER}@${VPS_HOST}"

echo "==> Hedef: ${TARGET}:${DEPLOY_PATH} (sürüm ${RELEASE})"

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "==> Bağımlılıklar"
  npm ci --no-audit --no-fund

  echo "==> Testler"
  npm test

  echo "==> Derleme"
  npm run build
fi

if [[ ! -f dist/index.html ]]; then
  echo "HATA: dist/index.html yok. Önce 'npm run build' çalıştırın." >&2
  exit 1
fi

echo "==> Sunucuda dizinler hazırlanıyor"
ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '${DEPLOY_PATH}/releases/${RELEASE}'"

echo "==> Dosyalar kopyalanıyor"
rsync -az --delete \
  -e "ssh -p ${VPS_PORT}" \
  dist/ "${TARGET}:${DEPLOY_PATH}/releases/${RELEASE}/"

echo "==> Yayın değiştiriliyor"
# ln -sfn + mv: symlink'i tek adımda değiştirir, arada 'yok' anı olmaz.
ssh "${SSH_OPTS[@]}" "$TARGET" bash -s <<EOF
set -euo pipefail
cd '${DEPLOY_PATH}'
ln -sfn 'releases/${RELEASE}' current.tmp
mv -T current.tmp current
# Eski sürümleri buda; sadece son ${KEEP} tanesi kalsın.
ls -1dt releases/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
if command -v nginx >/dev/null 2>&1; then
  nginx -t >/dev/null 2>&1 && (systemctl reload nginx || service nginx reload) || true
fi
EOF

echo "==> Tamam. Yayındaki sürüm: ${RELEASE}"
echo "    Geri almak için sunucuda:"
echo "      cd ${DEPLOY_PATH} && ln -sfn releases/<eski-surum> current.tmp && mv -T current.tmp current"
