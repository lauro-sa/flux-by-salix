'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Users, Mail, Copy, Check, Download, Upload,
  Briefcase, DollarSign, Calendar, UserRoundSearch,
  Clock, Cake, Phone,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Modal } from '@/componentes/ui/Modal'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useRol } from '@/hooks/useRol'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * Página de gestión de usuarios — /usuarios
 * Usa PlantillaListado + TablaDinamica como todas las demás páginas de lista.
 */

interface MiembroTabla {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
  avatar_url: string | null
  correo: string
  telefono: string
  telefono_empresa: string
  rol: string
  activo: boolean
  sector: string
  puesto: string
  numero_empleado: number | null
  documento_numero: string
  genero: string
  domicilio: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia: string
  dias_trabajo: number
  horario_tipo: string
  horario_flexible: boolean
  turno: string
  metodo_fichaje: string
  unido_en: string
  fecha_nacimiento: string | null
}

/** Calcula días hasta el próximo cumpleaños (0 = hoy, -1 = no aplica) */
function diasHastaCumple(fechaNac: string | null): number {
  if (!fechaNac) return -1
  const hoy = new Date()
  const nac = new Date(fechaNac + 'T12:00:00')
  if (isNaN(nac.getTime())) return -1

  const cumpleEsteAnio = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())
  let diff = Math.floor((cumpleEsteAnio.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)

  // Si ya pasó este año, calcular para el próximo
  if (diff < 0) {
    const cumpleProximo = new Date(hoy.getFullYear() + 1, nac.getMonth(), nac.getDate())
    diff = Math.floor((cumpleProximo.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  }

  return diff
}

/** Genera texto de cumpleaños: "Cumple hoy", "Cumple mañana", "Cumple el miércoles" */
function textoCumple(dias: number, fechaNac: string | null): string {
  if (dias < 0 || !fechaNac) return ''
  const nac = new Date(fechaNac + 'T12:00:00')
  const edad = new Date().getFullYear() - nac.getFullYear() + (dias === 0 ? 0 : 0)
  const edadCumple = dias === 0
    ? new Date().getFullYear() - nac.getFullYear()
    : new Date().getFullYear() - nac.getFullYear() + (new Date().getMonth() > nac.getMonth() || (new Date().getMonth() === nac.getMonth() && new Date().getDate() > nac.getDate()) ? 1 : 0)

  if (dias === 0) return `¡Cumple ${edadCumple} hoy!`
  if (dias === 1) return `Cumple ${edadCumple} mañana`

  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const diaSemana = fecha.toLocaleDateString('es', { weekday: 'long' })
  return `Cumple ${edadCumple} el ${diaSemana}`
}

/** Genera mapa de etiquetas de rol usando traducciones */
function crearEtiquetaRol(t: (clave: string) => string): Record<string, string> {
  return {
    propietario: t('empresa.roles.propietario'), administrador: t('empresa.roles.administrador'), gestor: t('empresa.roles.gestor'),
    vendedor: t('empresa.roles.vendedor'), supervisor: t('empresa.roles.supervisor'), empleado: t('empresa.roles.empleado'), invitado: t('empresa.roles.invitado'),
  }
}

const COLOR_ROL: Record<string, 'primario' | 'violeta' | 'info' | 'naranja' | 'cyan' | 'neutro' | 'advertencia'> = {
  propietario: 'primario', administrador: 'violeta', gestor: 'info',
  vendedor: 'naranja', supervisor: 'cyan', empleado: 'neutro', invitado: 'advertencia',
}

/** Genera opciones de rol para el select de invitar usando traducciones */
function crearRolesOpciones(t: (clave: string) => string) {
  return [
    { valor: 'administrador', etiqueta: t('empresa.roles.administrador') },
    { valor: 'gestor', etiqueta: t('empresa.roles.gestor') },
    { valor: 'vendedor', etiqueta: t('empresa.roles.vendedor') },
    { valor: 'supervisor', etiqueta: t('empresa.roles.supervisor') },
    { valor: 'empleado', etiqueta: t('empresa.roles.empleado') },
    { valor: 'invitado', etiqueta: t('empresa.roles.invitado') },
  ]
}

function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)
}

const ETIQUETA_FRECUENCIA: Record<string, string> = {
  mensual: '/mes',
  quincenal: '/quincena',
  semanal: '/semana',
  eventual: '',
}

