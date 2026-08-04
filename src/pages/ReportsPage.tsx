import { useMemo, useState } from 'react'
import { useSessionsAround, useSettings, useStudents } from '../db/queries.ts'
import { buildItems } from '../domain/schedule.ts'
import {
  dormantStudents,
  heatmap,
  rangeSummary,
  statsToCsv,
  studentStats,
  type StudentStats,
} from '../domain/stats.ts'
import {
  addDays,
  daysBetween,
  endOfMonth,
  formatFullDate,
  minToLabel,
  startOfMonth,
  startOfWeek,
  todayKey,
} from '../domain/time.ts'
import type { ScheduledItem, Weekday } from '../domain/types.ts'
import { SESSION_STATUS_LABELS, WEEKDAYS, WEEKDAY_SHORT } from '../domain/types.ts'
import { dotStyle, STATUS_STYLES } from '../ui/colors.ts'
import { Button, EmptyState, Field, Sheet, TextInput, cx, useToast } from '../ui/primitives.tsx'

type Preset = 'week' | 'month' | 'lastMonth' | 'quarter' | 'custom'

/**
 * Hazir tarih araliklari.
 *
 * "Bu ay" bilerek ayin sonuna degil BUGUNE kadar gider: rapor olup bitmisi
 * anlatmali. Ay sonuna kadar uzatilsaydi henuz yapilmamis dersler de sayilir,
 * "kac kez geldi" sorusunun cevabi sismis gorunurdu.
 */
function presetRange(preset: Preset, custom: { from: string; to: string }) {
  const today = todayKey()
  switch (preset) {
    case 'week':
      return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
    case 'month':
      return { from: startOfMonth(today), to: today }
    case 'lastMonth': {
      const lastMonthDay = addDays(startOfMonth(today), -1)
      return { from: startOfMonth(lastMonthDay), to: endOfMonth(lastMonthDay) }
    }
    case 'quarter':
      return { from: addDays(today, -89), to: today }
    case 'custom':
      return custom
  }
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="border-ink-700 bg-ink-850 rounded-xl border px-3 py-2.5">
      <div
        className={cx(
          'text-xl font-semibold tabular-nums',
          tone === 'good'
            ? 'text-emerald-300'
            : tone === 'warn'
              ? 'text-amber-300'
              : tone === 'bad'
                ? 'text-rose-300'
                : 'text-ink-100',
        )}
      >
        {value}
      </div>
      <div className="text-ink-400 mt-0.5 text-[11px] leading-tight">{label}</div>
    </div>
  )
}

