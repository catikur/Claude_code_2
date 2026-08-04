/**
 * Tüm JS ve CSS'i tek bir HTML dosyasına gömen Vite eklentisi.
 *
 * Demo derlemesi için: uygulamayı kurulum gerektirmeden, tek dosya olarak
 * paylaşabilmek üzere. Üretim derlemesi bunu kullanmaz — orada ayrı dosyalar
 * ve içerik özetli adlar önbellekleme için gerekli.
 */

function escapeForScript(code) {
  // </script> dizisi HTML ayrıştırıcısını erken kapatır; kaçırmak şart.
  return code.replaceAll('</script>', '<\\/script>')
}

export function singleFile() {
  return {
    name: 'single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlEntries = Object.values(bundle).filter(
        (f) => f.type === 'asset' && f.fileName.endsWith('.html'),
      )
      if (htmlEntries.length === 0) return

      const js = []
      const css = []
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.fileName.endsWith('.js')) {
          js.push(file.code)
          delete bundle[name]
        } else if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          css.push(String(file.source))
          delete bundle[name]
        }
      }

      for (const html of htmlEntries) {
        let out = String(html.source)
        // Derlenmiş varlıklara giden etiketleri sök, yerine gömülü hâllerini koy.
        out = out.replace(/<script[^>]*\ssrc="[^"]*"[^>]*><\/script>/g, '')
        out = out.replace(/<link[^>]*\srel="stylesheet"[^>]*>/g, '')
        out = out.replace(/<link[^>]*\srel="modulepreload"[^>]*>/g, '')

        const style = css.length ? `<style>${css.join('\n')}</style>` : ''
        const script = js.length
          ? `<script type="module">${escapeForScript(js.join('\n'))}</script>`
          : ''

        // Değiştirme metni DEĞİL fonksiyon veriliyor. Metin verilseydi içindeki
        // `$&`, `$'` gibi diziler özel değiştirme deseni sayılırdı; minify
        // edilmiş JS bunlardan bolca içeriyor ve çıktı sessizce bozuluyor.
        out = out.replace('</head>', () => `${style}</head>`)
        out = out.replace('</body>', () => `${script}</body>`)
        html.source = out
      }
    },
  }
}
