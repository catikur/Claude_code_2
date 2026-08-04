/**
 * Uygulamanin cekirdek veri modeli.
 *
 * Saatler gun basindan itibaren DAKIKA cinsinden tutulur (ornek: 18:30 -> 1110).
 * Boylece siralama, cakisma ve sure hesaplari saat/dakika ayristirmadan yapilir.
 * Tarihler her zaman yerel takvim gunu olarak 'YYYY-MM-DD' string'idir; UTC'ye
 * cevrilmez, cunku bir dersin "hangi gun" oldugu hocanin takvimine gore sabittir.
 */

/** 1 = Pazartesi ... 7 = Pazar (ISO 8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt',
  7: 'Paz',
}

/**
 * Ogrencinin program tipi. Hocanin gercek hayattaki uc ogrenci grubunu karsilar:
 *
 * - `fixed`     : Gunu de saati de sabit. Her hafta ayni yere dusen ogrenci.
 * - `dayFixed`  : Gunu sabit, saati degisken. O gunun bekleme havuzunda cikar,
 *                 hoca bosluga surukleyerek saatini belirler.
 * - `floating`  : Ne gunu ne saati sabit. Haftalik havuzda durur, hoca uygun
 *                 gordugu bosluga birakir.
 */
export type PlanType = 'fixed' | 'dayFixed' | 'floating'

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  fixed: 'Sabit gün + saat',
  dayFixed: 'Gün sabit, saat esnek',
  floating: 'Tamamen esnek',
}

/**
 * Ogrencinin haftalik tekrar kurali.
 * `startMin` null ise gun sabit ama saat hocaya birakilmistir (dayFixed).
 */
export interface PlanRule {
  id: string
  weekday: Weekday
  /** Gun basindan dakika. null => saati hoca haftalik olarak belirler. */
  startMin: number | null
  durationMin: number
}

export interface Student {
  id: string
  name: string
  phone?: string
  note?: string
  planType: PlanType
  /** `fixed` ve `dayFixed` icin dolu; `floating` icin bos dizi. */
  rules: PlanRule[]
  /**
   * Haftalik hedef ders sayisi. `floating` ogrenciler icin havuzda
   * "2/3 yerlestirildi" gostergesini besler. Diger tiplerde opsiyonel.
   */
  weeklyTarget?: number
  /** Kart rengi (tema paletinden bir anahtar). */
  color: ColorKey
  active: boolean
  createdAt: number
  updatedAt: number
}

export type ColorKey =
  | 'kirmizi'
  | 'turuncu'
  | 'amber'
  | 'yesil'
  | 'turkuaz'
  | 'mavi'
  | 'indigo'
  | 'mor'
  | 'pembe'
  | 'gri'

export const COLOR_KEYS: ColorKey[] = [
  'kirmizi',
  'turuncu',
  'amber',
  'yesil',
  'turkuaz',
  'mavi',
  'indigo',
  'mor',
  'pembe',
  'gri',
]

/**
 * Bir dersin sonucu. Raporlamanin tamami bu alan uzerinden hesaplanir.
 *
 * `planned` bir ders gecmiste kaldiysa hala "isaretlenmemis" demektir; rapor
 * bunlari ayri bir sutunda gosterir ki katilim yuzdesi yanlis okunmasin.
 */
export type SessionStatus =
  | 'planned'
  | 'attended'
  | 'noshow'
  | 'cancelledByStudent'
  | 'cancelledByCoach'

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  planned: 'Planlandı',
  attended: 'Geldi',
  noshow: 'Gelmedi',
  cancelledByStudent: 'Öğrenci iptal etti',
  cancelledByCoach: 'Hoca iptal etti',
}

export const SESSION_STATUS_SHORT: Record<SessionStatus, string> = {
  planned: 'Planlı',
  attended: 'Geldi',
  noshow: 'Gelmedi',
  cancelledByStudent: 'İptal',
  cancelledByCoach: 'Hoca ipt.',
}

/** Slotu isgal eden (dolayisiyla doluluk hesabina giren) durumlar. */
export const OCCUPYING_STATUSES: SessionStatus[] = ['planned', 'attended', 'noshow']

/**
 * Takvimdeki somut bir ders kaydi.
 *
 * Tekrar kurallarindan uretilen dersler DB'ye ancak hoca onlara dokundugunda
 * (surukleme, durum degisikligi, not) yazilir - bkz. domain/schedule.ts.
 * Boylece kural degistiginde gelecek haftalar kendiliginden guncellenir,
 * gecmis ise oldugu gibi korunur.
 */
export interface Session {
  id: string
  studentId: string
  /** 'YYYY-MM-DD' yerel takvim gunu. */
  date: string
  /** Gun basindan dakika. null => o gun icin saati henuz atanmadi. */
  startMin: number | null
  durationMin: number
  status: SessionStatus
  /** Tekrar kuralindan mi dogdu, hoca elle mi ekledi. */
  source: 'rule' | 'manual'
  /** `source === 'rule'` ise hangi kuraldan dogdugu. */
  ruleId?: string
  /**
   * Kuraldan dogan dersin ORIJINAL gunu. Hoca dersi baska gune surukleyince
   * `date` degisir ama bu alan sabit kalir; tekrar kurali o hafta icin zaten
   * karsilandigi anlasilsin ve ayni ders bir daha uretilmesin diye.
   */
  originDate?: string
  /** Baska bir dersin telafisi olarak konuldu mu. */
  makeup?: boolean
  note?: string
  createdAt: number
  updatedAt: number
}

/** Bir gunun calisma saatleri. */
export interface DayHours {
  open: boolean
  startMin: number
  endMin: number
}

export interface Settings {
  /** Tek satirlik tablo; sabit anahtar. */
  id: 'app'
  /** Izgara satir yuksekligi (dakika): 30 / 45 / 60. */
  slotMin: number
  /** Yeni ders eklenirken varsayilan sure. */
  defaultDurationMin: number
  /** Ayni saat diliminde kac ogrenci olabilir (birebir => 1, grup => n). */
  capacityPerSlot: number
  weekdayHours: Record<Weekday, DayHours>
  /** Yoklama isaretlenmeden gecen gun sayisi bu esigi asinca uyari cikar. */
  unmarkedWarningDays: number
  updatedAt: number
}

/** Izgarada gosterilen, DB'ye yazilmis ya da henuz sanal olan ders. */
export interface ScheduledItem {
  /** Sanal kayitlarda `virtual:<studentId>:<date>:<ruleId>` formatinda. */
  key: string
  session: Session
  student: Student
  /** true => henuz DB'de yok, kuraldan uretildi. */
  virtual: boolean
}
