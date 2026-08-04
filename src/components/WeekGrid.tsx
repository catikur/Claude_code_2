import { useDroppable } from '@dnd-kit/core'
import { useEffect, useMemo, useRef } from 'react'
import { layoutDay } from '../domain/layout.ts'
import { hoursFor, utilization } from '../domain/schedule.ts'
import { minToLabel, slotStarts, todayKey, weekdayOf } from '../domain/time.ts'
import type { ScheduledItem, Settings } from '../domain/types.ts'
import { WEEKDAY_SHORT } from '../domain/types.ts'
import { cx } from '../ui/primitives.tsx'
import { SessionCard } from './SessionCard.tsx'

const GUTTER_PX = 52

function rowHeight(slotMin: number): number {
  if (slotMin >= 60) return 76
  if (slotMin >= 45) return 62
  return 50
}

function DropCell({
  dateKey,
  slotStart,
  height,
  closed,
  onAdd,
  last,
}: {
  dateKey: string
  slotStart: number
  height: number
  closed: boolean
  onAdd: (dateKey: string, slotStart: number) => void
  last: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${dateKey}:${slotStart}`,
    data: { kind: 'cell', dateKey, slotStart },
    disabled: closed,
  })

  return (
    <div
      ref={closed ? undefined : setNodeRef}
      style={{ height }}
      onClick={closed ? undefined : () => onAdd(dateKey, slotStart)}
      className={cx(
        'border-ink-800/80 relative',
        !last && 'border-b',
        closed
          ? 'bg-ink-950/60 cursor-not-allowed'
          : 'hover:bg-ink-800/40 cursor-copy transition-colors',
        isOver && 'bg-accent/20 ring-accent inset-0 ring-2 ring-inset',
      )}
      aria-label={closed ? undefined : `${dateKey} ${minToLabel(slotStart)} — ders ekle`}
    />
  )
}

/** Bugunun saatini gosteren yatay cizgi. */
function NowLine({ top }: { top: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
      style={{ top }}
      aria-hidden
    >
      <span className="bg-accent -ml-1 h-2 w-2 shrink-0 rounded-full" />
      <span className="bg-accent/70 h-px flex-1" />
    </div>
  )
}

export function WeekGrid({
  dayKeys,
  items,
  settings,
  conflictKeys,
  onOpenItem,
  onAddAt,
}: {
  dayKeys: string[]
  items: ScheduledItem[]
  settings: Settings
  conflictKeys: Set<string>
  onOpenItem: (item: ScheduledItem) => void
  onAddAt: (dateKey: string, slotStart: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const didScroll = useRef(false)
  const today = todayKey()
  const ROW = rowHeight(settings.slotMin)
  const pxPerMin = ROW / settings.slotMin

  // Gorunen gunlerin calisma saatlerinin birlesimi; sutunlar hizali kalsin diye
  // tum gunler ayni zaman araligini cizer, kapali saatler taranmis gosterilir.
  const { gridStart, gridEnd } = useMemo(() => {
    let start = Infinity
    let end = -Infinity
    for (const key of dayKeys) {
      const h = hoursFor(settings, weekdayOf(key))
      if (!h) continue
      start = Math.min(start, h.startMin)
      end = Math.max(end, h.endMin)
    }
    if (!Number.isFinite(start)) return { gridStart: 9 * 60, gridEnd: 22 * 60 }
    return { gridStart: start, gridEnd: end }
  }, [dayKeys, settings])

  const slots = useMemo(
    () => slotStarts(gridStart, gridEnd, settings.slotMin),
    [gridStart, gridEnd, settings.slotMin],
  )

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduledItem[]>()
    for (const key of dayKeys) map.set(key, [])
    for (const item of items) {
      const list = map.get(item.session.date)
      if (list) list.push(item)
    }
    return map
  }, [dayKeys, items])

  /**
   * Acilista dolu saatlere kaydirir; hoca sabahin bos satirlarina bakmasin.
   *
   * Once bugunun (yoksa ilk gorunen gunun) en erken dersi denenir. Haftanin
   * tamamindaki en erken dersi almak yanlis olurdu: Cumartesi 11:00'deki tek
   * bir ders, herkesin geldigi aksam saatlerini ekranin altinda birakirdi.
   */
  useEffect(() => {
    if (didScroll.current || slots.length === 0) return
    const el = scrollRef.current
    if (!el) return

    const earliestOn = (dayKey: string | null) =>
      items.reduce<number | null>((min, i) => {
        const s = i.session.startMin
        if (s === null) return min
        if (dayKey !== null && i.session.date !== dayKey) return min
        return min === null ? s : Math.min(min, s)
      }, null)

    const focusDay = dayKeys.includes(today) ? today : dayKeys[0]
    const target = earliestOn(focusDay) ?? earliestOn(null) ?? gridStart
    el.scrollTop = Math.max(0, (target - gridStart) * pxPerMin - ROW / 2)
    didScroll.current = true
  }, [items, slots.length, gridStart, pxPerMin, ROW, dayKeys, today])

  const nowTop = useMemo(() => {
    if (!dayKeys.includes(today)) return null
    const now = new Date()
    const min = now.getHours() * 60 + now.getMinutes()
    if (min < gridStart || min > gridEnd) return null
    return (min - gridStart) * pxPerMin
  }, [dayKeys, today, gridStart, gridEnd, pxPerMin])

  const bodyHeight = slots.length * ROW

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Gun basliklari */}
      <div className="border-ink-800 bg-ink-900/95 z-20 flex border-b backdrop-blur">
        <div className="shrink-0" style={{ width: GUTTER_PX }} />
        {dayKeys.map((key) => {
          const wd = weekdayOf(key)
          const hours = hoursFor(settings, wd)
          const dayItems = itemsByDay.get(key) ?? []
          const u = utilization(dayItems, key, hours, settings.slotMin, settings.capacityPerSlot)
          const isToday = key === today
          return (
            <div
              key={key}
              className={cx(
                'border-ink-800/70 min-w-0 flex-1 border-l px-1.5 py-1.5 text-center',
                isToday && 'bg-accent/8',
              )}
            >
              <div
                className={cx(
                  'text-[11px] font-semibold',
                  isToday ? 'text-accent-soft' : 'text-ink-200',
                )}
              >
                {WEEKDAY_SHORT[wd]}
                <span className="text-ink-400 ml-1 font-normal tabular-nums">
                  {Number(key.slice(8, 10))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1">
                {hours ? (
                  <>
                    <span className="bg-ink-700 h-1 w-8 overflow-hidden rounded-full">
                      <span
                        className={cx(
                          'block h-full rounded-full',
                          u.ratio >= 0.85
                            ? 'bg-emerald-400'
                            : u.ratio >= 0.5
                              ? 'bg-amber-400'
                              : 'bg-ink-500',
                        )}
                        style={{ width: `${Math.min(100, Math.round(u.ratio * 100))}%` }}
                      />
                    </span>
                    <span className="text-ink-400 text-[10px] tabular-nums">{u.used}</span>
                  </>
                ) : (
                  <span className="text-ink-500 text-[10px]">kapalı</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Izgara govdesi */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex" style={{ height: bodyHeight }}>
          {/* Saat sutunu */}
          <div className="bg-ink-900 sticky left-0 z-10 shrink-0" style={{ width: GUTTER_PX }}>
            {slots.map((slot, idx) => (
              <div
                key={slot}
                style={{ height: ROW }}
                className={cx(
                  'border-ink-800/80 relative',
                  idx !== slots.length - 1 && 'border-b',
                )}
              >
                <span className="text-ink-400 absolute -top-2 right-1.5 bg-ink-900 px-1 text-[10px] tabular-nums">
                  {minToLabel(slot)}
                </span>
              </div>
            ))}
          </div>

          {/* Gun sutunlari */}
          {dayKeys.map((key) => {
            const wd = weekdayOf(key)
            const hours = hoursFor(settings, wd)
            const dayItems = itemsByDay.get(key) ?? []
            const laid = layoutDay(dayItems)
            return (
              <div key={key} className="border-ink-800/70 relative min-w-0 flex-1 border-l">
                {slots.map((slot, idx) => (
                  <DropCell
                    key={slot}
                    dateKey={key}
                    slotStart={slot}
                    height={ROW}
                    last={idx === slots.length - 1}
                    closed={!hours || slot < hours.startMin || slot + settings.slotMin > hours.endMin}
                    onAdd={onAddAt}
                  />
                ))}

                {laid.map(({ item, lane, lanes }) => {
                  const start = item.session.startMin!
                  const top = (start - gridStart) * pxPerMin
                  const height = Math.max(30, item.session.durationMin * pxPerMin - 3)
                  const widthPct = 100 / lanes
                  return (
                    <SessionCard
                      key={item.key}
                      item={item}
                      conflicted={conflictKeys.has(item.key)}
                      compact={height < 46}
                      onOpen={onOpenItem}
                      style={{
                        top,
                        height,
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        zIndex: 10 + lane,
                      }}
                    />
                  )
                })}

                {nowTop !== null && key === today && <NowLine top={nowTop} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
