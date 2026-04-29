'use client'

import { useState, useEffect } from 'react'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { Settings2, Building2, RotateCcw, Sparkles } from 'lucide-react'

/**
 * ConfigRecorrido — Modal de permisos del recorrido para un visitador.
 *
 * Se guarda en dos lugares según elija el coordinador:
 *  1. `recorridos.config` (jsonb) — siempre, aplica al recorrido del día.
 *  2. `miembros.permisos_recorrido_default` (jsonb) — opcional. Si el coordinador
 *     marca "Aplicar también como default para futuros recorridos del visitador",
 *     guardamos los mismos permisos como nuevo default. Los próximos recorridos
 *     que se creen heredarán estos defaults.
 */

export interface ConfigPermisos {
  puede_reordenar: boolean
  puede_cambiar_duracion: boolean
  puede_agregar_paradas: boolean
  puede_quitar_paradas: boolean
  puede_cancelar: boolean
}

const PERMISOS_DEFAULT: ConfigPermisos = {
  puede_reordenar: true,
  puede_cambiar_duracion: true,
  puede_agregar_paradas: false,
  puede_quitar_paradas: false,
  puede_cancelar: false,
}

interface OrigenDestinoProps {
  coordsEmpresa: { lat: number; lng: number; texto: string } | null
  origenEmpresa: boolean
  destinoEmpresa: boolean
  onToggleOrigen: (activo: boolean) => void
  onToggleDestino: (activo: boolean) => void
}

interface Props {
  recorridoId: string | null
  configActual?: ConfigPermisos | null
  /** ID del usuario visitador (necesario para guardar permisos default) */
  visitadorUsuarioId?: string | null
  nombreVisitador: string
  onGuardar: (config: ConfigPermisos) => Promise<void>
  /** Props opcionales para salida/regreso — solo en ModalRecorrido */
  origenDestino?: OrigenDestinoProps
  /** Modo controlado: el padre renderiza su propio trigger y maneja el estado.
   *  Si está seteado, no se renderiza el botón interno por default. */
  controlado?: {
    abierto: boolean
    onCerrar: () => void
  }
}

