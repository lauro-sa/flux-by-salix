'use client'

import { AlertTriangle, Eye, AlertCircle } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { Boton } from '@/componentes/ui/Boton'

/**
 * Banner contextual del editor de flujos.
 *
 * Sub-PR 19.2 introdujo las 3 variantes (amarillo, gris, rojo).
 * Sub-PR 19.4 cableó la variante `'error'` con CTA y resumen de errores
 * — el banner rojo solo aparece tras un intento fallido de Publicar/
 * Activar (decisión D2 del scope).
 *
 * Variantes (prioridad: error > lectura > borrador):
 *   • `error`     — rojo. Errores de validación al activar/publicar.
 *                    Acepta `titulo` y `descripcion` para sobreescribir
 *                    los defaults i18n por contexto (activar vs publicar).
 *                    Acepta `errores` para listar inline (máx 3 + "+N más").
 *                    Acepta `accion` para CTA "Ver errores" / similar.
 *   • `lectura`   — gris. Usuario tiene permiso `ver` pero no `editar`.
 *   • `borrador`  — amarillo. Flujo Activo/Pausado con borrador interno.
 *
 * El componente es puramente presentacional. La decisión de qué
 * variante mostrar la toma `EditorFlujo` consultando permisos +
 * `obtenerVersionEditable(flujo).esBorradorInterno` + estado
 * `intentoFallidoPublicar`.
 */

interface PropiedadesBanner {
  tipo: 'borrador' | 'lectura' | 'error'
  /**
   * Solo `error`: sobreescribe el título por defecto. Los demás tipos
   * lo ignoran (su título viene de las claves i18n fijas).
   */
  titulo?: string
  /**
   * Solo `error`: sobreescribe la descripción/subtítulo por defecto.
   */
  descripcion?: string
  /**
   * Solo `error`: lista de mensajes a mostrar inline. Se muestran los
   * primeros `MAX_ERRORES_INLINE`; el resto se resume como "+N más".
   * Si está vacío o ausente, no se renderiza la lista.
   */
  errores?: string[]
  /**
   * Solo `error`: acción opcional al costado del título (botón CTA).
   * En 19.4 se usa para "Ver errores" → scroll al primer paso fallado.
   */
  accion?: { etiqueta: string; onClick: () => void }
}

const MAX_ERRORES_INLINE = 3

export default function BannerEditorFlujo({
  tipo,
  titulo,
  descripcion,
  errores,
  accion,
}: PropiedadesBanner) {
  const { t } = useTraduccion()

  const config = (() => {
    switch (tipo) {
      case 'borrador':
        return {
          Icono: AlertTriangle,
          // Tokens semánticos del proyecto: insignia-advertencia para amarillo.
          fondo: 'bg-insignia-advertencia/10 border-insignia-advertencia/30',
          icono: 'text-insignia-advertencia-texto',
          texto: 'text-texto-primario',
          titulo: t('flujos.editor.banner.borrador_titulo'),
          desc: t('flujos.editor.banner.borrador_desc'),
        }
      case 'lectura':
        return {
          Icono: Eye,
          fondo: 'bg-superficie-tarjeta border-borde-sutil',
          icono: 'text-texto-terciario',
          texto: 'text-texto-secundario',
          titulo: t('flujos.editor.banner.lectura_titulo'),
          desc: t('flujos.editor.banner.lectura_desc'),
        }
      case 'error':
        return {
          Icono: AlertCircle,
          fondo: 'bg-insignia-peligro/10 border-insignia-peligro/30',
          icono: 'text-insignia-peligro-texto',
          texto: 'text-texto-primario',
          titulo: titulo ?? t('flujos.editor.banner.error_titulo'),
          desc: descripcion ?? t('flujos.editor.banner.error_desc'),
        }
    }
  })()

  // Lista de errores resumida: primeros 3 + "+N más" si hay overflow.
  // Solo aplica a tipo `error`. Filtramos vacíos defensivamente porque
  // alguna ruta puede mandar string vacío que arruinaría el visual.
  const erroresVisibles = (errores ?? []).filter((e) => e && e.length > 0)
  const inline = erroresVisibles.slice(0, MAX_ERRORES_INLINE)
  const restante = Math.max(0, erroresVisibles.length - MAX_ERRORES_INLINE)

  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 sm:px-6 py-3 border-y ${config.fondo}`}
    >
      <span className={`shrink-0 mt-0.5 ${config.icono}`}>
        <config.Icono size={18} strokeWidth={1.8} />
      </span>
      <div className={`flex-1 min-w-0 ${config.texto}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-medium leading-tight">{config.titulo}</p>
          {tipo === 'error' && accion && (
            <Boton variante="secundario" tamano="sm" onClick={accion.onClick}>
              {accion.etiqueta}
            </Boton>
          )}
        </div>
        <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed">{config.desc}</p>

        {tipo === 'error' && inline.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-texto-secundario list-disc list-inside">
            {inline.map((mensaje, idx) => (
              <li key={idx} className="truncate" title={mensaje}>
                {mensaje}
              </li>
            ))}
            {restante > 0 && (
              <li className="list-none text-texto-terciario italic">
                {t('flujos.editor.validacion.errores_extra').replace('{{n}}', String(restante))}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
