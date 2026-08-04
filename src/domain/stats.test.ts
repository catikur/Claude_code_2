import { describe, expect, it } from 'vitest'
import { dormantStudents, heatmap, rangeSummary, statsToCsv, studentStats } from './stats.ts'
import type { ScheduledItem, Session, SessionStatus, Student } from './types.ts'

const BASE = { createdAt: 0, updatedAt: 0 }

// Testler bugune bagli kalmasin diye kesin gecmis / kesin gelecek tarihler.
const PAST = '2020-03-02' // Pazartesi
const PAST2 = '2020-03-03'
const FUTURE = '2099-01-05'

function student(over: Partial<Student> = {}): Student {
  return {
    id: 's1',
    name: 'Ali',
    planType: 'fixed',
    rules: [],
    color: 'mavi',
    active: true,
    ...BASE,
    ...over,
  }
}

function item(over: Partial<Session> & { student?: Student } = {}): ScheduledItem {
  const { student: st, ...rest } = over
  const s = st ?? student()
  const session: Session = {
    id: Math.random().toString(36).slice(2),
    studentId: s.id,
    date: PAST,
    startMin: 18 * 60,
    durationMin: 60,
    status: 'attended',
    source: 'manual',
    ...BASE,
    ...rest,
  }
  return { key: session.id, session, student: s, virtual: false }
}

describe('studentStats', () => {
  it('durumlari dogru sayar', () => {
    const s = student()
    const statuses: SessionStatus[] = [
      'attended',
      'attended',
      'noshow',
      'cancelledByStudent',
      'cancelledByCoach',
    ]
    const rows = studentStats(
      statuses.map((status) => item({ student: s, status })),
      [s],
    )
    expect(rows[0].attended).toBe(2)
    expect(rows[0].noshow).toBe(1)
    expect(rows[0].cancelledByStudent).toBe(1)
    expect(rows[0].cancelledByCoach).toBe(1)
    expect(rows[0].scheduled).toBe(5)
  })

  it('gecmisteki isaretlenmemis dersi upcoming degil unmarked sayar', () => {
    const s = student()
    const rows = studentStats([item({ student: s, status: 'planned', date: PAST })], [s])
    expect(rows[0].unmarked).toBe(1)
    expect(rows[0].upcoming).toBe(0)
  })

  it('gelecekteki planli dersi upcoming sayar', () => {
    const s = student()
    const rows = studentStats([item({ student: s, status: 'planned', date: FUTURE })], [s])
    expect(rows[0].upcoming).toBe(1)
    expect(rows[0].unmarked).toBe(0)
  })

  it('katilim oranini hoca iptallerini disarida birakarak hesaplar', () => {
    const s = student()
    const rows = studentStats(
      [
        item({ student: s, status: 'attended' }),
        item({ student: s, status: 'attended' }),
        item({ student: s, status: 'attended' }),
        item({ student: s, status: 'noshow' }),
        // Bu ikisi paydaya girmemeli.
        item({ student: s, status: 'cancelledByCoach' }),
        item({ student: s, status: 'planned', date: FUTURE }),
      ],
      [s],
    )
    expect(rows[0].attendanceRate).toBeCloseTo(3 / 4)
  })

  it('ogrenci iptali katilim oranini dusurur', () => {
    const s = student()
    const rows = studentStats(
      [
        item({ student: s, status: 'attended' }),
        item({ student: s, status: 'cancelledByStudent' }),
      ],
      [s],
    )
    expect(rows[0].attendanceRate).toBeCloseTo(0.5)
  })

  it('hic sonuclanmis dersi olmayanda oran null olur', () => {
    const s = student()
    const rows = studentStats([item({ student: s, status: 'planned', date: FUTURE })], [s])
    expect(rows[0].attendanceRate).toBeNull()
  })

  it('son gelis tarihini en yeni derse gore verir', () => {
    const s = student()
    const rows = studentStats(
      [
        item({ student: s, status: 'attended', date: PAST }),
        item({ student: s, status: 'attended', date: PAST2 }),
        // Gelmedigi ders son gelis sayilmamali.
        item({ student: s, status: 'noshow', date: '2020-03-04' }),
      ],
      [s],
    )
    expect(rows[0].lastAttendedDate).toBe(PAST2)
  })

  it('dersi olmayan ogrenciyi de sifirlarla listeler', () => {
    const s = student()
    const rows = studentStats([], [s])
    expect(rows).toHaveLength(1)
    expect(rows[0].scheduled).toBe(0)
    expect(rows[0].lastAttendedDate).toBeNull()
  })

  it('cok gelen ogrenciyi basa alir', () => {
    const a = student({ id: 'a', name: 'Az' })
    const b = student({ id: 'b', name: 'Cok' })
    const rows = studentStats(
      [
        item({ student: a, status: 'attended' }),
        item({ student: b, status: 'attended' }),
        item({ student: b, status: 'attended' }),
      ],
      [a, b],
    )
    expect(rows[0].student.id).toBe('b')
  })
})

