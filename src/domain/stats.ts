import type { ScheduledItem, SessionStatus, Student, Weekday } from './types.ts'
import { OCCUPYING_STATUSES } from './types.ts'
import { todayKey, weekdayOf } from './time.ts'

export interface StudentStats {
  student: Student
  /** Aralikta bu ogrenci icin planlanmis toplam ders. */
  scheduled: number
  attended: number
  noshow: number
  cancelledByStudent: number
  cancelledByCoach: number
  /** Gecmiste kalmis ama yoklamasi isaretlenmemis dersler. */
  unmarked: number
  /** Henuz gelmemis planli dersler. */
  upcoming: number
  /**
   * Katilim orani = geldi / (geldi + gelmedi + ogrenci iptali).
   * Hocanin iptal ettigi dersler ogrenciyi cezalandirmasin diye paydaya girmez.
   * Payda 0 ise null (oran hesaplanamaz).
   */
  attendanceRate: number | null
  lastAttendedDate: string | null
}

export interface RangeSummary {
  attended: number
  noshow: number
  cancelledByStudent: number
  cancelledByCoach: number
  unmarked: number
  upcoming: number
  scheduled: number
  activeStudents: number
  attendanceRate: number | null
}

function emptyCounts() {
  return {
    scheduled: 0,
    attended: 0,
    noshow: 0,
    cancelledByStudent: 0,
    cancelledByCoach: 0,
    unmarked: 0,
    upcoming: 0,
  }
}

function bump(c: ReturnType<typeof emptyCounts>, status: SessionStatus, isPast: boolean) {
  c.scheduled++
  switch (status) {
    case 'attended':
      c.attended++
      break
    case 'noshow':
      c.noshow++
      break
    case 'cancelledByStudent':
      c.cancelledByStudent++
      break
    case 'cancelledByCoach':
      c.cancelledByCoach++
      break
    case 'planned':
      if (isPast) c.unmarked++
      else c.upcoming++
      break
  }
}

function rate(attended: number, noshow: number, cancelledByStudent: number): number | null {
  const denom = attended + noshow + cancelledByStudent
  return denom === 0 ? null : attended / denom
}

/** Ogrenci bazli rapor satirlari. Ismi bos gecmis ogrenciler de dahil edilir. */
export function studentStats(items: ScheduledItem[], students: Student[]): StudentStats[] {
  const today = todayKey()
  const counts = new Map<string, ReturnType<typeof emptyCounts>>()
  const lastAttended = new Map<string, string>()

  for (const item of items) {
    const { studentId, status, date } = item.session
    const c = counts.get(studentId) ?? emptyCounts()
    bump(c, status, date < today)
    counts.set(studentId, c)
    if (status === 'attended') {
      const prev = lastAttended.get(studentId)
      if (!prev || date > prev) lastAttended.set(studentId, date)
    }
  }

  return students
    .map((student) => {
      const c = counts.get(student.id) ?? emptyCounts()
      return {
        student,
        ...c,
        attendanceRate: rate(c.attended, c.noshow, c.cancelledByStudent),
        lastAttendedDate: lastAttended.get(student.id) ?? null,
      }
    })
    .sort((a, b) => {
      if (b.attended !== a.attended) return b.attended - a.attended
      return a.student.name.localeCompare(b.student.name, 'tr')
    })
}

export function rangeSummary(rows: StudentStats[]): RangeSummary {
  const total = rows.reduce(
    (acc, r) => {
      acc.attended += r.attended
      acc.noshow += r.noshow
      acc.cancelledByStudent += r.cancelledByStudent
      acc.cancelledByCoach += r.cancelledByCoach
      acc.unmarked += r.unmarked
      acc.upcoming += r.upcoming
      acc.scheduled += r.scheduled
      return acc
    },
    {
      attended: 0,
      noshow: 0,
      cancelledByStudent: 0,
      cancelledByCoach: 0,
      unmarked: 0,
      upcoming: 0,
      scheduled: 0,
    },
  )
  return {
    ...total,
    activeStudents: rows.filter((r) => r.scheduled > 0).length,
    attendanceRate: rate(total.attended, total.noshow, total.cancelledByStudent),
  }
}

export interface HeatCell {
  weekday: Weekday
  hour: number
  count: number
}

/**
 * Gun x saat yogunluk haritasi. Hangi saatlerin dolu, hangilerinin bos
 * gectigini gorup programi sikilastirmak icin.
 */
export function heatmap(items: ScheduledItem[]): HeatCell[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const s = item.session
    if (s.startMin === null) continue
    if (!OCCUPYING_STATUSES.includes(s.status)) continue
    const wd = weekdayOf(s.date)
    const hour = Math.floor(s.startMin / 60)
    const key = `${wd}:${hour}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const cells: HeatCell[] = []
  for (const [key, count] of map) {
    const [wd, hour] = key.split(':').map(Number)
    cells.push({ weekday: wd as Weekday, hour, count })
  }
  return cells
}

/**
 * Secili aralikta hic gelmemis aktif ogrenciler.
 * Hocanin "bu adam kayboldu mu" sorusunu tek bakista cevaplar.
 */
export function dormantStudents(rows: StudentStats[]): StudentStats[] {
  return rows
    .filter((r) => r.student.active && r.attended === 0)
    .sort((a, b) => {
      // Hic gelmemis olanlar (tarih yok) en basa.
      if (a.lastAttendedDate === b.lastAttendedDate) {
        return a.student.name.localeCompare(b.student.name, 'tr')
      }
      if (a.lastAttendedDate === null) return -1
      if (b.lastAttendedDate === null) return 1
      return a.lastAttendedDate.localeCompare(b.lastAttendedDate)
    })
}

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const s = String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Excel'in Turkce yerel ayarinda dogru acilmasi icin ';' ayirici + BOM. */
export function statsToCsv(rows: StudentStats[]): string {
  const header = [
    'Öğrenci',
    'Telefon',
    'Program tipi',
    'Planlanan',
    'Geldi',
    'Gelmedi',
    'Öğrenci iptali',
    'Hoca iptali',
    'İşaretlenmemiş',
    'Gelecek',
    'Katılım %',
    'Son geliş',
  ]
  const lines = [header.join(';')]
  for (const r of rows) {
    lines.push(
      [
        r.student.name,
        r.student.phone ?? '',
        r.student.planType,
        r.scheduled,
        r.attended,
        r.noshow,
        r.cancelledByStudent,
        r.cancelledByCoach,
        r.unmarked,
        r.upcoming,
        r.attendanceRate === null ? '' : Math.round(r.attendanceRate * 100),
        r.lastAttendedDate ?? '',
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  return '﻿' + lines.join('\r\n')
}