function etiquetaCompensacion(tipo: string, frecuencia: string): string {
  if (tipo === 'por_dia') return '/día'
  if (tipo === 'por_hora') return '/hora'
  return ETIQUETA_FRECUENCIA[frecuencia] || '/mes'
}

/** Genera mapa de etiquetas de horario usando traducciones */
function crearEtiquetaHorario(t: (clave: string) => string): Record<string, string> {
  return {
    lunes_viernes: t('usuarios.lv'),
    lunes_sabado: t('usuarios.ls'),
    todos: t('usuarios.ld'),
    custom: t('usuarios.personalizado'),
  }
}

/** Genera mapa de etiquetas de fichaje usando traducciones */
function crearEtiquetaFichaje(t: (clave: string) => string): Record<string, string> {
  return {
    kiosco: t('asistencias.metodos.kiosco'),
    automatico: t('asistencias.metodos.automatico'),
    manual: t('comun.manual'),
  }
}

function formatearIngreso(fecha: string | null): string | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return null
  return `Desde ${d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}`
}

/* ── Columnas de la tabla ──
   Orden lógico: identidad → rol/estado → organización → contacto → compensación → fechas
   Visibles por defecto: nombre, rol, estado, sector, puesto, correo (las más usadas)
   Ocultas por defecto: teléfono, compensación, días trabajo, ingreso, cumpleaños (disponibles para activar) */

/** Columnas visibles por defecto (el usuario puede cambiarlas y se persisten) */
const COLUMNAS_VISIBLES_DEFAULT = ['nombre', 'rol', 'activo', 'sector', 'puesto', 'correo']

