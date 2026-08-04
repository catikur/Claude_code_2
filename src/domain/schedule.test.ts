import { describe, expect, it } from 'vitest'
import { buildItems, findConflicts, floatingPool, pendingItems } from './schedule.ts'
import { layoutDay } from './layout.ts'
import type { Session, Student } from './types.ts'

const BASE = { createdAt: 0, updatedAt: 0 }

// 2026-08-03 Pazartesi ... 2026-08-09 Pazar
const MON = '2026-08-03'
const TUE = '2026-08-04'
const WED = '2026-08-05'
const WEEK = [MON, TUE, WED, '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']

function student(over: Partial<Student> = {}): Student {
  return {
    id: 's1',
    name: 'Test',
    planType: 'fixed',
    rules: [],
    color: 'mavi',
    active: true,
    ...BASE,
    ...over,
  }
}

function session(over: Partial<Session> = {}): Session {
  return {
    id: 'x1',
    studentId: 's1',
    date: MON,
    startMin: 18 * 60,
    durationMin: 60,
    status: 'planned',
    source: 'manual',
    ...BASE,
    ...over,
  }
}

describe('buildItems', () => {
  it('sabit programli ogrenci icin haftalik sanal ders uretir', () => {
    const s = student({
      rules: [{ id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 }],
    })
    const items = buildItems([s], [], WEEK)
    expect(items).toHaveLength(1)
    expect(items[0].virtual).toBe(true)
    expect(items[0].session.date).toBe(MON)
    expect(items[0].session.startMin).toBe(18 * 60)
  })

  it('gunu sabit saati esnek ogrenciyi saatsiz uretir', () => {
    const s = student({
      planType: 'dayFixed',
      rules: [{ id: 'r1', weekday: 3, startMin: null, durationMin: 60 }],
    })
    const items = buildItems([s], [], WEEK)
    expect(items).toHaveLength(1)
    expect(items[0].session.startMin).toBeNull()
    expect(pendingItems(items)).toHaveLength(1)
  })

  it('pasif ogrenciler icin ders uretmez', () => {
    const s = student({
      active: false,
      rules: [{ id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 }],
    })
    expect(buildItems([s], [], WEEK)).toHaveLength(0)
  })

  it('gercek kayit varsa ayni tekrar icin sanal kayit uretmez', () => {
    const s = student({
      rules: [{ id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 }],
    })
    const saved = session({
      id: 'real',
      source: 'rule',
      ruleId: 'r1',
      originDate: MON,
      status: 'attended',
    })
    const items = buildItems([s], [saved], WEEK)
    expect(items).toHaveLength(1)
    expect(items[0].virtual).toBe(false)
    expect(items[0].session.status).toBe('attended')
  })

  it('ders baska gune tasindiginda kopya uretmez', () => {
    const s = student({
      rules: [{ id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 }],
    })
    // Pazartesi'nin dersi Sali'ye cekilmis; originDate Pazartesi'de kalir.
    const moved = session({ id: 'real', source: 'rule', ruleId: 'r1', originDate: MON, date: TUE })
    const items = buildItems([s], [moved], WEEK)
    expect(items).toHaveLength(1)
    expect(items[0].session.date).toBe(TUE)
  })

  it('ders gorunen araligin disina tasindiysa o hafta bos kalir', () => {
    const s = student({
      rules: [{ id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 }],
    })
    const moved = session({
      id: 'real',
      source: 'rule',
      ruleId: 'r1',
      originDate: MON,
      date: '2026-08-17',
    })
    expect(buildItems([s], [moved], WEEK)).toHaveLength(0)
  })

  it('silinmis ogrenciye ait yetim kayitlari gostermez', () => {
    expect(buildItems([], [session({ studentId: 'yok' })], WEEK)).toHaveLength(0)
  })

  it('ayni ogrencinin birden fazla gunu icin ayri dersler uretir', () => {
    const s = student({
      rules: [
        { id: 'r1', weekday: 1, startMin: 18 * 60, durationMin: 60 },
        { id: 'r2', weekday: 4, startMin: 18 * 60, durationMin: 60 },
      ],
    })
    expect(buildItems([s], [], WEEK)).toHaveLength(2)
  })
})

describe('floatingPool', () => {
  it('yerlestirilen ders sayisini hedefe gore sayar', () => {
    const s = student({ id: 'f1', planType: 'floating', weeklyTarget: 2 })
    const placed = session({ studentId: 'f1', date: TUE })
    const items = buildItems([s], [placed], WEEK)
    const pool = floatingPool([s], items)
    expect(pool).toHaveLength(1)
    expect(pool[0].placed).toBe(1)
    expect(pool[0].target).toBe(2)
  })

  it('iptal edilmis dersler yerlestirilmis sayilmaz', () => {
    const s = student({ id: 'f1', planType: 'floating', weeklyTarget: 1 })
    const cancelled = session({ studentId: 'f1', status: 'cancelledByStudent' })
    const items = buildItems([s], [cancelled], WEEK)
    expect(floatingPool([s], items)[0].placed).toBe(0)
  })

  it('eksigi cok olan ogrenciyi basa alir', () => {
    const a = student({ id: 'a', name: 'A', planType: 'floating', weeklyTarget: 3 })
    const b = student({ id: 'b', name: 'B', planType: 'floating', weeklyTarget: 1 })
    const pool = floatingPool([a, b], [])
    expect(pool[0].student.id).toBe('a')
  })
})

