# Muay Thai Program — konteyner imajı (nginx'i doğrudan kurmak istemeyenler için)
#
# Derleme:  docker build -f deploy/Dockerfile -t muay-thai .
# Çalıştır: docker run -d -p 8080:80 --restart unless-stopped --name muay-thai muay-thai
#
# Bu imaj yalnız statik dosya sunar. HTTPS'i önüne koyacağınız ters vekil
# (Nginx Proxy Manager, Caddy, Traefik) üstlenir — bkz. deploy/README.md.

# ---- 1. aşama: derleme ----
FROM node:22-alpine AS build

WORKDIR /app

# Önce yalnız manifestler kopyalanır; kaynak değişince bağımlılık katmanı
# yeniden kurulmasın diye.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- 2. aşama: sunum ----
FROM nginx:1.27-alpine

# Konteyner içi nginx yapılandırması (dışarıdaki sunucu bloğundan farklı:
# burada sunucu adı ve TLS yok, onları ters vekil hallediyor).
COPY deploy/nginx-headers.conf /etc/nginx/snippets/muay-thai-headers.conf
COPY deploy/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/index.html >/dev/null || exit 1
