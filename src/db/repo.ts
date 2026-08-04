import { db, defaultSettings, newId } from './db.ts'
import type {
  PlanRule,
  ScheduledItem,
  Session,
  SessionStatus,
  Settings,
  Student,
} from '../domain/types.ts'

/**
 * UI'nin konustugu tek veri kapisi. Dexie detaylari burada kalir; ileride
 * bulut senkronu eklenecekse degisecek yer sadece bu dosyadir.
 */

// ---------------------------------------------------------------- Ayarlar

/**
 * Ayarlari okur. Kayit yoksa varsayilanlari DONER ama YAZMAZ.
 *
 * Yazmamak onemli: bu fonksiyon canli sorgular (useLiveQuery) icinden de
 * cagriliyor ve Dexie onlari salt-okunur bir islemde calistirir; icinde yazmaya
 * kalkmak ReadOnlyError firlatir. Ilk kaydi `ensureSettings` acilista atar.
 */
export async function readSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? defaultSettings()
}

/** Acilista bir kez cagrilir; ayar satiri yoksa olusturur. */
export async function ensureSettings(): Promise<void> {
  if (!(await db.settings.get('app'))) await db.settings.put(defaultSettings())
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await readSettings()
  await db.settings.put({ ...current, ...patch, id: 'app', updatedAt: Date.now() })
}

// --------------------------------------------------------------- Ogrenci

export interface StudentInput {
  name: string
  phone?: string
  note?: string
  planType: Student['planType']
  rules: PlanRule[]
  weeklyTarget?: number
  color: Student['color']
  active: boolean
}

export async function createStudent(input: StudentInput): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.students.add({ ...input, id, createdAt: now, updatedAt: now })
  return id
}

export async function updateStudent(id: string, patch: Partial<StudentInput>): Promise<void> {
  await db.students.update(id, { ...patch, updatedAt: Date.now() })
}

/**
 * Ogrenciyi pasife alir. Silmek yerine pasife almak gecmis raporlari korur -
 * "3 ay once kac kisi geliyordu" sorusu ancak boyle cevaplanabilir.
 */
export async function deactivateStudent(id: string): Promise<void> {
  await db.students.update(id, { active: false, updatedAt: Date.now() })
}

/** Ogrenciyi ve TUM ders gecmisini kalici olarak siler. */
export async function deleteStudentForever(id: string): Promise<void> {
  await db.transaction('rw', db.students, db.sessions, async () => {
    await db.sessions.where('studentId').equals(id).delete()
    await db.students.delete(id)
  })
}

// ----------------------------------------------------------------- Ders

/**
 * Sanal (kuraldan dogmus, henuz DB'de olmayan) bir dersi gercek kayda cevirir.
 * Zaten gercekse oldugu gibi doner.
 */
async function materialize(item: ScheduledItem): Promise<Session> {
  if (!item.virtual) return item.session
  const now = Date.now()
  const row: Session = {
    ...item.session,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  }
  await db.sessions.add(row)
  return row
}

/** Dersi baska gune / saate tasir. `startMin: null` => bekleme havuzuna geri. */
export async function moveSession(
  item: ScheduledItem,
  target: { date: string; startMin: number | null },
): Promise<void> {
  const row = await materialize(item)
  await db.sessions.update(row.id, {
    date: target.date,
    startMin: target.startMin,
    updatedAt: Date.now(),
  })
}

export async function setSessionStatus(
  item: ScheduledItem,
  status: SessionStatus,
): Promise<void> {
  const row = await materialize(item)
  await db.sessions.update(row.id, { status, updatedAt: Date.now() })
}

export async function setSessionDuration(item: ScheduledItem, durationMin: number): Promise<void> {
  const row = await materialize(item)
  await db.sessions.update(row.id, { durationMin, updatedAt: Date.now() })
}

export async function setSessionNote(item: ScheduledItem, note: string): Promise<void> {
  const row = await materialize(item)
  await db.sessions.update(row.id, { note: note.trim() || undefined, updatedAt: Date.now() })
}

