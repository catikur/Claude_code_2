import Dexie, { type Table } from 'dexie'
import type { Session, Settings, Student, Weekday } from '../domain/types.ts'
import { WEEKDAYS } from '../domain/types.ts'

/**
 * Yerel-oncelikli depolama: tum veri cihazdaki IndexedDB'de durur.
 * Sunucu gerektirmez, cevrimdisi calisir. Bulut senkronu ileride bu katmanin
 * ustune eklenebilir - UI dogrudan Dexie'ye degil repo.ts'e konusur.
 */
export class AppDb extends Dexie {
  students!: Table<Student, string>
  sessions!: Table<Session, string>
  settings!: Table<Settings, string>

  constructor() {
    super('muay-thai-program')
    this.version(1).stores({
      students: 'id, name, active, planType',
      sessions: 'id, date, studentId, status, [studentId+date]',
      settings: 'id',
    })
  }
}

export const db = new AppDb()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function defaultSettings(): Settings {
  const weekdayHours = {} as Record<Weekday, { open: boolean; startMin: number; endMin: number }>
  for (const wd of WEEKDAYS) {
    weekdayHours[wd] = {
      // Pazar varsayilan olarak kapali; hoca ayarlardan acabilir.
      open: wd !== 7,
      startMin: 9 * 60,
      endMin: 22 * 60,
    }
  }
  return {
    id: 'app',
    slotMin: 60,
    defaultDurationMin: 60,
    capacityPerSlot: 1,
    weekdayHours,
    unmarkedWarningDays: 3,
    updatedAt: Date.now(),
  }
}
