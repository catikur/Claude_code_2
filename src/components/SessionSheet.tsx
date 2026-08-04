import { useEffect, useState } from 'react'
import {
  moveSession,
  removeSession,
  resetToPlan,
  setSessionDuration,
  setSessionNote,
  setSessionStatus,
} from '../db/repo.ts'
import { durationLabel, formatFullDate, labelToMin, minToLabel } from '../domain/time.ts'
import type { ScheduledItem, SessionStatus } from '../domain/types.ts'
import { PLAN_TYPE_LABELS, SESSION_STATUS_LABELS } from '../domain/types.ts'
import { STATUS_STYLES } from '../ui/colors.ts'
import {
  Button,
  ConfirmSheet,
  Field,
  Select,
  Sheet,
  TextArea,
  TextInput,
  cx,
  useToast,
} from '../ui/primitives.tsx'

const STATUS_ORDER: SessionStatus[] = [
  'attended',
  'noshow',
  'cancelledByStudent',
  'cancelledByCoach',
]

const DURATIONS = [30, 45, 60, 75, 90, 120]

/**
 * Bir derse dokununca acilan panel. Hocanin en sik yaptigi is yoklama
 * isaretlemek oldugu icin durum dugmeleri en uste ve buyuk konur.
 */
export function SessionSheet({
  item,
  onClose,
  onOpenStudent,
}: {
  item: ScheduledItem | null
  onClose: () => void
  onOpenStudent: (studentId: string) => void
}) {
  const toast = useToast()
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (!item) return
    setTime(item.session.startMin === null ? '' : minToLabel(item.session.startMin))
    setNote(item.session.note ?? '')
  }, [item])

  if (!item) return null

  const { session, student } = item
  const isRule = session.source === 'rule'

  const applyStatus = async (status: SessionStatus) => {
    const previous = session.status
    await setSessionStatus(item, status)
    toast.show(`${student.name}: ${SESSION_STATUS_LABELS[status].toLowerCase()}`, {
      undo: () => void setSessionStatus(item, previous),
    })
    onClose()
  }

  const applyTime = async () => {
    const trimmed = time.trim()
    if (trimmed === '') {
      await moveSession(item, { date: session.date, startMin: null })
      toast.show(`${student.name} bekleme havuzuna alındı.`)
      onClose()
      return
    }
    const min = labelToMin(trimmed)
    if (min === null) {
      toast.show('Saati SS:DD biçiminde yazın (örn. 18:30).', { tone: 'error' })
      return
    }
    await moveSession(item, { date: session.date, startMin: min })
    toast.show(`${student.name} ${minToLabel(min)} saatine alındı.`)
    onClose()
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: `rgb(var(--c-${student.color}))` }}
              aria-hidden
            />
            <span className="truncate">{student.name}</span>
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(true)} className="flex-1">
              {isRule ? 'Bu haftayı iptal et' : 'Dersi sil'}
            </Button>
            <Button variant="primary" onClick={applyTime} className="flex-1">
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="text-ink-300 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>{formatFullDate(session.date)}</span>
            <span className="text-ink-600">·</span>
            <span className="tabular-nums">
              {session.startMin === null ? 'saat atanmadı' : minToLabel(session.startMin)}
            </span>
            <span className="text-ink-600">·</span>
            <span>{durationLabel(session.durationMin)}</span>
            <span
              className={cx(
                'ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold',
                STATUS_STYLES[session.status].chip,
              )}
            >
              {STATUS_STYLES[session.status].label}
            </span>
          </div>

          <div>
            <p className="text-ink-300 mb-2 text-xs font-medium tracking-wide uppercase">
              Yoklama
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.map((s) => (
                <Button
                  key={s}
                  onClick={() => void applyStatus(s)}
                  variant={session.status === s ? 'primary' : 'soft'}
                  className="text-[13px]"
                >
                  {SESSION_STATUS_LABELS[s]}
                </Button>
              ))}
              {/* Zaten planliysa "isareti kaldir" bir sey yapmaz; gosterilmez. */}
              {session.status !== 'planned' && (
                <Button
                  onClick={() => void applyStatus('planned')}
                  variant="ghost"
                  className="col-span-2 text-[13px]"
                >
                  İşareti kaldır (planlıya döndür)
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Saat" hint="Boş bırakırsan bekleme havuzuna döner.">
              <TextInput
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="18:30"
                inputMode="numeric"
              />
            </Field>
            <Field label="Süre">
              <Select
                value={String(session.durationMin)}
                onChange={(e) => void setSessionDuration(item, Number(e.target.value))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
                {!DURATIONS.includes(session.durationMin) && (
                  <option value={session.durationMin}>{durationLabel(session.durationMin)}</option>
                )}
              </Select>
            </Field>
          </div>

          <Field label="Not">
            <TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if ((session.note ?? '') !== note.trim()) void setSessionNote(item, note)
              }}
              placeholder="Sakatlık, ödeme, telafi…"
            />
          </Field>

          <div className="border-ink-700 flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-ink-400 text-xs">
              {PLAN_TYPE_LABELS[student.planType]}
              {session.source === 'manual' && ' · elle eklendi'}
              {session.makeup && ' · telafi'}
            </span>
            <button
              onClick={() => onOpenStudent(student.id)}
              className="text-accent-soft ml-auto text-xs font-medium hover:underline"
            >
              Öğrenciyi düzenle
            </button>
          </div>

          {isRule && !item.virtual && (
            <button
              onClick={async () => {
                await resetToPlan(item)
                toast.show('Ders haftalık plandaki haline döndü.')
                onClose()
              }}
              className="text-ink-400 hover:text-ink-200 text-xs underline"
            >
              Bu dersteki değişiklikleri geri al
            </button>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        title={isRule ? 'Bu haftalık iptal edilsin mi?' : 'Ders silinsin mi?'}
        body={
          isRule
            ? `${student.name} için ${formatFullDate(session.date)} dersi "hoca iptal etti" olarak işaretlenecek. Haftalık program bozulmaz, gelecek haftalar aynı kalır.`
            : `${student.name} için ${formatFullDate(session.date)} dersi tamamen silinecek. Bu işlem geri alınamaz.`
        }
        confirmLabel={isRule ? 'İptal et' : 'Sil'}
        destructive
        onConfirm={async () => {
          await removeSession(item)
          toast.show(isRule ? 'Ders iptal edildi.' : 'Ders silindi.')
          onClose()
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  )
}
