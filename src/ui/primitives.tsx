import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// ------------------------------------------------------------------ Sheet

/**
 * Mobilde alttan acilan panel, genis ekranda ortalanmis dialog.
 * Escape ile kapanir, acikken arka plan kaydirilmaz.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'animate-sheet-in bg-ink-850 border-ink-700 relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="border-ink-700 flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id={titleId} className="text-ink-100 min-w-0 truncate text-base font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="text-ink-300 hover:bg-ink-700 hover:text-ink-100 -mr-1 shrink-0 rounded-lg p-2 transition"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="border-ink-700 safe-bottom flex gap-2 border-t px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'ghost' | 'soft' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-soft active:bg-accent-dim',
  soft: 'bg-ink-700 text-ink-100 hover:bg-ink-600',
  ghost: 'text-ink-200 hover:bg-ink-700 hover:text-ink-100',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500',
}

export function Button({
  variant = 'soft',
  className,
  full,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition select-none',
        'disabled:pointer-events-none disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        full && 'w-full',
        className,
      )}
    />
  )
}

// ------------------------------------------------------------------ Field

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-ink-300 mb-1.5 block text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-ink-400 mt-1.5 block text-xs leading-snug">{hint}</span>}
    </label>
  )
}

const CONTROL =
  'w-full rounded-xl bg-ink-900 border border-ink-600 px-3 py-2.5 text-ink-100 placeholder:text-ink-400 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, 'resize-y', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, 'appearance-none pr-8', props.className)} />
}

// ------------------------------------------------------------- Segmented

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  size?: 'sm' | 'md'
}) {
  return (
    <div className="bg-ink-900 border-ink-700 inline-flex shrink-0 rounded-xl border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            'rounded-lg font-medium transition',
            size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
            value === o.value
              ? 'bg-ink-600 text-ink-100 shadow-sm'
              : 'text-ink-300 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Toast

interface ToastMessage {
  id: number
  text: string
  tone: 'info' | 'error'
  /** Geri alma eylemi - varsa toast'ta buton cikar. */
  undo?: () => void
}

interface ToastApi {
  show: (text: string, opts?: { undo?: () => void; tone?: 'info' | 'error' }) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([])
  const seq = useRef(0)

  const show = useCallback<ToastApi['show']>((text, opts) => {
    const id = ++seq.current
    setItems((prev) => [...prev.slice(-2), { id, text, undo: opts?.undo, tone: opts?.tone ?? 'info' }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'animate-sheet-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl',
              t.tone === 'error'
                ? 'border-rose-500/40 bg-rose-950/95 text-rose-100'
                : 'border-ink-600 bg-ink-800/95 text-ink-100',
            )}
          >
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.undo && (
              <button
                onClick={() => {
                  t.undo?.()
                  setItems((prev) => prev.filter((x) => x.id !== t.id))
                }}
                className="text-accent-soft shrink-0 font-semibold hover:underline"
              >
                Geri al
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ------------------------------------------------------------------ Misc

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <p className="text-ink-200 text-sm font-medium">{title}</p>
      {description && <p className="text-ink-400 max-w-xs text-xs leading-relaxed">{description}</p>}
      {action}
    </div>
  )
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Yikici islemler icin onay penceresi. */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Vazgeç
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-ink-200 text-sm leading-relaxed">{body}</p>
    </Sheet>
  )
}
