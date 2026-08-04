import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { AddSessionSheet } from '../components/AddSessionSheet.tsx'
import { AttendanceSheet } from '../components/AttendanceSheet.tsx'
import { SessionSheet } from '../components/SessionSheet.tsx'
import { StudentSheet } from '../components/StudentSheet.tsx'
import { Tray } from '../components/Tray.tsx'
import { WeekGrid } from '../components/WeekGrid.tsx'
import { useSessionsAround, useSettings, useStudents } from '../db/queries.ts'
import { addManualSession, moveSession } from '../db/repo.ts'
import { buildItems, findConflicts, floatingPool, pendingItems } from '../domain/schedule.ts'
import {
  addDays,
  formatDayMonth,
  formatFullDate,
  formatWeekRange,
  minToLabel,
  startOfWeek,
  todayKey,
  weekDays,
} from '../domain/time.ts'
import type { ScheduledItem, Student } from '../domain/types.ts'
import { WEEKDAY_LABELS } from '../domain/types.ts'
import { weekdayOf } from '../domain/time.ts'
import { cardStyle, suggestColor } from '../ui/colors.ts'
import { useLocalState, useMediaQuery } from '../ui/hooks.ts'
import { Button, EmptyState, Segmented, cx, useToast } from '../ui/primitives.tsx'

type ViewMode = 'day' | 'three' | 'week'

const SPAN: Record<ViewMode, number> = { day: 1, three: 3, week: 7 }

