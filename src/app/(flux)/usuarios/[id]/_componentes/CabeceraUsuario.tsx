'use client'

/**
 * Cabezal editorial del perfil de usuario.
 *
 * Estructura (una sola tarjeta contenedora):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  [Avatar]   Nombre GIGANTE                [CTA] [⋯]  │
 *   │             ROL · ● ESTADO                           │
 *   │             #003 · DESDE 30 MAR 2026 · 27 AÑOS       │
 *   │  ─────────────────────────────────────────────────   │
 *   │  ✉ correo    📞 teléfono   💼 puesto   🏢 sector    │
 *   │  ─────────────────────────────────────────────────   │
 *   │  CICLO DE VIDA                       Expira en 4 d  │
 *   │  ●───────────●───────────●                          │
 *   │  Fichaje      Pendiente    Activo                    │
 *   └──────────────────────────────────────────────────────┘
 *
 * Juega con 3 niveles tipográficos (hero / marca / terciario) como
 * `CabezaloHero` — el nombre lee primero, rol+estado segundo, meta tercero.
 * El ciclo de vida vive dentro del mismo bloque en vez de una tarjeta aparte.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Phone, Briefcase, Building,
  Camera, MoreHorizontal, X, KeyRound, Trash2, LogOut,
  Mail as MailIcon, Cake,
  Fingerprint, MailCheck, ShieldCheck, PowerOff,
  Send, RotateCcw, Copy, Power, Check, Clock,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { RecortadorImagen } from '@/componentes/ui/RecortadorImagen'
import { useTraduccion } from '@/lib/i18n'
import type { Miembro, Perfil } from '@/tipos'
import type { EstadoMiembro } from '@/lib/miembros/estado'
import { ESTADOS_MIEMBRO } from '@/lib/miembros/estado'
import { ItemMenu } from './ComponentesComunes'
import { ETIQUETA_ROL, diasHastaCumple, textoCumple } from './constantes'

/* Acciones del ciclo de vida que puede despachar el cabezal */
type AccionEstado = 'invitar' | 'reenviar' | 'copiar-link' | 'cancelar-invitacion' | 'reactivar' | 'desactivar' | 'reenviar-acceso'

interface PropsCabeceraUsuario {
  miembro: Miembro
  perfil: Perfil
  nombreCompleto: string
  numeroEmpleado: string
  edad: number | null
  puedeEditar: boolean
  esPropietario: boolean
  esAdmin: boolean
  fmt: {
    fecha: (v: string | Date, opts?: Record<string, unknown>) => string
    locale: string
  }
  /* Edición del perfil/miembro */
  onActualizarPerfil: (datos: Record<string, unknown>) => void
  onActualizarMiembro: (datos: Record<string, unknown>) => void
  setPerfil: React.Dispatch<React.SetStateAction<Perfil | null>>
  setMiembro: React.Dispatch<React.SetStateAction<Miembro | null>>
  /* Modales del dropdown admin */
  setModalResetPassword: (v: boolean) => void
  setModalForzarPassword: (v: boolean) => void
  setModalForzarLogout: (v: boolean) => void
  setModalConfirmarEliminar: (v: boolean) => void
  /* Supabase para subir imágenes */
  supabase: ReturnType<typeof import('@/lib/supabase/cliente').crearClienteNavegador>
  empresaId: string
  miembroId: string
  /* Ciclo de vida — fusionado al cabezal */
  estadoCiclo: EstadoMiembro
  invitacion?: { expira_en: string | Date; usado: boolean } | null
  linkInvitacion?: string | null
  tieneCuentaPrevia?: boolean
  onAccionEstado?: (accion: AccionEstado) => void
  accionCargando?: AccionEstado | null
  avisoReenvio?: { tipo: 'exito' | 'error'; texto: string } | null
  /* Etiquetas resueltas (FK miembros.puesto_id → puestos / miembros_sectores → sectores) */
  puestoNombre: string | null
  sectorNombre: string | null
}

