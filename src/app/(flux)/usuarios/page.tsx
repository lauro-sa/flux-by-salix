'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Users, Mail, Copy, Check, Download, Upload as UploadIcon,
  Calendar, UserRoundSearch,
  Clock, Cake, Phone, Send, Hash, Fingerprint, KeyRound,
} from 'lucide-react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { normalizarBusqueda } from '@/lib/validaciones'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { TextArea } from '@/componentes/ui/TextArea'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { calcularEstadoMiembro, ESTADOS_MIEMBRO, type EstadoMiembro } from '@/lib/miembros/estado'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

/**
 * Página de gestión de usuarios — /usuarios
 * Usa PlantillaListado + TablaDinamica como todas las demás páginas de lista.
 */

interface MiembroTabla {
  id: string
  usuario_id: string | null
  nombre: string
  apellido: string
  avatar_url: string | null
  correo: string
  telefono: string
  telefono_empresa: string
  rol: string
  activo: boolean
  estado: EstadoMiembro
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
function textoCumple(dias: number, fechaNac: string | null, locale: string): string {
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
  const diaSemana = fecha.toLocaleDateString(locale, { weekday: 'long' })
  return `Cumple ${edadCumple} el ${diaSemana}`
}

/** Genera mapa de etiquetas de rol usando traducciones */
function crearEtiquetaRol(t: (clave: string) => string): Record<string, string> {
  return {
    propietario: t('empresa.roles.propietario'), administrador: t('empresa.roles.administrador'), gestor: t('empresa.roles.gestor'),
    vendedor: t('empresa.roles.vendedor'), supervisor: t('empresa.roles.supervisor'), colaborador: t('empresa.roles.colaborador'), invitado: t('empresa.roles.invitado'),
  }
}

const COLOR_ROL: Record<string, 'primario' | 'violeta' | 'info' | 'naranja' | 'cyan' | 'neutro' | 'advertencia'> = {
  propietario: 'primario', administrador: 'violeta', gestor: 'info',
  vendedor: 'naranja', supervisor: 'cyan', colaborador: 'neutro', invitado: 'advertencia',
}

/** Genera opciones de rol para el select de invitar usando traducciones */
function crearRolesOpciones(t: (clave: string) => string) {
  return [
    { valor: 'administrador', etiqueta: t('empresa.roles.administrador') },
    { valor: 'gestor', etiqueta: t('empresa.roles.gestor') },
    { valor: 'vendedor', etiqueta: t('empresa.roles.vendedor') },
    { valor: 'supervisor', etiqueta: t('empresa.roles.supervisor') },
    { valor: 'colaborador', etiqueta: t('empresa.roles.colaborador') },
    { valor: 'invitado', etiqueta: t('empresa.roles.invitado') },
  ]
}

function formatearMoneda(monto: number, locale: string, monedaCodigo: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: monedaCodigo, minimumFractionDigits: 0 }).format(monto)
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

function formatearIngreso(fecha: string | null, locale: string): string | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return null
  return `Desde ${d.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}`
}

/* ── Columnas de la tabla ──
   Orden lógico: identidad → rol/estado → organización → contacto → compensación → fechas
   Visibles por defecto: nombre, rol, estado, sector, puesto, correo (las más usadas)
   Ocultas por defecto: teléfono, compensación, días trabajo, ingreso, cumpleaños (disponibles para activar) */

/** Columnas visibles por defecto (el usuario puede cambiarlas y se persisten) */
const COLUMNAS_VISIBLES_DEFAULT = ['nombre', 'rol', 'activo', 'sector', 'puesto', 'correo']

