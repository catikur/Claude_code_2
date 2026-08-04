import { useMemo, useState } from 'react'
import { StudentSheet } from '../components/StudentSheet.tsx'
import { useStudents } from '../db/queries.ts'
import { useSettings } from '../db/queries.ts'
import { durationLabel, minToLabel } from '../domain/time.ts'
import type { Student } from '../domain/types.ts'
import { PLAN_TYPE_LABELS, WEEKDAY_SHORT } from '../domain/types.ts'
import { dotStyle, suggestColor } from '../ui/colors.ts'
import { Button, EmptyState, Segmented, TextInput, cx } from '../ui/primitives.tsx'

type Filter = 'active' | 'passive' | 'all'

function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/** Ogrencinin haftalik programini tek satirda ozetler. */
function planSummary(s: Student): string {
  if (s.planType === 'floating') {
    return s.weeklyTarget ? `Esnek · haftada ${s.weeklyTarget} ders` : 'Esnek · havuzda bekler'
  }
  if (s.rules.length === 0) return 'Gün seçilmemiş'
  return s.rules
    .map((r) =>
      r.startMin === null
        ? WEEKDAY_SHORT[r.weekday]
        : `${WEEKDAY_SHORT[r.weekday]} ${minToLabel(r.startMin)}`,
    )
    .join(' · ')
}

export function StudentsPage() {
  const students = useStudents()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [editing, setEditing] = useState<Student | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const visible = useMemo(() => {
    if (!students) return []
    const q = normalize(query.trim())
    return students.filter((s) => {
      if (filter === 'active' && !s.active) return false
      if (filter === 'passive' && s.active) return false
      if (q && !normalize(s.name).includes(q)) return false
      return true
    })
  }, [students, query, filter])

  const counts = useMemo(() => {
    const active = students?.filter((s) => s.active).length ?? 0
    return { active, passive: (students?.length ?? 0) - active }
  }, [students])

  const openNew = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  if (!students || !settings) {
    return <div className="text-ink-400 p-8 text-center text-sm">Yükleniyor…</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-ink-800 bg-ink-900 safe-top shrink-0 space-y-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-ink-100 flex-1 text-sm font-semibold">
            Öğrenciler
            <span className="text-ink-400 ml-2 text-xs font-normal tabular-nums">
              {counts.active} aktif
              {counts.passive > 0 && ` · ${counts.passive} pasif`}
            </span>
          </h1>
          <Button variant="primary" className="!min-h-9 !px-3 text-xs" onClick={openNew}>
            + Yeni
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
            className="!py-2 text-sm"
          />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'passive', label: 'Pasif' },
            { value: 'all', label: 'Tümü' },
          ]}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState
            title={query ? 'Eşleşen öğrenci yok' : 'Bu listede öğrenci yok'}
            description={
              query
                ? 'Aramayı değiştirmeyi deneyin.'
                : 'Yeni öğrenci ekleyin; sabit programı olanlar takvime kendiliğinden düşer.'
            }
            action={
              !query ? (
                <Button variant="primary" onClick={openNew}>
                  Öğrenci ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-ink-800 divide-y">
            {visible.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setEditing(s)
                    setSheetOpen(true)
                  }}
                  className="hover:bg-ink-850 flex w-full items-center gap-3 px-3 py-3 text-left transition"
                >
                  <span
                    className={cx('h-2.5 w-2.5 shrink-0 rounded-full', !s.active && 'opacity-35')}
                    style={dotStyle(s.color)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        'block truncate text-sm font-medium',
                        s.active ? 'text-ink-100' : 'text-ink-400',
                      )}
                    >
                      {s.name}
                      {!s.active && <span className="text-ink-500 ml-2 text-xs">pasif</span>}
                    </span>
                    <span className="text-ink-400 block truncate text-xs">{planSummary(s)}</span>
                  </span>
                  <span className="text-ink-500 shrink-0 text-right text-[10px] leading-tight">
                    <span className="block">{PLAN_TYPE_LABELS[s.planType].split(',')[0]}</span>
                    {s.rules.length > 0 && (
                      <span className="block tabular-nums">
                        {durationLabel(s.rules[0].durationMin)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StudentSheet
        open={sheetOpen}
        student={editing}
        defaultDuration={settings.defaultDurationMin}
        suggestedColor={suggestColor(students.map((x) => x.color))}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
