'use client'

/**
 * InfoEstadoMiembro — Tarjeta con el estado del ciclo de vida de un empleado.
 *
 * Muestra en qué punto está el empleado (solo fichaje / pendiente de
 * activar / activo con cuenta / desactivado) y los estados restantes como
 * hoja de ruta visual. Expone acciones contextuales: enviar invitación,
 * reenviar, copiar link, reactivar.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Fingerprint, MailCheck, ShieldCheck, PowerOff,
  Send, RotateCcw, Copy, Power, Info, Check, Clock, X,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import {
  type EstadoMiembro,
  ESTADOS_MIEMBRO,
} from '@/lib/miembros/estado'

interface PropsInfoEstadoMiembro {
  estado: EstadoMiembro
  /** Correo del empleado — se muestra como hint de destino de invitación */
  correo?: string | null
  /** Invitación vigente del miembro (si aplica) */
  invitacion?: { expira_en: string | Date; usado: boolean } | null
  /** Link listo para copiar cuando hay invitación pendiente */
  linkInvitacion?: string | null
  /** Si el usuario actual puede gestionar (invitar/activar) */
  puedeGestionar?: boolean
  /** Hay una cuenta auth previa que se puede restaurar (estado=fichaje viniendo de activo). */
  tieneCuentaPrevia?: boolean
  /** Callback de acciones — el contenedor decide qué hacer */
  onAccion?: (accion: 'invitar' | 'reenviar' | 'copiar-link' | 'cancelar-invitacion' | 'reactivar' | 'desactivar' | 'reenviar-acceso') => void
  /** ID de la acción actualmente en curso (muestra spinner) */
  cargando?: 'invitar' | 'reenviar' | 'copiar-link' | 'cancelar-invitacion' | 'reactivar' | 'desactivar' | 'reenviar-acceso' | null
  /** Variante compacta para usar en modales o columnas angostas */
  compacto?: boolean
}

/* Íconos grandes por estado — se muestra en la tarjeta destacada */
const ICONO_ESTADO: Record<EstadoMiembro, React.ComponentType<{ size?: number; className?: string }>> = {
  fichaje: Fingerprint,
  pendiente: MailCheck,
  activo: ShieldCheck,
  desactivado: PowerOff,
}

/* Colores de fondo del ícono grande por estado — usa tokens semánticos */
const FONDO_ICONO: Record<EstadoMiembro, string> = {
  fichaje: 'bg-insignia-cyan-fondo text-insignia-cyan-texto',
  pendiente: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto',
  activo: 'bg-insignia-exito-fondo text-insignia-exito-texto',
  desactivado: 'bg-insignia-neutro-fondo text-insignia-neutro-texto',
}

/* Orden del flujo lineal (no incluye "desactivado", que es estado lateral) */
const FLUJO: EstadoMiembro[] = ['fichaje', 'pendiente', 'activo']