describe('rangeSummary', () => {
  it('satirlari toplayip genel orani hesaplar', () => {
    const a = student({ id: 'a' })
    const b = student({ id: 'b' })
    const rows = studentStats(
      [
        item({ student: a, status: 'attended' }),
        item({ student: a, status: 'noshow' }),
        item({ student: b, status: 'attended' }),
      ],
      [a, b],
    )
    const sum = rangeSummary(rows)
    expect(sum.attended).toBe(2)
    expect(sum.noshow).toBe(1)
    expect(sum.activeStudents).toBe(2)
    expect(sum.attendanceRate).toBeCloseTo(2 / 3)
  })

  it('bos aralikta oran null doner', () => {
    expect(rangeSummary([]).attendanceRate).toBeNull()
  })
})

describe('dormantStudents', () => {
  it('aralikta hic gelmemis aktif ogrencileri listeler', () => {
    const gelen = student({ id: 'a', name: 'Gelen' })
    const gelmeyen = student({ id: 'b', name: 'Gelmeyen' })
    const rows = studentStats(
      [
        item({ student: gelen, status: 'attended' }),
        item({ student: gelmeyen, status: 'noshow' }),
      ],
      [gelen, gelmeyen],
    )
    const dormant = dormantStudents(rows)
    expect(dormant.map((d) => d.student.id)).toEqual(['b'])
  })

  it('pasif ogrencileri listeye almaz', () => {
    const pasif = student({ id: 'p', active: false })
    expect(dormantStudents(studentStats([], [pasif]))).toHaveLength(0)
  })

  it('hic gelisi olmayanlari en basa koyar', () => {
    const hic = student({ id: 'hic', name: 'Hic' })
    const eski = student({ id: 'eski', name: 'Eski' })
    const rows = studentStats(
      [
        item({ student: hic, status: 'noshow' }),
        // Aralikta gelmemis ama gecmiste bir gelisi var.
        item({ student: eski, status: 'attended', date: '2020-01-05' }),
        item({ student: eski, status: 'noshow' }),
      ],
      [hic, eski],
    )
    // `eski` aralikta geldigi icin dormant degil; sadece `hic` kalir.
    expect(dormantStudents(rows).map((d) => d.student.id)).toEqual(['hic'])
  })
})

describe('heatmap', () => {
  it('gun ve saate gore sayar', () => {
    const s = student()
    const cells = heatmap([
      item({ student: s, date: PAST, startMin: 18 * 60 }),
      item({ student: s, date: PAST, startMin: 18 * 60 + 30 }),
      item({ student: s, date: PAST2, startMin: 18 * 60 }),
    ])
    const monday18 = cells.find((c) => c.weekday === 1 && c.hour === 18)
    expect(monday18?.count).toBe(2)
  })

  it('iptal edilen ve saatsiz dersleri saymaz', () => {
    const s = student()
    const cells = heatmap([
      item({ student: s, status: 'cancelledByStudent' }),
      item({ student: s, startMin: null }),
    ])
    expect(cells).toHaveLength(0)
  })
})

describe('statsToCsv', () => {
  it('noktali virgulle ayrilmis basliklari ve satirlari yazar', () => {
    const s = student({ name: 'Ali', phone: '555' })
    const csv = statsToCsv(studentStats([item({ student: s, status: 'attended' })], [s]))
    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('Öğrenci;Telefon')
    expect(lines[1]).toContain('Ali;555')
    expect(lines[1]).toContain('100') // katilim yuzdesi
  })

  it('ayirici iceren isimleri tirnaklar', () => {
    const s = student({ name: 'Ali; Veli' })
    const csv = statsToCsv(studentStats([], [s]))
    expect(csv).toContain('"Ali; Veli"')
  })

  it('Excel icin BOM ile baslar', () => {
    expect(statsToCsv([]).charCodeAt(0)).toBe(0xfeff)
  })
})
