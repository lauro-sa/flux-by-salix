'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNavegacion, type Migaja } from '@/hooks/useNavegacion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Migajas (Breadcrumbs) — Muestra el camino de navegación completo.
 * Se usa en el Header. Permite volver a cualquier nivel intermedio.
 *
 * Ejemplo: Inicio > Contactos > Juan Pérez > Editar
 *
 * En mobile: muestra botón "volver" + la migaja actual.
 * En desktop: muestra el camino completo con separadores.
 *
 * Acepta migajas extras para páginas dinámicas (ej: nombre del contacto).
 */

interface PropiedadesMigajas {
  extras?: Migaja[] // Migajas adicionales (ej: nombre de entidad dinámica)
}

function Migajas({ extras }: PropiedadesMigajas) {
  const pathname = usePathname()
  const { migajas: migajasBase, volverAtras, puedeVolver, obtenerMigajasParaRuta } = useNavegacion()

  // Si hay extras, recalcular con ellas
  const migajas = extras
    ? obtenerMigajasParaRuta(pathname, extras)
    : migajasBase

  if (migajas.length <= 1) return null

  return (
    <>
      {/* Mobile: botón volver + página actual */}
      <div className="migajas-mobile" style={{ display: 'none' }}>
        {puedeVolver && (
          <button
            onClick={volverAtras}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--espacio-1)',
              padding: 'var(--espacio-1) var(--espacio-2)',
              borderRadius: 'var(--radio-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--texto-secundario)',
              cursor: 'pointer',
              fontSize: 'var(--texto-sm)',
            }}
          >
            <ChevronLeft size={16} />
            {migajas.length > 2 ? migajas[migajas.length - 2].etiqueta : 'Volver'}
          </button>
        )}
        <span style={{ fontSize: 'var(--texto-sm)', fontWeight: 600, color: 'var(--texto-primario)' }}>
          {migajas[migajas.length - 1].etiqueta}
        </span>
      </div>

      {/* Desktop: camino completo */}
      <nav
        className="migajas-desktop"
        aria-label="Breadcrumbs"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--espacio-1)',
          fontSize: 'var(--texto-sm)',
          flexWrap: 'wrap',
        }}
      >
        {migajas.map((migaja, i) => {
          const esUltima = i === migajas.length - 1

          return (
            <span key={migaja.ruta + i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--espacio-1)' }}>
              {i > 0 && (
                <ChevronRight size={14} style={{ color: 'var(--texto-terciario)' }} />
              )}
              {esUltima ? (
                <span style={{ color: 'var(--texto-primario)', fontWeight: 500 }}>
                  {migaja.etiqueta}
                </span>
              ) : (
                <Link
                  href={migaja.ruta}
                  style={{
                    color: 'var(--texto-terciario)',
                    textDecoration: 'none',
                    transition: `color var(--transicion-rapida)`,
                  }}
                >
                  {migaja.etiqueta}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      <style>{`
        @media (max-width: 767px) {
          .migajas-desktop { display: none !important; }
          .migajas-mobile { display: flex !important; align-items: center; gap: var(--espacio-2); }
        }
        @media (min-width: 768px) {
          .migajas-mobile { display: none !important; }
          .migajas-desktop { display: flex !important; }
        }
      `}</style>
    </>
  )
}

export { Migajas }
