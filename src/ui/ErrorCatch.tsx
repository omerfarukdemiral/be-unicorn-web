// Render-error fence for the panel body and the center screens. Without one React 19 unmounts the whole tree on a
// render error (blank screen, nothing opens); here the game keeps running, the box shows one line plus the raw
// message (a phone has no console: the player can screenshot it) and "Tekrar dene" renders the children again.
// F5: App also fences the scene and the whole game layer (`run`): there the error saves and pauses the run, the
// line says so and "Devam et" mounts the layer again; a crash never leaves a blank page the player reloads out of.
import { Component, type ReactNode } from 'react'
import { t } from './i18n'
import { Button } from './primitives'

interface State {
  error: Error | null
}

interface Props {
  where: string
  children: ReactNode
  /** Runs once per caught error (App: save + pause). Must not throw. */
  onError?: (error: Error) => void
  /** Whole-layer fence: the box sits centred over the scene, with the run line and "Devam et". */
  run?: boolean
}

export class ErrorCatch extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error(`[ui] ${this.props.where} render error`, error, info.componentStack)
    try {
      this.props.onError?.(error instanceof Error ? error : new Error(String(error)))
    } catch (e) {
      console.error('[ui] onError failed', e)
    }
  }

  render() {
    const e = this.state.error
    if (!e) return this.props.children
    const run = this.props.run
    const box = (
      <div role="alert" className={run ? 'ui-card flex max-w-sm flex-col items-start gap-3 p-4 shadow-pop' : 'flex flex-col items-start gap-3 p-4'}>
        <p className="text-sm font-semibold text-ink">{t(run ? 'ui.error.run' : 'ui.error.title')}</p>
        <code className="max-w-full break-words rounded-control bg-surface-2 px-2 py-1 text-[11px] text-ink-2">
          {this.props.where}: {e.name}: {e.message}
        </code>
        <Button size="sm" tone={run ? 'commit' : undefined} icon={run ? 'play' : undefined} onClick={() => this.setState({ error: null })}>
          {t(run ? 'ui.error.resume' : 'ui.error.retry')}
        </Button>
      </div>
    )
    return run ? <div className="absolute inset-0 z-50 flex items-center justify-center p-4 safe-x">{box}</div> : box
  }
}
