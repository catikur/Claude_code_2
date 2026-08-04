import type { ScheduledItem } from './types.ts'
import { overlaps } from './time.ts'

export interface LaidOutItem {
  item: ScheduledItem
  /** Kartin kacinci serit (sutun) oldugunu belirtir. */
  lane: number
  /** Bu kartin ait oldugu cakisma kumesindeki toplam serit sayisi. */
  lanes: number
}

/**
 * Cakisan dersleri yan yana seritlere dagitir; boylece ayni saatte iki ogrenci
 * varsa iki kart da gorunur, biri digerinin altinda kaybolmaz.
 *
 * Once cakisan dersler bir kumeye toplanir, kume icinde her karta bos bir serit
 * atanir, kumedeki en genis serit sayisi kumenin tamamina uygulanir - boylece
 * ayni kumedeki kartlar esit genislikte olur.
 */
export function layoutDay(items: ScheduledItem[]): LaidOutItem[] {
  const placed = items
    .filter((i) => i.session.startMin !== null)
    .sort((a, b) => {
      const d = a.session.startMin! - b.session.startMin!
      if (d !== 0) return d
      // Esit baslangicta uzun ders solda dursun; kisa olan ustune binmesin.
      const dd = b.session.durationMin - a.session.durationMin
      if (dd !== 0) return dd
      return a.student.name.localeCompare(b.student.name, 'tr')
    })

  const out: LaidOutItem[] = []
  let cluster: ScheduledItem[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const laneEnds: number[] = []
    const assigned: Array<{ item: ScheduledItem; lane: number }> = []
    for (const it of cluster) {
      const start = it.session.startMin!
      let lane = laneEnds.findIndex((end) => end <= start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[lane] = start + it.session.durationMin
      assigned.push({ item: it, lane })
    }
    const lanes = laneEnds.length
    for (const a of assigned) out.push({ ...a, lanes })
    cluster = []
    clusterEnd = -1
  }

  for (const it of placed) {
    const start = it.session.startMin!
    const end = start + it.session.durationMin
    if (cluster.length > 0 && start >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()

  return out
}

/** Bir dersin baska bir derse degip degmedigi (kapasite uyarisi icin). */
export function collidesWithAny(
  candidate: { startMin: number; durationMin: number },
  others: ScheduledItem[],
): ScheduledItem[] {
  return others.filter((o) => {
    if (o.session.startMin === null) return false
    return overlaps(
      candidate.startMin,
      candidate.durationMin,
      o.session.startMin,
      o.session.durationMin,
    )
  })
}
