'use client'

/**
 * Cabecera del perfil de usuario — avatar, nombre, rol, datos rápidos, menú de acciones.
 * Se muestra siempre arriba, independiente del tab activo.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Phone, Calendar, Briefcase, Building,
  Camera, User, MoreHorizontal,
  X, KeyRound, Trash2, LogOut, Power, Mail as MailIcon, Cake,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { RecortadorImagen } from '@/componentes/ui/RecortadorImagen'
import type { Miembro, Perfil } from '@/tipos'
import { ItemMenu } from './ComponentesComunes'
import { ETIQUETA_ROL, COLOR_ROL, diasHastaCumple, textoCumple } from './constantes'

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
  /* Callbacks */
  onActualizarPerfil: (datos: Record<string, unknown>) => void
  onActualizarMiembro: (datos: Record<string, unknown>) => void
  setPerfil: React.Dispatch<React.SetStateAction<Perfil | null>>
  setMiembro: React.Dispatch<React.SetStateAction<Miembro | null>>
  /* Acciones de usuario */
  ejecutarAccion: (accion: string) => void
  accionCargando: string | null
  setModalForzarPassword: (v: boolean) => void
  setModalConfirmarEliminar: (v: boolean) => void
  /* Supabase para subir imágenes */
  supabase: ReturnType<typeof import('@/lib/supabase/cliente').crearClienteNavegador>
  empresaId: string
  miembroId: string
}

export function CabeceraUsuario({
  miembro, perfil, nombreCompleto, numeroEmpleado, edad,
  puedeEditar, esPropietario, esAdmin,
  fmt,
  onActualizarPerfil, onActualizarMiembro,
  setPerfil, setMiembro,
  ejecutarAccion, accionCargando,
  setModalForzarPassword, setModalConfirmarEliminar,
  supabase, empresaId, miembroId,
}: PropsCabeceraUsuario) {
  const rolActual = (miembro?.rol as string) || 'empleado'

  /* ── Estado local: menú acciones y recortador ── */
  const [menuAcciones, setMenuAcciones] = useState(false)
  const menuAccionesRef = useRef<HTMLDivElement>(null)
  const [recortador, setRecortador] = useState<{ imagen: string; tipo: 'avatar' | 'kiosco' } | null>(null)

  /* Cerrar menú acciones al hacer click afuera */
  useEffect(() => {
    if (!menuAcciones) return
    const handler = (e: MouseEvent) => {
      if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target as Node)) setMenuAcciones(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAcciones])

  return (
    <>
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
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
                {/* Overlay: si tiene foto abre recortador con la existente, si no abre file picker */}
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
                {/* Botón eliminar foto */}
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

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-texto-primario">{nombreCompleto}</h1>
              <Insignia color={miembro.activo ? 'exito' : 'advertencia'}>
                {miembro.activo ? 'Activo' : 'Inactivo'}
              </Insignia>
              <Insignia color={COLOR_ROL[rolActual] || 'neutro'}>
                {ETIQUETA_ROL[rolActual] || rolActual}
              </Insignia>
            </div>

            {/* Datos rápidos en línea */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-texto-secundario">
              {/* Edad o cumpleaños */}
              {(() => {
                const dias = diasHastaCumple(perfil.fecha_nacimiento)
                if (dias === 0) return (
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-1.5 text-insignia-advertencia font-medium"
                  >
                    <Cake size={13} />
                    {textoCumple(dias, perfil.fecha_nacimiento, fmt.locale)}
                  </motion.span>
                )
                if (dias > 0 && dias <= 7) return (
                  <span className="flex items-center gap-1.5 text-insignia-advertencia/50">
                    <Cake size={13} />
                    {textoCumple(dias, perfil.fecha_nacimiento, fmt.locale)}
                  </span>
                )
                if (edad !== null) return (
                  <span className="flex items-center gap-1.5">
                    <User size={13} className="text-texto-terciario" />
                    {edad} años
                  </span>
                )
                return null
              })()}
              {(perfil.correo_empresa || perfil.correo) ? (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-texto-terciario" />
                  {perfil.correo_empresa || perfil.correo}
                </span>
              ) : null}
              {perfil.telefono ? (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-texto-terciario" />
                  {perfil.telefono}
                </span>
              ) : null}
              {miembro.puesto_nombre ? (
                <span className="flex items-center gap-1.5">
                  <Briefcase size={13} className="text-texto-terciario" />
                  {miembro.puesto_nombre}
                </span>
              ) : null}
              {miembro.sector ? (
                <span className="flex items-center gap-1.5">
                  <Building size={13} className="text-texto-terciario" />
                  {miembro.sector}
                </span>
              ) : null}
            </div>

            {/* Fecha de ingreso */}
            <p className="text-xs text-texto-terciario mt-1.5">
              <Calendar size={11} className="inline mr-1" />
              Desde {fmt.fecha(miembro.unido_en)}
            </p>
          </div>

          {/* Número de empleado + Acciones */}
          <div className="shrink-0 self-start flex flex-col items-end gap-2">
            <span className="text-2xl font-bold font-mono text-texto-terciario/40">#{numeroEmpleado}</span>
            {puedeEditar && miembro.rol !== 'propietario' && (
              <div className="relative" ref={menuAccionesRef}>
                <Boton
                  variante="secundario"
                  tamano="sm"
                  soloIcono
                  titulo="Más opciones"
                  icono={<MoreHorizontal size={16} />}
                  onClick={() => setMenuAcciones(!menuAcciones)}
                />

              {/* Dropdown */}
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
                    {/* Acciones de cuenta — solo si el empleado ya tiene cuenta Flux */}
                    {miembro.usuario_id && (
                      <>
                        <ItemMenu icono={<MailIcon size={15} />} onClick={() => ejecutarAccion('reset-password')}>Enviar reseteo de contraseña</ItemMenu>
                        <ItemMenu icono={<KeyRound size={15} />} onClick={() => { setMenuAcciones(false); setModalForzarPassword(true) }}>Forzar nueva contraseña</ItemMenu>
                        <ItemMenu icono={<LogOut size={15} />} onClick={() => ejecutarAccion('forzar-logout')}>Forzar cierre de sesión</ItemMenu>
                        <div className="border-t border-borde-sutil my-1" />
                      </>
                    )}

                    <ItemMenu icono={<Power size={15} />} variante="advertencia" onClick={() => ejecutarAccion('desactivar')}>
                      {miembro.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                    </ItemMenu>

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
      </div>

      {/* Recortador de imagen (avatar o kiosco) */}
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