export default function ConfigRecorrido({
  recorridoId,
  configActual,
  visitadorUsuarioId,
  nombreVisitador,
  onGuardar,
  origenDestino,
  controlado,
}: Props) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [abiertoInterno, setAbiertoInterno] = useState(false)
  const abierto = controlado ? controlado.abierto : abiertoInterno
  const cerrar = () => controlado ? controlado.onCerrar() : setAbiertoInterno(false)
  const [config, setConfig] = useState<ConfigPermisos>({ ...PERMISOS_DEFAULT, ...(configActual || {}) })
  const [aplicarADefault, setAplicarADefault] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Re-sincronizar el state al abrir o cuando cambian los datos del recorrido
  useEffect(() => {
    if (abierto) {
      setConfig({ ...PERMISOS_DEFAULT, ...(configActual || {}) })
      setAplicarADefault(false)
    }
  }, [abierto, configActual])

  const togglePermiso = (campo: keyof ConfigPermisos) => {
    setConfig(prev => ({ ...prev, [campo]: !prev[campo] }))
  }

  // Restablecer todos los permisos a los defaults del sistema (reordenar y duración
  // habilitados; agregar/quitar/cancelar deshabilitados). El cambio queda solo
  // en el state local hasta que el usuario apriete Guardar.
  const restablecer = () => {
    setConfig({ ...PERMISOS_DEFAULT })
  }
  const yaEstaEnDefault = (Object.keys(PERMISOS_DEFAULT) as (keyof ConfigPermisos)[])
    .every(k => config[k] === PERMISOS_DEFAULT[k])

  const guardar = async () => {
    if (!recorridoId) return
    setGuardando(true)
    try {
      // 1) Siempre guardar en este recorrido
      await onGuardar(config)

      // 2) Si pidió aplicar como default del visitador, guardar también ahí
      if (aplicarADefault && visitadorUsuarioId) {
        const res = await fetch('/api/visitas/permisos-recorrido-default', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario_id: visitadorUsuarioId, permisos: config }),
        })
        if (!res.ok) throw new Error('default')
      }

      mostrar('exito', aplicarADefault
        ? `Permisos guardados — también será el default para ${nombreVisitador.split(' ')[0]}`
        : 'Permisos del recorrido actualizados')
      cerrar()
    } catch (err) {
      const detalle = err instanceof Error && err.message === 'default'
        ? 'Los permisos del día se guardaron, pero no se pudo actualizar el default del visitador'
        : 'Error al guardar permisos'
      mostrar('error', detalle)
    } finally {
      setGuardando(false)
    }
  }

  const permisos: { campo: keyof ConfigPermisos; clave: string; descripcion: string }[] = [
    { campo: 'puede_reordenar', clave: 'visitas.puede_reordenar', descripcion: 'Cambiar el orden de las paradas durante el recorrido.' },
    { campo: 'puede_cambiar_duracion', clave: 'visitas.puede_cambiar_duracion', descripcion: 'Ajustar el tiempo estimado de cada parada.' },
    { campo: 'puede_agregar_paradas', clave: 'visitas.puede_agregar_paradas', descripcion: 'Sumar paradas no planificadas (combustible, café, etc.).' },
    { campo: 'puede_quitar_paradas', clave: 'visitas.puede_quitar_paradas', descripcion: 'Eliminar paradas que ya no aplican.' },
    { campo: 'puede_cancelar', clave: 'visitas.puede_cancelar', descripcion: 'Cancelar visitas en el día.' },
  ]

  return (
    <>
      {/* Trigger por default — solo si el padre no controla el modal desde afuera */}
      {!controlado && (
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={<Settings2 size={14} />}
          tooltip={t('visitas.permisos_recorrido')}
          onClick={() => setAbiertoInterno(true)}
        />
      )}

      <ModalAdaptable
        abierto={abierto}
        onCerrar={() => cerrar()}
        titulo={`Permisos del recorrido — ${nombreVisitador}`}
        tamano="2xl"
        accionPrimaria={{
          etiqueta: 'Guardar',
          onClick: guardar,
          cargando: guardando,
          disabled: !recorridoId,
        }}
        accionSecundaria={{
          etiqueta: t('comun.cancelar'),
          onClick: () => cerrar(),
        }}
      >
        <div className="space-y-5 px-1">
          {/* Permisos — grid de 2 columnas en desktop para que entren todos los toggles
              sin generar scroll. En mobile colapsa a una columna. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                Qué puede hacer durante el recorrido
              </h3>
              <button
                type="button"
                onClick={restablecer}
                disabled={yaEstaEnDefault}
                className="flex items-center gap-1 text-[11px] font-medium text-texto-marca hover:text-texto-marca/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Volver a los permisos por defecto del sistema"
              >
                <RotateCcw size={11} />
                Restablecer
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {permisos.map(({ campo, clave, descripcion }) => (
                <button
                  type="button"
                  key={campo}
                  onClick={() => togglePermiso(campo)}
                  className="w-full text-left flex items-start gap-3 rounded-card border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] py-2.5 px-3 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-texto-primario">{t(clave)}</div>
                    <div className="text-[11px] text-texto-terciario leading-snug mt-0.5">{descripcion}</div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <Interruptor activo={config[campo]} onChange={() => togglePermiso(campo)} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Salida y regreso — solo en ModalRecorrido. También 2 columnas en desktop. */}
          {origenDestino?.coordsEmpresa && (
            <div>
              <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
                {t('visitas.salida_y_regreso')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between rounded-card border border-white/[0.06] bg-white/[0.02] py-2.5 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={13} className="shrink-0 text-texto-terciario" />
                    <div className="min-w-0">
                      <p className="text-sm text-texto-primario">{t('visitas.salir_desde_empresa')}</p>
                      <p className="text-[11px] text-texto-terciario truncate">{origenDestino.coordsEmpresa.texto}</p>
                    </div>
                  </div>
                  <Interruptor
                    activo={origenDestino.origenEmpresa}
                    onChange={() => origenDestino.onToggleOrigen(!origenDestino.origenEmpresa)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-card border border-white/[0.06] bg-white/[0.02] py-2.5 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw size={13} className="shrink-0 text-texto-terciario" />
                    <div className="min-w-0">
                      <p className="text-sm text-texto-primario">{t('visitas.volver_a_empresa')}</p>
                      <p className="text-[11px] text-texto-terciario truncate">{origenDestino.coordsEmpresa.texto}</p>
                    </div>
                  </div>
                  <Interruptor
                    activo={origenDestino.destinoEmpresa}
                    onChange={() => origenDestino.onToggleDestino(!origenDestino.destinoEmpresa)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Toggle: aplicar a futuros recorridos del visitador.
              Solo se muestra si tenemos el ID del usuario (sin él no hay a quién
              aplicarle el default). */}
          {visitadorUsuarioId && (
            <div className="rounded-card border border-texto-marca/20 bg-texto-marca/[0.04] py-3 px-3">
              <button
                type="button"
                onClick={() => setAplicarADefault(v => !v)}
                className="w-full text-left flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-texto-primario">
                    <Sparkles size={13} className="text-texto-marca" />
                    Aplicar como default a futuros recorridos
                  </div>
                  <div className="text-[11px] text-texto-terciario leading-snug mt-0.5">
                    Estos permisos van a aplicarse automáticamente a todos los próximos
                    recorridos de <span className="text-texto-secundario">{nombreVisitador}</span>.
                    Los recorridos pasados no se modifican.
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <Interruptor activo={aplicarADefault} onChange={() => setAplicarADefault(v => !v)} />
                </div>
              </button>
            </div>
          )}

          {!recorridoId && (
            <p className="text-[11px] text-texto-terciario italic">
              {t('visitas.sin_recorrido_config')}
            </p>
          )}
        </div>
      </ModalAdaptable>
    </>
  )
}
