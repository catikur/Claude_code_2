import { useEffect, useMemo, useState } from 'react'
import { newId } from '../db/db.ts'
import {
  createStudent,
  deactivateStudent,
  deleteStudentForever,
  updateStudent,
  type StudentInput,
} from '../db/repo.ts'
import { durationLabel, labelToMin, minToLabel } from '../domain/time.ts'
import type { ColorKey, PlanRule, PlanType, Student, Weekday } from '../domain/types.ts'
import { COLOR_KEYS, WEEKDAYS, WEEKDAY_SHORT } from '../domain/types.ts'
import { COLOR_LABELS, swatchStyle } from '../ui/colors.ts'
import {
  Button,
  ConfirmSheet,
  Field,
  Segmented,
  Select,
  Sheet,
  TextArea,
  TextInput,
  cx,
  useToast,
} from '../ui/primitives.tsx'

const DURATIONS = [30, 45, 60, 75, 90, 120]

interface Draft {
  name: string
  phone: string
  note: string
  planType: PlanType
  rules: PlanRule[]
  weeklyTarget: string
  color: ColorKey
  active: boolean
}

function toDraft(student: Student | null, defaults: { color: ColorKey }): Draft {
  if (!student) {
    return {
      name: '',
      phone: '',
      note: '',
      planType: 'fixed',
      rules: [],
      weeklyTarget: '',
      color: defaults.color,
      active: true,
    }
  }
  return {
    name: student.name,
    phone: student.phone ?? '',
    note: student.note ?? '',
    planType: student.planType,
    rules: student.rules,
    weeklyTarget: student.weeklyTarget === undefined ? '' : String(student.weeklyTarget),
    color: student.color,
    active: student.active,
  }
}

/** Gun secici: sabit/gun-sabit ogrenciler icin haftalik gunleri isaretler. */
function WeekdayPicker({
  selected,
  onToggle,
}: {
  selected: Set<Weekday>
  onToggle: (wd: Weekday) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((wd) => (
        <button
          key={wd}
          type="button"
          onClick={() => onToggle(wd)}
          aria-pressed={selected.has(wd)}
          className={cx(
            'rounded-lg py-2 text-xs font-semibold transition',
            selected.has(wd)
              ? 'bg-accent text-white'
              : 'bg-ink-900 border-ink-600 text-ink-300 hover:text-ink-100 border',
          )}
        >
          {WEEKDAY_SHORT[wd]}
        </button>
      ))}
    </div>
  )
}