/** Genera columnas de la tabla con traducciones */
function crearColumnas(t: (clave: string) => string): ColumnaDinamica<MiembroTabla>[] {
  const ETIQUETA_ROL = crearEtiquetaRol(t)
  const ETIQUETA_HORARIO = crearEtiquetaHorario(t)
  const ETIQUETA_FICHAJE = crearEtiquetaFichaje(t)

  return [
  /* ── Identidad ── */
  {
    clave: 'nombre',
    etiqueta: t('comun.nombre'),
    ancho: 240,
    ordenable: true,
    grupo: t('comun.identidad'),
    render: (fila) => {
      const dias = diasHastaCumple(fila.fecha_nacimiento)
      const esHoy = dias === 0
      const esProximo = dias > 0 && dias <= 7
      return (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar nombre={`${fila.nombre} ${fila.apellido}`} tamano="sm" />
            {esHoy && (
              <div className="absolute -top-1 -right-1 size-4 rounded-full bg-insignia-advertencia flex items-center justify-center">
                <Cake size={9} className="text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-texto-primario truncate">{fila.nombre} {fila.apellido}</p>
            {esHoy ? (
              <motion.p
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-xs text-insignia-advertencia font-medium truncate flex items-center gap-1"
              >
                <Cake size={10} />
                {textoCumple(dias, fila.fecha_nacimiento)}
              </motion.p>
            ) : esProximo ? (
              <p className="text-xs text-insignia-advertencia/50 truncate flex items-center gap-1">
                <Cake size={10} />
                {textoCumple(dias, fila.fecha_nacimiento)}
              </p>
            ) : (
              fila.correo && <p className="text-xs text-texto-terciario truncate">{fila.correo}</p>
            )}
          </div>
        </div>
      )
    },
  },

  /* ── Rol y estado ── */
  {
    clave: 'rol',
    etiqueta: t('usuarios.rol'),
    ancho: 130,
    ordenable: true,
    grupo: t('usuarios.rol') + ' y ' + t('comun.estado').toLowerCase(),
    filtrable: true,
    tipoFiltro: 'pills',
    opcionesFiltro: [
      { valor: 'propietario', etiqueta: t('empresa.roles.propietario') },
      { valor: 'administrador', etiqueta: t('empresa.roles.administrador') },
      { valor: 'gestor', etiqueta: t('empresa.roles.gestor') },
      { valor: 'vendedor', etiqueta: t('empresa.roles.vendedor') },
      { valor: 'supervisor', etiqueta: t('empresa.roles.supervisor') },
      { valor: 'empleado', etiqueta: t('empresa.roles.empleado') },
      { valor: 'invitado', etiqueta: t('empresa.roles.invitado') },
    ],
    render: (fila) => (
      <Insignia color={COLOR_ROL[fila.rol] || 'neutro'} tamano="sm">
        {ETIQUETA_ROL[fila.rol] || fila.rol}
      </Insignia>
    ),
  },
  {
    clave: 'activo',
    etiqueta: t('comun.estado'),
    ancho: 100,
    ordenable: true,
    grupo: t('usuarios.rol') + ' y ' + t('comun.estado').toLowerCase(),
    filtrable: true,
    opcionesFiltro: [
      { valor: 'true', etiqueta: t('comun.activo') },
      { valor: 'false', etiqueta: t('comun.inactivo') },
    ],
    render: (fila) => (
      <Insignia color={fila.activo ? 'exito' : 'advertencia'} tamano="sm">
        {fila.activo ? t('comun.activo') : t('comun.inactivo')}
      </Insignia>
    ),
  },

  /* ── Organización ── */
  {
    clave: 'numero_empleado',
    etiqueta: t('usuarios.num_empleado'),
    ancho: 110,
    ordenable: true,
    tipo: 'numero',
    grupo: t('comun.laboral'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.numero_empleado != null ? `#${fila.numero_empleado}` : '—'}</span>
    ),
  },
  {
    clave: 'sector',
    etiqueta: t('usuarios.sector'),
    ancho: 140,
    ordenable: true,
    grupo: t('comun.laboral'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.sector || '—'}</span>
    ),
  },
  {
    clave: 'puesto',
    etiqueta: t('usuarios.puesto'),
    ancho: 180,
    ordenable: true,
    grupo: t('comun.laboral'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario truncate">{fila.puesto || '—'}</span>
    ),
  },

  /* ── Contacto ── */
  {
    clave: 'correo',
    etiqueta: t('usuarios.correo'),
    ancho: 220,
    ordenable: true,
    grupo: t('comun.contacto'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario truncate">{fila.correo || '—'}</span>
    ),
  },
  {
    clave: 'telefono',
    etiqueta: t('usuarios.telefono_personal'),
    ancho: 150,
    grupo: t('comun.contacto'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.telefono || '—'}</span>
    ),
  },
  {
    clave: 'telefono_empresa',
    etiqueta: t('usuarios.telefono_laboral'),
    ancho: 150,
    grupo: t('comun.contacto'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.telefono_empresa || '—'}</span>
    ),
  },
  {
    clave: 'documento_numero',
    etiqueta: t('comun.documento'),
    ancho: 140,
    ordenable: true,
    grupo: t('comun.contacto'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.documento_numero || '—'}</span>
    ),
  },
  {
    clave: 'domicilio',
    etiqueta: t('comun.domicilio'),
    ancho: 200,
    grupo: t('comun.contacto'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario truncate">{fila.domicilio || '—'}</span>
    ),
  },
  {
    clave: 'genero',
    etiqueta: t('comun.genero'),
    ancho: 100,
    ordenable: true,
    grupo: t('comun.contacto'),
    render: (fila) => {
      const etiquetas: Record<string, string> = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' }
      return <span className="text-sm text-texto-secundario">{etiquetas[fila.genero] || '—'}</span>
    },
  },

  /* ── Compensación ── */
  {
    clave: 'compensacion_monto',
    etiqueta: t('usuarios.compensacion'),
    ancho: 160,
    ordenable: true,
    tipo: 'moneda',
    resumen: 'suma',
    grupo: t('usuarios.compensacion'),
    render: (fila) => {
      if (!fila.compensacion_monto) return <span className="text-sm text-texto-terciario">—</span>
      return (
        <div>
          <p className="text-sm font-medium text-texto-primario">{formatearMoneda(fila.compensacion_monto)}</p>
          <p className="text-xxs text-texto-terciario">
            {etiquetaCompensacion(fila.compensacion_tipo, fila.compensacion_frecuencia)} · {fila.compensacion_frecuencia}
          </p>
        </div>
      )
    },
  },
  {
    clave: 'dias_trabajo',
    etiqueta: t('usuarios.dias_semana'),
    ancho: 110,
    ordenable: true,
    tipo: 'numero',
    resumen: 'promedio',
    grupo: t('usuarios.compensacion'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.dias_trabajo ? `${fila.dias_trabajo} días` : '—'}</span>
    ),
  },

  /* ── Horario ── */
  {
    clave: 'horario_tipo',
    etiqueta: t('usuarios.horario'),
    ancho: 130,
    ordenable: true,
    grupo: t('usuarios.horario'),
    filtrable: true,
    opcionesFiltro: [
      { valor: 'lunes_viernes', etiqueta: t('usuarios.lv') },
      { valor: 'lunes_sabado', etiqueta: t('usuarios.ls') },
      { valor: 'todos', etiqueta: t('usuarios.ld') },
      { valor: 'custom', etiqueta: t('usuarios.personalizado') },
    ],
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{ETIQUETA_HORARIO[fila.horario_tipo] || '—'}</span>
    ),
  },
  {
    clave: 'horario_flexible',
    etiqueta: t('usuarios.flexible'),
    ancho: 100,
    grupo: t('usuarios.horario'),
    render: (fila) => (
      <Insignia color={fila.horario_flexible ? 'exito' : 'neutro'} tamano="sm">
        {fila.horario_flexible ? 'Sí' : 'No'}
      </Insignia>
    ),
  },
  {
    clave: 'turno',
    etiqueta: t('usuarios.turno'),
    ancho: 120,
    ordenable: true,
    grupo: t('usuarios.horario'),
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{fila.turno || '—'}</span>
    ),
  },
  {
    clave: 'metodo_fichaje',
    etiqueta: t('usuarios.fichaje'),
    ancho: 120,
    ordenable: true,
    grupo: t('usuarios.horario'),
    filtrable: true,
    opcionesFiltro: [
      { valor: 'kiosco', etiqueta: t('asistencias.metodos.kiosco') },
      { valor: 'automatico', etiqueta: t('asistencias.metodos.automatico') },
      { valor: 'manual', etiqueta: t('comun.manual') },
    ],
    render: (fila) => (
      <span className="text-sm text-texto-secundario">{ETIQUETA_FICHAJE[fila.metodo_fichaje] || '—'}</span>
    ),
  },

  /* ── Fechas ── */
  {
    clave: 'unido_en',
    etiqueta: t('usuarios.ingreso'),
    ancho: 130,
    ordenable: true,
    grupo: t('comun.fechas'),
    render: (fila) => (
      <span className="text-sm text-texto-terciario">
        {fila.unido_en ? new Date(fila.unido_en).toLocaleDateString('es', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
      </span>
    ),
  },
  {
    clave: 'fecha_nacimiento',
    etiqueta: t('usuarios.cumpleanos'),
    ancho: 130,
    ordenable: true,
    grupo: t('comun.fechas'),
    render: (fila) => {
      if (!fila.fecha_nacimiento) return <span className="text-sm text-texto-terciario">—</span>
      const dias = diasHastaCumple(fila.fecha_nacimiento)
      const fecha = new Date(fila.fecha_nacimiento + 'T12:00:00')
      const texto = fecha.toLocaleDateString('es', { day: 'numeric', month: 'short' })
      if (dias === 0) return <span className="text-sm text-insignia-advertencia font-medium flex items-center gap-1"><Cake size={12} /> ¡Hoy!</span>
      if (dias > 0 && dias <= 7) return <span className="text-sm text-insignia-advertencia/60 flex items-center gap-1"><Cake size={12} /> {texto} ({dias}d)</span>
      return <span className="text-sm text-texto-terciario">{texto}</span>
    },
  },
]
}