describe('findConflicts', () => {
  const twoAtOnce = (): Student[] => [
    student({ id: 'a', name: 'A' }),
    student({ id: 'b', name: 'B' }),
  ]

  it('kapasite 1 iken cakisan iki dersi yakalar', () => {
    const items = buildItems(twoAtOnce(), [
      session({ id: '1', studentId: 'a', startMin: 18 * 60 }),
      session({ id: '2', studentId: 'b', startMin: 18 * 60 + 30 }),
    ], WEEK)
    expect(findConflicts(items, 1).length).toBeGreaterThan(0)
  })

  it('kapasite 2 iken iki ders cakisma sayilmaz', () => {
    const items = buildItems(twoAtOnce(), [
      session({ id: '1', studentId: 'a', startMin: 18 * 60 }),
      session({ id: '2', studentId: 'b', startMin: 18 * 60 }),
    ], WEEK)
    expect(findConflicts(items, 2)).toHaveLength(0)
  })

  it('bitisik dersler cakisma sayilmaz', () => {
    const items = buildItems(twoAtOnce(), [
      session({ id: '1', studentId: 'a', startMin: 18 * 60, durationMin: 60 }),
      session({ id: '2', studentId: 'b', startMin: 19 * 60, durationMin: 60 }),
    ], WEEK)
    expect(findConflicts(items, 1)).toHaveLength(0)
  })

  it('farkli gunlerdeki ayni saatler cakisma sayilmaz', () => {
    const items = buildItems(twoAtOnce(), [
      session({ id: '1', studentId: 'a', date: MON }),
      session({ id: '2', studentId: 'b', date: TUE }),
    ], WEEK)
    expect(findConflicts(items, 1)).toHaveLength(0)
  })
})

describe('layoutDay', () => {
  it('cakismayan dersleri tek seride koyar', () => {
    const items = buildItems(
      [student({ id: 'a' }), student({ id: 'b' })],
      [
        session({ id: '1', studentId: 'a', startMin: 10 * 60 }),
        session({ id: '2', studentId: 'b', startMin: 12 * 60 }),
      ],
      WEEK,
    )
    const laid = layoutDay(items)
    expect(laid.every((l) => l.lanes === 1)).toBe(true)
  })

  it('cakisan dersleri yan yana seritlere boler', () => {
    const items = buildItems(
      [student({ id: 'a' }), student({ id: 'b' })],
      [
        session({ id: '1', studentId: 'a', startMin: 10 * 60 }),
        session({ id: '2', studentId: 'b', startMin: 10 * 60 + 30 }),
      ],
      WEEK,
    )
    const laid = layoutDay(items)
    expect(laid.every((l) => l.lanes === 2)).toBe(true)
    expect(new Set(laid.map((l) => l.lane)).size).toBe(2)
  })

  it('saati atanmamis dersleri izgaraya koymaz', () => {
    const items = buildItems([student({ id: 'a' })], [session({ startMin: null })], WEEK)
    expect(layoutDay(items)).toHaveLength(0)
  })

  it('bagimsiz cakisma kumelerini ayri hesaplar', () => {
    const students = [student({ id: 'a' }), student({ id: 'b' }), student({ id: 'c' })]
    const items = buildItems(
      students,
      [
        session({ id: '1', studentId: 'a', startMin: 10 * 60 }),
        session({ id: '2', studentId: 'b', startMin: 10 * 60 }),
        // Ayri kume: tek basina, tam genislik almali.
        session({ id: '3', studentId: 'c', startMin: 15 * 60 }),
      ],
      WEEK,
    )
    const laid = layoutDay(items)
    const alone = laid.find((l) => l.item.session.id === '3')
    expect(alone?.lanes).toBe(1)
  })
})

describe('pendingItems', () => {
  it('yalnizca saati atanmamis dersleri dondurur', () => {
    const items = buildItems(
      [student({ id: 'a' }), student({ id: 'b' })],
      [
        session({ id: '1', studentId: 'a', startMin: null, date: WED }),
        session({ id: '2', studentId: 'b', startMin: 10 * 60 }),
      ],
      WEEK,
    )
    const pending = pendingItems(items)
    expect(pending).toHaveLength(1)
    expect(pending[0].session.id).toBe('1')
  })
})
