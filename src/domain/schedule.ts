import type { ScheduledItem, Session, Student, Settings, Weekday } from './types.ts'
import { OCCUPYING_STATUSES } from './types.ts'
import { overlaps, weekdayOf } from './time.ts'

/**
 * Tekrar kurali + istisna modeli.
 *
 * Ogrencinin haftalik kurallari her hafta icin "sanal" ders uretir. Sanal ders
 * DB'de yoktur; hoca ona dokundugu anda (surukleme / durum / not) gercek kayda
 * donusur. Bunun iki faydasi var:
 *
 *   1. Kural degistiginde gelecek haftalar kendiliginden guncellenir.
 *   2. Gecmis haftalar dokunulmus kayitlarla oldugu gibi kalir - rapor bozulmaz.
 *
 * Bir ders baska gune surukleninc `date` degisir, `originDate` sabit kalir;
 * boylece o haftanin kurali "karsilandi" sayilir ve kopya uretilmez.
 */

export function virtualKey(studentId: string, ruleId: string, originDate: string): string {
  return `virtual:${studentId}:${ruleId}:${originDate}`
}

/** Kuraldan dogmus bir kaydin hangi kural-tekrarini karsiladigini verir. */
function occurrenceKey(s: Session): string | null {
  if (s.source !== 'rule' || !s.ruleId) return null
  return `${s.studentId}:${s.ruleId}:${s.originDate ?? s.date}`
}

/**
 * Verilen gun araligi icin izgarada gosterilecek tum dersleri uretir:
 * DB'deki gercek kayitlar + kurallardan dogan sanal kayitlar.
 */
export function buildItems(
  students: Student[],
  sessions: Session[],
  dayKeys: string[],
): ScheduledItem[] {
  const studentById = new Map(students.map((s) => [s.id, s]))
  const dayset = new Set(dayKeys)
  const items: ScheduledItem[] = []
  const covered = new Set<string>()

  for (const session of sessions) {
    const student = studentById.get(session.studentId)
    if (!student) continue // ogrenci silinmis; yetim kayit gosterilmez

    const occ = occurrenceKey(session)
    // Ders araligin disina tasinmis olsa bile kural-tekrari karsilanmistir.
    if (occ) covered.add(occ)
    if (!dayset.has(session.date)) continue

    items.push({ key: session.id, session, student, virtual: false })
  }

  const now = Date.now()
  for (const student of students) {
    if (!student.active) continue
    for (const dateKey of dayKeys) {
      const wd = weekdayOf(dateKey)
      for (const rule of student.rules) {
        if (rule.weekday !== wd) continue
        const occ = `${student.id}:${rule.id}:${dateKey}`
        if (covered.has(occ)) continue
        covered.add(occ)
        const key = virtualKey(student.id, rule.id, dateKey)
        items.push({
          key,
          virtual: true,
          student,
          session: {
            id: key,
            studentId: student.id,
            date: dateKey,
            startMin: rule.startMin,
            durationMin: rule.durationMin,
            status: 'planned',
            source: 'rule',
            ruleId: rule.id,
            originDate: dateKey,
            createdAt: now,
            updatedAt: now,
          },
        })
      }
    }
  }

  return items
}

/** Saati atanmis dersler (izgaraya yerlesenler). */
export function placedItems(items: ScheduledItem[]): ScheduledItem[] {
  return items.filter((i) => i.session.startMin !== null)
}

/** Saati atanmamis dersler - o gunun bekleme havuzu. */
export function pendingItems(items: ScheduledItem[]): ScheduledItem[] {
  return items.filter((i) => i.session.startMin === null)
}

export interface FloatingPoolEntry {
  student: Student
  /** Bu hafta izgaraya yerlestirilmis ders sayisi. */
  placed: number
  /** Ogrencinin haftalik hedefi (tanimliysa). */
  target?: number
}

/**
 * Tamamen esnek ogrencilerin haftalik havuzu. Hoca buradan bosluklara suruklur.
 * `placed` sayaci "Ali icin 2 dersten 1'ini koydum" takibini mumkun kilar.
 */
