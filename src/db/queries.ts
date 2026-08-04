import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db.ts'
import { readSettings } from './repo.ts'
import type { Session, Settings, Student } from '../domain/types.ts'

/**
 * Canli sorgular: IndexedDB'de bir sey degisince bu hook'lari kullanan
 * bilesenler kendiliginden yeniden cizilir. Manuel "yenile" gerekmez.
 */

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => readSettings(), [])
}

export function useStudents(): Student[] | undefined {
  return useLiveQuery(
    async () => {
      const all = await db.students.toArray()
      return all.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    },
    [],
  )
}

export function useStudent(id: string | null): Student | undefined {
  return useLiveQuery(() => (id ? db.students.get(id) : undefined), [id])
}

/** [from, to] araligindaki (iki uc dahil) tum ders kayitlari. */
export function useSessionsInRange(from: string, to: string): Session[] | undefined {
  return useLiveQuery(
    () => db.sessions.where('date').between(from, to, true, true).toArray(),
    [from, to],
  )
}

/**
 * Ders kaydi baska bir gune tasinmis olabilir. Tekrar kurallarinin ayni dersi
 * ikinci kez uretmesini engellemek icin araligin biraz disina tasan kayitlari da
 * cekeriz; `buildItems` bunlari "karsilandi" isaretlemek icin kullanir.
 */
export function useSessionsAround(
  from: string,
  to: string,
  padDays = 21,
): Session[] | undefined {
  return useLiveQuery(async () => {
    const pad = (key: string, delta: number) => {
      const d = new Date(key)
      d.setDate(d.getDate() + delta)
      return d.toISOString().slice(0, 10)
    }
    return db.sessions.where('date').between(pad(from, -padDays), pad(to, padDays), true, true).toArray()
  }, [from, to, padDays])
}

export function useSessionCount(): number | undefined {
  return useLiveQuery(() => db.sessions.count(), [])
}
