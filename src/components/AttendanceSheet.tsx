import { useMemo, useState } from 'react'
import { bulkSetStatus, setSessionStatus } from '../db/repo.ts'
import { formatFullDate, minToLabel } from '../domain/time.ts'
import type { ScheduledItem, SessionStatus } from '../domain/types.ts'
import { dotStyle, STATUS_STYLES } from '../ui/colors.ts'
import { Button, EmptyState, Sheet, cx, useToast } from '../ui/primitives.tsx'

const QUICK: Array<{ status: SessionStatus; label: string; tone: string }> = [
  { status: 'attended', label: 'Geldi', tone: 'bg-emerald-500/20 text-emerald-300' },
  { status: 'noshow', label: 'Gelmedi', tone: 'bg-amber-500/20 text-amber-300' },
  { status: 'cancelledByStudent', label: 'İptal', tone: 'bg-rose-500/20 text-rose-300' },
]

/**
 * Gun sonu yoklama ekrani.
 *
 * Kartlari tek tek acmak yerine gunun tum derslerini tek listede gosterip
 * her birine tek dokunusla durum atamayi saglar - hocanin gunluk rutini bu.
 */
export function AttendanceSheet({
  open,
  dateKey,
  items,
  onClose,
}: {
  open: boolean
  dateKey: string
  items: ScheduledItem[]
  onClose: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const dayItems = useMemo(
    () =>
      items
        .filter((i) => i.session.date === dateKey && i.session.startMin !== null)
        .sort((a, b) => a.session.startMin! - b.session.startMin!),
    [items, dateKey],
  )

  const unmarked = dayItems.filter((i) => i.session.status === 'planned')

  const markAll = async () => {
    setBusy(true)
    try {
      const n = await bulkSetStatus(unmarked, 'attended')
      toast.show(`${n} ders “geldi” olarak işaretlendi.`)
      if (n > 0) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={`Yoklama · ${formatFullDate(dateKey)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Kapat
          </Button>
          <Button
            variant="primary"
            onClick={markAll}
            disabled={busy || unmarked.length === 0}
            className="flex-1"
          >
            Kalan {unmarked.length} kişi geldi
          </Button>
        </>
      }
    >
      {dayItems.length === 0 ? (
        <EmptyState
          title="Bu güne yerleşmiş ders yok"
          description="Takvimde boş bir saate dokunarak ya da bekleyen kartları sürükleyerek ders ekleyebilirsiniz."
        />
      ) : (
        <ul className="divide-ink-800 border-ink-700 divide-y overflow-hidden rounded-xl border">
          {dayItems.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={dotStyle(item.student.color)}
                aria-hidden
              />
              <span className="text-ink-400 w-11 shrink-0 text-xs tabular-nums">
                {minToLabel(item.session.startMin!)}
              </span>
              <span className="text-ink-100 min-w-0 flex-1 truncate text-sm font-medium">
                {item.student.name}
              </span>
              {/* Dar ekranda dugmeler alt satira gecer; isim kirpilmasin. */}
              <span className="flex w-full shrink-0 gap-1 sm:w-auto">
                {QUICK.map((q) => {
                  const active = item.session.status === q.status
                  return (
                    <button
                      key={q.status}
                      onClick={() =>
                        void setSessionStatus(item, active ? 'planned' : q.status)
                      }
                      aria-pressed={active}
                      aria-label={`${item.student.name}: ${q.label}`}
                      className={cx(
                        'min-h-9 flex-1 rounded-lg px-2.5 text-xs font-semibold transition sm:flex-none',
                        active ? q.tone : 'bg-ink-800 text-ink-400 hover:text-ink-100',
                      )}
                    >
                      {q.label}
                    </button>
                  )
                })}
              </span>
              {item.session.status === 'cancelledByCoach' && (
                <span
                  className={cx(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    STATUS_STYLES.cancelledByCoach.chip,
                  )}
                >
                  Hoca iptal etti
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