/* Config visual del ciclo de vida */
const FLUJO: EstadoMiembro[] = ['fichaje', 'pendiente', 'activo']
const ICONO_ESTADO: Record<EstadoMiembro, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  fichaje: Fingerprint,
  pendiente: MailCheck,
  activo: ShieldCheck,
  desactivado: PowerOff,
}
/* Color textual por estado — dot de la línea marca y labels del stepper */
const COLOR_ESTADO: Record<EstadoMiembro, string> = {
  fichaje: 'text-insignia-cyan-texto',
  pendiente: 'text-insignia-advertencia-texto',
  activo: 'text-insignia-exito-texto',
  desactivado: 'text-insignia-neutro-texto',
}

export function CabeceraUsuario({
  miembro, perfil, nombreCompleto, numeroEmpleado, edad,
  puedeEditar, esPropietario, esAdmin,
  fmt,
  onActualizarPerfil, onActualizarMiembro,
  setPerfil, setMiembro,
  setModalResetPassword, setModalForzarPassword, setModalForzarLogout,
  setModalConfirmarEliminar,
  supabase, empresaId, miembroId,
  estadoCiclo, invitacion, linkInvitacion, tieneCuentaPrevia,
  onAccionEstado, accionCargando, avisoReenvio,
  puestoNombre, sectorNombre,
}: PropsCabeceraUsuario) {
  const { t } = useTraduccion()
  const rolActual = (miembro?.rol as string) || 'empleado'
  const mostrarCicloVida = miembro.rol !== 'propietario'
  const puedeGestionarCiclo = puedeEditar && !!onAccionEstado && mostrarCicloVida

  /* Menú acciones + recortador */
  const [menuAcciones, setMenuAcciones] = useState(false)
  const menuAccionesRef = useRef<HTMLDivElement>(null)
  const [recortador, setRecortador] = useState<{ imagen: string; tipo: 'avatar' | 'kiosco' } | null>(null)

  useEffect(() => {
    if (!menuAcciones) return
    const handler = (e: MouseEvent) => {
      if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target as Node)) setMenuAcciones(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAcciones])

  /* Días hasta expirar invitación (para pendiente) */
  const diasInvitacion = useMemo(() => {
    if (!invitacion || invitacion.usado) return null
    const expira = invitacion.expira_en instanceof Date ? invitacion.expira_en : new Date(invitacion.expira_en)
    const ms = expira.getTime() - Date.now()
    if (ms <= 0) return 0
    return Math.ceil(ms / (1000 * 60 * 60 * 24))
  }, [invitacion])

  /* Cumpleaños inline */
  const diasCumple = diasHastaCumple(perfil.fecha_nacimiento)
  const esCumpleHoy = diasCumple === 0

  /* Etiquetas i18n con fallback a las cadenas por defecto */
  const etiquetaEstado: Record<EstadoMiembro, string> = {
    fichaje: t('usuarios.estado_fichaje') || ESTADOS_MIEMBRO.fichaje.etiqueta,
    pendiente: t('usuarios.estado_pendiente') || ESTADOS_MIEMBRO.pendiente.etiqueta,
    activo: t('usuarios.estado_activo') || ESTADOS_MIEMBRO.activo.etiqueta,
    desactivado: t('usuarios.estado_desactivado') || ESTADOS_MIEMBRO.desactivado.etiqueta,
  }
  const captionEstado: Record<EstadoMiembro, string> = {
    fichaje: t('usuarios.estado_fichaje_caption') || 'Kiosco · RFID · PIN',
    pendiente: t('usuarios.estado_pendiente_caption') || 'Invitación enviada',
    activo: t('usuarios.estado_activo_caption') || 'Accede a Flux',
    desactivado: '',
  }

  /* CTA principal según el estado — visible arriba a la derecha junto al ⋯ */
  const ctaPrincipal = (() => {
    if (!puedeGestionarCiclo) return null
    switch (estadoCiclo) {
      case 'fichaje':
        return tieneCuentaPrevia
          ? { label: t('usuarios.reactivar_acceso') || 'Reactivar acceso', Icono: Power, accion: 'reactivar' as const, variante: 'primario' as const }
          : { label: t('usuarios.enviar_invitacion_flux') || 'Enviar invitación', Icono: Send, accion: 'invitar' as const, variante: 'primario' as const }
      case 'pendiente':
        return { label: t('usuarios.reenviar_invitacion') || 'Reenviar invitación', Icono: RotateCcw, accion: 'reenviar' as const, variante: 'secundario' as const }
      case 'activo':
        return { label: t('usuarios.desactivar') || 'Desactivar', Icono: Power, accion: 'desactivar' as const, variante: 'secundario' as const }
      case 'desactivado':
        return { label: t('usuarios.reactivar_empleado') || 'Reactivar empleado', Icono: Power, accion: 'reactivar' as const, variante: 'primario' as const }
    }
    return null
  })()

  /* Dropdown visible si hay acciones admin o extras contextuales */
  const hayExtrasContextuales =
    puedeGestionarCiclo && (
      estadoCiclo === 'pendiente' ||
      estadoCiclo === 'activo' ||
      (estadoCiclo === 'fichaje' && !!tieneCuentaPrevia)
    )
  const mostrarDropdown = puedeEditar && miembro.rol !== 'propietario' && (
    !!miembro.usuario_id || esPropietario || esAdmin || hayExtrasContextuales
  )

  return (
    <>
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
        {/* ═══════════════ HERO ═══════════════ */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-5 flex flex-col sm:flex-row gap-5 sm:gap-6 items-start">
          {/* Avatar con upload + recortador */}
          <div className="relative group shrink-0">
            <Avatar nombre={nombreCompleto} foto={perfil.avatar_url} tamano="xl" />
            {puedeEditar && (
              <>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  id="avatar-upload"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0]
                    if (!archivo) return
                    const url = URL.createObjectURL(archivo)
                    setRecortador({ imagen: url, tipo: 'avatar' })
                    e.target.value = ''
                  }}
                />
                {perfil.avatar_url ? (
                  <Boton
                    variante="fantasma"
                    soloIcono
                    icono={<Camera size={20} className="text-white" />}
                    titulo="Editar foto de perfil"
                    onClick={() => setRecortador({ imagen: perfil.avatar_url!, tipo: 'avatar' })}
                    className="absolute inset-0 !rounded-full opacity-0 group-hover:opacity-100 !bg-black/40"
                  />
                ) : (
                  <label
                    htmlFor="avatar-upload"
                    aria-label="Subir foto de perfil"
                    className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                  >
                    <Camera size={20} className="text-white" />
                  </label>
                )}
                {perfil.avatar_url && (
                  <Boton
                    variante="peligro"
                    tamano="xs"
                    soloIcono
                    icono={<X size={10} className="text-white" />}
                    titulo="Eliminar foto"
                    onClick={async () => {
                      setPerfil(p => p ? { ...p, avatar_url: null } : null)
                      onActualizarPerfil({ avatar_url: null })
                    }}
                    className="absolute -bottom-1 -right-1 !size-5 !rounded-full opacity-0 group-hover:opacity-100"
                  />
                )}
              </>
            )}
          </div>

          {/* Identidad editorial */}
          <div className="flex-1 min-w-0">
            {/* Nombre — nivel hero */}
            <h1 className="text-[28px] sm:text-[36px] font-bold text-texto-primario tracking-tight leading-[1.05] break-words">
              {nombreCompleto}
            </h1>

            {/* Rol · estado — nivel marca */}
            <div className="mt-2.5 flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.15em]">
              <span className="text-texto-marca">
                {ETIQUETA_ROL[rolActual] || rolActual}
              </span>
              <span className="text-borde-fuerte/60" aria-hidden>·</span>
              <span className={`flex items-center gap-1.5 ${COLOR_ESTADO[estadoCiclo]}`}>
                <motion.span
                  className="size-1.5 rounded-full bg-current"
                  animate={estadoCiclo === 'activo' ? { opacity: [1, 0.3, 1] } : undefined}
                  transition={estadoCiclo === 'activo' ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                  aria-hidden
                />
                {etiquetaEstado[estadoCiclo]}
              </span>
            </div>

            {/* Meta — nivel terciario */}
            <p className="mt-2 text-[11px] text-texto-terciario/80 uppercase tracking-wider font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono">#{numeroEmpleado}</span>
              <span className="text-borde-fuerte/50" aria-hidden>·</span>
              <span>
                {(t('usuarios.desde') || 'Desde')} {fmt.fecha(miembro.unido_en, { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {edad !== null && !esCumpleHoy && (
                <>
                  <span className="text-borde-fuerte/50" aria-hidden>·</span>
                  <span>{edad} {(t('usuarios.anos') || 'años')}</span>
                </>
              )}
              {esCumpleHoy && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center gap-1 text-insignia-advertencia-texto normal-case tracking-normal font-semibold"
                >
                  <Cake size={12} />
                  {textoCumple(diasCumple, perfil.fecha_nacimiento, fmt.locale)}
                </motion.span>
              )}
              {diasCumple > 0 && diasCumple <= 7 && (
                <span className="flex items-center gap-1 text-insignia-advertencia-texto/70 normal-case tracking-normal">
                  <Cake size={11} />
                  {textoCumple(diasCumple, perfil.fecha_nacimiento, fmt.locale)}
                </span>
              )}
            </p>
          </div>

          {/* CTAs + menú ⋯ */}
          <div className="shrink-0 flex items-center gap-2 self-stretch sm:self-start">
            {ctaPrincipal && (
              <Boton
                variante={ctaPrincipal.variante}
                tamano="sm"
                icono={<ctaPrincipal.Icono size={13} />}
                cargando={accionCargando === ctaPrincipal.accion}
                onClick={() => onAccionEstado?.(ctaPrincipal.accion)}
              >
                {ctaPrincipal.label}
              </Boton>
            )}

            {mostrarDropdown && (
              <div className="relative" ref={menuAccionesRef}>
                <Boton
                  variante="secundario"
                  tamano="sm"
                  soloIcono
                  titulo="Más opciones"
                  icono={<MoreHorizontal size={16} />}
                  onClick={() => setMenuAcciones(!menuAcciones)}
                />
                <AnimatePresence>
                  {menuAcciones && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      role="menu"
                      className="absolute right-0 top-full mt-1 w-64 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg z-50 overflow-hidden py-1"
                    >
                      {/* Extras contextuales del ciclo de vida */}
                      {puedeGestionarCiclo && estadoCiclo === 'pendiente' && (
                        <>
                          {linkInvitacion && (
                            <ItemMenu
                              icono={accionCargando === 'copiar-link' ? <Check size={15} /> : <Copy size={15} />}
                              onClick={() => { setMenuAcciones(false); onAccionEstado?.('copiar-link') }}
                            >
                              {t('usuarios.copiar_link') || 'Copiar link'}
                            </ItemMenu>
                          )}
                          <ItemMenu
                            icono={<X size={15} />}
                            onClick={() => { setMenuAcciones(false); onAccionEstado?.('cancelar-invitacion') }}
                          >
                            {t('usuarios.cancelar_invitacion') || 'Cancelar invitación'}
                          </ItemMenu>
                          {(miembro.usuario_id || esPropietario || esAdmin) && <div className="border-t border-borde-sutil my-1" />}
                        </>
                      )}

                      {puedeGestionarCiclo && estadoCiclo === 'activo' && (
                        <>
                          <ItemMenu
                            icono={<Send size={15} />}
                            onClick={() => { setMenuAcciones(false); onAccionEstado?.('reenviar-acceso') }}
                          >
                            {t('usuarios.reenviar_acceso') || 'Reenviar acceso'}
                          </ItemMenu>
                          {(miembro.usuario_id || esPropietario || esAdmin) && <div className="border-t border-borde-sutil my-1" />}
                        </>
                      )}

                      {puedeGestionarCiclo && estadoCiclo === 'fichaje' && tieneCuentaPrevia && (
                        <>
                          <ItemMenu
                            icono={<Send size={15} />}
                            onClick={() => { setMenuAcciones(false); onAccionEstado?.('invitar') }}
                          >
                            {t('usuarios.enviar_invitacion_flux') || 'Enviar invitación'}
                          </ItemMenu>
                          {(miembro.usuario_id || esPropietario || esAdmin) && <div className="border-t border-borde-sutil my-1" />}
                        </>
                      )}

                      {/* Acciones de cuenta — solo si el empleado ya tiene cuenta Flux.
                          Ordenadas por impacto creciente: reseteo → obligar cambio → logout → eliminar. */}
                      {miembro.usuario_id && (
                        <>
                          <ItemMenu icono={<MailIcon size={15} />} onClick={() => { setMenuAcciones(false); setModalResetPassword(true) }}>Enviar reseteo de contraseña</ItemMenu>
                          <ItemMenu icono={<KeyRound size={15} />} onClick={() => { setMenuAcciones(false); setModalForzarPassword(true) }}>Obligar a cambiar contraseña</ItemMenu>
                          <ItemMenu icono={<LogOut size={15} />} onClick={() => { setMenuAcciones(false); setModalForzarLogout(true) }}>Forzar cierre de sesión</ItemMenu>
                          {(esPropietario || esAdmin) && <div className="border-t border-borde-sutil my-1" />}
                        </>
                      )}

                      {(esPropietario || esAdmin) && (
                        <ItemMenu icono={<Trash2 size={15} />} variante="peligro" onClick={() => { setMenuAcciones(false); setModalConfirmarEliminar(true) }}>Eliminar usuario</ItemMenu>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════ FILA CONTACTO ═══════════════ */}
        {(perfil.correo_empresa || perfil.correo || perfil.telefono || puestoNombre || sectorNombre) && (
          <>
            <div className="h-px bg-borde-sutil/60 mx-5 sm:mx-7" />
            <div className="px-5 sm:px-7 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-texto-secundario">
              {(perfil.correo_empresa || perfil.correo) && (
                <span className="flex items-center gap-1.5 min-w-0 max-w-full">
                  <Mail size={13} className="text-texto-terciario shrink-0" />
                  <span className="truncate">{perfil.correo_empresa || perfil.correo}</span>
                </span>
              )}
              {perfil.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-texto-terciario shrink-0" />
                  {perfil.telefono}
                </span>
              )}
              {puestoNombre && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Briefcase size={13} className="text-texto-terciario shrink-0" />
                  <span className="truncate">{puestoNombre}</span>
                </span>
              )}
              {sectorNombre && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Building size={13} className="text-texto-terciario shrink-0" />
                  <span className="truncate">{sectorNombre}</span>
                </span>
              )}
            </div>
          </>
        )}

        {/* ═══════════════ CICLO DE VIDA ═══════════════ */}
        {mostrarCicloVida && (
          <>
            <div className="h-px bg-borde-sutil/60 mx-5 sm:mx-7" />
            <div className="px-5 sm:px-7 pt-5 pb-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  {(estadoCiclo === 'desactivado'
                    ? t('usuarios.ciclo_vida_suspendido')
                    : t('usuarios.ciclo_vida')) || 'Ciclo de vida'}
                </p>
                {estadoCiclo === 'pendiente' && diasInvitacion !== null && (
                  <p className="text-[11px] text-texto-terciario/90 flex items-center gap-1.5">
                    <Clock size={11} />
                    {diasInvitacion === 0
                      ? (t('usuarios.invitacion_expira_hoy') || 'Expira hoy')
                      : diasInvitacion === 1
                      ? (t('usuarios.invitacion_expira_manana') || 'Expira mañana')
                      : (t('usuarios.invitacion_expira_en_dias') || 'Expira en {{dias}} días').replace('{{dias}}', String(diasInvitacion))}
                  </p>
                )}
              </div>
              <StepperEditorial
                estadoActual={estadoCiclo === 'desactivado' ? null : estadoCiclo}
                etiquetas={etiquetaEstado}
                captions={captionEstado}
              />
            </div>

            {/* Aviso de reenvío (feedback efímero) */}
            {avisoReenvio && (
              <div
                className={`mx-5 sm:mx-7 mb-4 text-xs px-3 py-2 rounded-card border ${
                  avisoReenvio.tipo === 'exito'
                    ? 'bg-insignia-exito-fondo/40 border-insignia-exito/30 text-insignia-exito-texto'
                    : 'bg-insignia-peligro-fondo/40 border-insignia-peligro/30 text-insignia-peligro-texto'
                }`}
              >
                {avisoReenvio.texto}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recortador de imagen */}
      {recortador && (
        <RecortadorImagen
          imagen={recortador.imagen}
          aspecto={recortador.tipo === 'avatar' ? 1 : 3 / 4}
          circular={recortador.tipo === 'avatar'}
          titulo={recortador.tipo === 'avatar' ? 'Recortar foto de perfil' : 'Recortar foto para kiosco'}
          onCambiarImagen={(nuevaUrl) => {
            if (recortador.imagen.startsWith('blob:')) URL.revokeObjectURL(recortador.imagen)
            setRecortador({ ...recortador, imagen: nuevaUrl })
          }}
          onCancelar={() => {
            if (recortador.imagen.startsWith('blob:')) URL.revokeObjectURL(recortador.imagen)
            setRecortador(null)
          }}
          onConfirmar={async (blob) => {
            const tipo = recortador.tipo
            URL.revokeObjectURL(recortador.imagen)
            setRecortador(null)

            if (tipo === 'avatar') {
              const ruta = `${perfil.id}/avatar.jpg`
              await supabase.storage.from('usuarios').upload(ruta, blob, { upsert: true, contentType: 'image/jpeg' })
              const { data: urlData } = supabase.storage.from('usuarios').getPublicUrl(ruta)
              const url = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null
              if (url) {
                setPerfil(p => p ? { ...p, avatar_url: url } : null)
                onActualizarPerfil({ avatar_url: url })
              }
            } else {
              const ruta = `${empresaId}/${miembroId}/kiosco.jpg`
              await supabase.storage.from('usuarios').upload(ruta, blob, { upsert: true, contentType: 'image/jpeg' })
              const { data: urlData } = supabase.storage.from('usuarios').getPublicUrl(ruta)
              const url = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null
              if (url) {
                setMiembro(p => p ? { ...p, foto_kiosco_url: url } : null)
                onActualizarMiembro({ foto_kiosco_url: url })
              }
            }
          }}
        />
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   StepperEditorial — timeline horizontal del ciclo de vida.
   Diseño minimal: dots conectados por línea, labels + captions debajo.
   Sin íconos grandes (esa info ya vive en la línea marca del hero).
   ══════════════════════════════════════════════════════════════ */

function StepperEditorial({
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
    <div className="flex items-start justify-between gap-2 relative">
      {FLUJO.map((paso, i) => {
        const Icono = ICONO_ESTADO[paso]
        const esActual = i === indiceActual
        const yaPasado = i < indiceActual
        const claseActual =
          paso === 'fichaje'
            ? 'bg-insignia-cyan-fondo border-insignia-cyan/40 text-insignia-cyan-texto'
            : paso === 'pendiente'
            ? 'bg-insignia-advertencia-fondo border-insignia-advertencia/40 text-insignia-advertencia-texto'
            : 'bg-insignia-exito-fondo border-insignia-exito/40 text-insignia-exito-texto'

        return (
          <div key={paso} className="flex-1 flex flex-col items-center relative min-w-0">
            {/* Conector al siguiente paso */}
            {i < FLUJO.length - 1 && (
              <div
                className={`absolute top-[18px] left-[calc(50%+22px)] right-[calc(-50%+22px)] h-px transition-colors ${
                  yaPasado ? 'bg-insignia-exito/50' : 'bg-borde-sutil'
                }`}
                aria-hidden
              />
            )}

            {/* Círculo con ícono */}
            <motion.div
              animate={esActual ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={esActual ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
              className={`size-9 rounded-full flex items-center justify-center border transition-colors relative z-10 ${
                esActual
                  ? `${claseActual} shadow-sm`
                  : yaPasado
                  ? 'bg-insignia-exito-fondo/70 text-insignia-exito-texto border-insignia-exito/30'
                  : 'bg-superficie-app text-texto-terciario/40 border-borde-sutil'
              }`}
            >
              {yaPasado ? <Check size={14} strokeWidth={2.5} /> : <Icono size={14} />}
            </motion.div>

            {/* Etiqueta + caption */}
            <p
              className={`text-[12px] font-medium mt-2.5 text-center leading-tight tracking-tight ${
                esActual
                  ? 'text-texto-primario'
                  : yaPasado
                  ? 'text-texto-secundario'
                  : 'text-texto-terciario/50'
              }`}
            >
              {etiquetas[paso]}
            </p>
            {captions[paso] && (
              <p
                className={`text-[10px] text-center mt-0.5 leading-tight tracking-wide uppercase hidden sm:block ${
                  esActual ? 'text-texto-terciario/80' : 'text-texto-terciario/40'
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
