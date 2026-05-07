'use client'

/**
 * Tab Información — datos personales, contacto, laborales, kiosco,
 * emergencia, bancaria, documentos.
 * Formularios editables con autoguardado.
 */

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Mail, Phone, CreditCard,
  Briefcase, FileText, KeyRound,
  User, Fingerprint,
  Upload, Eye, EyeOff,
  AlertCircle, Pencil, Camera,
  Heart, X, Nfc, Cake,
  Bell, AlertTriangle, LogIn, Lock,
} from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectCreable } from '@/componentes/ui/SelectCreable'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { BloqueDireccion, type DatosDireccion } from '@/componentes/ui/BloqueDireccion'
import { RecortadorImagen } from '@/componentes/ui/RecortadorImagen'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import type { Rol, Miembro, Perfil, HorarioTipo, MetodoFichaje } from '@/tipos'
import { SeccionEncabezado } from './ComponentesComunes'
import Image from 'next/image'
import {
  ROLES_OPCIONES, ETIQUETA_ROL, OPCIONES_HORARIO, OPCIONES_FICHAJE,
  OPCIONES_GENERO, TIPOS_DOCUMENTOS, diasHastaCumple, textoCumple,
} from './constantes'

interface PropsTabInformacion {
  perfil: Perfil
  miembro: Miembro
  puedeEditar: boolean
  /* Setters de estado */
  setPerfil: React.Dispatch<React.SetStateAction<Perfil | null>>
  setMiembro: React.Dispatch<React.SetStateAction<Miembro | null>>
  /* Autoguardado */
  autoGuardarPerfil: (datos: Record<string, unknown>) => void
  guardarPerfil: (datos: Record<string, unknown>) => Promise<boolean>
  guardarMiembroInmediato: (datos: Record<string, unknown>) => void
  guardarMiembro: (datos: Record<string, unknown>) => Promise<boolean>
  /* Sector y puesto */
  sectores: { id: string; nombre: string }[]
  puestos: { id: string; nombre: string }[]
  sectorActualId: string
  guardarSector: (sectorId: string) => void
  guardarPuesto: (puestoId: string) => void
  /* Info bancaria */
  infoBancaria: Record<string, unknown> | null
  setInfoBancaria: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
  guardarInfoBancaria: (campo: string, valor: string) => void
  bancosEmpresa: { id: string; nombre: string }[]
  setBancosEmpresa: React.Dispatch<React.SetStateAction<{ id: string; nombre: string }[]>>
  /* Contacto emergencia */
  contactoEmergencia: Record<string, unknown> | null
  setContactoEmergencia: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
  guardarEmergencia: (campo: string, valor: string | Record<string, unknown>) => void
  /* Documentos */
  documentosUsuario: Record<string, unknown>[]
  setDocumentosUsuario: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>
  archivosDocLocal: Record<string, { nombre: string; url: string | null; subiendo: boolean; error?: boolean }>
  setArchivosDocLocal: React.Dispatch<React.SetStateAction<Record<string, { nombre: string; url: string | null; subiendo: boolean; error?: boolean }>>>
  setDocPreview: (v: { titulo: string; url: string } | null) => void
  /* Datos derivados */
  rolActual: Rol
  edad: number | null
  /* Empresa */
  empresa: Record<string, unknown> | null
  miembroId: string
  /* Formatter */
  fmt: { locale: string }
  t: (key: string) => string
  /* Supabase */
  supabase: ReturnType<typeof import('@/lib/supabase/cliente').crearClienteNavegador>
}

/**
 * Selector binario empresa/personal usado tanto para canales de notificación
 * (correo/teléfono) como para el canal de login. Cada uso define su
 * etiqueta, ícono y mensaje de campo vacío. No hay fallback automático: si
 * el canal elegido no tiene valor cargado, se marca con advertencia.
 */