export default function PaginaUsuarios() {
  const { t } = useTraduccion()
  const router = useRouter()
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { esPropietario, esAdmin } = useRol()
  const [supabase] = useState(() => crearClienteNavegador())

  // Columnas y opciones con traducciones (se recalculan si cambia el idioma)
  const columnas = crearColumnas(t)
  const ETIQUETA_ROL = crearEtiquetaRol(t)
  const ROLES_OPCIONES = crearRolesOpciones(t)

  const [miembros, setMiembros] = useState<MiembroTabla[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Modal de invitar
  const [modalInvitar, setModalInvitar] = useState(false)
  const [invCorreo, setInvCorreo] = useState('')
  const [invRol, setInvRol] = useState('empleado')
  const [invitando, setInvitando] = useState(false)
  const [invError, setInvError] = useState('')
  const [linkCopiado, setLinkCopiado] = useState('')

  // Modal de confirmación
  const [modalActivar, setModalActivar] = useState<{ miembro: MiembroTabla; accion: 'activar' | 'desactivar' } | null>(null)
  const [procesando, setProcesando] = useState(false)

  const puedeGestionar = esPropietario || esAdmin

  /* ── Cargar miembros con perfiles ── */
  const cargarDatos = useCallback(async () => {
    if (!empresa) return
    setCargando(true)

    // Cargar miembros
    const { data: miembrosData } = await supabase
      .from('miembros')
      .select('id, usuario_id, rol, activo, unido_en, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo, puesto_id, numero_empleado, horario_tipo, horario_flexible, turno, metodo_fichaje')
      .eq('empresa_id', empresa.id)
      .order('unido_en', { ascending: true })

    if (!miembrosData || miembrosData.length === 0) {
      setCargando(false)
      return
    }

    // Cargar perfiles
    const usuarioIds = miembrosData.map(m => m.usuario_id)
    const { data: perfilesData } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, avatar_url, telefono, telefono_empresa, correo_empresa, fecha_nacimiento, documento_numero, genero, domicilio')
      .in('id', usuarioIds)

    const perfilesMapa = new Map(
      (perfilesData || []).map(p => [p.id, p])
    )

    // Cargar sectores de miembros
    const miembroIds = miembrosData.map(m => m.id)
    const { data: sectoresData } = await supabase
      .from('miembros_sectores')
      .select('miembro_id, sector_id')
      .in('miembro_id', miembroIds)
      .eq('es_primario', true)

    // Cargar nombres de sectores
    let sectoresMapa = new Map<string, string>()
    if (sectoresData && sectoresData.length > 0) {
      const sectorIds = [...new Set(sectoresData.map(s => s.sector_id))]
      const { data: sectoresNombres } = await supabase
        .from('sectores')
        .select('id, nombre')
        .in('id', sectorIds)

      if (sectoresNombres) {
        sectoresMapa = new Map(sectoresNombres.map(s => [s.id, s.nombre]))
      }
    }

    const miembroSectorMapa = new Map(
      (sectoresData || []).map(s => [s.miembro_id, sectoresMapa.get(s.sector_id) || ''])
    )

    // Cargar puestos
    const puestoIds = miembrosData.map(m => m.puesto_id).filter(Boolean)
    let puestosMapa = new Map<string, string>()
    if (puestoIds.length > 0) {
      const { data: puestosData } = await supabase
        .from('puestos')
        .select('id, nombre')
        .in('id', puestoIds)
      if (puestosData) {
        puestosMapa = new Map(puestosData.map(p => [p.id, p.nombre]))
      }
    }

    // Armar datos completos
    const resultado: MiembroTabla[] = miembrosData.map(m => {
      const perfil = perfilesMapa.get(m.usuario_id)
      return {
        id: m.id,
        usuario_id: m.usuario_id,
        nombre: perfil?.nombre || 'Sin',
        apellido: perfil?.apellido || 'nombre',
        avatar_url: perfil?.avatar_url || null,
        correo: perfil?.correo_empresa || '',
        telefono: perfil?.telefono || '',
        telefono_empresa: perfil?.telefono_empresa || '',
        rol: m.rol,
        activo: m.activo,
        sector: miembroSectorMapa.get(m.id) || '',
        puesto: m.puesto_id ? (puestosMapa.get(m.puesto_id) || '') : '',
        numero_empleado: m.numero_empleado ?? null,
        documento_numero: perfil?.documento_numero || '',
        genero: perfil?.genero || '',
        domicilio: perfil?.domicilio || '',
        compensacion_tipo: m.compensacion_tipo || 'fijo',
        compensacion_monto: Number(m.compensacion_monto) || 0,
        compensacion_frecuencia: m.compensacion_frecuencia || 'mensual',
        dias_trabajo: m.dias_trabajo || 5,
        horario_tipo: m.horario_tipo || '',
        horario_flexible: m.horario_flexible ?? false,
        turno: m.turno || '',
        metodo_fichaje: m.metodo_fichaje || '',
        unido_en: m.unido_en,
        fecha_nacimiento: perfil?.fecha_nacimiento || null,
      }
    })

    // Cumpleañeros de hoy van primero, luego próximos 7 días, luego el resto
    resultado.sort((a, b) => {
      const da = diasHastaCumple(a.fecha_nacimiento)
      const db = diasHastaCumple(b.fecha_nacimiento)
      const prioA = da >= 0 && da <= 7 ? da : 999
      const prioB = db >= 0 && db <= 7 ? db : 999
      if (prioA !== prioB) return prioA - prioB
      return 0 // mantener orden original para el resto
    })

    setMiembros(resultado)
    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  /* ── Invitar usuario ── */
  const invitarUsuario = async () => {
    setInvError('')
    if (!invCorreo) { setInvError('El correo es obligatorio'); return }
    setInvitando(true)

    const res = await fetch('/api/invitaciones/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: invCorreo, rol: invRol }),
    })
    const datos = await res.json()

    if (!res.ok) {
      setInvError(datos.error)
      setInvitando(false)
      return
    }

    setLinkCopiado(datos.link)
    setInvitando(false)
    setInvCorreo('')
    setInvRol('empleado')
    cargarDatos()
  }

  /* ── Activar/desactivar ── */
  const manejarActivacion = async () => {
    if (!modalActivar) return
    setProcesando(true)

    const res = await fetch('/api/miembros/activar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: modalActivar.miembro.id,
        activo: modalActivar.accion === 'activar',
      }),
    })

    if (res.ok) cargarDatos()
    setProcesando(false)
    setModalActivar(null)
  }

  /* ── Acciones en lote ── */
  const accionesLote = puedeGestionar ? [
    {
      id: 'desactivar',
      etiqueta: t('usuarios.desactivar_seleccionados'),
      icono: <Clock size={14} />,
      onClick: (ids: Set<string>) => {
        // TODO: batch desactivar
      },
    },
  ] : []

  return (
    <PlantillaListado
      titulo={t('navegacion.usuarios')}
      icono={<Users size={20} />}
      accionPrincipal={puedeGestionar ? {
        etiqueta: t('empresa.invitar'),
        icono: <UserPlus size={14} />,
        onClick: () => { setModalInvitar(true); setLinkCopiado('') },
      } : undefined}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/usuarios/configuracion')}
    >
      <TablaDinamica<MiembroTabla>
        idModulo="usuarios"
        columnas={columnas}
        columnasVisiblesDefault={COLUMNAS_VISIBLES_DEFAULT}
        opcionesOrden={[
          { etiqueta: t('comun.mas_recientes'), clave: 'unido_en', direccion: 'desc' },
          { etiqueta: t('comun.mas_antiguos'), clave: 'unido_en', direccion: 'asc' },
          { etiqueta: t('comun.nombre_az'), clave: 'nombre', direccion: 'asc' },
          { etiqueta: t('comun.nombre_za'), clave: 'nombre', direccion: 'desc' },
        ]}
        datos={miembros}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas']}
        seleccionables={puedeGestionar}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder={`${t('comun.buscar')} por nombre, correo, rol...`}
        accionesLote={accionesLote}
        mostrarResumen
        onClickFila={(fila) => router.push(`/usuarios/${fila.id}`)}
        renderTarjeta={(fila) => {
          const dias = diasHastaCumple(fila.fecha_nacimiento)
          const esCumple = dias >= 0 && dias <= 7
          const ingreso = formatearIngreso(fila.unido_en)
          const tieneDetalle = fila.telefono || fila.compensacion_monto > 0 || ingreso
          return (
            <div className="p-4 flex flex-col gap-3">
              {/* ── Identidad ── */}
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar nombre={`${fila.nombre} ${fila.apellido}`} foto={fila.avatar_url} tamano="md" />
                  {esCumple && (
                    <motion.div
                      animate={dias === 0 ? { scale: [1, 1.2, 1] } : undefined}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -top-1 -right-1 size-5 rounded-full bg-insignia-advertencia flex items-center justify-center"
                    >
                      <Cake size={10} className="text-white" />
                    </motion.div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-texto-primario truncate">{fila.nombre} {fila.apellido}</p>
                  <p className="text-xs text-texto-terciario truncate">{fila.correo || 'Sin correo'}</p>
                  {esCumple && (
                    dias === 0 ? (
                      <motion.p
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-xs text-insignia-advertencia font-medium truncate flex items-center gap-1 mt-0.5"
                      >
                        <Cake size={10} />
                        {textoCumple(dias, fila.fecha_nacimiento)}
                      </motion.p>
                    ) : (
                      <p className="text-xs text-insignia-advertencia/50 truncate flex items-center gap-1 mt-0.5">
                        <Cake size={10} />
                        {textoCumple(dias, fila.fecha_nacimiento)}
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* ── Contexto laboral ── */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Insignia color={COLOR_ROL[fila.rol] || 'neutro'} tamano="sm">{ETIQUETA_ROL[fila.rol] || fila.rol}</Insignia>
                  <Insignia color={fila.activo ? 'exito' : 'advertencia'} tamano="sm">{fila.activo ? t('comun.activo') : t('comun.inactivo')}</Insignia>
                </div>
                {fila.sector && <p className="text-xs text-texto-terciario truncate">{fila.sector}{fila.puesto ? ` · ${fila.puesto}` : ''}</p>}
              </div>

              {/* ── Detalle (separador visual + datos compactos) ── */}
              {tieneDetalle && (
                <div className="border-t border-borde-sutil pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-terciario">
                  {fila.compensacion_monto > 0 && (
                    <span className="text-xs font-medium text-texto-primario">
                      {formatearMoneda(fila.compensacion_monto)}
                      <span className="text-texto-terciario font-normal">
                        {etiquetaCompensacion(fila.compensacion_tipo, fila.compensacion_frecuencia)}
                      </span>
                    </span>
                  )}
                  {fila.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone size={10} className="shrink-0" />
                      {fila.telefono}
                    </span>
                  )}
                  {ingreso && (
                    <span className="flex items-center gap-1">
                      <Calendar size={10} className="shrink-0" />
                      {ingreso}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        }}
        estadoVacio={
          <EstadoVacio
            icono={<UserRoundSearch size={52} strokeWidth={1} />}
            titulo="Sin miembros del equipo"
            descripcion="Invitá a tu primer miembro para empezar a gestionar el equipo."
            accion={puedeGestionar ? <Boton icono={<UserPlus size={14} />} onClick={() => setModalInvitar(true)}>Invitar usuario</Boton> : undefined}
          />
        }
      />

      {/* ══════ MODAL INVITAR ══════ */}
      <Modal abierto={modalInvitar} onCerrar={() => setModalInvitar(false)} titulo={t('empresa.invitar')} tamano="sm">
        {linkCopiado ? (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-insignia-exito/10 flex items-center justify-center mb-3">
                <Check size={24} className="text-insignia-exito" />
              </div>
              <p className="text-sm text-texto-primario font-medium mb-1">Invitación creada</p>
              <p className="text-xs text-texto-terciario">Compartí este link con el usuario</p>
            </div>
            <div className="flex gap-2">
              <Input tipo="text" value={linkCopiado} readOnly compacto />
              <Boton variante="secundario" tamano="sm" soloIcono icono={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(linkCopiado)} />
            </div>
            <Boton variante="primario" anchoCompleto onClick={() => setModalInvitar(false)}>Listo</Boton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              tipo="email"
              etiqueta="Correo del usuario"
              placeholder="usuario@correo.com"
              value={invCorreo}
              onChange={(e) => setInvCorreo(e.target.value)}
              icono={<Mail size={16} />}
            />
            <Select etiqueta="Rol" opciones={ROLES_OPCIONES} valor={invRol} onChange={(v) => setInvRol(v)} />
            <AnimatePresence>
              {invError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-insignia-peligro">
                  {invError}
                </motion.p>
              )}
            </AnimatePresence>
            <Boton variante="primario" anchoCompleto cargando={invitando} onClick={invitarUsuario} icono={<UserPlus size={16} />}>
              Enviar invitación
            </Boton>
          </div>
        )}
      </Modal>

      {/* ══════ MODAL ACTIVAR/DESACTIVAR ══════ */}
      {modalActivar && (
        <ModalConfirmacion
          abierto={true}
          onCerrar={() => setModalActivar(null)}
          onConfirmar={manejarActivacion}
          titulo={modalActivar.accion === 'activar' ? 'Activar miembro' : 'Desactivar miembro'}
          descripcion={
            modalActivar.accion === 'activar'
              ? 'Este usuario podrá acceder a la empresa y ver los datos según su rol.'
              : 'Este usuario perderá acceso a la empresa hasta que lo reactives.'
          }
          tipo={modalActivar.accion === 'activar' ? 'exito' : 'advertencia'}
          etiquetaConfirmar={modalActivar.accion === 'activar' ? 'Activar' : 'Desactivar'}
          cargando={procesando}
        />
      )}
    </PlantillaListado>
  )
}