export function SchedulePage() {
  const toast = useToast()
  const settings = useSettings()
  const students = useStudents()

  const isWide = useMediaQuery('(min-width: 900px)')
  const [storedMode, setStoredMode] = useLocalState<ViewMode>('mt:viewMode', 'week')
  // Dar ekranda haftanin 7 sutunu okunmaz hale gelir; ilk acilista gune duser.
  const [mode, setMode] = useState<ViewMode>(() => (isWide ? storedMode : 'day'))
  const [anchor, setAnchor] = useState(todayKey())

  const [openItem, setOpenItem] = useState<ScheduledItem | null>(null)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [studentSheetOpen, setStudentSheetOpen] = useState(false)
  const [addSlot, setAddSlot] = useState<{ dateKey: string; slotStart: number } | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [dragging, setDragging] = useState<ScheduledItem | Student | null>(null)

  const dayKeys = useMemo(() => {
    if (mode === 'week') return weekDays(startOfWeek(anchor))
    return Array.from({ length: SPAN[mode] }, (_, i) => addDays(anchor, i))
  }, [mode, anchor])

  const rangeStart = dayKeys[0]
  const rangeEnd = dayKeys[dayKeys.length - 1]
  const sessions = useSessionsAround(rangeStart, rangeEnd)

  const items = useMemo(() => {
    if (!students || !sessions) return []
    return buildItems(students, sessions, dayKeys)
  }, [students, sessions, dayKeys])

  const conflictKeys = useMemo(() => {
    if (!settings) return new Set<string>()
    const set = new Set<string>()
    for (const c of findConflicts(items, settings.capacityPerSlot)) {
      set.add(c.a.key)
      set.add(c.b.key)
    }
    return set
  }, [items, settings])

  const pending = useMemo(() => pendingItems(items), [items])
  const pool = useMemo(() => floatingPool(students ?? [], items), [students, items])

  const attendanceDate = dayKeys.includes(todayKey()) ? todayKey() : rangeStart
  const unmarkedToday = items.filter(
    (i) =>
      i.session.date === attendanceDate &&
      i.session.startMin !== null &&
      i.session.status === 'planned',
  ).length

  const sensors = useSensors(
    // Fare: 6px surukleyince baslar, boylece tiklama ile karismaz.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Dokunmatik: 180ms basili tutunca baslar, boylece sayfa kaydirma calisir.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  useEffect(() => {
    document.body.classList.toggle('dragging-active', dragging !== null)
    return () => document.body.classList.remove('dragging-active')
  }, [dragging])

  const changeMode = (m: ViewMode) => {
    setMode(m)
    if (isWide) setStoredMode(m)
    // Haftaya gecerken hafta basina hizalanir, gune donerken bugune yakin kalir.
    if (m === 'week') setAnchor((a) => startOfWeek(a))
  }

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current
    if (data?.kind === 'item') setDragging(data.item as ScheduledItem)
    else if (data?.kind === 'student') setDragging(data.student as Student)
  }

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const active = e.active.data.current
    const over = e.over?.data.current
    if (!active || !over || !settings) return

    const target =
      over.kind === 'cell'
        ? { date: over.dateKey as string, startMin: over.slotStart as number }
        : over.kind === 'tray'
          ? { date: over.dateKey as string, startMin: null }
          : null
    if (!target) return

    if (active.kind === 'item') {
      const item = active.item as ScheduledItem
      const before = { date: item.session.date, startMin: item.session.startMin }
      if (before.date === target.date && before.startMin === target.startMin) return
      await moveSession(item, target)
      toast.show(
        target.startMin === null
          ? `${item.student.name} bekleme havuzuna alındı.`
          : `${item.student.name} → ${formatDayMonth(target.date)} ${minToLabel(target.startMin)}`,
        { undo: () => void moveSession(item, before) },
      )
      return
    }

    if (active.kind === 'student') {
      const student = active.student as Student
      await addManualSession({
        studentId: student.id,
        date: target.date,
        startMin: target.startMin,
        durationMin: settings.defaultDurationMin,
      })
      toast.show(
        target.startMin === null
          ? `${student.name} ${formatDayMonth(target.date)} bekleme havuzuna eklendi.`
          : `${student.name} → ${formatDayMonth(target.date)} ${minToLabel(target.startMin)}`,
      )
    }
  }

  if (!settings || !students) {
    return <div className="text-ink-400 p-8 text-center text-sm">Yükleniyor…</div>
  }

  const title =
    mode === 'week'
      ? formatWeekRange(dayKeys[0])
      : mode === 'day'
        ? `${WEEKDAY_LABELS[weekdayOf(anchor)]}, ${formatFullDate(anchor)}`
        : `${formatDayMonth(rangeStart)} – ${formatDayMonth(rangeEnd)}`

  const step = SPAN[mode]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Ust bar */}
        <header className="border-ink-800 bg-ink-900 safe-top z-30 shrink-0 border-b">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="border-ink-700 flex shrink-0 overflow-hidden rounded-xl border">
              <button
                onClick={() => setAnchor((a) => addDays(a, -step))}
                aria-label="Önceki"
                className="text-ink-300 hover:bg-ink-700 hover:text-ink-100 px-2.5 py-2 transition"
              >
                <Chevron dir="left" />
              </button>
              <button
                onClick={() => setAnchor(mode === 'week' ? startOfWeek(todayKey()) : todayKey())}
                className="border-ink-700 text-ink-200 hover:bg-ink-700 hover:text-ink-100 border-x px-2.5 py-2 text-xs font-medium transition"
              >
                Bugün
              </button>
              <button
                onClick={() => setAnchor((a) => addDays(a, step))}
                aria-label="Sonraki"
                className="text-ink-300 hover:bg-ink-700 hover:text-ink-100 px-2.5 py-2 transition"
              >
                <Chevron dir="right" />
              </button>
            </div>

            <h1 className="text-ink-100 min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
          </div>

          <div className="flex items-center gap-2 px-3 pb-2">
            <Segmented
              size="sm"
              value={mode}
              onChange={changeMode}
              options={[
                { value: 'day', label: 'Gün' },
                { value: 'three', label: '3 Gün' },
                { value: 'week', label: 'Hafta' },
              ]}
            />
            <button
              onClick={() => setAttendanceOpen(true)}
              className={cx(
                'ml-auto shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition',
                unmarkedToday > 0
                  ? 'bg-accent/15 text-accent-soft hover:bg-accent/25'
                  : 'text-ink-300 hover:bg-ink-700 hover:text-ink-100',
              )}
            >
              Yoklama
              {unmarkedToday > 0 && (
                <span className="bg-accent ml-1.5 rounded-full px-1.5 py-px text-[10px] text-white tabular-nums">
                  {unmarkedToday}
                </span>
              )}
            </button>
            <Button
              variant="primary"
              className="!min-h-9 shrink-0 !px-3 text-xs"
              aria-label="Yeni öğrenci ekle"
              onClick={() => {
                setEditStudent(null)
                setStudentSheetOpen(true)
              }}
            >
              {/* Dar ekranda yalnizca artiya duser; araç çubuğu tek satirda kalsin. */}
              <span aria-hidden>+</span>
              <span className="hidden sm:inline">Öğrenci</span>
            </Button>
          </div>
        </header>

        <Tray
          dayKeys={dayKeys}
          pending={pending}
          pool={pool}
          onOpenItem={setOpenItem}
          onOpenStudent={(s) => {
            setEditStudent(s)
            setStudentSheetOpen(true)
          }}
        />

        {students.length === 0 ? (
          <EmptyState
            title="Henüz öğrenci yok"
            description="Önce öğrencileri ekleyin. Sabit programı olanlar takvime kendiliğinden düşer; günü ya da saati esnek olanlar üstteki bekleme şeridinde çıkar."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setEditStudent(null)
                  setStudentSheetOpen(true)
                }}
              >
                İlk öğrenciyi ekle
              </Button>
            }
          />
        ) : (
          <WeekGrid
            dayKeys={dayKeys}
            items={items}
            settings={settings}
            conflictKeys={conflictKeys}
            onOpenItem={setOpenItem}
            onAddAt={(dateKey, slotStart) => setAddSlot({ dateKey, slotStart })}
          />
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div
            style={cardStyle('student' in dragging ? dragging.student.color : dragging.color)}
            className="pointer-events-none rounded-lg border px-2.5 py-2 text-[13px] font-semibold text-white shadow-2xl"
          >
            {'student' in dragging ? dragging.student.name : dragging.name}
          </div>
        )}
      </DragOverlay>

      <SessionSheet
        item={openItem}
        onClose={() => setOpenItem(null)}
        onOpenStudent={(id) => {
          const s = students.find((x) => x.id === id) ?? null
          setOpenItem(null)
          setEditStudent(s)
          setStudentSheetOpen(true)
        }}
      />

      <StudentSheet
        open={studentSheetOpen}
        student={editStudent}
        defaultDuration={settings.defaultDurationMin}
        suggestedColor={suggestColor(students.map((s) => s.color))}
        onClose={() => setStudentSheetOpen(false)}
      />

      <AddSessionSheet
        slot={addSlot}
        students={students}
        defaultDuration={settings.defaultDurationMin}
        onClose={() => setAddSlot(null)}
      />

      <AttendanceSheet
        open={attendanceOpen}
        dateKey={attendanceDate}
        items={items}
        onClose={() => setAttendanceOpen(false)}
      />
    </DndContext>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
