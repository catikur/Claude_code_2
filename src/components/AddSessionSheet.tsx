import { useMemo, useState } from 'react'
import { addManualSession } from '../db/repo.ts'
import { durationLabel, formatFullDate, minToLabel } from '../domain/time.ts'
import type { Student } from '../domain/types.ts'
import { PLAN_TYPE_LABELS } from '../domain/types.ts'
import { dotStyle } from '../ui/colors.ts'
import {
  Button,
  EmptyState,
  Field,
  Select,
  Sheet,
  TextInput,
  cx,
  useToast,
} from '../ui/primitives.tsx'

const DURATIONS = [30, 45, 60, 75, 90, 120]

/** Turkce arama: buyuk/kucuk ve aksan farkini yok sayar. */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Bos bir slota dokununca acilir: ogrenci sec, dersi oraya koy.
 * Suruklemeye alternatif - tek eliyle telefon kullanan hoca icin daha hizli.
 */
export function AddSessionSheet({
  slot,
  students,
  defaultDuration,
  onClose,
}: {
  slot: { dateKey: string; slotStart: number } | null
  students: Student[]
  defaultDuration: number
  onClose: () => void
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [duration, setDuration] = useState(defaultDuration)
  const [makeup, setMakeup] = useState(false)

  const results = useMemo(() => {
    const active = students.filter((s) => s.active)
    const q = normalize(query.trim())
    if (!q) return active
    return active.filter((s) => normalize(s.name).includes(q))
  }, [students, query])

  if (!slot) return null

  const place = async (student: Student) => {
    await addManualSession({
      studentId: student.id,
      date: slot.dateKey,
      startMin: slot.slotStart,
      durationMin: duration,
      makeup: makeup || undefined,
    })
    toast.show(`${student.name} · ${minToLabel(slot.slotStart)} eklendi.`)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${formatFullDate(slot.dateKey)} · ${minToLabel(slot.slotStart)}`}
      footer={
        <Button variant="ghost" onClick={onClose} full>
          Kapat
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Süre">
            <Select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </Select>
          </Field>
          <label className="border-ink-700 bg-ink-900/60 mt-6 flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5">
            <input
              type="checkbox"
              checked={makeup}
              onChange={(e) => setMakeup(e.target.checked)}
              className="accent-accent h-4 w-4"
            />
            <span className="text-ink-100 text-sm">Telafi dersi</span>
          </label>
        </div>

        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Öğrenci ara…"
          autoFocus
        />

        {results.length === 0 ? (
          <EmptyState
            title="Öğrenci bulunamadı"
            description="Aramayı değiştirin ya da Öğrenciler sekmesinden yeni bir öğrenci ekleyin."
          />
        ) : (
          <ul className="divide-ink-800 border-ink-700 divide-y overflow-hidden rounded-xl border">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => void place(s)}
                  className="hover:bg-ink-700/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={dotStyle(s.color)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-100 block truncate text-sm font-medium">{s.name}</span>
                    <span className="text-ink-400 block text-xs">
                      {PLAN_TYPE_LABELS[s.planType]}
                    </span>
                  </span>
                  <span
                    className={cx(
                      'text-ink-400 shrink-0 text-xs',
                      s.planType === 'floating' && 'text-accent-soft',
                    )}
                  >
                    Ekle
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
