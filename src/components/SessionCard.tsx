import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties } from 'react'
import type { ScheduledItem } from '../domain/types.ts'
import { durationLabel, minToLabel } from '../domain/time.ts'
import { cardStyle, isDimmed, STATUS_STYLES } from '../ui/colors.ts'
import { cx } from '../ui/primitives.tsx'

/**
 * Takvimdeki tek ders karti. Hem surukleme tutamaci hem de detay panelini acan
 * dugmedir: kisa dokunus paneli acar, basili tutup kaydirmak dersi tasir.
 */
export function SessionCard({
  item,
  style,
  onOpen,
  compact,
  conflicted,
}: {
  item: ScheduledItem
  style?: CSSProperties
  onOpen: (item: ScheduledItem) => void
  compact?: boolean
  conflicted?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item:${item.key}`,
    data: { kind: 'item', item },
  })

  const { session, student } = item
  const dimmed = isDimmed(session.status)
  const status = STATUS_STYLES[session.status]

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item)}
      style={{ ...style, ...cardStyle(student.color, { muted: dimmed }) }}
      className={cx(
        'group absolute flex flex-col overflow-hidden rounded-lg border px-2 py-1.5 text-left transition',
        'hover:z-20 hover:brightness-110 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
        isDragging && 'opacity-25',
        dimmed && 'line-through decoration-1 opacity-60',
        conflicted && 'ring-2 ring-rose-400/80',
      )}
      title={`${student.name} · ${session.startMin !== null ? minToLabel(session.startMin) : ''} · ${status.label}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: 'var(--dot)' }}
          aria-hidden
        />
        <span className="text-ink-100 min-w-0 flex-1 truncate text-[13px] leading-tight font-semibold">
          {student.name}
        </span>
        {item.virtual && (
          <span
            className="bg-ink-100/25 h-1 w-1 shrink-0 rounded-full"
            title="Plandan geliyor, henüz işaretlenmedi"
            aria-hidden
          />
        )}
      </span>
      {!compact && (
        <span className="text-ink-300 mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
          <span className="shrink-0 tabular-nums">
            {session.startMin !== null && minToLabel(session.startMin)}
          </span>
          <span className="text-ink-500 shrink-0">·</span>
          <span className="shrink-0">{durationLabel(session.durationMin)}</span>
          {session.makeup && <span className="text-amber-300/90">· telafi</span>}
        </span>
      )}
      {session.status !== 'planned' && (
        <span
          className={cx(
            'mt-1 inline-flex w-fit rounded px-1 py-px text-[10px] font-semibold',
            status.chip,
          )}
        >
          {status.label}
        </span>
      )}
    </button>
  )
}

/**
 * Bekleme havuzundaki kart (saati henuz atanmamis ders).
 * Izgaradaki karttan farki: mutlak konumlanmaz, satir icinde akar.
 */
export function TrayCard({
  item,
  onOpen,
  subtitle,
}: {
  item: ScheduledItem
  onOpen: (item: ScheduledItem) => void
  subtitle?: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item:${item.key}`,
    data: { kind: 'item', item },
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item)}
      style={cardStyle(item.student.color)}
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
          {item.student.name}
        </span>
        <span className="text-ink-300 block text-[11px] leading-tight">
          {subtitle ?? durationLabel(item.session.durationMin)}
        </span>
      </span>
    </button>
  )
}
