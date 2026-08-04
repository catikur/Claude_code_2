import { useRef, useState } from 'react'
import { useSessionCount, useSettings, useStudents } from '../db/queries.ts'
import { loadDemoData } from '../db/seed.ts'
import {
  BackupFormatError,
  exportBackup,
  importBackup,
  saveSettings,
  wipeAll,
} from '../db/repo.ts'
import { durationLabel, labelToMin, minToLabel } from '../domain/time.ts'
import type { DayHours, Weekday } from '../domain/types.ts'
import { WEEKDAYS, WEEKDAY_LABELS } from '../domain/types.ts'
import {
  Button,
  ConfirmSheet,
  Field,
  Select,
  TextInput,
  cx,
  useToast,
} from '../ui/primitives.tsx'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-ink-100 text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-ink-400 mt-0.5 text-xs leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/** Tek bir gunun acilis/kapanis saatleri. */
function DayHoursRow({
  weekday,
  hours,
  onChange,
}: {
  weekday: Weekday
  hours: DayHours
  onChange: (h: DayHours) => void
}) {
  const [start, setStart] = useState(minToLabel(hours.startMin))
  const [end, setEnd] = useState(minToLabel(hours.endMin))

  const commit = (which: 'start' | 'end', raw: string) => {
    const min = labelToMin(raw)
    if (min === null) {
      // Gecersiz girdi son gecerli degere geri doner.
      if (which === 'start') setStart(minToLabel(hours.startMin))
      else setEnd(minToLabel(hours.endMin))
      return
    }
    const next =
      which === 'start'
        ? { ...hours, startMin: Math.min(min, hours.endMin - 30) }
        : { ...hours, endMin: Math.max(min, hours.startMin + 30) }
    setStart(minToLabel(next.startMin))
    setEnd(minToLabel(next.endMin))
    onChange(next)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={hours.open}
          onChange={(e) => onChange({ ...hours, open: e.target.checked })}
          className="accent-accent h-4 w-4 shrink-0"
        />
        <span
          className={cx('truncate text-sm', hours.open ? 'text-ink-100' : 'text-ink-500')}
        >
          {WEEKDAY_LABELS[weekday]}
        </span>
      </label>
      <TextInput
        value={start}
        onChange={(e) => setStart(e.target.value)}
        onBlur={(e) => commit('start', e.target.value)}
        disabled={!hours.open}
        inputMode="numeric"
        className="!w-20 !py-1.5 text-center text-sm disabled:opacity-40"
        aria-label={`${WEEKDAY_LABELS[weekday]} açılış`}
      />
      <span className="text-ink-500 text-xs">–</span>
      <TextInput
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={(e) => commit('end', e.target.value)}
        disabled={!hours.open}
        inputMode="numeric"
        className="!w-20 !py-1.5 text-center text-sm disabled:opacity-40"
        aria-label={`${WEEKDAY_LABELS[weekday]} kapanış`}
      />
    </div>
  )
}