/** Hocanin elle ekledigi ders (esnek ogrenciyi bosluga birakmak dahil). */
export async function addManualSession(input: {
  studentId: string
  date: string
  startMin: number | null
  durationMin: number
  makeup?: boolean
  note?: string
}): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.sessions.add({
    id,
    studentId: input.studentId,
    date: input.date,
    startMin: input.startMin,
    durationMin: input.durationMin,
    status: 'planned',
    source: 'manual',
    makeup: input.makeup,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

/**
 * Dersi takvimden kaldirir.
 *
 * Elle eklenmis ders tamamen silinir. Kuraldan dogan ders ise silinemez -
 * silinse tekrar kurali onu bir sonraki acilista yeniden uretirdi. Onun yerine
 * kayit "hoca iptal etti" olarak isaretlenir; hem takvimden cikar hem de
 * raporda iz birakir.
 */
export async function removeSession(item: ScheduledItem): Promise<void> {
  if (item.session.source === 'manual' && !item.virtual) {
    await db.sessions.delete(item.session.id)
    return
  }
  if (item.virtual && item.session.source === 'manual') return
  await setSessionStatus(item, 'cancelledByCoach')
}

/** Kuraldan dogan derste yapilan tum degisiklikleri geri alir. */
export async function resetToPlan(item: ScheduledItem): Promise<void> {
  if (item.virtual) return
  if (item.session.source !== 'rule') return
  await db.sessions.delete(item.session.id)
}

/** Bir gunun isaretlenmemis derslerini toplu olarak sonuclandirir. */
export async function bulkSetStatus(
  items: ScheduledItem[],
  status: SessionStatus,
): Promise<number> {
  let n = 0
  for (const item of items) {
    if (item.session.status !== 'planned') continue
    if (item.session.startMin === null) continue
    await setSessionStatus(item, status)
    n++
  }
  return n
}

// ----------------------------------------------------------------- Yedek

export interface Backup {
  format: 'muay-thai-program'
  version: 1
  exportedAt: string
  students: Student[]
  sessions: Session[]
  settings: Settings
}

export async function exportBackup(): Promise<Backup> {
  const [students, sessions, settings] = await Promise.all([
    db.students.toArray(),
    db.sessions.toArray(),
    readSettings(),
  ])
  return {
    format: 'muay-thai-program',
    version: 1,
    exportedAt: new Date().toISOString(),
    students,
    sessions,
    settings,
  }
}

export class BackupFormatError extends Error {}

/**
 * Yedegi geri yukler. Mevcut veriyi TAMAMEN degistirir - cagiran taraf
 * kullanicidan onay almis olmalidir.
 */
export async function importBackup(raw: unknown): Promise<{ students: number; sessions: number }> {
  const data = raw as Partial<Backup>
  if (!data || data.format !== 'muay-thai-program') {
    throw new BackupFormatError('Bu dosya bu uygulamanın yedeği değil.')
  }
  if (!Array.isArray(data.students) || !Array.isArray(data.sessions)) {
    throw new BackupFormatError('Yedek dosyası bozuk görünüyor.')
  }
  await db.transaction('rw', db.students, db.sessions, db.settings, async () => {
    await Promise.all([db.students.clear(), db.sessions.clear(), db.settings.clear()])
    await db.students.bulkAdd(data.students!)
    await db.sessions.bulkAdd(data.sessions!)
    await db.settings.put({ ...defaultSettings(), ...(data.settings ?? {}), id: 'app' })
  })
  return { students: data.students!.length, sessions: data.sessions!.length }
}

/** Tum veriyi siler ve fabrika ayarlarina doner. */
export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.students, db.sessions, db.settings, async () => {
    await Promise.all([db.students.clear(), db.sessions.clear(), db.settings.clear()])
    await db.settings.put(defaultSettings())
  })
}
