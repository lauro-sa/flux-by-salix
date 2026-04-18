'use client'

/**
 * SeccionDirecciones — Selector de dirección del contacto con contadores de visitas.
 * Se usa en: ModalVisita (columna izquierda).
 */

import { MapPin, Check, Navigation } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'

interface Direccion {
  id: string
  texto: string | null
  tipo: string | null
  es_principal: boolean
  lat: number | null
  lng: number | null
  total_visitas: number
  ultima_visita: string | null
}

interface Props {
  direcciones: Direccion[]
  direccionId: string | null
  cargando: boolean
  onSeleccionar: (dir: Direccion) => void
}

export function SeccionDirecciones({ direcciones, direccionId, cargando, onSeleccionar }: Props) {
  const { t } = useTraduccion()
  const formato = useFormato()

  if (cargando) {
    return <p className="text-sm text-texto-terciario">{t('visitas.cargando')}</p>
  }

  if (direcciones.length === 0) {
    return <p className="text-sm text-texto-terciario">{t('visitas.sin_direcciones')}</p>
  }

  return (
    <div className="space-y-1.5">
      {direcciones.map(dir => {
        const esSeleccionada = dir.id === direccionId
        const tieneGps = dir.lat && dir.lng
        return (
          <button
            key={dir.id}
            onClick={() => onSeleccionar(dir)}
            className={`w-full text-left px-3 py-2.5 rounded-card border text-sm transition-colors ${
              esSeleccionada
                ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-primario'
                : 'border-white/[0.06] bg-white/[0.03] text-texto-secundario hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-start gap-2">
              <MapPin size={14} className={`mt-0.5 shrink-0 ${esSeleccionada ? 'text-texto-marca' : 'text-texto-terciario'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{dir.texto || t('visitas.sin_direccion')}</span>
                  {dir.tipo && (
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                      {dir.tipo === 'principal' ? t('visitas.principal') : dir.tipo === 'fiscal' ? t('visitas.fiscal') : dir.tipo === 'entrega' ? t('visitas.entrega') : dir.tipo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {dir.total_visitas > 0 && (
                    <span className="text-xs text-texto-terciario">
                      {dir.total_visitas} {dir.total_visitas === 1 ? t('visitas.visita') : t('visitas.visitas_label')}
                    </span>
                  )}
                  {dir.ultima_visita && (
                    <span className="text-xs text-texto-terciario">
                      {t('visitas.ultima')}: {formato.fechaRelativa(dir.ultima_visita)}
                    </span>
                  )}
                  {dir.total_visitas === 0 && (
                    <span className="text-xs text-texto-terciario italic">{t('visitas.sin_visitas_previas')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {tieneGps && (
                  <Navigation size={12} className="text-texto-terciario" />
                )}
                {esSeleccionada && <Check size={14} className="text-texto-marca" />}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
