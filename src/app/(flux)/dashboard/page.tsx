'use client'

import { useTraduccion } from '@/lib/i18n'

/**
 * Página de Dashboard — Panel principal con widgets.
 * Por ahora muestra un placeholder. Los widgets se agregan después.
 */
export default function PaginaDashboard() {
  const { t } = useTraduccion()

  return (
    <div>
      <h1 style={{ fontSize: 'var(--texto-2xl)', fontWeight: 700, color: 'var(--texto-primario)' }}>
        {t('dashboard.bienvenido')}
      </h1>
      <p style={{ color: 'var(--texto-secundario)', marginTop: 'var(--espacio-2)' }}>
        Flux by Salix
      </p>
    </div>
  )
}
