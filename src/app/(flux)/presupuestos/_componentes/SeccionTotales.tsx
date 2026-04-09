'use client'

/**
 * SeccionTotales — Muestra subtotal, impuestos y total del presupuesto.
 * Se usa en: EditorPresupuesto.tsx
 */

import { useTraduccion } from '@/lib/i18n'

interface PropsSeccionTotales {
  subtotal: number
  impuestos: number
  total: number
  /** Función de formato de moneda */
  fmt: (v: string | number) => string
}

export default function SeccionTotales({ subtotal, impuestos, total, fmt }: PropsSeccionTotales) {
  const { t } = useTraduccion()

  return (
    <div className="px-6 py-4 border-t border-borde-sutil">
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-texto-secundario">{t('documentos.subtotal')}</span>
            <span className="font-mono tabular-nums text-texto-primario text-right">{fmt(subtotal)}</span>
          </div>
          {impuestos !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-secundario">{t('documentos.impuesto')}</span>
              <span className="font-mono tabular-nums text-texto-primario text-right">{fmt(impuestos)}</span>
            </div>
          )}
          <div className="border-t border-borde-sutil pt-2 flex justify-between text-base font-bold">
            <span className="text-texto-primario">{t('documentos.total')}</span>
            <span className="font-mono tabular-nums text-texto-marca text-right">{fmt(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