export function InfoEstadoMiembro({
  estado,
  correo,
  invitacion,
  linkInvitacion,
  puedeGestionar = false,
  tieneCuentaPrevia = false,
  onAccion,
  cargando = null,
  compacto = false,
}: PropsInfoEstadoMiembro) {
  const { t } = useTraduccion()
  const meta = ESTADOS_MIEMBRO[estado]
  const IconoGrande = ICONO_ESTADO[estado]
  const esDesactivado = estado === 'desactivado'

  // Etiquetas y descripciones traducidas de cada estado — usamos t() con
  // fallback a las cadenas en español de ESTADOS_MIEMBRO para no depender de
  // que todas las claves estén definidas en todos los idiomas.
  const etiquetaEstado: Record<EstadoMiembro, string> = {
    fichaje: t('usuarios.estado_fichaje') || ESTADOS_MIEMBRO.fichaje.etiqueta,
    pendiente: t('usuarios.estado_pendiente') || ESTADOS_MIEMBRO.pendiente.etiqueta,
    activo: t('usuarios.estado_activo') || ESTADOS_MIEMBRO.activo.etiqueta,
    desactivado: t('usuarios.estado_desactivado') || ESTADOS_MIEMBRO.desactivado.etiqueta,
  }
  const descripcionEstado: Record<EstadoMiembro, string> = {
    fichaje: t('usuarios.estado_fichaje_desc') || ESTADOS_MIEMBRO.fichaje.descripcion,
    pendiente: t('usuarios.estado_pendiente_desc') || ESTADOS_MIEMBRO.pendiente.descripcion,
    activo: t('usuarios.estado_activo_desc') || ESTADOS_MIEMBRO.activo.descripcion,
    desactivado: t('usuarios.estado_desactivado_desc') || ESTADOS_MIEMBRO.desactivado.descripcion,
  }
  const captionEstado: Record<EstadoMiembro, string> = {
    fichaje: t('usuarios.estado_fichaje_caption'),
    pendiente: t('usuarios.estado_pendiente_caption'),
    activo: t('usuarios.estado_activo_caption'),
    desactivado: '',
  }

  /* Calcular días restantes de la invitación si está vigente */
  const diasRestantes = useMemo(() => {
    if (!invitacion || invitacion.usado) return null
    const expira = invitacion.expira_en instanceof Date
      ? invitacion.expira_en
      : new Date(invitacion.expira_en)
    const ms = expira.getTime() - Date.now()
    if (ms <= 0) return 0
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }, [invitacion])

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
      {/* ── Cabecera: título + insignia de estado ── */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-texto-terciario" />
          <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            {t('usuarios.estado_del_empleado')}
          </h3>
        </div>
        <Insignia color={meta.color}>{etiquetaEstado[estado]}</Insignia>
      </div>

      {/* ── Estado actual destacado ── */}
      <div className="px-5 pb-4 flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className={`shrink-0 size-14 rounded-card flex items-center justify-center ${FONDO_ICONO[estado]}`}
        >
          <IconoGrande size={28} />
        </motion.div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-texto-primario">
            {etiquetaEstado[estado]}
          </p>
          <p className="text-xs text-texto-secundario mt-1 leading-relaxed">
            {descripcionEstado[estado]}
          </p>
          {/* Hint de invitación vigente */}
          {estado === 'pendiente' && diasRestantes !== null && (
            <p className="text-xs text-texto-terciario mt-2 flex items-center gap-1.5">
              <Clock size={11} />
              {diasRestantes === 0
                ? t('usuarios.invitacion_expira_hoy')
                : diasRestantes === 1
                ? t('usuarios.invitacion_expira_manana')
                : t('usuarios.invitacion_expira_en_dias').replace('{{dias}}', String(diasRestantes))}
              {correo && <span className="text-texto-terciario/70"> · {correo}</span>}
            </p>
          )}
        </div>
      </div>

      {/* ── Flujo / ciclo de vida ── */}
      {!compacto && (
        <div className="px-5 pt-4 pb-5 border-t border-borde-sutil">
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-4">
            {esDesactivado ? t('usuarios.ciclo_vida_suspendido') : t('usuarios.ciclo_vida')}
          </p>
          <Stepper estadoActual={esDesactivado ? null : estado} etiquetas={etiquetaEstado} captions={captionEstado} />
        </div>
      )}

      {/* ── Acciones contextuales ── */}
      {puedeGestionar && onAccion && (
        <div className="px-5 py-3 border-t border-borde-sutil bg-superficie-elevada/30 flex flex-wrap items-center justify-end gap-2">
          {estado === 'fichaje' && (
            <>
              {tieneCuentaPrevia && (
                <Boton
                  variante="primario"
                  tamano="sm"
                  icono={<Power size={13} />}
                  cargando={cargando === 'reactivar'}
                  onClick={() => onAccion('reactivar')}
                >
                  Reactivar acceso
                </Boton>
              )}
              <Boton
                variante={tieneCuentaPrevia ? 'secundario' : 'primario'}
                tamano="sm"
                icono={<Send size={13} />}
                cargando={cargando === 'invitar'}
                onClick={() => onAccion('invitar')}
              >
                {t('usuarios.enviar_invitacion_flux')}
              </Boton>
            </>
          )}

          {estado === 'pendiente' && (
            <>
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<X size={13} />}
                cargando={cargando === 'cancelar-invitacion'}
                onClick={() => onAccion('cancelar-invitacion')}
              >
                {t('usuarios.cancelar_invitacion')}
              </Boton>
              {linkInvitacion && (
                <Boton
                  variante="secundario"
                  tamano="sm"
                  icono={cargando === 'copiar-link' ? <Check size={13} /> : <Copy size={13} />}
                  onClick={() => onAccion('copiar-link')}
                >
                  {t('usuarios.copiar_link')}
                </Boton>
              )}
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<RotateCcw size={13} />}
                cargando={cargando === 'reenviar'}
                onClick={() => onAccion('reenviar')}
              >
                {t('usuarios.reenviar_invitacion')}
              </Boton>
            </>
          )}

          {estado === 'activo' && (
            <>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Send size={13} />}
                cargando={cargando === 'reenviar-acceso'}
                onClick={() => onAccion('reenviar-acceso')}
              >
                {t('usuarios.reenviar_acceso') || 'Reenviar acceso'}
              </Boton>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<Power size={13} />}
                cargando={cargando === 'desactivar'}
                onClick={() => onAccion('desactivar')}
              >
                {t('usuarios.desactivar')}
              </Boton>
            </>
          )}

          {estado === 'desactivado' && (
            <Boton
              variante="primario"
              tamano="sm"
              icono={<Power size={13} />}
              cargando={cargando === 'reactivar'}
              onClick={() => onAccion('reactivar')}
            >
              {t('usuarios.reactivar_empleado')}
            </Boton>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Stepper — muestra los 3 estados del flujo lineal.
   Cuando el estado es "desactivado" pasa null y todo se ve apagado.
   ══════════════════════════════════════════════════════════════ */

function Stepper({
  estadoActual,
  etiquetas,
  captions,
}: {
  estadoActual: EstadoMiembro | null
  etiquetas: Record<EstadoMiembro, string>
  captions: Record<EstadoMiembro, string>
}) {
  const indiceActual = estadoActual ? FLUJO.indexOf(estadoActual) : -1

  return (
    <div className="flex items-start justify-between gap-2">
      {FLUJO.map((paso, i) => {
        const Icono = ICONO_ESTADO[paso]
        const esActual = i === indiceActual
        const yaPasado = i < indiceActual

        return (
          <div key={paso} className="flex-1 flex flex-col items-center relative min-w-0">
            {/* Conector a la derecha (excepto el último) */}
            {i < FLUJO.length - 1 && (
              <div
                className={`absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-px ${
                  yaPasado || (esActual && i < FLUJO.length - 1) ? 'bg-insignia-exito/40' : 'bg-borde-sutil'
                }`}
              />
            )}

            {/* Círculo con ícono */}
            <motion.div
              animate={esActual ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={esActual ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
              className={`size-10 rounded-full flex items-center justify-center border-2 transition-colors relative z-10 ${
                esActual
                  ? `${FONDO_ICONO[paso]} border-current shadow-sm`
                  : yaPasado
                  ? 'bg-insignia-exito-fondo text-insignia-exito-texto border-insignia-exito/40'
                  : 'bg-superficie-app text-texto-terciario/50 border-borde-sutil'
              }`}
            >
              {yaPasado ? <Check size={16} strokeWidth={2.5} /> : <Icono size={16} />}
            </motion.div>

            {/* Etiqueta + descripción corta */}
            <p
              className={`text-xs font-medium mt-2 text-center leading-tight ${
                esActual
                  ? 'text-texto-primario'
                  : yaPasado
                  ? 'text-texto-secundario'
                  : 'text-texto-terciario/60'
              }`}
            >
              {etiquetas[paso]}
            </p>
            {captions[paso] && (
              <p
                className={`text-[10px] text-center mt-0.5 leading-tight hidden sm:block ${
                  esActual ? 'text-texto-terciario' : 'text-texto-terciario/50'
                }`}
              >
                {captions[paso]}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
