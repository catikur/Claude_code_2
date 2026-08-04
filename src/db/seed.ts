import { db, newId } from './db.ts'
import { addManualSession, createStudent } from './repo.ts'
import { addDays, startOfWeek, todayKey } from '../domain/time.ts'
import type { ColorKey, PlanRule, PlanType, Weekday } from '../domain/types.ts'

/**
 * Ornek veri: uc ogrenci tipini de gosteren kucuk bir kadro.
 * Uygulamayi bos ekranda degil, dolu bir haftada denemek icin.
 */

function rule(weekday: Weekday, startMin: number | null, durationMin = 60): PlanRule {
  return { id: newId(), weekday, startMin, durationMin }
}

interface SeedStudent {
  name: string
  planType: PlanType
  rules: PlanRule[]
  color: ColorKey
  weeklyTarget?: number
  note?: string
}

function seedStudents(): SeedStudent[] {
  return [
    {
      name: 'Ahmet Yılmaz',
      planType: 'fixed',
      rules: [rule(1, 18 * 60), rule(4, 18 * 60)],
      color: 'kirmizi',
      note: 'Wettkampf hazırlığı, tempo yüksek.',
    },
    {
      name: 'Elif Demir',
      planType: 'fixed',
      rules: [rule(2, 19 * 60), rule(5, 19 * 60)],
      color: 'mavi',
    },
    {
      name: 'Burak Şahin',
      planType: 'fixed',
      rules: [rule(1, 19 * 60 + 30, 90)],
      color: 'yesil',
    },
    {
      name: 'Zeynep Kaya',
      planType: 'dayFixed',
      rules: [rule(3, null), rule(6, null)],
      color: 'mor',
      note: 'Vardiyalı çalışıyor, saati hafta başında netleşiyor.',
    },
    {
      name: 'Mert Aydın',
      planType: 'dayFixed',
      rules: [rule(2, null), rule(4, null)],
      color: 'turkuaz',
    },
    {
      name: 'Selin Arslan',
      planType: 'floating',
      rules: [],
      weeklyTarget: 2,
      color: 'turuncu',
      note: 'Boşluk oldukça çağır.',
    },
    {
      name: 'Kaan Öztürk',
      planType: 'floating',
      rules: [],
      weeklyTarget: 1,
      color: 'amber',
    },
    {
      name: 'Deniz Polat',
      planType: 'fixed',
      rules: [rule(3, 20 * 60), rule(6, 11 * 60)],
      color: 'pembe',
    },
  ]
}

/**
 * Ornek veriyi yukler ve gecen haftaya bir miktar yoklama gecmisi yazar ki
 * rapor ekrani bos gorunmesin.
 */
export async function loadDemoData(): Promise<void> {
  for (const s of seedStudents()) {
    await createStudent({
      name: s.name,
      planType: s.planType,
      rules: s.rules,
      color: s.color,
      weeklyTarget: s.weeklyTarget,
      note: s.note,
      active: true,
    })
  }

  // Gecmis iki hafta icin ornek yoklama - raporun anlamli gorunmesi icin.
  const thisMonday = startOfWeek(todayKey())
  const students = await db.students.toArray()
  const statuses = ['attended', 'attended', 'attended', 'noshow', 'cancelledByStudent'] as const

  let seq = 0
  for (let weekOffset = -2; weekOffset < 0; weekOffset++) {
    const monday = addDays(thisMonday, weekOffset * 7)
    for (const student of students) {
      for (const r of student.rules) {
        const date = addDays(monday, r.weekday - 1)
        const startMin = r.startMin ?? 17 * 60 + (seq % 4) * 60
        await db.sessions.add({
          id: newId(),
          studentId: student.id,
          date,
          startMin,
          durationMin: r.durationMin,
          status: statuses[seq % statuses.length],
          source: 'rule',
          ruleId: r.id,
          originDate: date,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        seq++
      }
    }
    // Esnek ogrencilerden birer ders.
    const floats = students.filter((s) => s.planType === 'floating')
    for (const [i, f] of floats.entries()) {
      await addManualSession({
        studentId: f.id,
        date: addDays(monday, 2 + i),
        startMin: (20 + i) * 60,
        durationMin: 60,
      })
    }
  }

  // Bu haftanin esnek ogrencilerinden biri zaten yerlestirilmis olsun.
  const selin = students.find((s) => s.name === 'Selin Arslan')
  if (selin) {
    await addManualSession({
      studentId: selin.id,
      date: addDays(thisMonday, 1),
      startMin: 20 * 60 + 30,
      durationMin: 60,
    })
  }
}
