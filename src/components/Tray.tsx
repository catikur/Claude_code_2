import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { FloatingPoolEntry } from '../domain/schedule.ts'
import type { ScheduledItem, Student } from '../domain/types.ts'
import { WEEKDAY_SHORT } from '../domain/types.ts'
import { formatDayMonth, weekdayOf } from '../domain/time.ts'
import { cardStyle } from '../ui/colors.ts'
import { cx } from '../ui/primitives.tsx'
import { TrayCard } from './SessionCard.tsx'

/** Havuzdaki esnek ogrenci. Izgaraya birakilinca yeni ders olusur. */
function FloatingChip({ entry, onOpen }: { entry: FloatingPoolEntry; onOpen: (s: Student) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student:${entry.student.id}`,
    data: { kind: 'student', student: entry.student },
  })

  const done = entry.target !== undefined && entry.placed >= entry.target

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(entry.student)}
      style={cardStyle(entry.student.color, { muted: done })}
      className={cx(
        'flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition',
        'hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
        isDragging && 'opacity-25',
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: 'var(--dot)' }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="text-ink-100 block truncate text-[13px] leading-tight font-semibold">
          {entry.student.name}
        </span>
        <span
          className={cx(
            'block text-[11px] leading-tight tabular-nums',
            done ? 'text-emerald-300/80' : 'text-ink-300',
          )}
        >
          {entry.target !== undefined
            ? `${entry.placed}/${entry.target} yerleşti`
            : `${entry.placed} ders`}
        </span>
      </span>
    </button>
  )
}

/** Bir gunun bekleme havuzu; buraya birakilan ders saatini kaybeder. */
function DayDropZone({
  dateKey,
  items,
  onOpenItem,
  showDate,
}: {
  dateKey: string
  items: ScheduledItem[]
  onOpenItem: (item: ScheduledItem) => void
  showDate: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tray:${dateKey}`,
    data: { kind: 'tray', dateKey },
  })

  if (items.length === 0 && !showDate) return null

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'flex shrink-0 items-center gap-2 rounded-xl border border-dashed px-2 py-1.5 transition',
        isOver ? 'border-accent bg-accent/10' : 'border-ink-600 bg-ink-900/40',
      )}
    >
      <span className="text-ink-400 shrink-0 text-[10px] font-semibold tracking-wide uppercase">
        {WEEKDAY_SHORT[weekdayOf(dateKey)]}
        <span className="text-ink-500 ml-1 font-normal normal-case">
          {formatDayMonth(dateKey)}
        </span>
      </span>
      {items.length === 0 ? (
        <span className="text-ink-500 px-1 text-[11px]">boş</span>
      ) : (
        items.map((item) => (
          <TrayCard key={item.key} item={item} onOpen={onOpenItem} subtitle="saat bekliyor" />
        ))
      )}
    </div>
  )
}

/**
 * Izgaranin ustundeki bekleme seridi.
 *
 * Iki grup icerir:
 *  - "Saat bekleyen": gunu belli, saati belli olmayan ogrenciler. Gun gun ayrilir
 *    ki hoca hangi gunun doldurulmayi bekledigini gorsun.
 *  - "Esnek havuz": ne gunu ne saati belli olanlar. Hoca bunlari bosluklara koyar.
 */
export function Tray({
  dayKeys,
  pending,
  pool,
  onOpenItem,
  onOpenStudent,
}: {
  dayKeys: string[]
  pending: ScheduledItem[]
  pool: FloatingPoolEntry[]
  onOpenItem: (item: ScheduledItem) => void
  onOpenStudent: (s: Student) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const byDay = new Map<string, ScheduledItem[]>()
  for (const key of dayKeys) byDay.set(key, [])
  for (const item of pending) {
    const list = byDay.get(item.session.date)
    if (list) list.push(item)
  }

  const pendingCount = pending.length
  const poolPending = pool.filter((p) => p.target === undefined || p.placed < p.target).length
  const total = pendingCount + poolPending

  return (
    <div className="border-ink-800 bg-ink-900/95 border-b backdrop-blur">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="text-ink-300 hover:text-ink-100 flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition"
        aria-expanded={!collapsed}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cx('shrink-0 transition-transform', collapsed && '-rotate-90')}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span>Yerleştirilecekler</span>
        {total > 0 && (
          <span className="bg-accent/20 text-accent-soft rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums">
            {total}
          </span>
        )}
        {collapsed && total === 0 && <span className="text-ink-500">— hepsi yerleşti</span>}
      </button>

      {!collapsed && (
        <div className="space-y-1.5 px-3 pb-2.5">
          <div className="no-scrollbar flex items-stretch gap-2 overflow-x-auto pb-0.5">
            {dayKeys.map((key) => (
              <DayDropZone
                key={key}
                dateKey={key}
                items={byDay.get(key) ?? []}
                onOpenItem={onOpenItem}
                showDate={dayKeys.length <= 3 || (byDay.get(key)?.length ?? 0) > 0}
              />
            ))}
            {pendingCount === 0 && (
              <span className="text-ink-500 self-center px-1 text-[11px]">
                Saat bekleyen öğrenci yok.
              </span>
            )}
          </div>

          {pool.length > 0 && (
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
              <span className="text-ink-400 shrink-0 text-[10px] font-semibold tracking-wide uppercase">
                Esnek
              </span>
              {pool.map((entry) => (
                <FloatingChip key={entry.student.id} entry={entry} onOpen={onOpenStudent} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
