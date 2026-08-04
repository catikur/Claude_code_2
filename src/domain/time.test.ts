import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  durationLabel,
  endOfMonth,
  labelToMin,
  minToLabel,
  overlaps,
  slotStarts,
  startOfMonth,
  startOfWeek,
  toDateKey,
  weekDays,
  weekdayOf,
} from './time.ts'

describe('saat bicimleri', () => {
  it('dakikayi etikete cevirir', () => {
    expect(minToLabel(0)).toBe('00:00')
    expect(minToLabel(9 * 60)).toBe('09:00')
    expect(minToLabel(18 * 60 + 30)).toBe('18:30')
    expect(minToLabel(23 * 60 + 59)).toBe('23:59')
  })

  it('etiketi dakikaya cevirir', () => {
    expect(labelToMin('18:30')).toBe(1110)
    expect(labelToMin('9:00')).toBe(540)
    expect(labelToMin(' 07:05 ')).toBe(425)
  })

  it('gecersiz saatleri reddeder', () => {
    for (const bad of ['', 'abc', '25:00', '12:60', '12', '12:5', '-1:00']) {
      expect(labelToMin(bad)).toBeNull()
    }
  })

  it('sureyi okunur yazar', () => {
    expect(durationLabel(45)).toBe('45dk')
    expect(durationLabel(60)).toBe('1s')
    expect(durationLabel(90)).toBe('1s 30dk')
    expect(durationLabel(120)).toBe('2s')
  })
})

describe('takvim gunleri', () => {
  it('yerel gunu UTC kaymasi olmadan yazar', () => {
    // Gece yarisindan hemen sonra: UTC'ye cevrilse bir onceki gune duserdi.
    expect(toDateKey(new Date(2026, 7, 4, 0, 30))).toBe('2026-08-04')
    expect(toDateKey(new Date(2026, 7, 4, 23, 30))).toBe('2026-08-04')
  })

  it('ISO hafta gununu dogru hesaplar', () => {
    expect(weekdayOf('2026-08-03')).toBe(1) // Pazartesi
    expect(weekdayOf('2026-08-09')).toBe(7) // Pazar
  })

  it('haftanin basini Pazartesi alir', () => {
    expect(startOfWeek('2026-08-05')).toBe('2026-08-03')
    expect(startOfWeek('2026-08-09')).toBe('2026-08-03')
    expect(startOfWeek('2026-08-03')).toBe('2026-08-03')
  })

  it('hafta 7 gun dondurur', () => {
    const days = weekDays('2026-08-03')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-08-03')
    expect(days[6]).toBe('2026-08-09')
  })

  it('ay sinirlarini asarken dogru sayar', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('artik yili dogru gecer', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('ay basi ve sonunu bulur', () => {
    expect(startOfMonth('2026-08-17')).toBe('2026-08-01')
    expect(endOfMonth('2026-08-17')).toBe('2026-08-31')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  })

  it('aralikaki tum gunleri sayar', () => {
    expect(daysBetween('2026-08-03', '2026-08-05')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
    expect(daysBetween('2026-08-03', '2026-08-03')).toEqual(['2026-08-03'])
    expect(daysBetween('2026-08-05', '2026-08-03')).toEqual([])
  })
})

describe('cakisma ve slotlar', () => {
  it('ust uste binen araliklari yakalar', () => {
    expect(overlaps(600, 60, 630, 60)).toBe(true)
    expect(overlaps(600, 60, 660, 60)).toBe(false) // bitisik
    expect(overlaps(600, 60, 540, 60)).toBe(false)
    expect(overlaps(600, 90, 660, 30)).toBe(true) // icine alan
  })

  it('slot baslangiclarini uretir', () => {
    expect(slotStarts(540, 720, 60)).toEqual([540, 600, 660])
    // Tam sigmayan son slot uretilmez.
    expect(slotStarts(540, 700, 60)).toEqual([540, 600])
    expect(slotStarts(540, 540, 60)).toEqual([])
  })
})
