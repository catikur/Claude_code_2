// Kök giriş kullanılıyor: paketin `./lib/*` alt yolları tip bildirimlerini
// package.json "exports" üzerinden sunmuyor, kök giriş sunuyor.
import { indexedDB as fakeIndexedDB, IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb'

/**
 * Demo derlemesi için depolama hazırlığı. YAN ETKİLİ modül: içe aktarılır
 * aktarılmaz çalışır.
 *
 * Neden ayrı bir modül: Dexie örneği `db.ts` yüklenirken kuruluyor ve o anda
 * global `indexedDB`'yi yakalıyor. Değiştirme işi ondan ÖNCE bitmiş olmalı.
 * ES modüllerinde değerlendirme sırası import bildirim sırasını izlediği için
 * bu dosya `demo.tsx` içinde db'den önce import edilerek garanti altına alınır.
 *
 * Neden statik import: dinamik import tek dosyalık çıktıda Vite'ın ön yükleme
 * sarmalayıcısını devreye sokuyor ve çözülmemiş bir yer tutucu bırakıyor.
 * fake-indexeddb her hâlükârda pakete giriyor ama yalnız gerektiğinde kuruluyor.
 */

function realIndexedDbUsable(): boolean {
  try {
    // Erişimin KENDİSİ korumalı çerçevelerde SecurityError fırlatır; asıl
    // yakalamak istediğimiz durum bu.
    const idb = globalThis.indexedDB
    return !!idb && typeof idb.open === 'function'
  } catch {
    return false
  }
}

/** Değişiklikler kalıcı mı, yoksa yalnız bellekte mi tutuluyor. */
export const persistent = realIndexedDbUsable()

if (!persistent) {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: fakeIndexedDB,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: FakeIDBKeyRange,
    configurable: true,
    writable: true,
  })
}
