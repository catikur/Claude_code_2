// DİKKAT: Bu import ilk sırada kalmalı. Depolamayı Dexie örneği kurulmadan
// önce hazırlar; aşağıdaki hiçbir import'un üstüne çıkmamalı.
import { persistent } from './demo-storage.ts'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { db } from './db/db.ts'
import { ensureSettings } from './db/repo.ts'
import { loadDemoData } from './db/seed.ts'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import './index.css'

/**
 * Tek dosyalık deneme sürümünün giriş noktası.
 *
 * Üretim girişinden (main.tsx) farkları:
 *  1. Servis çalışanı kaydı yok — tek dosya olarak açıldığında sw.js zaten yok.
 *  2. IndexedDB kapalıysa bellek içi bir uygulamaya düşer (demo-storage.ts).
 *  3. Boş ekranla açılmasın diye örnek kadro ve geçmiş kendiliğinden yüklenir.
 */

function DemoNotice() {
  return (
    <div className="border-ink-800 bg-ink-950 text-ink-400 shrink-0 border-b px-3 py-1.5 text-[11px] leading-snug">
      <strong className="text-ink-200">Deneme sürümü</strong> — örnek öğrencilerle
      dolu.{' '}
      {persistent
        ? 'Değişiklikler bu tarayıcıda saklanır.'
        : 'Bu ortamda kalıcı depolama kapalı; sayfayı yenilerseniz her şey başa döner.'}
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('#root bulunamadı')

async function bootstrap() {
  await ensureSettings()
  if ((await db.students.count()) === 0) {
    await loadDemoData()
  }

  createRoot(root!).render(
    <StrictMode>
      <ErrorBoundary>
        <div className="flex h-full flex-col overflow-hidden">
          <DemoNotice />
          <div className="flex min-h-0 flex-1 flex-col">
            <App />
          </div>
        </div>
      </ErrorBoundary>
    </StrictMode>,
  )
}

bootstrap().catch((err) => {
  console.error('Demo açılamadı:', err)
  root.innerHTML =
    '<div style="padding:2rem;font:14px system-ui;color:#dbe3ec">Demo açılamadı. Tarayıcı konsoluna bakın.</div>'
})