/** Gun x saat yogunluk haritasi - hangi saatler dolu, hangileri bos. */
function Heatmap({ items }: { items: ScheduledItem[] }) {
  const cells = useMemo(() => heatmap(items), [items])
  const { hours, max, byKey } = useMemo(() => {
    const byKey = new Map<string, number>()
    let max = 0
    let min = 23
    let maxH = 0
    for (const c of cells) {
      byKey.set(`${c.weekday}:${c.hour}`, c.count)
      max = Math.max(max, c.count)
      min = Math.min(min, c.hour)
      maxH = Math.max(maxH, c.hour)
    }
    const hours = cells.length === 0 ? [] : Array.from({ length: maxH - min + 1 }, (_, i) => min + i)
    return { hours, max, byKey }
  }, [cells])

  if (hours.length === 0) {
    return <p className="text-ink-500 px-1 py-4 text-xs">Bu aralıkta veri yok.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-9" />
            {WEEKDAYS.map((wd) => (
              <th key={wd} className="text-ink-400 px-1 pb-1 text-[10px] font-medium">
                {WEEKDAY_SHORT[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <td className="text-ink-400 pr-1 text-right text-[10px] tabular-nums">
                {String(h).padStart(2, '0')}
              </td>
              {WEEKDAYS.map((wd) => {
                const n = byKey.get(`${wd as Weekday}:${h}`) ?? 0
                const alpha = max === 0 ? 0 : n / max
                return (
                  <td key={wd} className="p-0">
                    <div
                      title={`${WEEKDAY_SHORT[wd]} ${String(h).padStart(2, '0')}:00 — ${n} ders`}
                      className="border-ink-800 flex h-6 w-9 items-center justify-center rounded border text-[10px] font-semibold tabular-nums"
                      style={{
                        background:
                          n === 0 ? 'transparent' : `rgb(240 81 43 / ${0.15 + alpha * 0.65})`,
                        color: alpha > 0.5 ? '#fff' : undefined,
                      }}
                    >
                      {n > 0 ? n : ''}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Bir ogrencinin secili aralikaki tum ders gecmisi. */
function HistorySheet({
  row,
  items,
  onClose,
}: {
  row: StudentStats | null
  items: ScheduledItem[]
  onClose: () => void
}) {
  const history = useMemo(() => {
    if (!row) return []
    return items
      .filter((i) => i.session.studentId === row.student.id)
      .sort((a, b) =>
        a.session.date === b.session.date
          ? (b.session.startMin ?? 0) - (a.session.startMin ?? 0)
          : b.session.date.localeCompare(a.session.date),
      )
  }, [row, items])

  if (!row) return null

  return (
    <Sheet open onClose={onClose} wide title={`${row.student.name} · ders geçmişi`}>
      {history.length === 0 ? (
        <EmptyState title="Bu aralıkta ders yok" />
      ) : (
        <ul className="divide-ink-800 border-ink-700 divide-y overflow-hidden rounded-xl border">
          {history.map((i) => (
            <li key={i.key} className="flex items-center gap-3 px-3 py-2">
              <span className="text-ink-300 w-32 shrink-0 text-xs">
                {formatFullDate(i.session.date)}
              </span>
              <span className="text-ink-400 w-12 shrink-0 text-xs tabular-nums">
                {i.session.startMin === null ? '—' : minToLabel(i.session.startMin)}
              </span>
              <span
                className={cx(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  STATUS_STYLES[i.session.status].chip,
                )}
              >
                {SESSION_STATUS_LABELS[i.session.status]}
              </span>
              {i.session.note && (
                <span className="text-ink-400 min-w-0 flex-1 truncate text-xs">
                  {i.session.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

export function ReportsPage() {
  const toast = useToast()
  const students = useStudents()
  const settings = useSettings()
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState({ from: startOfMonth(todayKey()), to: todayKey() })
  const [detail, setDetail] = useState<StudentStats | null>(null)

  const range = presetRange(preset, custom)
  const valid = range.from <= range.to
  const sessions = useSessionsAround(range.from, range.to)

  const items = useMemo(() => {
    if (!students || !sessions || !valid) return []
    return buildItems(students, sessions, daysBetween(range.from, range.to))
  }, [students, sessions, range.from, range.to, valid])

  const rows = useMemo(() => {
    if (!students) return []
    return studentStats(items, students).filter((r) => r.scheduled > 0 || r.student.active)
  }, [items, students])

  const summary = useMemo(() => rangeSummary(rows), [rows])
  const dormant = useMemo(() => dormantStudents(rows), [rows])

  const download = () => {
    const blob = new Blob([statsToCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `muay-thai-rapor-${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.show('Rapor CSV olarak indirildi.')
  }

  if (!students || !settings) {
    return <div className="text-ink-400 p-8 text-center text-sm">Yükleniyor…</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-ink-800 bg-ink-900 safe-top shrink-0 space-y-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-ink-100 flex-1 text-sm font-semibold">Rapor</h1>
          <Button
            className="!min-h-9 !px-3 text-xs"
            onClick={download}
            disabled={rows.length === 0}
          >
            CSV indir
          </Button>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(
            [
              ['week', 'Bu hafta'],
              ['month', 'Bu ay'],
              ['lastMonth', 'Geçen ay'],
              ['quarter', 'Son 90 gün'],
              ['custom', 'Özel'],
            ] as Array<[Preset, string]>
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
              className={cx(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                preset === p
                  ? 'bg-ink-600 text-ink-100'
                  : 'bg-ink-900 border-ink-700 text-ink-300 hover:text-ink-100 border',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Başlangıç">
              <TextInput
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="!py-2 text-sm"
              />
            </Field>
            <Field label="Bitiş">
              <TextInput
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="!py-2 text-sm"
              />
            </Field>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {!valid ? (
          <EmptyState
            title="Tarih aralığı geçersiz"
            description="Başlangıç tarihi bitiş tarihinden sonra olamaz."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Geldi" value={String(summary.attended)} tone="good" />
              <Tile label="Gelmedi" value={String(summary.noshow)} tone="warn" />
              <Tile
                label="İptal (öğrenci)"
                value={String(summary.cancelledByStudent)}
                tone="bad"
              />
              <Tile
                label="Katılım oranı"
                value={
                  summary.attendanceRate === null
                    ? '—'
                    : `%${Math.round(summary.attendanceRate * 100)}`
                }
              />
            </div>

            {summary.unmarked > 0 && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
                <strong className="tabular-nums">{summary.unmarked}</strong> geçmiş ders henüz
                işaretlenmemiş. Bunlar katılım oranına dahil edilmiyor — Takvim sekmesindeki
                “Yoklama” düğmesinden hızlıca işaretleyebilirsiniz.
              </p>
            )}

            <section>
              <h2 className="text-ink-300 mb-2 text-xs font-semibold tracking-wide uppercase">
                Öğrenci bazında
              </h2>
              {rows.length === 0 ? (
                <EmptyState title="Bu aralıkta kayıt yok" />
              ) : (
                <div className="border-ink-700 overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-ink-800 text-ink-400 border-b text-[11px]">
                        <th className="px-3 py-2 text-left font-medium">Öğrenci</th>
                        <th className="px-2 py-2 text-right font-medium">Toplam</th>
                        <th className="px-2 py-2 text-right font-medium">Geldi</th>
                        <th className="px-2 py-2 text-right font-medium">Gelmedi</th>
                        <th className="px-2 py-2 text-right font-medium">İptal</th>
                        <th className="px-2 py-2 text-right font-medium">İşaretsiz</th>
                        <th className="px-3 py-2 text-right font-medium">Katılım</th>
                      </tr>
                    </thead>
                    <tbody className="divide-ink-800 divide-y">
                      {rows.map((r) => (
                        <tr
                          key={r.student.id}
                          onClick={() => setDetail(r)}
                          className="hover:bg-ink-850 cursor-pointer transition"
                        >
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={dotStyle(r.student.color)}
                                aria-hidden
                              />
                              <span className="text-ink-100 truncate">{r.student.name}</span>
                              {!r.student.active && (
                                <span className="text-ink-500 text-[10px]">pasif</span>
                              )}
                            </span>
                          </td>
                          <td className="text-ink-400 px-2 py-2 text-right tabular-nums">
                            {r.scheduled || ''}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-300">
                            {r.attended || ''}
                          </td>
                          <td className="text-ink-300 px-2 py-2 text-right tabular-nums">
                            {r.noshow || ''}
                          </td>
                          <td className="text-ink-300 px-2 py-2 text-right tabular-nums">
                            {r.cancelledByStudent + r.cancelledByCoach || ''}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-amber-300/80">
                            {r.unmarked || ''}
                          </td>
                          <td className="text-ink-100 px-3 py-2 text-right tabular-nums">
                            {r.attendanceRate === null
                              ? '—'
                              : `%${Math.round(r.attendanceRate * 100)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {dormant.length > 0 && (
              <section>
                <h2 className="text-ink-300 mb-2 text-xs font-semibold tracking-wide uppercase">
                  Bu aralıkta hiç gelmeyenler
                </h2>
                <ul className="border-ink-700 divide-ink-800 divide-y overflow-hidden rounded-xl border">
                  {dormant.map((r) => (
                    <li
                      key={r.student.id}
                      onClick={() => setDetail(r)}
                      className="hover:bg-ink-850 flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={dotStyle(r.student.color)}
                        aria-hidden
                      />
                      <span className="text-ink-100 min-w-0 flex-1 truncate text-sm">
                        {r.student.name}
                      </span>
                      <span className="text-ink-400 shrink-0 text-xs">
                        {r.lastAttendedDate
                          ? `son geliş ${formatFullDate(r.lastAttendedDate)}`
                          : 'kayıtlı gelişi yok'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-ink-300 mb-2 text-xs font-semibold tracking-wide uppercase">
                Saat yoğunluğu
              </h2>
              <Heatmap items={items} />
              <p className="text-ink-500 mt-2 text-[11px] leading-relaxed">
                Koyu kutular dolu saatleri gösterir. Boş kalan saatleri görüp esnek öğrencileri
                oraya kaydırarak doluluğu artırabilirsiniz.
              </p>
            </section>
          </>
        )}
      </div>

      <HistorySheet row={detail} items={items} onClose={() => setDetail(null)} />
    </div>
  )
}