export function SettingsPage() {
  const toast = useToast()
  const settings = useSettings()
  const students = useStudents()
  const sessionCount = useSessionCount()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [pendingImport, setPendingImport] = useState<unknown>(null)

  if (!settings) {
    return <div className="text-ink-400 p-8 text-center text-sm">Yükleniyor…</div>
  }

  const download = async () => {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `muay-thai-yedek-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.show('Yedek indirildi.')
  }

  const pickFile = () => fileRef.current?.click()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPendingImport(JSON.parse(await file.text()))
    } catch {
      toast.show('Dosya okunamadı. Geçerli bir JSON yedeği seçin.', { tone: 'error' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const isEmpty = (students?.length ?? 0) === 0 && (sessionCount ?? 0) === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-ink-800 bg-ink-900 safe-top shrink-0 border-b px-3 py-3">
        <h1 className="text-ink-100 text-sm font-semibold">Ayarlar</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-3 py-4">
        <Section
          title="Çalışma saatleri"
          description="Takvimde hangi saat aralığının görüneceğini belirler. Kapalı günler taranmış görünür ve oraya ders bırakılamaz."
        >
          <div className="border-ink-700 bg-ink-850 divide-ink-800 divide-y rounded-xl border">
            {WEEKDAYS.map((wd) => (
              <DayHoursRow
                key={wd}
                weekday={wd}
                hours={settings.weekdayHours[wd]}
                onChange={(h) =>
                  void saveSettings({
                    weekdayHours: { ...settings.weekdayHours, [wd]: h },
                  })
                }
              />
            ))}
          </div>
        </Section>

        <Section title="Takvim düzeni">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Satır aralığı" hint="Izgaradaki her satırın kaç dakika olduğu.">
              <Select
                value={String(settings.slotMin)}
                onChange={(e) => void saveSettings({ slotMin: Number(e.target.value) })}
              >
                {[30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Varsayılan ders süresi">
              <Select
                value={String(settings.defaultDurationMin)}
                onChange={(e) => void saveSettings({ defaultDurationMin: Number(e.target.value) })}
              >
                {[30, 45, 60, 75, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Aynı saatte kaç kişi"
              hint="Birebir çalışıyorsanız 1 bırakın. Fazlası çakışma uyarısı çıkarır."
            >
              <Select
                value={String(settings.capacityPerSlot)}
                onChange={(e) => void saveSettings({ capacityPerSlot: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} kişi
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section
          title="Yedekleme"
          description="Veriler yalnızca bu cihazda saklanır. Telefonu değiştirmeden ya da tarayıcı verilerini temizlemeden önce mutlaka yedek alın."
        >
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>Yedek indir (JSON)</Button>
            <Button onClick={pickFile}>Yedekten geri yükle</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          <p className="text-ink-400 text-xs tabular-nums">
            Şu an: {students?.length ?? 0} öğrenci · {sessionCount ?? 0} ders kaydı
          </p>
        </Section>

        {isEmpty && (
          <Section
            title="Denemek için örnek veri"
            description="Üç öğrenci tipini de içeren örnek bir kadro ve iki haftalık yoklama geçmişi yükler. Kendi verinizi girmeden önce uygulamayı tanımak için."
          >
            <Button
              variant="primary"
              onClick={async () => {
                await loadDemoData()
                toast.show('Örnek veri yüklendi.')
              }}
            >
              Örnek veriyi yükle
            </Button>
          </Section>
        )}

        <Section
          title="Tehlikeli bölge"
          description="Tüm öğrenciler, ders kayıtları ve ayarlar silinir. Geri alınamaz."
        >
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>
            Tüm veriyi sil
          </Button>
        </Section>

        <p className="text-ink-500 pb-4 text-[11px] leading-relaxed">
          Muay Thai Program · sürüm 0.1 — Telefonda tarayıcı menüsünden “Ana ekrana ekle”
          dediğinizde uygulama gibi çalışır ve internet olmadan da açılır.
        </p>
      </div>

      <ConfirmSheet
        open={confirmWipe}
        title="Tüm veri silinsin mi?"
        body="Öğrenciler, ders geçmişi ve ayarlar kalıcı olarak silinecek. Devam etmeden önce yedek almanız önerilir."
        confirmLabel="Evet, hepsini sil"
        destructive
        onConfirm={async () => {
          await wipeAll()
          toast.show('Tüm veri silindi.')
        }}
        onClose={() => setConfirmWipe(false)}
      />

      <ConfirmSheet
        open={pendingImport !== null}
        title="Yedek geri yüklensin mi?"
        body="Bu cihazdaki mevcut öğrenciler ve ders kayıtları silinip yedekteki verilerle değiştirilecek. Bu işlem geri alınamaz."
        confirmLabel="Geri yükle"
        destructive
        onConfirm={async () => {
          try {
            const res = await importBackup(pendingImport)
            toast.show(`${res.students} öğrenci, ${res.sessions} ders kaydı geri yüklendi.`)
          } catch (err) {
            toast.show(
              err instanceof BackupFormatError ? err.message : 'Yedek geri yüklenemedi.',
              { tone: 'error' },
            )
          }
        }}
        onClose={() => setPendingImport(null)}
      />
    </div>
  )
}
