import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App.tsx'
import { ensureSettings } from './db/repo.ts'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import './index.css'

// Yeni sürüm yayımlandığında sessizce güncellenir; çevrimdışı açılış korunur.
registerSW({ immediate: true })

// Ayar satırını açılışta bir kez oluşturur. Canlı sorgular salt-okunur bir
// işlemde çalıştığı için bu yazma işi oradan yapılamaz.
void ensureSettings()

const root = document.getElementById('root')
if (!root) throw new Error('#root bulunamadı')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