export function StudentSheet({
  open,
  student,
  defaultDuration,
  suggestedColor,
  onClose,
}: {
  open: boolean
  /** null => yeni ogrenci. */
  student: Student | null
  defaultDuration: number
  suggestedColor: ColorKey
  onClose: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(student, { color: suggestedColor }),
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(toDraft(student, { color: suggestedColor }))
      setError(null)
    }
  }, [open, student, suggestedColor, defaultDuration])

  const selectedDays = useMemo(
    () => new Set(draft.rules.map((r) => r.weekday)),
    [draft.rules],
  )

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  /** Program tipi degisince kurallari yeni tipe uyarlar, veriyi atmaz. */
  const changePlanType = (planType: PlanType) => {
    setDraft((d) => {
      if (planType === 'floating') return { ...d, planType, rules: [] }
      const rules = d.rules.map((r) => ({
        ...r,
        // Gun sabit + saat esnek => saat bilgisi bosaltilir.
        startMin: planType === 'dayFixed' ? null : (r.startMin ?? 18 * 60),
      }))
      return { ...d, planType, rules }
    })
  }

  const toggleDay = (wd: Weekday) => {
    setDraft((d) => {
      const has = d.rules.some((r) => r.weekday === wd)
      if (has) return { ...d, rules: d.rules.filter((r) => r.weekday !== wd) }
      const rule: PlanRule = {
        id: newId(),
        weekday: wd,
        startMin: d.planType === 'dayFixed' ? null : 18 * 60,
        durationMin: defaultDuration,
      }
      return { ...d, rules: [...d.rules, rule].sort((a, b) => a.weekday - b.weekday) }
    })
  }

  const updateRule = (id: string, p: Partial<PlanRule>) =>
    setDraft((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...p } : r)) }))

  const save = async () => {
    const name = draft.name.trim()
    if (!name) {
      setError('Öğrencinin adını yazın.')
      return
    }
    if (draft.planType !== 'floating' && draft.rules.length === 0) {
      setError('En az bir gün seçin. Günü de belli değilse "Tamamen esnek" seçeneğini kullanın.')
      return
    }
    if (draft.planType === 'fixed' && draft.rules.some((r) => r.startMin === null)) {
      setError('Sabit programda her gün için bir saat girmelisiniz.')
      return
    }

    const targetNum = Number(draft.weeklyTarget)
    const input: StudentInput = {
      name,
      phone: draft.phone.trim() || undefined,
      note: draft.note.trim() || undefined,
      planType: draft.planType,
      rules: draft.rules,
      weeklyTarget:
        draft.weeklyTarget.trim() === '' || !Number.isFinite(targetNum) || targetNum <= 0
          ? undefined
          : Math.round(targetNum),
      color: draft.color,
      active: draft.active,
    }

    if (student) {
      await updateStudent(student.id, input)
      toast.show(`${name} güncellendi.`)
    } else {
      await createStudent(input)
      toast.show(`${name} eklendi.`)
    }
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        wide
        title={student ? 'Öğrenciyi düzenle' : 'Yeni öğrenci'}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Vazgeç
            </Button>
            <Button variant="primary" onClick={save} className="flex-1">
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad soyad">
              <TextInput
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Örn. Ahmet Yılmaz"
                autoFocus={!student}
              />
            </Field>
            <Field label="Telefon">
              <TextInput
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="0555 000 00 00"
                inputMode="tel"
              />
            </Field>
          </div>

          <Field
            label="Program tipi"
            hint={
              draft.planType === 'fixed'
                ? 'Her hafta aynı gün ve saatte takvime düşer.'
                : draft.planType === 'dayFixed'
                  ? 'Seçtiğiniz günlerde “saat bekliyor” olarak çıkar; saatini siz sürükleyerek verirsiniz.'
                  : 'Takvimde sabit yeri yoktur; esnek havuzda bekler, boşluklara siz yerleştirirsiniz.'
            }
          >
            <div className="flex flex-wrap gap-2">
              <Segmented
                value={draft.planType}
                onChange={changePlanType}
                options={[
                  { value: 'fixed', label: 'Sabit gün + saat' },
                  { value: 'dayFixed', label: 'Gün sabit' },
                  { value: 'floating', label: 'Esnek' },
                ]}
                size="sm"
              />
            </div>
          </Field>

          {draft.planType !== 'floating' && (
            <div className="space-y-3">
              <Field label="Günler">
                <WeekdayPicker selected={selectedDays} onToggle={toggleDay} />
              </Field>

              {draft.rules.length > 0 && (
                <div className="border-ink-700 bg-ink-900/60 divide-ink-800 divide-y rounded-xl border">
                  {draft.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-ink-200 w-10 shrink-0 text-xs font-semibold">
                        {WEEKDAY_SHORT[rule.weekday]}
                      </span>
                      {draft.planType === 'fixed' ? (
                        <TextInput
                          value={rule.startMin === null ? '' : minToLabel(rule.startMin)}
                          onChange={(e) => {
                            const min = labelToMin(e.target.value)
                            updateRule(rule.id, {
                              startMin: min ?? rule.startMin,
                            })
                          }}
                          placeholder="18:30"
                          inputMode="numeric"
                          className="!w-24 !py-1.5 text-sm"
                        />
                      ) : (
                        <span className="text-ink-400 flex-1 text-xs">saati hoca belirler</span>
                      )}
                      <Select
                        value={String(rule.durationMin)}
                        onChange={(e) => updateRule(rule.id, { durationMin: Number(e.target.value) })}
                        className="!w-28 !py-1.5 text-sm"
                      >
                        {DURATIONS.map((d) => (
                          <option key={d} value={d}>
                            {durationLabel(d)}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => toggleDay(rule.weekday)}
                        aria-label={`${WEEKDAY_SHORT[rule.weekday]} gününü kaldır`}
                        className="text-ink-400 hover:bg-ink-700 hover:text-rose-300 ml-auto rounded-lg p-1.5 transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                          <path
                            d="M5 5l10 10M15 5L5 15"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Haftalık hedef ders"
              hint="Havuzda “2/3 yerleşti” göstergesi için. Boş bırakabilirsiniz."
            >
              <TextInput
                value={draft.weeklyTarget}
                onChange={(e) => patch({ weeklyTarget: e.target.value.replace(/\D/g, '') })}
                placeholder="Örn. 2"
                inputMode="numeric"
              />
            </Field>
            <Field label="Kart rengi">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_KEYS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ color: c })}
                    aria-label={COLOR_LABELS[c]}
                    aria-pressed={draft.color === c}
                    style={swatchStyle(c)}
                    className={cx(
                      'h-7 w-7 rounded-full transition',
                      draft.color === c
                        ? 'ring-ink-100 ring-offset-ink-850 ring-2 ring-offset-2'
                        : 'opacity-60 hover:opacity-100',
                    )}
                  />
                ))}
              </div>
            </Field>
          </div>

          <Field label="Not">
            <TextArea
              rows={2}
              value={draft.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Seviye, sakatlık, paket bilgisi…"
            />
          </Field>

          <label className="border-ink-700 bg-ink-900/60 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => patch({ active: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
            <span className="min-w-0">
              <span className="text-ink-100 block text-sm font-medium">Aktif öğrenci</span>
              <span className="text-ink-400 block text-xs">
                Pasif öğrenciler takvimde çıkmaz ama geçmiş kayıtları raporlarda kalır.
              </span>
            </span>
          </label>

          {student && (
            <div className="border-ink-700 flex flex-wrap gap-3 border-t pt-4">
              {student.active && (
                <button
                  onClick={async () => {
                    await deactivateStudent(student.id)
                    toast.show(`${student.name} pasife alındı.`)
                    onClose()
                  }}
                  className="text-ink-300 hover:text-ink-100 text-xs underline"
                >
                  Pasife al
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-xs text-rose-400 underline hover:text-rose-300"
              >
                Kalıcı olarak sil
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {student && (
        <ConfirmSheet
          open={confirmDelete}
          title="Öğrenci kalıcı olarak silinsin mi?"
          body={
            <>
              <strong>{student.name}</strong> ve bu öğrenciye ait <em>tüm ders geçmişi</em>{' '}
              silinecek. Raporlarda da görünmez olur ve bu işlem geri alınamaz. Geçmişi korumak
              istiyorsanız “Pasife al” seçeneğini kullanın.
            </>
          }
          confirmLabel="Kalıcı olarak sil"
          destructive
          onConfirm={async () => {
            await deleteStudentForever(student.id)
            toast.show(`${student.name} silindi.`)
            onClose()
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
