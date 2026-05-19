'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useNavegacion, type Migaja } from '@/hooks/useNavegacion'
import { useNavegarProtegido } from '@/hooks/useCambiosPendientes'
import { ChevronRight } from 'lucide-react'
import {
  Users, MapPin, FileText, Package,
  MessagesSquare, Clock, Calendar, Shield,
  Wrench, Zap, LayoutDashboard,
  Megaphone, FileBarChart, Route,
  CircleUserRound, Building2, Trash2,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'

/** Componente de icono polimórfico: acepta tanto Lucide como nuestros iconos custom. */
type ComponenteIcono = React.ComponentType<{ size?: number; className?: string }>

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

/** Mapa de módulo → ícono (mismos que el sidebar) */
const ICONOS_MODULO: Record<string, ComponenteIcono> = {
  dashboard: LayoutDashboard,
  contactos: Users,
  actividades: Zap,
  visitas: MapPin,
  recorrido: Route,
  documentos: FileText,
  productos: Package,
  presupuestos: FileText,
  informes: FileBarChart,
  ordenes: Wrench,
  inbox: MessagesSquare,
  whatsapp: IconoWhatsApp,
  asistencias: Clock,
  calendario: Calendar,
  auditoria: Shield,
  marketing: Megaphone,
  configuracion: Building2,
  usuarios: CircleUserRound,
  papelera: Trash2,
}

interface PropiedadesMigajas {
  extras?: Migaja[] // Migajas adicionales (ej: nombre de entidad dinámica)
}

function MigajasInterno({ extras }: PropiedadesMigajas) {
  const pathname = usePathname()
  const router = useRouter()
  const intentarNavegar = useNavegarProtegido()
  const { migajas: migajasBase, volverAtras, puedeVolver, obtenerMigajasParaRuta, obtenerRutaModulo } = useNavegacion()

  // Si hay extras, recalcular con ellas
  const migajas = extras
    ? obtenerMigajasParaRuta(pathname, extras)
    : migajasBase

  if (migajas.length === 0) return null

  // Click en migaja intermedia: respeta el sistema global de "cambios sin guardar"
  // y restaura los filtros del listado si se guardó la URL completa del módulo.
  const navegarAMigaja = (ruta: string) => {
    const destino = obtenerRutaModulo(ruta)
    intentarNavegar(() => router.push(destino))
  }

  return (
    <>
      {/* Mobile: ícono + nombre de la página actual */}
      <div className="migajas-mobile" style={{ display: 'none' }}>
        {(() => {
          const ultima = migajas[migajas.length - 1]
          const primera = migajas[0]
          const Icono = primera?.modulo ? ICONOS_MODULO[primera.modulo] : undefined
          return (
            <span className="font-semibold flex items-center gap-2" style={{ fontSize: 'var(--texto-base)', color: 'var(--texto-primario)' }}>
              {Icono && <Icono size={18} className="text-texto-secundario shrink-0" />}
              {ultima.etiqueta}
            </span>
          )
        })()}
      </div>

      {/* Desktop: camino completo con ícono del módulo */}
      <nav
        className="migajas-desktop"
        aria-label="Breadcrumbs"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--espacio-2)',
          fontSize: 'var(--texto-sm)',
          flexWrap: 'wrap',
        }}
      >
        {migajas.map((migaja, i) => {
          const esPrimera = i === 0
          const esUltima = i === migajas.length - 1
          const Icono = esPrimera && migaja.modulo ? ICONOS_MODULO[migaja.modulo] : undefined

          // Primera migaja (módulo/sección): protagonista — ícono más grande + texto base semibold
          if (esPrimera) {
            const contenido = (
              <span className="flex items-center gap-2 font-semibold" style={{ fontSize: 'var(--texto-base)', color: 'var(--texto-primario)' }}>
                {Icono && <Icono size={18} className="text-texto-secundario shrink-0" />}
                {migaja.etiqueta}
              </span>
            )
            return (
              <span key={migaja.ruta + i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--espacio-2)' }}>
                {esUltima ? (
                  contenido
                ) : (
                  <button
                    type="button"
                    onClick={() => navegarAMigaja(migaja.ruta)}
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textDecoration: 'none', transition: `opacity var(--transicion-rapida)` }}
                    className="hover:opacity-80"
                  >
                    {contenido}
                  </button>
                )}
              </span>
            )
          }

          // Migajas siguientes (entidades, subniveles): terciario, más sutiles
          return (
            <span key={migaja.ruta + i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--espacio-2)' }}>
              <ChevronRight size={14} style={{ color: 'var(--texto-terciario)' }} />
              {esUltima ? (
                <span className="font-medium" style={{ color: 'var(--texto-secundario)' }}>
                  {migaja.etiqueta}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navegarAMigaja(migaja.ruta)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--texto-terciario)',
                    textDecoration: 'none',
                    transition: `color var(--transicion-rapida)`,
                  }}
                  className="hover:!text-texto-secundario"
                >
                  {migaja.etiqueta}
                </button>
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

// Renderizar solo en cliente para evitar hydration mismatch con searchParams (desde=/...)
const Migajas = dynamic(() => Promise.resolve(MigajasInterno), { ssr: false })

export { Migajas }
