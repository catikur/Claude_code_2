/**
 * PWA ikonlarini uretir (public/icon-*.png).
 *
 * Ortamda ImageMagick/sharp yok; bu yuzden sekiller isaretli mesafe fonksiyonu
 * (SDF) ile piksel piksel cizilip elle PNG olarak kodlanir. Tek bagimlilik
 * Node'un yerlesik zlib'i.
 *
 * Kullanim: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// ------------------------------------------------------------------ PNG

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** RGBA piksel dizisini PNG dosyasina cevirir. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit derinligi
  ihdr[9] = 6 // renk tipi: RGBA
  // 10-12: sikistirma / filtre / interlace = 0

  // Her satirin basina filtre baytI (0 = filtre yok).
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------ SDF

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

function sdRoundedRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r)
  const qy = Math.abs(py - cy) - (halfH - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r

const union = (...d) => Math.min(...d)

/** Kenar yumusatma: mesafeyi 0..1 kapsama oranina cevirir. */
const coverage = (d, px) => clamp01(0.5 - d / px)

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// ----------------------------------------------------------------- Ikon

const BG_TOP = [21, 29, 39] // ink-800
const BG_BOTTOM = [11, 15, 20] // ink-900
const GLOVE = [240, 81, 43] // accent
const GLOVE_DARK = [176, 48, 20]

/**
 * Boks eldiveni silueti. Yumruk ve basparmak tek parca, bilek mansetI ayri;
 * aralarindaki ince bosluk mansetI ayirir - ustune cizgi cizmeye gerek kalmaz.
 * Koordinatlar 0..1 normalize; boylece her boyutta ayni gorunur.
 */
function fistDistance(x, y) {
  const body = sdRoundedRect(x, y, 0.55, 0.395, 0.215, 0.2, 0.175)
  const thumb = sdCircle(x, y, 0.36, 0.48, 0.115)
  return union(body, thumb)
}

function cuffDistance(x, y) {
  return sdRoundedRect(x, y, 0.5, 0.715, 0.17, 0.1, 0.05)
}

function gloveDistance(x, y) {
  return union(fistDistance(x, y), cuffDistance(x, y))
}

function renderIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const px = 1 / size // bir pikselin normalize genisligi

  // Maskeli ikonlarda kenarlar kirpilabilir; icerigi guvenli alana kucult.
  const scale = maskable ? 0.72 : 1
  const bgRadius = maskable ? 0.5 : 0.235

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size
      const ny = (y + 0.5) / size

      const bg = mix(BG_TOP, BG_BOTTOM, ny)
      const bgD = sdRoundedRect(nx, ny, 0.5, 0.5, 0.5, 0.5, bgRadius)
      const bgA = coverage(bgD, px)

      // Icerigi merkezden olceklendir.
      const sx = (nx - 0.5) / scale + 0.5
      const sy = (ny - 0.5) / scale + 0.5

      const gD = gloveDistance(sx, sy)
      const gA = coverage(gD, px / scale)

      // Ust taraf acik, alt taraf koyu: hafif hacim hissi.
      const gloveColor = mix(GLOVE, GLOVE_DARK, clamp01((sy - 0.22) / 0.58))
      const color = mix(bg, gloveColor, gA)

      const i = (y * size + x) * 4
      rgba[i] = Math.round(color[0])
      rgba[i + 1] = Math.round(color[1])
      rgba[i + 2] = Math.round(color[2])
      rgba[i + 3] = Math.round(255 * bgA)
    }
  }

  return encodePng(size, size, rgba)
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
]

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, opts))
  console.log(`yazildi: public/${name} (${size}x${size})`)
}
