import type { Weekday } from './types.ts'

/** 1110 -> "18:30" */
export function minToLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "18:30" -> 1110. Gecersiz girdide null. */
export function labelToMin(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null
  return h * 60 + mm
}

/** 90 -> "1s 30dk", 60 -> "1s", 45 -> "45dk" */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}dk`
  if (m === 0) return `${h}s`
  return `${h}s ${m}dk`
}

/** Yerel takvim gununu 'YYYY-MM-DD' olarak verir (UTC kaymasi yok). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM-DD' -> yerel saat diliminde gun basi Date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** ISO hafta gunu: 1 = Pazartesi ... 7 = Pazar. */
export function weekdayOf(key: string): Weekday {
  const js = fromDateKey(key).getDay() // 0 = Pazar
  return (js === 0 ? 7 : js) as Weekday
}

/** Verilen gunun icinde bulundugu haftanin Pazartesi'si. */
export function startOfWeek(key: string): string {
  return addDays(key, -(weekdayOf(key) - 1))
}

/** Pazartesi'den Pazar'a 7 gun anahtari. */
export function weekDays(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayKey, i))
}

export function todayKey(): string {
  return toDateKey(new Date())
}

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

/** '2026-08-04' -> '4 Ağustos' */
export function formatDayMonth(key: string): string {
  const d = fromDateKey(key)
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`
}

/** '2026-08-04' -> '4 Ağustos 2026' */
export function formatFullDate(key: string): string {
  const d = fromDateKey(key)
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Hafta basligi: '4 – 10 Ağustos 2026' */
export function formatWeekRange(mondayKey: string): string {
  const start = fromDateKey(mondayKey)
  const end = fromDateKey(addDays(mondayKey, 6))
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameMonth && sameYear) {
    return `${start.getDate()} – ${end.getDate()} ${TR_MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }
  if (sameYear) {
    return `${start.getDate()} ${TR_MONTHS[start.getMonth()]} – ${end.getDate()} ${TR_MONTHS[end.getMonth()]} ${end.getFullYear()}`
  }
  return `${formatFullDate(mondayKey)} – ${formatFullDate(addDays(mondayKey, 6))}`
}

/** Ayin ilk gunu. */
export function startOfMonth(key: string): string {
  const d = fromDateKey(key)
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Ayin son gunu. */
export function endOfMonth(key: string): string {
  const d = fromDateKey(key)
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** [a, b] araligindaki tum gun anahtarlari (dahil). */
export function daysBetween(a: string, b: string): string[] {
  const out: string[] = []
  let cur = a
  // Guvenlik siniri: 5 yildan uzun aralik istenmez.
  for (let i = 0; cur <= b && i < 2000; i++) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** Iki zaman araligi cakisiyor mu. */
export function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur
}

/** Izgara satir baslangiclari: [startMin, startMin+slot, ...) endMin'e kadar. */
export function slotStarts(startMin: number, endMin: number, slotMin: number): number[] {
  const out: number[] = []
  for (let t = startMin; t + slotMin <= endMin; t += slotMin) out.push(t)
  return out
}
