import { useState, type ReactNode } from 'react'
import { ReportsPage } from './pages/ReportsPage.tsx'
import { SchedulePage } from './pages/SchedulePage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { StudentsPage } from './pages/StudentsPage.tsx'
import { ToastHost, cx } from './ui/primitives.tsx'
import { useLocalState } from './ui/hooks.ts'

type Tab = 'schedule' | 'students' | 'reports' | 'settings'

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  {
    id: 'schedule',
    label: 'Takvim',
    icon: (
      <>
        <rect x="3" y="4.5" width="14" height="12" rx="2" />
        <path d="M3 8h14M7 3v3M13 3v3" />
      </>
    ),
  },
  {
    id: 'students',
    label: 'Öğrenciler',
    icon: (
      <>
        <circle cx="7.5" cy="7" r="2.6" />
        <path d="M2.8 16c0-2.6 2.1-4.3 4.7-4.3s4.7 1.7 4.7 4.3" />
        <path d="M13.2 5.2a2.4 2.4 0 010 4.4M14.4 11.9c1.7.5 2.8 1.9 2.8 4.1" />
      </>
    ),
  },
  {
    id: 'reports',
    label: 'Rapor',
    icon: (
      <>
        <path d="M3.5 16.5h13" />
        <rect x="5" y="9" width="2.8" height="6" rx="1" />
        <rect x="9.6" y="5.5" width="2.8" height="9.5" rx="1" />
        <rect x="14.2" y="11.5" width="2.8" height="3.5" rx="1" />
      </>
    ),
  },
  {
    id: 'settings',
    label: 'Ayarlar',
    icon: (
      <>
        <circle cx="10" cy="10" r="2.6" />
        <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7" />
      </>
    ),
  },
]

export function App() {
  const [stored, setStored] = useLocalState<Tab>('mt:tab', 'schedule')
  const [tab, setTab] = useState<Tab>(stored)

  const go = (t: Tab) => {
    setTab(t)
    setStored(t)
  }

  return (
    <ToastHost>
      <div className="bg-ink-900 flex h-full flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col">
          {tab === 'schedule' && <SchedulePage />}
          {tab === 'students' && <StudentsPage />}
          {tab === 'reports' && <ReportsPage />}
          {tab === 'settings' && <SettingsPage />}
        </main>

        <nav className="border-ink-800 bg-ink-900 safe-bottom z-40 shrink-0 border-t">
          <ul className="flex">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <li key={t.id} className="flex-1">
                  <button
                    onClick={() => go(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex w-full flex-col items-center gap-0.5 py-2 transition',
                      active ? 'text-accent-soft' : 'text-ink-400 hover:text-ink-200',
                    )}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {t.icon}
                    </svg>
                    <span className="text-[10px] font-medium">{t.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </ToastHost>
  )
}