/** Genera columnas de la tabla con traducciones */
function crearColumnas(t: (clave: string) => string, locale: string, monedaCodigo: string): ColumnaDinamica<MiembroTabla>[] {
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
                {textoCumple(dias, fila.fecha_nacimiento, locale)}
              </motion.p>
            ) : esProximo ? (
              <p className="text-xs text-insignia-advertencia/50 truncate flex items-center gap-1">
                <Cake size={10} />
                {textoCumple(dias, fila.fecha_nacimiento, locale)}
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
      { valor: 'colaborador', etiqueta: t('empresa.roles.colaborador') },
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
          <p className="text-sm font-medium text-texto-primario">{formatearMoneda(fila.compensacion_monto, locale, monedaCodigo)}</p>
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
        {fila.unido_en ? new Date(fila.unido_en).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
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
      const texto = fecha.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
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
  const { esPropietario, esAdmin, tienePermiso } = useRol()
  const formato = useFormato()
  const [supabase] = useState(() => crearClienteNavegador())

  // Guard de acceso: requiere permiso 'usuarios:ver'.
  // El early-return vive al final (después de todos los hooks) para no romper Rules of Hooks.
  const puedeVer = esPropietario || tienePermiso('usuarios', 'ver')

  // Columnas y opciones con traducciones (se recalculan si cambia el idioma)
  const columnas = crearColumnas(t, formato.locale, formato.codigoMoneda)
  const ETIQUETA_ROL = crearEtiquetaRol(t)
  const ROLES_OPCIONES = crearRolesOpciones(t)

  const [miembros, setMiembros] = useState<MiembroTabla[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Modal de agregar empleado (crear con o sin invitación)
  const [modalAgregar, setModalAgregar] = useState(false)
  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: '',
    apellido: '',
    correo: '',
    telefono: '',
    fecha_ingreso: new Date().toISOString().split('T')[0], // hoy por default; permite retroactivo
    rol: 'colaborador',
    numero_empleado: '',
    sector_id: '',
    puesto_id: '',
    metodo_fichaje: 'kiosco',
    kiosco_rfid: '',
    kiosco_pin: '',
    enviar_invitacion: true,
  })
  const [invitando, setInvitando] = useState(false)
  const [invError, setInvError] = useState('')
  const [linkCopiado, setLinkCopiado] = useState('')
  const [correoEnviadoExitoso, setCorreoEnviadoExitoso] = useState(false)
  const [sectoresDisponibles, setSectoresDisponibles] = useState<{ id: string; nombre: string }[]>([])
  const [puestosDisponibles, setPuestosDisponibles] = useState<{ id: string; nombre: string }[]>([])

  // ── Filtros del listado ──
  // Estado ciclo de vida (multi): activo, pendiente, fichaje, desactivado
  const [filtroEstadoCiclo, setFiltroEstadoCiclo] = useState<EstadoMiembro[]>([])
  // Rol (multi)
  const [filtroRoles, setFiltroRoles] = useState<string[]>([])
  // Sector/puesto (multi, por nombre)
  const [filtroSectores, setFiltroSectores] = useState<string[]>([])
  const [filtroPuestos, setFiltroPuestos] = useState<string[]>([])
  // Horario y fichaje
  const [filtroHorarioTipo, setFiltroHorarioTipo] = useState<string[]>([])
  const [filtroHorarioFlexible, setFiltroHorarioFlexible] = useState('')
  const [filtroMetodoFichaje, setFiltroMetodoFichaje] = useState<string[]>([])
  // Compensación
  const [filtroCompensacionTipo, setFiltroCompensacionTipo] = useState<string[]>([])
  // Tipo de cuenta
  const [filtroTipoCuenta, setFiltroTipoCuenta] = useState('')
  // Presets de fecha
  const [filtroUnidoRango, setFiltroUnidoRango] = useState('')
  const [filtroCumpleRango, setFiltroCumpleRango] = useState('')

  // Importación CSV
  const [modalImportar, setModalImportar] = useState(false)
  const [csvTexto, setCsvTexto] = useState('')
  const [importando, setImportando] = useState(false)
  const [reporteImport, setReporteImport] = useState<{ creados: number; total: number; errores: { fila: number; motivo: string }[] } | null>(null)

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

    // Cargar perfiles (solo los miembros que ya tienen cuenta Flux)
    const usuarioIds = miembrosData.map(m => m.usuario_id).filter((x): x is string => !!x)
    const { data: perfilesData } = usuarioIds.length > 0
      ? await supabase
          .from('perfiles')
          .select('id, nombre, apellido, avatar_url, telefono, telefono_empresa, correo_empresa, correo, fecha_nacimiento, documento_numero, genero, domicilio')
          .in('id', usuarioIds)
      : { data: [] as Array<{ id: string; nombre: string; apellido: string; avatar_url: string | null; telefono: string | null; telefono_empresa: string | null; correo_empresa: string | null; correo: string | null; fecha_nacimiento: string | null; documento_numero: string | null; genero: string | null; domicilio: string | null }> }

    const perfilesMapa = new Map(
      (perfilesData || []).map(p => [p.id, p])
    )

    // Cargar contactos vinculados a los miembros (para los que no tienen perfil aún)
    const miembroIdsParaContactos = miembrosData.map(m => m.id)
    const { data: contactosData } = await supabase
      .from('contactos')
      .select('miembro_id, nombre, apellido, correo, telefono')
      .in('miembro_id', miembroIdsParaContactos)
      .eq('en_papelera', false)

    const contactosMapa = new Map(
      (contactosData || []).filter(c => c.miembro_id).map(c => [c.miembro_id as string, c])
    )

    // Cargar invitaciones vigentes para derivar estado "pendiente"
    const correosConMiembro = (contactosData || []).map(c => (c.correo || '').toLowerCase().trim()).filter(Boolean)
    const { data: invitacionesData } = correosConMiembro.length > 0
      ? await supabase
          .from('invitaciones')
          .select('correo, expira_en, usado')
          .eq('empresa_id', empresa.id)
          .in('correo', correosConMiembro)
          .eq('usado', false)
          .gt('expira_en', new Date().toISOString())
      : { data: [] as Array<{ correo: string; expira_en: string; usado: boolean }> }

    const invitacionesMapa = new Map(
      (invitacionesData || []).map(i => [i.correo.toLowerCase().trim(), i])
    )

    // Cargar sectores de miembros (vía API para evitar 406 de PostgREST)
    const miembroIds = miembrosData.map(m => m.id)
    const sectoresRes = await fetch(`/api/miembros-sectores?miembro_ids=${miembroIds.join(',')}&es_primario=true`)
    const sectoresData: { miembro_id: string; sector_id: string }[] = sectoresRes.ok ? await sectoresRes.json() : []

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

    // Armar datos completos — si el miembro no tiene perfil (sin cuenta Flux)
    // derivamos nombre/correo/teléfono desde el contacto tipo equipo vinculado.
    const resultado: MiembroTabla[] = miembrosData.map(m => {
      const perfil = m.usuario_id ? perfilesMapa.get(m.usuario_id) : undefined
      const contacto = contactosMapa.get(m.id)
      const correo = (perfil?.correo_empresa || perfil?.correo || contacto?.correo || '').trim()
      const invitacion = correo ? invitacionesMapa.get(correo.toLowerCase()) : undefined
      const estado = calcularEstadoMiembro(
        { usuario_id: m.usuario_id, activo: m.activo },
        invitacion ? { expira_en: invitacion.expira_en, usado: invitacion.usado } : null,
      )
      return {
        id: m.id,
        usuario_id: m.usuario_id,
        nombre: perfil?.nombre || contacto?.nombre || 'Sin',
        apellido: perfil?.apellido || contacto?.apellido || 'nombre',
        avatar_url: perfil?.avatar_url || null,
        correo,
        telefono: perfil?.telefono || contacto?.telefono || '',
        telefono_empresa: perfil?.telefono_empresa || '',
        rol: m.rol,
        activo: m.activo,
        estado,
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

  /* ── Cargar sectores y puestos disponibles para el modal de agregar ── */
  useEffect(() => {
    if (!empresa) return
    supabase
      .from('sectores')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => { if (data) setSectoresDisponibles(data) })
    supabase
      .from('puestos')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => { if (data) setPuestosDisponibles(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa])

  /* ── Resetear formulario del modal ── */
  const resetFormularioEmpleado = () => {
    setNuevoEmpleado({
      nombre: '', apellido: '', correo: '', telefono: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      rol: 'colaborador', numero_empleado: '', sector_id: '', puesto_id: '',
      metodo_fichaje: 'kiosco', kiosco_rfid: '', kiosco_pin: '',
      enviar_invitacion: true,
    })
    setInvError('')
    setLinkCopiado('')
    setCorreoEnviadoExitoso(false)
  }

  /* ── Agregar empleado — crea el miembro (con o sin invitación) ── */
  const agregarEmpleado = async () => {
    setInvError('')
    const { nombre, apellido, correo, telefono, fecha_ingreso, rol, numero_empleado, sector_id, puesto_id, metodo_fichaje, kiosco_rfid, kiosco_pin } = nuevoEmpleado
    // Sin correo no puede enviarse invitación: el estado se ignora
    const enviar_invitacion = nuevoEmpleado.enviar_invitacion && !!correo.trim()

    if (!nombre.trim() || !apellido.trim()) {
      setInvError('Nombre y apellido son obligatorios')
      return
    }
    setInvitando(true)

    try {
      // 1. Crear el miembro (usuario_id=null, activo=true)
      const resCrear = await fetch('/api/miembros/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          correo: correo.trim() || null,
          telefono: telefono.trim() || null,
          rol,
          numero_empleado: numero_empleado ? parseInt(numero_empleado, 10) : null,
          puesto_id: puesto_id || null,
          puesto_nombre: puesto_id ? (puestosDisponibles.find(p => p.id === puesto_id)?.nombre || null) : null,
          sector_id: sector_id || null,
          sector: sector_id ? (sectoresDisponibles.find(s => s.id === sector_id)?.nombre || null) : null,
          metodo_fichaje: metodo_fichaje || 'kiosco',
          kiosco_rfid: kiosco_rfid.trim() || null,
          kiosco_pin: kiosco_pin.trim() || null,
          fecha_ingreso: fecha_ingreso || null,
        }),
      })

      if (!resCrear.ok) {
        const datos = await resCrear.json().catch(() => ({}))
        setInvError(datos.error || 'Error al crear el empleado')
        return
      }

      // 2. Si marcó "enviar invitación" y hay correo → disparar invitación
      if (enviar_invitacion && correo.trim()) {
        const resInv = await fetch('/api/invitaciones/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: correo.trim(), rol }),
        })
        if (resInv.ok) {
          const datos = await resInv.json()
          setLinkCopiado(datos.link)
          setCorreoEnviadoExitoso(!!datos.correo_enviado)
        }
      }

      if (!enviar_invitacion) {
        // Sin invitación: cerrar modal y refrescar
        setModalAgregar(false)
        resetFormularioEmpleado()
      }
      cargarDatos()
    } catch (error) {
      console.error('Error al crear empleado:', error)
      setInvError('Error de red al crear el empleado. Intentá de nuevo.')
    } finally {
      setInvitando(false)
    }
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

  /* ── Parsear CSV y disparar importación masiva ── */
  const importarCsv = async () => {
    setImportando(true)
    setReporteImport(null)

    // Parser simple: primera línea = encabezados. Campos entre comillas
    // soportados para escapar comas. Alias aceptados para algunos nombres.
    const lineas = csvTexto.trim().split(/\r?\n/).filter(l => l.trim())
    if (lineas.length < 2) {
      setImportando(false)
      setReporteImport({ creados: 0, total: 0, errores: [{ fila: 0, motivo: 'El CSV debe tener encabezado y al menos una fila de datos' }] })
      return
    }

    const parseLinea = (linea: string): string[] => {
      const campos: string[] = []
      let actual = ''
      let enComillas = false
      for (const char of linea) {
        if (char === '"') enComillas = !enComillas
        else if (char === ',' && !enComillas) { campos.push(actual); actual = '' }
        else actual += char
      }
      campos.push(actual)
      return campos.map(c => c.trim())
    }

    const encabezados = parseLinea(lineas[0]).map(h => h.toLowerCase().trim().replace(/[^a-z_]/g, '_'))
    const filas = lineas.slice(1).map(linea => {
      const campos = parseLinea(linea)
      const fila: Record<string, string> = {}
      encabezados.forEach((h, i) => { fila[h] = campos[i] || '' })
      return fila
    })

    const res = await fetch('/api/miembros/importar-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas }),
    })

    if (res.ok) {
      const datos = await res.json()
      setReporteImport(datos)
      cargarDatos()
    } else {
      const datos = await res.json()
      setReporteImport({ creados: 0, total: filas.length, errores: [{ fila: 0, motivo: datos.error || 'Error del servidor' }] })
    }
    setImportando(false)
  }

  /* ── Helpers para filtrado client-side ── */

  /** Días desde/hasta fecha para presets de "Unido en" */
  const dentroRango = (iso: string | null, rango: string): boolean => {
    if (!iso) return false
    const fecha = new Date(iso)
    const ahora = new Date()
    const diff = (ahora.getTime() - fecha.getTime()) / 86400000 // días
    switch (rango) {
      case 'hoy': return diff < 1 && fecha.toDateString() === ahora.toDateString()
      case '7d': return diff <= 7
      case '30d': return diff <= 30
      case '90d': return diff <= 90
      case 'este_ano': return fecha.getFullYear() === ahora.getFullYear()
      default: return true
    }
  }

  /* ── Filtrado de miembros (búsqueda + todos los filtros) ── */
  const miembrosFiltrados = useMemo(() => {
    const q = busqueda.trim() ? normalizarBusqueda(busqueda) : ''
    return miembros.filter(m => {
      // Búsqueda: nombre, apellido, correo, rol, puesto, sector — accent-insensitive
      if (q) {
        const campos = [m.nombre, m.apellido, m.correo, m.rol, m.puesto, m.sector]
          .filter(Boolean)
          .map(v => normalizarBusqueda(String(v)))
        if (!campos.some(c => c.includes(q))) return false
      }
      // Estado ciclo de vida (multi)
      if (filtroEstadoCiclo.length > 0 && !filtroEstadoCiclo.includes(m.estado)) return false
      // Rol (multi)
      if (filtroRoles.length > 0 && !filtroRoles.includes(m.rol)) return false
      // Sector (multi, por nombre)
      if (filtroSectores.length > 0 && !filtroSectores.includes(m.sector)) return false
      // Puesto (multi, por nombre)
      if (filtroPuestos.length > 0 && !filtroPuestos.includes(m.puesto)) return false
      // Horario tipo
      if (filtroHorarioTipo.length > 0 && !filtroHorarioTipo.includes(m.horario_tipo || '')) return false
      // Horario flexible (Sí/No)
      if (filtroHorarioFlexible === 'true' && !m.horario_flexible) return false
      if (filtroHorarioFlexible === 'false' && m.horario_flexible) return false
      // Método de fichaje (multi)
      if (filtroMetodoFichaje.length > 0 && !filtroMetodoFichaje.includes(m.metodo_fichaje || '')) return false
      // Compensación tipo (multi)
      if (filtroCompensacionTipo.length > 0 && !filtroCompensacionTipo.includes(m.compensacion_tipo || '')) return false
      // Tipo de cuenta: con_flux / solo_kiosco
      if (filtroTipoCuenta === 'con_flux' && !m.usuario_id) return false
      if (filtroTipoCuenta === 'solo_kiosco' && m.usuario_id) return false
      // Unido en (preset)
      if (filtroUnidoRango && !dentroRango(m.unido_en, filtroUnidoRango)) return false
      // Cumple próximo
      if (filtroCumpleRango) {
        const dias = diasHastaCumple(m.fecha_nacimiento)
        if (dias < 0) return false
        if (filtroCumpleRango === 'hoy' && dias !== 0) return false
        if (filtroCumpleRango === '7d' && dias > 7) return false
        if (filtroCumpleRango === '30d' && dias > 30) return false
      }
      return true
    })
  }, [
    miembros, busqueda,
    filtroEstadoCiclo, filtroRoles, filtroSectores, filtroPuestos,
    filtroHorarioTipo, filtroHorarioFlexible, filtroMetodoFichaje,
    filtroCompensacionTipo, filtroTipoCuenta,
    filtroUnidoRango, filtroCumpleRango,
  ])

  /* ── Opciones dinámicas extraídas de los miembros cargados ── */
  const opcionesRoles = useMemo(() => {
    const set = new Set<string>()
    miembros.forEach(m => m.rol && set.add(m.rol))
    return [...set].sort().map(r => ({
      valor: r,
      etiqueta: t(`usuarios.rol_${r}` as Parameters<typeof t>[0]) || r,
    }))
  }, [miembros, t])

  const opcionesSectoresMiembros = useMemo(() => {
    const set = new Set<string>()
    miembros.forEach(m => m.sector && set.add(m.sector))
    return [...set].sort().map(s => ({ valor: s, etiqueta: s }))
  }, [miembros])

  const opcionesPuestosMiembros = useMemo(() => {
    const set = new Set<string>()
    miembros.forEach(m => m.puesto && set.add(m.puesto))
    return [...set].sort().map(p => ({ valor: p, etiqueta: p }))
  }, [miembros])

  /* ── Acciones en lote ── */
  const accionesLote = puedeGestionar ? [
    {
      id: 'desactivar',
      etiqueta: t('usuarios.desactivar_seleccionados'),
      icono: <Clock size={14} />,
      onClick: async (ids: Set<string>) => {
        for (const id of ids) {
          await fetch(`/api/miembros/activar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ miembro_id: id, activo: false }),
          })
        }
        cargarDatos()
      },
    },
  ] : []

  // Guard de acceso: si no tiene permiso de ver usuarios → pantalla SinPermiso.
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/')} />

  return (
    <PlantillaListado
      titulo={t('navegacion.usuarios')}
      icono={<Users size={20} />}
      accionPrincipal={puedeGestionar ? {
        etiqueta: t('usuarios.agregar_empleado'),
        icono: <UserPlus size={14} />,
        onClick: () => { resetFormularioEmpleado(); setModalAgregar(true) },
      } : undefined}
      acciones={[
        { id: 'importar', etiqueta: t('usuarios.importar_csv'), icono: <UploadIcon size={14} />, onClick: () => { setModalImportar(true); setReporteImport(null); setCsvTexto('') } },
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
          { etiqueta: 'Compensación ↓', clave: 'compensacion_monto', direccion: 'desc' },
          { etiqueta: 'Legajo ↑', clave: 'numero_empleado', direccion: 'asc' },
        ]}
        datos={miembrosFiltrados}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas']}
        seleccionables={puedeGestionar}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre, correo, rol, puesto, sector..."
        accionesLote={accionesLote}
        filtros={[
          // ── Identidad ──
          {
            id: 'rol', etiqueta: 'Rol', tipo: 'multiple-compacto' as const,
            valor: filtroRoles,
            onChange: (v) => setFiltroRoles(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesRoles,
            descripcion: 'Nivel de acceso y permisos dentro de la empresa.',
          },
          {
            id: 'estado_ciclo', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstadoCiclo,
            onChange: (v) => setFiltroEstadoCiclo((Array.isArray(v) ? v : (v ? [v] : [])) as EstadoMiembro[]),
            opciones: [
              { valor: 'activo', etiqueta: t('usuarios.estado_activo') },
              { valor: 'pendiente', etiqueta: t('usuarios.estado_pendiente') },
              { valor: 'fichaje', etiqueta: t('usuarios.estado_fichaje') },
              { valor: 'desactivado', etiqueta: t('usuarios.estado_desactivado') },
            ],
            descripcion: 'Activo: con cuenta Flux y acceso. Pendiente: invitación enviada sin aceptar. Solo fichaje: sin cuenta pero activo en kiosco. Desactivado: sin acceso.',
          },
          {
            id: 'tipo_cuenta', etiqueta: 'Tipo de cuenta', tipo: 'pills' as const,
            valor: filtroTipoCuenta, onChange: (v) => setFiltroTipoCuenta(v as string),
            opciones: [
              { valor: 'con_flux', etiqueta: 'Con cuenta Flux' },
              { valor: 'solo_kiosco', etiqueta: 'Solo kiosco' },
            ],
            descripcion: 'Con cuenta Flux = usa la app. Solo kiosco = solo ficha desde terminal.',
          },
          // ── Laboral ──
          {
            id: 'sector', etiqueta: 'Sector', tipo: 'multiple-compacto' as const,
            valor: filtroSectores,
            onChange: (v) => setFiltroSectores(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesSectoresMiembros,
            descripcion: 'Filtrá por uno o más sectores de la estructura de la empresa.',
          },
          {
            id: 'puesto', etiqueta: 'Puesto', tipo: 'multiple-compacto' as const,
            valor: filtroPuestos,
            onChange: (v) => setFiltroPuestos(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesPuestosMiembros,
            descripcion: 'Cargo específico del empleado.',
          },
          {
            id: 'compensacion_tipo', etiqueta: 'Compensación', tipo: 'multiple-compacto' as const,
            valor: filtroCompensacionTipo,
            onChange: (v) => setFiltroCompensacionTipo(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'fijo', etiqueta: 'Salario fijo' },
              { valor: 'por_dia', etiqueta: 'Por día' },
              { valor: 'por_hora', etiqueta: 'Por hora' },
            ],
            descripcion: 'Esquema de cálculo de la compensación del miembro.',
          },
          // ── Fichaje ──
          {
            id: 'horario_tipo', etiqueta: 'Horario', tipo: 'multiple-compacto' as const,
            valor: filtroHorarioTipo,
            onChange: (v) => setFiltroHorarioTipo(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'lunes_viernes', etiqueta: 'Lunes a Viernes' },
              { valor: 'lunes_sabado', etiqueta: 'Lunes a Sábado' },
              { valor: 'todos', etiqueta: 'Todos los días' },
              { valor: 'custom', etiqueta: 'Personalizado' },
            ],
            descripcion: 'Régimen de días laborales del miembro.',
          },
          {
            id: 'horario_flexible', etiqueta: 'Horario flexible', tipo: 'pills' as const,
            valor: filtroHorarioFlexible, onChange: (v) => setFiltroHorarioFlexible(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Miembros con horario flexible (sin penalizar tardanzas).',
          },
          {
            id: 'metodo_fichaje', etiqueta: 'Método de fichaje', tipo: 'multiple-compacto' as const,
            valor: filtroMetodoFichaje,
            onChange: (v) => setFiltroMetodoFichaje(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'kiosco', etiqueta: 'Kiosco' },
              { valor: 'automatico', etiqueta: 'Automático (PWA)' },
              { valor: 'manual', etiqueta: 'Manual' },
            ],
            descripcion: 'Cómo registra habitualmente entradas y salidas.',
          },
          // ── Período ──
          {
            id: 'unido_rango', etiqueta: 'Ingresó', tipo: 'pills' as const,
            valor: filtroUnidoRango, onChange: (v) => setFiltroUnidoRango(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: '7d', etiqueta: '7 días' },
              { valor: '30d', etiqueta: '30 días' },
              { valor: '90d', etiqueta: '90 días' },
              { valor: 'este_ano', etiqueta: 'Este año' },
            ],
            descripcion: 'Fecha de ingreso del empleado a la empresa.',
          },
          {
            id: 'cumple_rango', etiqueta: 'Cumpleaños próximo', tipo: 'pills' as const,
            valor: filtroCumpleRango, onChange: (v) => setFiltroCumpleRango(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: '7d', etiqueta: 'Próximos 7 días' },
              { valor: '30d', etiqueta: 'Próximos 30 días' },
            ],
            descripcion: 'Miembros que cumplen años en el rango elegido.',
          },
        ]}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['rol', 'estado_ciclo', 'tipo_cuenta'] },
          { id: 'laboral', etiqueta: 'Laboral', filtros: ['sector', 'puesto', 'compensacion_tipo'] },
          { id: 'fichaje', etiqueta: 'Fichaje', filtros: ['horario_tipo', 'horario_flexible', 'metodo_fichaje'] },
          { id: 'periodo', etiqueta: 'Período', filtros: ['unido_rango', 'cumple_rango'] },
        ]}
        onLimpiarFiltros={() => {
          setFiltroEstadoCiclo([])
          setFiltroRoles([])
          setFiltroSectores([])
          setFiltroPuestos([])
          setFiltroHorarioTipo([])
          setFiltroHorarioFlexible('')
          setFiltroMetodoFichaje([])
          setFiltroCompensacionTipo([])
          setFiltroTipoCuenta('')
          setFiltroUnidoRango('')
          setFiltroCumpleRango('')
        }}
        mostrarResumen
        onClickFila={(fila) => router.push(`/usuarios/${fila.id}`)}
        renderTarjeta={(fila) => {
          const dias = diasHastaCumple(fila.fecha_nacimiento)
          const esCumple = dias >= 0 && dias <= 7
          const ingreso = formatearIngreso(fila.unido_en, formato.locale)
          const tieneDetalle = fila.telefono || fila.compensacion_monto > 0 || ingreso
          const etiquetaEstadoFila: Record<EstadoMiembro, string> = {
            fichaje: t('usuarios.estado_fichaje'),
            pendiente: t('usuarios.estado_pendiente'),
            activo: t('usuarios.estado_activo'),
            desactivado: t('usuarios.estado_desactivado'),
          }
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
                        {textoCumple(dias, fila.fecha_nacimiento, formato.locale)}
                      </motion.p>
                    ) : (
                      <p className="text-xs text-insignia-advertencia/50 truncate flex items-center gap-1 mt-0.5">
                        <Cake size={10} />
                        {textoCumple(dias, fila.fecha_nacimiento, formato.locale)}
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* ── Contexto laboral ── */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Insignia color={COLOR_ROL[fila.rol] || 'neutro'} tamano="sm">{ETIQUETA_ROL[fila.rol] || fila.rol}</Insignia>
                  <Insignia color={ESTADOS_MIEMBRO[fila.estado].color} tamano="sm">
                    {etiquetaEstadoFila[fila.estado]}
                  </Insignia>
                </div>
                {fila.sector && <p className="text-xs text-texto-terciario truncate">{fila.sector}{fila.puesto ? ` · ${fila.puesto}` : ''}</p>}
              </div>

              {/* ── Detalle (separador visual + datos compactos) ── */}
              {tieneDetalle && (
                <div className="border-t border-borde-sutil pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-terciario">
                  {fila.compensacion_monto > 0 && (
                    <span className="text-xs font-medium text-texto-primario">
                      {formatearMoneda(fila.compensacion_monto, formato.locale, formato.codigoMoneda)}
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
            titulo={t('usuarios.sin_usuarios')}
            descripcion={t('usuarios.sin_miembros_desc')}
            accion={puedeGestionar ? <Boton icono={<UserPlus size={14} />} onClick={() => { resetFormularioEmpleado(); setModalAgregar(true) }}>{t('usuarios.agregar_empleado')}</Boton> : undefined}
          />
        }
      />

      {/* ══════ MODAL AGREGAR EMPLEADO ══════ */}
      <Modal
        abierto={modalAgregar}
        onCerrar={() => { setModalAgregar(false); resetFormularioEmpleado() }}
        titulo={t('usuarios.agregar_empleado')}
        tamano="lg"
      >
        {linkCopiado ? (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-insignia-exito/10 flex items-center justify-center mb-3">
                <Check size={24} className="text-insignia-exito" />
              </div>
              <p className="text-sm text-texto-primario font-medium mb-1">
                {correoEnviadoExitoso ? t('usuarios.invitacion_enviada') : t('usuarios.invitacion_lista')}
              </p>
              <p className="text-xs text-texto-terciario">
                {correoEnviadoExitoso ? t('usuarios.invitacion_compartir') : t('usuarios.invitacion_sin_canal')}
              </p>
            </div>
            <div className="flex gap-2">
              <Input tipo="text" value={linkCopiado} readOnly compacto />
              <Boton variante="secundario" tamano="sm" soloIcono titulo={t('portal.copiar_enlace')} icono={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(linkCopiado)} />
            </div>
            <Boton variante="primario" anchoCompleto onClick={() => { setModalAgregar(false); resetFormularioEmpleado() }}>{t('comun.listo')}</Boton>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Datos personales ── */}
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">
                {t('usuarios.seccion_datos_personales')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  tipo="text"
                  etiqueta={t('usuarios.nombre')}
                  placeholder="Juan"
                  value={nuevoEmpleado.nombre}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, nombre: e.target.value }))}
                />
                <Input
                  tipo="text"
                  etiqueta={t('usuarios.apellido')}
                  placeholder="Pérez"
                  value={nuevoEmpleado.apellido}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, apellido: e.target.value }))}
                />
                <Input
                  tipo="email"
                  etiqueta={t('usuarios.correo_opcional')}
                  placeholder="usuario@correo.com"
                  value={nuevoEmpleado.correo}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, correo: e.target.value }))}
                  icono={<Mail size={16} />}
                />
                <Input
                  tipo="tel"
                  etiqueta={t('usuarios.telefono_opcional')}
                  placeholder="+54 9 ..."
                  value={nuevoEmpleado.telefono}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, telefono: e.target.value }))}
                  icono={<Phone size={16} />}
                />
                <SelectorFecha
                  etiqueta="Fecha de ingreso"
                  valor={nuevoEmpleado.fecha_ingreso}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, fecha_ingreso: v || new Date().toISOString().split('T')[0] }))}
                />
              </div>
              <p className="text-[11px] text-texto-terciario/70 mt-2 leading-relaxed">
                Si el empleado ya está trabajando hace unos días, poné la fecha real de inicio. Después podés cargar sus fichajes desde Asistencias.
              </p>
            </div>

            <div className="border-t border-white/[0.07]" />

            {/* ── Rol y organización ── */}
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">
                {t('usuarios.seccion_rol_organizacion')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  etiqueta={t('usuarios.rol')}
                  opciones={ROLES_OPCIONES}
                  valor={nuevoEmpleado.rol}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, rol: v }))}
                />
                <Input
                  tipo="number"
                  etiqueta={t('usuarios.legajo_opcional')}
                  placeholder={t('usuarios.legajo_placeholder')}
                  value={nuevoEmpleado.numero_empleado}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, numero_empleado: e.target.value }))}
                  icono={<Hash size={16} />}
                />
                <Select
                  etiqueta={t('usuarios.sector_opcional')}
                  opciones={[{ valor: '', etiqueta: t('usuarios.sin_sector') }, ...sectoresDisponibles.map(s => ({ valor: s.id, etiqueta: s.nombre }))]}
                  valor={nuevoEmpleado.sector_id}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, sector_id: v }))}
                />
                <Select
                  etiqueta={t('usuarios.puesto_opcional')}
                  opciones={[{ valor: '', etiqueta: t('usuarios.sin_puesto') }, ...puestosDisponibles.map(p => ({ valor: p.id, etiqueta: p.nombre }))]}
                  valor={nuevoEmpleado.puesto_id}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, puesto_id: v }))}
                />
              </div>
            </div>

            <div className="border-t border-white/[0.07]" />

            {/* ── Fichaje y kiosco ── */}
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">
                {t('usuarios.seccion_fichaje_kiosco')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  etiqueta={t('usuarios.metodo_fichaje')}
                  opciones={[
                    { valor: 'kiosco', etiqueta: t('usuarios.metodo_kiosco') },
                    { valor: 'automatico', etiqueta: t('usuarios.metodo_automatico') },
                    { valor: 'manual', etiqueta: t('usuarios.metodo_manual') },
                  ]}
                  valor={nuevoEmpleado.metodo_fichaje}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, metodo_fichaje: v }))}
                />
                <Input
                  tipo="text"
                  etiqueta={t('usuarios.llavero_rfid')}
                  placeholder={t('usuarios.llavero_placeholder')}
                  value={nuevoEmpleado.kiosco_rfid}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, kiosco_rfid: e.target.value }))}
                  icono={<Fingerprint size={16} />}
                />
                <Input
                  tipo="text"
                  etiqueta={t('usuarios.pin_respaldo')}
                  placeholder={t('usuarios.pin_placeholder')}
                  value={nuevoEmpleado.kiosco_pin}
                  onChange={(e) => setNuevoEmpleado(p => ({ ...p, kiosco_pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  icono={<KeyRound size={16} />}
                />
              </div>
              <p className="text-[11px] text-texto-terciario/70 mt-2 leading-relaxed">
                {t('usuarios.nota_kiosco')}
              </p>
            </div>

            <div className="border-t border-white/[0.07]" />

            {/* ── Acceso a Flux ── */}
            <div className="flex items-start gap-3 p-3 rounded-card bg-superficie-elevada/40 border border-borde-sutil">
              <div className="pt-0.5">
                <Checkbox
                  marcado={nuevoEmpleado.enviar_invitacion && !!nuevoEmpleado.correo.trim()}
                  onChange={(v) => setNuevoEmpleado(p => ({ ...p, enviar_invitacion: v }))}
                  deshabilitado={!nuevoEmpleado.correo.trim()}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-texto-primario flex items-center gap-1.5">
                  <Send size={13} className="text-texto-terciario" />
                  {t('usuarios.enviar_invitacion_flux')}
                </p>
                <p className="text-xs text-texto-terciario mt-0.5 leading-relaxed">
                  {nuevoEmpleado.correo.trim()
                    ? t('usuarios.enviar_invitacion_con_correo')
                    : t('usuarios.enviar_invitacion_sin_correo')}
                </p>
              </div>
            </div>

            <AnimatePresence>
              {invError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-insignia-peligro">
                  {invError}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.07]">
              <Boton variante="fantasma" tamano="sm" onClick={() => { setModalAgregar(false); resetFormularioEmpleado() }}>
                {t('comun.cancelar')}
              </Boton>
              <Boton
                variante="primario"
                tamano="sm"
                cargando={invitando}
                onClick={agregarEmpleado}
                icono={<UserPlus size={14} />}
              >
                {t('usuarios.crear_empleado')}
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════ MODAL IMPORTAR CSV ══════ */}
      <Modal
        abierto={modalImportar}
        onCerrar={() => { setModalImportar(false); setReporteImport(null); setCsvTexto('') }}
        titulo={t('usuarios.importar_titulo')}
        tamano="lg"
      >
        {reporteImport ? (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-card border ${reporteImport.creados > 0 ? 'bg-insignia-exito-fondo border-insignia-exito/30' : 'bg-insignia-peligro-fondo border-insignia-peligro/30'}`}>
              <Check size={20} className={reporteImport.creados > 0 ? 'text-insignia-exito-texto mt-0.5' : 'text-insignia-peligro-texto mt-0.5'} />
              <div className="flex-1">
                <p className="text-sm font-medium text-texto-primario">
                  {t('usuarios.importar_resultado')
                    .replace('{{creados}}', String(reporteImport.creados))
                    .replace('{{total}}', String(reporteImport.total))}
                </p>
                {reporteImport.errores.length > 0 && (
                  <p className="text-xs text-texto-terciario mt-0.5">
                    {reporteImport.errores.length} {reporteImport.errores.length === 1 ? t('usuarios.importar_error') : t('usuarios.importar_errores')}
                  </p>
                )}
              </div>
            </div>

            {reporteImport.errores.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-borde-sutil rounded-card">
                <table className="w-full text-xs">
                  <thead className="bg-superficie-elevada/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-texto-terciario font-medium">{t('usuarios.importar_fila')}</th>
                      <th className="px-3 py-2 text-left text-texto-terciario font-medium">{t('usuarios.importar_motivo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporteImport.errores.map((err, i) => (
                      <tr key={i} className="border-t border-borde-sutil">
                        <td className="px-3 py-2 text-texto-terciario font-mono">{err.fila || '—'}</td>
                        <td className="px-3 py-2 text-texto-primario">{err.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
              <Boton variante="fantasma" tamano="sm" onClick={() => { setReporteImport(null); setCsvTexto('') }}>{t('usuarios.importar_otro')}</Boton>
              <Boton variante="primario" tamano="sm" onClick={() => { setModalImportar(false); setReporteImport(null); setCsvTexto('') }}>{t('usuarios.importar_listo')}</Boton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-card bg-superficie-elevada/40 border border-borde-sutil text-xs text-texto-secundario leading-relaxed">
              <p className="font-medium text-texto-primario mb-1">{t('usuarios.importar_formato_titulo')}</p>
              <p>{t('usuarios.importar_formato_desc')}</p>
              <code className="block mt-1.5 px-2 py-1 rounded bg-superficie-app text-[11px] text-texto-primario overflow-x-auto">
                nombre, apellido, correo, telefono, rol, numero_empleado, sector, puesto, kiosco_rfid, kiosco_pin, metodo_fichaje
              </code>
              <p className="mt-2">{t('usuarios.importar_obligatorios')}</p>
            </div>

            <TextArea
              etiqueta="CSV"
              rows={10}
              monoespacio
              value={csvTexto}
              onChange={(e) => setCsvTexto(e.target.value)}
              placeholder={`nombre,apellido,correo,telefono,rol,numero_empleado,sector,puesto,kiosco_rfid,kiosco_pin\nJuan,Pérez,juan@mail.com,+5491122334455,empleado,101,Ventas,Cajero,ABC123,1234\nMaría,González,,+5491199887766,empleado,102,Producción,,XYZ456,5678`}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
              <Boton variante="fantasma" tamano="sm" onClick={() => { setModalImportar(false); setCsvTexto('') }}>
                {t('comun.cancelar')}
              </Boton>
              <Boton
                variante="primario"
                tamano="sm"
                cargando={importando}
                onClick={importarCsv}
                icono={<UploadIcon size={14} />}
                disabled={!csvTexto.trim()}
              >
                {t('comun.importar')}
              </Boton>
            </div>
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