function SelectorCanal({
  icono, etiquetaPrincipal, descripcion, etiquetaSinValor,
  valor, valorEmpresa, valorPersonal, onChange, deshabilitado,
}: {
  icono: React.ReactNode
  etiquetaPrincipal: string
  descripcion: string
  /** Texto que sigue al "No hay ..." cuando falta valor. Ej: "correo", "teléfono". */
  etiquetaSinValor: string
  valor: 'empresa' | 'personal'
  valorEmpresa: string | null | undefined
  valorPersonal: string | null | undefined
  onChange: (v: 'empresa' | 'personal') => void
  deshabilitado?: boolean
}) {
  const vacio = valor === 'empresa' ? !valorEmpresa?.trim() : !valorPersonal?.trim()

  // Orden alineado con los inputs de arriba (Personal a la izquierda, Empresa a la derecha)
  const opciones: { v: 'empresa' | 'personal'; etiqueta: string; tieneValor: boolean }[] = [
    { v: 'personal', etiqueta: 'Personal', tieneValor: !!valorPersonal?.trim() },
    { v: 'empresa', etiqueta: 'Empresa', tieneValor: !!valorEmpresa?.trim() },
  ]

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-texto-terciario mt-0.5 shrink-0">{icono}</span>
        <div className="min-w-0">
          <span className="text-sm font-medium text-texto-primario">{etiquetaPrincipal}</span>
          <p className="text-xs text-texto-terciario">{descripcion}</p>
          {vacio && (
            <p className="text-xs text-insignia-advertencia flex items-center gap-1 mt-1">
              <AlertTriangle size={11} />
              No hay {etiquetaSinValor} {valor === 'empresa' ? 'de empresa' : 'personal'} cargado — no va a funcionar hasta que lo completes.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {opciones.map(opt => {
          const activo = valor === opt.v
          return (
            <button
              key={opt.v}
              type="button"
              disabled={deshabilitado}
              onClick={() => !activo && onChange(opt.v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activo
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte'
              }`}
              title={opt.tieneValor ? undefined : `No hay ${etiquetaSinValor} ${opt.v === 'empresa' ? 'de empresa' : 'personal'} cargado`}
            >
              {opt.etiqueta}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabInformacion({
  perfil, miembro, puedeEditar,
  setPerfil, setMiembro,
  autoGuardarPerfil, guardarPerfil, guardarMiembroInmediato, guardarMiembro,
  sectores, puestos, sectorActualId, guardarSector, guardarPuesto,
  infoBancaria, setInfoBancaria, guardarInfoBancaria,
  bancosEmpresa, setBancosEmpresa,
  contactoEmergencia, setContactoEmergencia, guardarEmergencia,
  documentosUsuario, setDocumentosUsuario,
  archivosDocLocal, setArchivosDocLocal, setDocPreview,
  rolActual, edad,
  empresa, miembroId,
  fmt, t,
  supabase,
}: PropsTabInformacion) {
  /* ── Estado local: kiosco ── */
  const [pinVisible, setPinVisible] = useState(false)
  const [capturandoRfid, setCapturandoRfid] = useState(false)
  const rfidInputRef = useRef<HTMLInputElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const [recortador, setRecortador] = useState<{ imagen: string; tipo: 'avatar' | 'kiosco' } | null>(null)
  // Edición de RFID/PIN bloqueada por defecto: requiere confirmación explícita
  // antes de poder modificarlos. Evita cambios accidentales.
  const [rfidEditable, setRfidEditable] = useState(false)
  const [pinEditable, setPinEditable] = useState(false)
  const [confirmandoDesbloqueo, setConfirmandoDesbloqueo] = useState<'rfid' | 'pin' | null>(null)

  /* ── Canal de login: el cambio actualiza miembros + sincroniza auth.users.email
        en un solo POST. El endpoint valida permisos y responde 400 si falta el
        correo del canal elegido. ── */
  const { mostrar: mostrarToast } = useToast()

  const sincronizarCorreoLoginConServidor = async (payload: { canal_login?: 'empresa' | 'personal' }) => {
    try {
      const res = await fetch('/api/miembros/sincronizar-correo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ miembro_id: miembroId, ...payload }),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) {
        mostrarToast('error', datos?.error || 'No se pudo actualizar el correo de login')
        return false
      }
      return true
    } catch {
      mostrarToast('error', 'No se pudo actualizar el correo de login')
      return false
    }
  }

  const cambiarCanalLogin = async (nuevo: 'empresa' | 'personal') => {
    const anterior = (miembro.canal_login || 'empresa') as 'empresa' | 'personal'
    if (anterior === nuevo) return
    setMiembro(p => p ? { ...p, canal_login: nuevo } : null)
    const ok = await sincronizarCorreoLoginConServidor({ canal_login: nuevo })
    if (!ok) setMiembro(p => p ? { ...p, canal_login: anterior } : null)
    else mostrarToast('exito', 'Correo de login actualizado')
  }

  /**
   * Si el usuario modifica el correo que usa actualmente para login, re-sincroniza
   * auth.users. Llamado desde onBlur de los inputs de correo en la sección Contacto.
   */
  const sincronizarLoginSiCorrespondeAlCanal = (campo: 'correo' | 'correo_empresa') => {
    const canalActivo = (miembro.canal_login || 'empresa') as 'empresa' | 'personal'
    const coincide = (canalActivo === 'empresa' && campo === 'correo_empresa')
      || (canalActivo === 'personal' && campo === 'correo')
    if (coincide) void sincronizarCorreoLoginConServidor({})
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 [&>section]:bg-superficie-tarjeta/40 [&>section]:rounded-card [&>section]:p-4 [&>section]:sm:p-5 [&>section]:border [&>section]:border-borde-sutil/40">

      {/* ── 1. DATOS PERSONALES ── */}
      <section>
        <SeccionEncabezado icono={<User size={15} />} titulo={t('usuarios.datos_personales')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input tipo="text" formato="nombre_persona" etiqueta={t('usuarios.nombre')} value={perfil.nombre || ''} onChange={(e) => setPerfil(p => p ? { ...p, nombre: e.target.value } : null)} onBlur={(e) => autoGuardarPerfil({ nombre: e.target.value })} disabled={!puedeEditar} />
          <Input tipo="text" formato="nombre_persona" etiqueta={t('usuarios.apellido')} value={perfil.apellido || ''} onChange={(e) => setPerfil(p => p ? { ...p, apellido: e.target.value } : null)} onBlur={(e) => autoGuardarPerfil({ apellido: e.target.value })} disabled={!puedeEditar} />
          <div>
            <SelectorFecha
              etiqueta={t('usuarios.fecha_nacimiento')}
              valor={perfil.fecha_nacimiento || null}
              onChange={(v) => {
                setPerfil(p => p ? { ...p, fecha_nacimiento: v } : null)
                autoGuardarPerfil({ fecha_nacimiento: v })
              }}
              disabled={!puedeEditar}
              anioMin={1940}
              anioMax={new Date().getFullYear()}
            />
            {edad !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                {diasHastaCumple(perfil.fecha_nacimiento) === 0 ? (
                  <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="flex items-center gap-1.5">
                    <Cake size={12} className="text-insignia-advertencia" />
                    <span className="text-xs font-medium text-insignia-advertencia">¡Hoy cumple {edad} años!</span>
                  </motion.div>
                ) : diasHastaCumple(perfil.fecha_nacimiento) <= 7 ? (
                  <div className="flex items-center gap-1.5">
                    <Cake size={12} className="text-insignia-advertencia/50" />
                    <span className="text-xs text-insignia-advertencia/50">{textoCumple(diasHastaCumple(perfil.fecha_nacimiento), perfil.fecha_nacimiento, fmt.locale)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-texto-terciario">{edad} años</p>
                )}
              </div>
            )}
          </div>
          <Select etiqueta="Género" opciones={OPCIONES_GENERO} valor={perfil.genero || ''} onChange={(v) => { setPerfil(p => p ? { ...p, genero: (v || null) as Perfil['genero'] } : null); guardarPerfil({ genero: v || null }) }} />
          <Input tipo="text" etiqueta="Documento" value={perfil.documento_numero || ''} onChange={(e) => setPerfil(p => p ? { ...p, documento_numero: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ documento_numero: perfil.documento_numero })} icono={<Fingerprint size={15} />} formato={null} disabled={!puedeEditar} />
          <div className="sm:col-span-2">
            <BloqueDireccion
              etiqueta="Domicilio"
              valorInicial={perfil.direccion as Partial<DatosDireccion> | null}
              paises={['AR']}
              alCambiar={(dir) => {
                setPerfil(p => p ? { ...p, direccion: dir as unknown as Record<string, unknown>, domicilio: dir.textoCompleto } : null)
                guardarPerfil({ direccion: dir, domicilio: dir.textoCompleto })
              }}
              deshabilitado={!puedeEditar}
              coordenadasReferencia={(empresa?.direccion as { coordenadas?: { lat: number; lng: number } })?.coordenadas ?? null}
              etiquetaReferencia="la empresa"
            />
          </div>
        </div>
      </section>

      {/* ── 2. CONTACTO ── */}
      <section>
        <SeccionEncabezado icono={<Mail size={15} />} titulo="Contacto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input tipo="email" etiqueta="Correo personal" value={perfil.correo || ''} onChange={(e) => setPerfil(p => p ? { ...p, correo: e.target.value } : null)} onBlur={() => { autoGuardarPerfil({ correo: perfil.correo }); sincronizarLoginSiCorrespondeAlCanal('correo') }} icono={<Mail size={15} />} disabled={!puedeEditar} />
          <Input tipo="email" etiqueta="Correo empresa" value={perfil.correo_empresa || ''} onChange={(e) => setPerfil(p => p ? { ...p, correo_empresa: e.target.value } : null)} onBlur={() => { autoGuardarPerfil({ correo_empresa: perfil.correo_empresa }); sincronizarLoginSiCorrespondeAlCanal('correo_empresa') }} icono={<Mail size={15} />} disabled={!puedeEditar} />
          {/* onBlur lee `e.target.value`: el Input ya aplicó el formato canónico al perder foco
              (vía nativeInputValueSetter + input event), pero el setPerfil queda batched y
              `perfil.telefono` del closure todavía es el valor crudo. Tomar del DOM garantiza
              que la BD recibe la versión formateada. */}
          <Input tipo="tel" etiqueta="Teléfono personal" value={perfil.telefono || ''} onChange={(e) => setPerfil(p => p ? { ...p, telefono: e.target.value } : null)} onBlur={(e) => autoGuardarPerfil({ telefono: e.target.value })} icono={<Phone size={15} />} disabled={!puedeEditar} />
          <Input tipo="tel" etiqueta="Teléfono empresa" value={perfil.telefono_empresa || ''} onChange={(e) => setPerfil(p => p ? { ...p, telefono_empresa: e.target.value } : null)} onBlur={(e) => autoGuardarPerfil({ telefono_empresa: e.target.value })} icono={<Phone size={15} />} disabled={!puedeEditar} />
        </div>

        {/* Canales: dónde llegan notificaciones + con cuál correo inicia sesión.
            Sin fallback automático — si el canal elegido no tiene valor, el
            envío / login correspondiente falla hasta que se complete. */}
        <div className="mt-5 pt-4 border-t border-white/[0.07] space-y-3">
          <SelectorCanal
            icono={<Bell size={13} />}
            etiquetaPrincipal="Notificaciones por correo"
            descripcion="Nómina, invitaciones y avisos del sistema llegan a este correo."
            etiquetaSinValor="correo"
            valor={(miembro.canal_notif_correo || 'empresa') as 'empresa' | 'personal'}
            valorEmpresa={perfil.correo_empresa}
            valorPersonal={perfil.correo}
            onChange={(v) => {
              setMiembro(p => p ? { ...p, canal_notif_correo: v } : null)
              guardarMiembroInmediato({ canal_notif_correo: v })
            }}
            deshabilitado={!puedeEditar}
          />
          <SelectorCanal
            icono={<Bell size={13} />}
            etiquetaPrincipal="Notificaciones por teléfono / WhatsApp"
            descripcion="Nómina, recordatorios y mensajes de Salix IA llegan a este teléfono."
            etiquetaSinValor="teléfono"
            valor={(miembro.canal_notif_telefono || 'empresa') as 'empresa' | 'personal'}
            valorEmpresa={perfil.telefono_empresa}
            valorPersonal={perfil.telefono}
            onChange={(v) => {
              setMiembro(p => p ? { ...p, canal_notif_telefono: v } : null)
              guardarMiembroInmediato({ canal_notif_telefono: v })
            }}
            deshabilitado={!puedeEditar}
          />
          <SelectorCanal
            icono={<LogIn size={13} />}
            etiquetaPrincipal="Correo de inicio de sesión"
            descripcion="Con cuál de los dos correos inicia sesión en Flux y recibe recuperación de contraseña."
            etiquetaSinValor="correo"
            valor={(miembro.canal_login || 'empresa') as 'empresa' | 'personal'}
            valorEmpresa={perfil.correo_empresa}
            valorPersonal={perfil.correo}
            onChange={(v) => cambiarCanalLogin(v)}
            deshabilitado={!puedeEditar}
          />
        </div>
      </section>

      {/* ── 3. DATOS LABORALES + KIOSCO ── */}
      <section>
        <SeccionEncabezado icono={<Briefcase size={15} />} titulo={t('usuarios.datos_laborales')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {puedeEditar ? (
            <Select etiqueta={t('usuarios.rol')} opciones={ROLES_OPCIONES} valor={rolActual} onChange={(v) => { setMiembro(prev => prev ? { ...prev, rol: v as Rol } : null); guardarMiembroInmediato({ rol: v }) }} />
          ) : (
            <Input tipo="text" etiqueta={t('usuarios.rol')} value={ETIQUETA_ROL[rolActual] || rolActual} disabled />
          )}
          <Select
            etiqueta="Sector"
            opciones={[{ valor: '', etiqueta: 'Sin sector' }, ...sectores.map(s => ({ valor: s.id, etiqueta: s.nombre }))]}
            valor={sectorActualId}
            onChange={(v) => guardarSector(v)}
          />
          <Select
            etiqueta={t('usuarios.puesto')}
            opciones={[{ valor: '', etiqueta: 'Sin puesto' }, ...puestos.map(p => ({ valor: p.id, etiqueta: p.nombre }))]}
            valor={miembro.puesto_id || ''}
            onChange={(v) => guardarPuesto(v)}
          />
          <Select etiqueta="Horario" opciones={OPCIONES_HORARIO} valor={miembro.horario_tipo || 'lunes_viernes'} onChange={(v) => { setMiembro(p => p ? { ...p, horario_tipo: v as HorarioTipo } : null); guardarMiembroInmediato({ horario_tipo: v }) }} />
          <Select etiqueta="Método de fichaje" opciones={OPCIONES_FICHAJE} valor={miembro.metodo_fichaje || 'kiosco'} onChange={(v) => { setMiembro(p => p ? { ...p, metodo_fichaje: v as MetodoFichaje } : null); guardarMiembroInmediato({ metodo_fichaje: v }) }} />
        </div>

        <div className="mt-5 space-y-3">
          {[
            { campo: 'horario_flexible', etiqueta: 'Horario flexible', desc: 'No se evalúa puntualidad ni tardanza. La entrada y salida se registran pero no se comparan contra un turno.' },
            ...(miembro.metodo_fichaje === 'automatico' ? [
              { campo: 'fichaje_auto_movil', etiqueta: 'Fichaje automático en móvil', desc: 'Permite que el fichaje automático también funcione cuando usa Flux desde el celular o tablet (PWA). Si está apagado, solo ficha auto desde la PC.' },
            ] : []),
          ].map(toggle => (
            <div key={toggle.campo} className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium text-texto-primario">{toggle.etiqueta}</span>
                <p className="text-xs text-texto-terciario">{toggle.desc}</p>
              </div>
              <Interruptor
                activo={!!((miembro as unknown as Record<string, unknown>)[toggle.campo])}
                onChange={(v) => {
                  setMiembro(p => p ? { ...p, [toggle.campo]: v } as Miembro : null)
                  guardarMiembroInmediato({ [toggle.campo]: v })
                }}
                deshabilitado={!puedeEditar}
              />
            </div>
          ))}
        </div>

        {/* Acceso a Salix IA: nivel define QUÉ puede hacer (ninguno / personal / completo)
            y los flags de canal definen DÓNDE puede usarlo. Cuando el nivel es 'ninguno',
            los toggles de canal quedan desactivados visualmente porque no tienen efecto. */}
        <div className="mt-5 pt-4 border-t border-white/[0.07]">
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">
            Acceso a Salix IA
          </p>

          {/* Selector de nivel: 3 pills horizontales */}
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="min-w-0">
              <span className="text-sm font-medium text-texto-primario">Nivel de acceso</span>
              <p className="text-xs text-texto-terciario">
                {(miembro.nivel_salix ?? 'ninguno') === 'ninguno'
                  ? 'Sin acceso al asistente.'
                  : miembro.nivel_salix === 'personal'
                  ? 'Solo consultas sobre sus datos: recibos, asistencia, próximo pago.'
                  : 'Asistente con acceso a todas las funciones de su rol.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(['ninguno', 'personal', 'completo'] as const).map(nivel => {
                const activo = (miembro.nivel_salix ?? 'ninguno') === nivel
                const etiqueta = nivel === 'ninguno' ? 'Ninguno' : nivel === 'personal' ? 'Personal' : 'Completo'
                return (
                  <button
                    key={nivel}
                    type="button"
                    disabled={!puedeEditar}
                    onClick={() => {
                      if (activo) return
                      setMiembro(p => p ? { ...p, nivel_salix: nivel } : null)
                      guardarMiembroInmediato({ nivel_salix: nivel })
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      activo
                        ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                        : 'border-borde-sutil text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte'
                    }`}
                  >
                    {etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles de canal: deshabilitados cuando el nivel es 'ninguno' */}
          <div className={`mt-3 pt-3 border-t border-white/[0.05] space-y-2.5 ${(miembro.nivel_salix ?? 'ninguno') === 'ninguno' ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm font-medium text-texto-primario">En la app (web y móvil)</span>
                <p className="text-xs text-texto-terciario">Puede abrir el asistente desde el botón flotante de Flux.</p>
              </div>
              <Interruptor
                activo={!!miembro.salix_ia_web}
                onChange={(v) => {
                  setMiembro(p => p ? { ...p, salix_ia_web: v } : null)
                  guardarMiembroInmediato({ salix_ia_web: v })
                }}
                deshabilitado={!puedeEditar}
              />
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm font-medium text-texto-primario">Por WhatsApp</span>
                <p className="text-xs text-texto-terciario">
                  Puede usar Salix IA como copilot escribiendo al WhatsApp de la empresa. Se identifica por su {miembro.canal_notif_telefono === 'personal' ? 'teléfono personal' : 'teléfono de empresa'}.
                </p>
              </div>
              <Interruptor
                activo={!!miembro.salix_ia_whatsapp}
                onChange={(v) => {
                  setMiembro(p => p ? { ...p, salix_ia_whatsapp: v } : null)
                  guardarMiembroInmediato({ salix_ia_whatsapp: v })
                }}
                deshabilitado={!puedeEditar}
              />
            </div>
          </div>
        </div>

        {/* Acceso al kiosco */}
        <div className="mt-6 pt-5 -mx-4 px-4 sm:-mx-5 sm:px-5 border-t border-borde-sutil/40">
          <p className="text-sm font-medium text-texto-primario flex items-center gap-2 mb-4">
            <KeyRound size={14} className="text-texto-terciario" />
            Acceso al kiosco
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Llavero RFID */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-texto-primario">Llavero RFID</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    tipo="text"
                    ref={rfidInputRef}
                    value={miembro.kiosco_rfid || ''}
                    onChange={(e) => setMiembro(p => p ? { ...p, kiosco_rfid: e.target.value } : null)}
                    onBlur={() => {
                      if (capturandoRfid && miembro.kiosco_rfid) {
                        guardarMiembroInmediato({ kiosco_rfid: miembro.kiosco_rfid })
                        setCapturandoRfid(false)
                      } else {
                        guardarMiembro({ kiosco_rfid: miembro.kiosco_rfid || null })
                      }
                      // Re-bloquear al perder foco para evitar ediciones posteriores accidentales
                      setRfidEditable(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (miembro.kiosco_rfid) {
                          guardarMiembroInmediato({ kiosco_rfid: miembro.kiosco_rfid })
                        }
                        setCapturandoRfid(false)
                        rfidInputRef.current?.blur()
                      }
                    }}
                    placeholder={capturandoRfid ? 'Esperando...' : 'Sin asignar'}
                    formato={null}
                    disabled={!puedeEditar || !rfidEditable}
                    compacto
                  />
                </div>
                {puedeEditar && (
                  rfidEditable ? (
                    <Boton
                      variante={capturandoRfid ? 'primario' : 'secundario'}
                      tamano="sm"
                      icono={<Nfc size={14} className={capturandoRfid ? 'animate-pulse' : ''} />}
                      onClick={() => {
                        if (capturandoRfid) {
                          setCapturandoRfid(false)
                          return
                        }
                        setCapturandoRfid(true)
                        setTimeout(() => rfidInputRef.current?.focus(), 50)
                      }}
                    >
                      {capturandoRfid ? 'Capturando...' : 'Capturar'}
                    </Boton>
                  ) : (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      icono={<Lock size={14} />}
                      titulo="Editar llavero RFID"
                      onClick={() => setConfirmandoDesbloqueo('rfid')}
                    >
                      Editar
                    </Boton>
                  )
                )}
              </div>
              <p className="text-xs text-texto-terciario">
                {!rfidEditable
                  ? 'Bloqueado. Tocá Editar para modificar.'
                  : capturandoRfid
                    ? 'Pasá el llavero por el lector USB...'
                    : 'Clic en Capturar y pasá el llavero.'}
              </p>
            </div>

            {/* PIN del kiosco */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-texto-primario">PIN del kiosco <span className="font-normal text-texto-terciario">(6 dígitos)</span></p>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    tipo={pinVisible ? 'text' : 'password'}
                    ref={pinInputRef}
                    value={miembro.kiosco_pin || ''}
                    onChange={(e) => setMiembro(p => p ? { ...p, kiosco_pin: e.target.value.replace(/\D/g, '').slice(0, 6) } : null)}
                    onBlur={() => {
                      guardarMiembro({ kiosco_pin: miembro.kiosco_pin || null })
                      setPinEditable(false)
                    }}
                    placeholder="000000"
                    formato={null}
                    disabled={!puedeEditar || !pinEditable}
                    compacto
                    iconoDerecho={
                      <Boton
                        variante="fantasma"
                        tamano="xs"
                        soloIcono
                        icono={pinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        titulo={pinVisible ? 'Ocultar' : 'Mostrar'}
                        onClick={() => setPinVisible(v => !v)}
                      />
                    }
                  />
                </div>
                {puedeEditar && (
                  pinEditable ? (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      icono={<KeyRound size={14} />}
                      onClick={() => {
                        const pin = String(Math.floor(100000 + Math.random() * 900000))
                        setMiembro(p => p ? { ...p, kiosco_pin: pin } : null)
                        guardarMiembroInmediato({ kiosco_pin: pin })
                        setPinVisible(true)
                      }}
                    >
                      Generar
                    </Boton>
                  ) : (
                    <Boton
                      variante="secundario"
                      tamano="sm"
                      icono={<Lock size={14} />}
                      titulo="Editar PIN del kiosco"
                      onClick={() => setConfirmandoDesbloqueo('pin')}
                    >
                      Editar
                    </Boton>
                  )
                )}
              </div>
              <p className="text-xs text-texto-terciario">
                {!pinEditable
                  ? 'Bloqueado. Tocá Editar para modificar.'
                  : 'Alternativa al llavero. Ej: últimos 6 dígitos del DNI.'}
              </p>
            </div>
          </div>

          {/* Foto para kiosco */}
          <div className="mt-4 flex items-start gap-4">
            <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" id="foto-kiosco-upload"
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (!archivo) return
                const url = URL.createObjectURL(archivo)
                setRecortador({ imagen: url, tipo: 'kiosco' })
                e.target.value = ''
              }}
            />
            <div className="w-16 shrink-0">
              {miembro.foto_kiosco_url ? (
                <div className="relative group">
                  <Image
                    src={miembro.foto_kiosco_url}
                    alt="Foto kiosco"
                    width={64}
                    height={85}
                    className="w-16 aspect-[3/4] object-cover rounded-card border border-borde-sutil"
                  />
                  <Boton
                    variante="fantasma"
                    soloIcono
                    icono={<Camera size={14} className="text-white" />}
                    titulo="Editar foto kiosco"
                    onClick={() => setRecortador({ imagen: miembro.foto_kiosco_url!, tipo: 'kiosco' })}
                    className="absolute inset-0 !rounded-card opacity-0 group-hover:opacity-100 !bg-black/40"
                  />
                  <Boton
                    variante="peligro"
                    tamano="xs"
                    soloIcono
                    icono={<X size={10} className="text-white" />}
                    titulo="Eliminar foto"
                    onClick={async () => {
                      setMiembro(p => p ? { ...p, foto_kiosco_url: null } : null)
                      guardarMiembroInmediato({ foto_kiosco_url: null })
                    }}
                    className="absolute -top-1.5 -right-1.5 !size-5 !rounded-full opacity-0 group-hover:opacity-100"
                  />
                </div>
              ) : (
                <label
                  htmlFor="foto-kiosco-upload"
                  className="w-16 aspect-[3/4] rounded-card border-2 border-dashed border-borde-fuerte flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-superficie-hover/30 hover:border-texto-marca/30 transition-all"
                >
                  <Camera size={14} className="text-texto-terciario" />
                  <span className="text-xxs text-texto-terciario">Subir</span>
                </label>
              )}
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium text-texto-primario">Foto para kiosco</p>
              <p className="text-xs text-texto-terciario mt-0.5">Se muestra al fichar. Vertical 3:4, tipo carnet.</p>
              {!miembro.foto_kiosco_url && puedeEditar && (
                <label htmlFor="foto-kiosco-upload" className="text-xs text-texto-marca cursor-pointer hover:underline mt-1 inline-block">
                  Subir foto
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Recortador de imagen para foto kiosco */}
        {recortador && (
          <RecortadorImagen
            imagen={recortador.imagen}
            aspecto={3 / 4}
            circular={false}
            titulo="Recortar foto para kiosco"
            onCambiarImagen={(nuevaUrl) => {
              if (recortador.imagen.startsWith('blob:')) URL.revokeObjectURL(recortador.imagen)
              setRecortador({ ...recortador, imagen: nuevaUrl })
            }}
            onCancelar={() => {
              if (recortador.imagen.startsWith('blob:')) URL.revokeObjectURL(recortador.imagen)
              setRecortador(null)
            }}
            onConfirmar={async (blob) => {
              if (!empresa) return
              URL.revokeObjectURL(recortador.imagen)
              setRecortador(null)
              const ruta = `${(empresa as Record<string, unknown>).id}/${miembroId}/kiosco.jpg`
              await supabase.storage.from('usuarios').upload(ruta, blob, { upsert: true, contentType: 'image/jpeg' })
              const { data: urlData } = supabase.storage.from('usuarios').getPublicUrl(ruta)
              const url = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null
              if (url) {
                setMiembro(p => p ? { ...p, foto_kiosco_url: url } : null)
                guardarMiembroInmediato({ foto_kiosco_url: url })
              }
            }}
          />
        )}
      </section>

      {/* ── 4. CONTACTO DE EMERGENCIA ── */}
      <section>
        <SeccionEncabezado icono={<Heart size={15} />} titulo="Contacto de emergencia" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input tipo="text" formato="nombre_persona" etiqueta="Nombre" value={(contactoEmergencia?.nombre as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, nombre: e.target.value }))} onBlur={(e) => guardarEmergencia('nombre', e.target.value)} placeholder="Nombre completo" disabled={!puedeEditar} />
          <Input tipo="text" etiqueta="Relación" value={(contactoEmergencia?.relacion as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, relacion: e.target.value }))} onBlur={(e) => guardarEmergencia('relacion', e.target.value)} placeholder="Padre, madre, pareja..." disabled={!puedeEditar} />
          <Input tipo="tel" etiqueta="Teléfono" value={(contactoEmergencia?.telefono as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, telefono: e.target.value }))} onBlur={(e) => guardarEmergencia('telefono', e.target.value)} placeholder="+54 11 1234-5678" icono={<Phone size={15} />} disabled={!puedeEditar} />
          <div className="sm:col-span-2">
            <BloqueDireccion
              etiqueta="Dirección"
              valorInicial={(() => {
                const dir = contactoEmergencia?.direccion
                if (!dir) return null
                if (typeof dir === 'object') return dir as Partial<DatosDireccion>
                try { return JSON.parse(dir as string) as Partial<DatosDireccion> } catch { return { textoCompleto: dir as string, calle: dir as string } }
              })()}
              paises={['AR']}
              alCambiar={(dir) => {
                setContactoEmergencia(p => ({ ...p, direccion: dir }))
                guardarEmergencia('direccion', dir as unknown as Record<string, unknown>)
              }}
              deshabilitado={!puedeEditar}
            />
          </div>
        </div>
      </section>

      {/* ── 5. INFORMACIÓN BANCARIA ── */}
      <section>
        <SeccionEncabezado icono={<CreditCard size={15} />} titulo="Información bancaria" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select etiqueta="Tipo de cuenta" opciones={[{ valor: '', etiqueta: 'No especificado' }, { valor: 'cbu', etiqueta: 'CBU — Cuenta bancaria' }, { valor: 'cvu', etiqueta: 'CVU — Cuenta virtual' }]} valor={(infoBancaria?.tipo_cuenta as string) || ''} onChange={(v) => guardarInfoBancaria('tipo_cuenta', v)} />
          <SelectCreable
            etiqueta={t('usuarios.banco')}
            placeholder="Buscar banco..."
            opciones={bancosEmpresa.map(b => ({ valor: b.nombre, etiqueta: b.nombre }))}
            valor={(infoBancaria?.banco as string) || ''}
            onChange={(v) => { setInfoBancaria(p => ({ ...p, banco: v })); guardarInfoBancaria('banco', v) }}
            onCrear={async (nombre) => {
              try {
                const res = await fetch('/api/bancos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })
                if (!res.ok) return false
                const banco = await res.json()
                setBancosEmpresa(prev => {
                  if (prev.some(b => b.id === banco.id)) return prev
                  return [...prev, banco].sort((a, b) => a.nombre.localeCompare(b.nombre))
                })
                return banco.nombre
              } catch { return false }
            }}
            onEditar={async (valorActual, nuevoNombre) => {
              try {
                const banco = bancosEmpresa.find(b => b.nombre === valorActual)
                if (!banco) return false
                const res = await fetch('/api/bancos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banco.id, nombre: nuevoNombre }) })
                if (!res.ok) return false
                const actualizado = await res.json()
                setBancosEmpresa(prev => prev.map(b => b.id === banco.id ? actualizado : b).sort((a, b) => a.nombre.localeCompare(b.nombre)))
                if ((infoBancaria?.banco as string) === valorActual) setInfoBancaria(p => ({ ...p, banco: actualizado.nombre }))
                return actualizado.nombre
              } catch { return false }
            }}
            onEliminar={async (valorBanco) => {
              try {
                const banco = bancosEmpresa.find(b => b.nombre === valorBanco)
                if (!banco) return false
                const res = await fetch('/api/bancos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banco.id }) })
                if (!res.ok) return false
                setBancosEmpresa(prev => prev.filter(b => b.id !== banco.id))
                if ((infoBancaria?.banco as string) === valorBanco) setInfoBancaria(p => ({ ...p, banco: null }))
                return true
              } catch { return false }
            }}
            textoCrear="Crear banco"
          />
          <Input tipo="text" etiqueta={t('usuarios.cbu')} value={(infoBancaria?.numero_cuenta as string) || ''} onChange={(e) => setInfoBancaria(p => ({ ...p, numero_cuenta: e.target.value }))} onBlur={(e) => guardarInfoBancaria('numero_cuenta', e.target.value)} placeholder="Número de cuenta" formato={null} disabled={!puedeEditar} />
          <Input tipo="text" etiqueta={t('usuarios.alias_bancario')} value={(infoBancaria?.alias as string) || ''} onChange={(e) => setInfoBancaria(p => ({ ...p, alias: e.target.value }))} onBlur={(e) => guardarInfoBancaria('alias', e.target.value)} placeholder="mi.alias.mp" formato="minusculas" disabled={!puedeEditar} />
        </div>
      </section>

      {/* ── 6. DOCUMENTOS ── */}
      <section id="seccion-documentos">
        <SeccionEncabezado icono={<FileText size={15} />} titulo="Documentos" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIPOS_DOCUMENTOS.map(doc => {
            const docExistente = documentosUsuario.find(d => (d.tipo as string) === doc)
            const previewLocal = archivosDocLocal[doc]
            const imgUrl = previewLocal?.url || (docExistente?.url as string | undefined) || null

            return (
              <div key={doc} className={`flex flex-col rounded-card overflow-hidden border-2 transition-all ${imgUrl ? 'border-insignia-exito/40' : 'border-dashed border-borde-fuerte hover:border-texto-marca/30'}`}>

                {/* Input oculto */}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" id={`doc-${doc}`}
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0]
                    if (!archivo || !empresa) return
                    const previewUrl = archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null
                    setArchivosDocLocal(prev => ({ ...prev, [doc]: { nombre: archivo.name, url: previewUrl, subiendo: true } }))
                    const ext = archivo.name.split('.').pop() || 'jpg'
                    const ruta = `${(empresa as Record<string, unknown>).id}/${miembroId}/docs/${doc.replace(/\s/g, '_').toLowerCase()}.${ext}`
                    const { error: upErr } = await supabase.storage.from('documentos-usuario').upload(ruta, archivo, { upsert: true })
                    if (upErr) { setArchivosDocLocal(prev => ({ ...prev, [doc]: { ...prev[doc], subiendo: false, error: true } })); return }
                    const { data: urlData } = supabase.storage.from('documentos-usuario').getPublicUrl(ruta)
                    const url = urlData?.publicUrl || ''
                    if (docExistente?.id) {
                      await supabase.from('documentos_usuario').update({ url, nombre_archivo: archivo.name }).eq('id', docExistente.id)
                    } else {
                      await supabase.from('documentos_usuario').insert({ miembro_id: miembroId, tipo: doc, url, nombre_archivo: archivo.name })
                    }
                    const { data: docsData } = await supabase.from('documentos_usuario').select('*').eq('miembro_id', miembroId)
                    if (docsData) setDocumentosUsuario(docsData)
                    setArchivosDocLocal(prev => { const n = { ...prev }; delete n[doc]; return n })
                  }}
                />

                {/* Área de imagen / placeholder */}
                {imgUrl ? (
                  <div
                    className="relative aspect-[4/3] cursor-pointer group"
                    onClick={(e) => { e.preventDefault(); setDocPreview({ titulo: doc, url: imgUrl }) }}
                  >
                    <Image src={imgUrl} alt={doc} fill sizes="(max-width: 768px) 50vw, 200px" className="object-contain bg-superficie-hover/30" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {previewLocal?.subiendo && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {previewLocal?.error && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <AlertCircle size={20} className="text-insignia-peligro" />
                      </div>
                    )}
                  </div>
                ) : (
                  <label htmlFor={`doc-${doc}`} className="aspect-[4/3] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-superficie-hover/30 transition-colors">
                    <Upload size={20} className="text-texto-terciario" />
                  </label>
                )}

                {/* Pie: nombre + acción */}
                <div className="px-2 py-2 flex items-center justify-between gap-1 bg-superficie-tarjeta/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-texto-terciario text-center truncate">{doc}</p>
                    {(previewLocal || docExistente) && (
                      <p className="text-xxs text-insignia-exito text-center truncate">{previewLocal?.nombre || (docExistente?.nombre_archivo as string)}</p>
                    )}
                  </div>
                  {imgUrl && (
                    <Tooltip contenido="Reemplazar">
                    <label htmlFor={`doc-${doc}`} className="shrink-0 cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors">
                      <Pencil size={11} />
                    </label>
                    </Tooltip>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Confirmación para desbloquear edición de RFID o PIN del kiosco */}
      <ModalConfirmacion
        abierto={confirmandoDesbloqueo !== null}
        onCerrar={() => setConfirmandoDesbloqueo(null)}
        onConfirmar={() => {
          if (confirmandoDesbloqueo === 'rfid') {
            setRfidEditable(true)
            setTimeout(() => rfidInputRef.current?.focus(), 50)
          } else if (confirmandoDesbloqueo === 'pin') {
            setPinEditable(true)
            setTimeout(() => pinInputRef.current?.focus(), 50)
          }
          setConfirmandoDesbloqueo(null)
        }}
        titulo={confirmandoDesbloqueo === 'rfid' ? '¿Editar llavero RFID?' : '¿Editar PIN del kiosco?'}
        descripcion={
          confirmandoDesbloqueo === 'rfid'
            ? 'Vas a modificar el llavero RFID asociado a este usuario. Si lo cambiás, dejará de funcionar el llavero anterior para fichar en el kiosco.'
            : 'Vas a modificar el PIN del kiosco. Si lo cambiás, el usuario deberá usar el nuevo PIN para fichar.'
        }
        tipo="advertencia"
        etiquetaConfirmar="Sí, editar"
      />
    </div>
  )
}
