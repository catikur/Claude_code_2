import type { CSSProperties } from 'react'
import type { ColorKey, SessionStatus } from '../domain/types.ts'
import { COLOR_KEYS } from '../domain/types.ts'

export const COLOR_LABELS: Record<ColorKey, string> = {
  kirmizi: 'Kırmızı',
  turuncu: 'Turuncu',
  amber: 'Amber',
  yesil: 'Yeşil',
  turkuaz: 'Turkuaz',
  mavi: 'Mavi',
  indigo: 'İndigo',
  mor: 'Mor',
  pembe: 'Pembe',
  gri: 'Gri',
}

/** Kart zemini/kenari icin CSS degiskenlerine baglanan stil. */
export function cardStyle(color: ColorKey, opts?: { muted?: boolean }): CSSProperties {
  const rgb = `var(--c-${color})`
  return {
    // Koyu zemin uzerinde renk kimligi korunsun ama metin okunakli kalsin.
    background: opts?.muted
      ? `rgb(${rgb} / 0.07)`
      : `linear-gradient(180deg, rgb(${rgb} / 0.22), rgb(${rgb} / 0.13))`,
    borderColor: `rgb(${rgb} / ${opts?.muted ? 0.22 : 0.5})`,
    ['--dot' as string]: `rgb(${rgb})`,
  }
}

export function dotStyle(color: ColorKey): CSSProperties {
  return { background: `rgb(var(--c-${color}))` }
}

export function swatchStyle(color: ColorKey): CSSProperties {
  return { background: `rgb(var(--c-${color}))` }
}

/** Yeni ogrenciye paletten en az kullanilan rengi verir. */
export function suggestColor(used: ColorKey[]): ColorKey {
  const counts = new Map<ColorKey, number>(COLOR_KEYS.map((c) => [c, 0]))
  for (const c of used) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: ColorKey = COLOR_KEYS[0]
  let bestN = Infinity
  for (const c of COLOR_KEYS) {
    const n = counts.get(c) ?? 0
    if (n < bestN) {
      bestN = n
      best = c
    }
  }
  return best
}

export const STATUS_STYLES: Record<SessionStatus, { chip: string; label: string }> = {
  planned: { chip: 'bg-ink-600/60 text-ink-200', label: 'Planlı' },
  attended: { chip: 'bg-emerald-500/20 text-emerald-300', label: 'Geldi' },
  noshow: { chip: 'bg-amber-500/20 text-amber-300', label: 'Gelmedi' },
  cancelledByStudent: { chip: 'bg-rose-500/20 text-rose-300', label: 'İptal' },
  cancelledByCoach: { chip: 'bg-slate-500/25 text-slate-300', label: 'Hoca ipt.' },
}

/** Iptal edilmis dersler izgarada soluk gorunur. */
export function isDimmed(status: SessionStatus): boolean {
  return status === 'cancelledByStudent' || status === 'cancelledByCoach'
}
