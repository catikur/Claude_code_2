import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error — saf JS eklenti, tip bildirimi yok
import { singleFile } from './scripts/vite-single-file.mjs'

/**
 * Tek dosyalık deneme derlemesi: `npm run build:demo` -> dist-demo/demo.html
 *
 * Kurulum, sunucu veya internet gerektirmez; dosyayı çift tıklayıp açmak ya da
 * birine göndermek yeterli. Üretim derlemesi (vite.config.ts) bundan ayrıdır -
 * orada servis çalışanı ve içerik özetli dosya adları önbellek için gerekli.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), singleFile()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    // Tek dosyada ön yükleme diye bir şey yok; açık bırakılırsa Vite dinamik
    // import'ları __vitePreload sarmalayıcısına alıyor ve tek dosya çıktısında
    // çözülmeyen bir __VITE_PRELOAD__ yer tutucusu kalıyor.
    modulePreload: false,
    // Görseller ve yazı tipleri de HTML'in içine gömülsün.
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'demo.html',
      output: { inlineDynamicImports: true },
    },
  },
})
