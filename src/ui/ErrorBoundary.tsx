import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Bir veri hatasi tum uygulamayi bos ekrana dusurmesin diye son savunma hatti.
 * Hocanin elinde en azindan hatanin ne oldugu ve yedegini kurtarabilecegi bir
 * ekran kalir.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Uygulama hatasi:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-ink-100 text-base font-semibold">Bir şeyler ters gitti</h1>
        <p className="text-ink-400 max-w-sm text-sm leading-relaxed">
          Uygulama beklenmedik bir hatayla karşılaştı. Verileriniz cihazda duruyor; sayfayı
          yenilemek çoğu zaman yeterli olur.
        </p>
        <pre className="border-ink-700 bg-ink-850 text-ink-300 max-w-sm overflow-x-auto rounded-lg border px-3 py-2 text-left text-[11px]">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="bg-accent hover:bg-accent-soft min-h-11 rounded-xl px-5 text-sm font-medium text-white transition"
        >
          Sayfayı yenile
        </button>
      </div>
    )
  }
}
