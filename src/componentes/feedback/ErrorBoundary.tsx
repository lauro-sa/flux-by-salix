'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Error Boundary — atrapa errores en componentes hijos sin tumbar toda la app.
 * Se usa en: inbox (envuelve cada panel), layouts críticos.
 */

interface Props {
  children: ReactNode
  /** Mensaje a mostrar cuando falla */
  mensaje?: string
}

interface Estado {
  tieneError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, Estado> {
  constructor(props: Props) {
    super(props)
    this.state = { tieneError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Estado {
    return { tieneError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary atrapó error:', error, info)
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--insignia-peligro-fondo, rgba(239,68,68,0.1))' }}
          >
            <AlertTriangle size={24} style={{ color: 'var(--insignia-peligro)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--texto-primario)' }}>
            {this.props.mensaje || 'Algo salió mal'}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--texto-terciario)' }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => this.setState({ tieneError: false, error: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--superficie-hover)',
              color: 'var(--texto-secundario)',
            }}
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
