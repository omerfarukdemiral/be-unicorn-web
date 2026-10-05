// Render-error fence for the panel body and the center screens. Without one React 19 unmounts the whole tree on a
// render error (blank screen, nothing opens); here the game keeps running, the box shows one line plus the raw
// message (a phone has no console: the player can screenshot it) and "Tekrar dene" renders the children again.
import { Component, type ReactNode } from 'react'
import { t } from './i18n'
import { Button } from './primitives'

interface State {
  error: Error | null
}

export class ErrorCatch extends Component<{ where: string; children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error(`[ui] ${this.props.where} render error`, error, info.componentStack)
  }

  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm font-semibold text-ink">{t('ui.error.title')}</p>
        <code className="max-w-full break-words rounded-control bg-surface-2 px-2 py-1 text-[11px] text-ink-2">
          {this.props.where}: {e.name}: {e.message}
        </code>
        <Button size="sm" onClick={() => this.setState({ error: null })}>{t('ui.error.retry')}</Button>
      </div>
    )
  }
}