export function floatingPool(students: Student[], items: ScheduledItem[]): FloatingPoolEntry[] {
  const placedCount = new Map<string, number>()
  for (const item of items) {
    if (item.session.startMin === null) continue
    if (!OCCUPYING_STATUSES.includes(item.session.status)) continue
    placedCount.set(item.session.studentId, (placedCount.get(item.session.studentId) ?? 0) + 1)
  }
  return students
    .filter((s) => s.active && s.planType === 'floating')
    .map((s) => ({ student: s, placed: placedCount.get(s.id) ?? 0, target: s.weeklyTarget }))
    .sort((a, b) => {
      const ra = remaining(a)
      const rb = remaining(b)
      if (ra !== rb) return rb - ra // eksigi cok olan once
      return a.student.name.localeCompare(b.student.name, 'tr')
    })
}

function remaining(e: FloatingPoolEntry): number {
  return e.target === undefined ? 0 : e.target - e.placed
}

/** Bir gunun calisma saatleri; gun kapaliysa null. */
export function hoursFor(settings: Settings, weekday: Weekday) {
  const h = settings.weekdayHours[weekday]
  return h && h.open ? h : null
}

export interface Conflict {
  /** Ayni slotta cakisan dersler (kapasite asimi). */
  a: ScheduledItem
  b: ScheduledItem
}

/**
 * Ayni gun icinde kapasiteyi asan cakismalari bulur.
 * Kapasite 1 ise her ust uste binme bir cakismadir; 3 ise ancak 4. ders sorundur.
 */
export function findConflicts(items: ScheduledItem[], capacity: number): Conflict[] {
  const byDate = new Map<string, ScheduledItem[]>()
  for (const item of items) {
    if (item.session.startMin === null) continue
    if (!OCCUPYING_STATUSES.includes(item.session.status)) continue
    const list = byDate.get(item.session.date) ?? []
    list.push(item)
    byDate.set(item.session.date, list)
  }

  const conflicts: Conflict[] = []
  for (const list of byDate.values()) {
    list.sort((x, y) => (x.session.startMin ?? 0) - (y.session.startMin ?? 0))
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      let overlapping = 0
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue
        const b = list[j]
        if (
          overlaps(
            a.session.startMin!,
            a.session.durationMin,
            b.session.startMin!,
            b.session.durationMin,
          )
        ) {
          overlapping++
          if (overlapping >= capacity && j > i) conflicts.push({ a, b })
        }
      }
    }
  }
  return conflicts
}

/** Bir slota (gun + saat) dusen dersler. */
export function itemsInSlot(
  items: ScheduledItem[],
  dateKey: string,
  slotStart: number,
  slotMin: number,
): ScheduledItem[] {
  return items.filter((i) => {
    const s = i.session
    if (s.date !== dateKey || s.startMin === null) return false
    return overlaps(s.startMin, s.durationMin, slotStart, slotMin)
  })
}

/** Dersin izgarada basladigi satir bu mu (kart yalnizca bir kez cizilsin). */
export function startsInSlot(item: ScheduledItem, slotStart: number, slotMin: number): boolean {
  const s = item.session.startMin
  if (s === null) return false
  return s >= slotStart && s < slotStart + slotMin
}

/**
 * Bir gunun doluluk orani: dolu slot / acik slot.
 * Iptal edilmis dersler slotu bosaltir, bu yuzden doluluga dahil edilmez.
 */
export function utilization(
  items: ScheduledItem[],
  dateKey: string,
  hours: { startMin: number; endMin: number } | null,
  slotMin: number,
  capacity: number,
): { used: number; total: number; ratio: number } {
  if (!hours) return { used: 0, total: 0, ratio: 0 }
  const slots = Math.max(0, Math.floor((hours.endMin - hours.startMin) / slotMin))
  const total = slots * capacity
  let used = 0
  for (const item of items) {
    const s = item.session
    if (s.date !== dateKey || s.startMin === null) continue
    if (!OCCUPYING_STATUSES.includes(s.status)) continue
    used += Math.max(1, Math.round(s.durationMin / slotMin))
  }
  return { used, total, ratio: total === 0 ? 0 : used / total }
}
