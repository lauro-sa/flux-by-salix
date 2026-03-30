'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Phone, MapPin, Calendar, CreditCard, Shield, FileText,
  Briefcase, Clock, KeyRound, Heart, Camera, Building,
  ChevronLeft, User, DollarSign, Fingerprint,
  Upload, Plus, ChevronRight, ChevronDown, Eye, EyeOff,
  Wallet, CalendarDays, Check, X, Minus, AlertCircle, Pencil, Receipt,
  Banknote, Save, ArrowRight, Landmark, FileUp, Trash2, MoreHorizontal,
  LogOut, UserX, Power, Mail as MailIcon, Nfc, Cake,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Tabs } from '@/componentes/ui/Tabs'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Modal } from '@/componentes/ui/Modal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { BloqueDireccion, type DatosDireccion } from '@/componentes/ui/BloqueDireccion'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { RecortadorImagen } from '@/componentes/ui/RecortadorImagen'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useRol, PERMISOS_POR_ROL } from '@/hooks/useRol'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { Rol, Modulo, PermisosMapa, Miembro, Perfil, CompensacionTipo, CompensacionFrecuencia, HorarioTipo, MetodoFichaje } from '@/tipos'
import { ACCIONES_POR_MODULO } from '@/tipos'
import { SeccionPermisos } from '@/componentes/entidad/SeccionPermisos'

/**
 * Página de detalle de usuario — /usuarios/[id]
 * Tabs: Resumen | Información | Pagos | Permisos
 * Inspirado en Attio/Linear — plano, limpio, datos útiles de un vistazo.
 */

type TabPerfil = 'resumen' | 'informacion' | 'pagos' | 'permisos'

/* ═══════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════ */

// Preview de modulos principales para la tarjeta resumen
const MODULOS_PREVIEW = [
  { id: 'contactos', nombre: 'Contactos' },
  { id: 'actividades', nombre: 'Actividades' },
  { id: 'visitas', nombre: 'Visitas' },
  { id: 'presupuestos', nombre: 'Presupuestos' },
  { id: 'facturas', nombre: 'Facturas' },
  { id: 'inbox_whatsapp', nombre: 'WhatsApp' },
  { id: 'asistencias', nombre: 'Asistencias' },
  { id: 'ordenes_trabajo', nombre: 'Ordenes' },
]

const ROLES_OPCIONES = [
  { valor: 'propietario', etiqueta: 'Propietario' },
  { valor: 'administrador', etiqueta: 'Administrador' },
  { valor: 'gestor', etiqueta: 'Gestor' },
  { valor: 'vendedor', etiqueta: 'Vendedor' },
  { valor: 'supervisor', etiqueta: 'Supervisor' },
  { valor: 'empleado', etiqueta: 'Colaborador' },
  { valor: 'invitado', etiqueta: 'Invitado' },
]

const ETIQUETA_ROL: Record<string, string> = {
  propietario: 'Propietario', administrador: 'Admin', gestor: 'Gestor',
  vendedor: 'Vendedor', supervisor: 'Supervisor', empleado: 'Colaborador', invitado: 'Invitado',
}

const COLOR_ROL: Record<string, 'primario' | 'violeta' | 'info' | 'naranja' | 'cyan' | 'neutro' | 'advertencia'> = {
  propietario: 'primario', administrador: 'violeta', gestor: 'info',
  vendedor: 'naranja', supervisor: 'cyan', empleado: 'neutro', invitado: 'advertencia',
}

const OPCIONES_COMPENSACION = [
  { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja. El total depende de cuántos días asista.', icono: 'calendar-days' as const },
  { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo, sin importar los días que asista.', icono: 'landmark' as const },
]

const FRECUENCIAS_PAGO = [
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'eventual', etiqueta: 'Eventual' },
]

const ETIQUETA_FRECUENCIA: Record<string, string> = {
  semanal: 'semanal',
  quincenal: 'quincenal',
  mensual: 'mensual',
  eventual: 'mensual (estimado)',
}

const DIAS_TRABAJO_OPCIONES = [
  { valor: 1, etiqueta: '1', sub: '1 día' },
  { valor: 2, etiqueta: '2', sub: '2 días' },
  { valor: 3, etiqueta: '3', sub: '3 días' },
  { valor: 4, etiqueta: '4', sub: '4 días' },
  { valor: 5, etiqueta: 'L-V', sub: 'Lunes a Viernes' },
  { valor: 6, etiqueta: 'L-S', sub: 'Lunes a Sábado' },
  { valor: 7, etiqueta: '7/7', sub: 'Todos los días' },
]

const ESTADOS_ASISTENCIA = [
  { color: 'bg-insignia-exito/20', etiqueta: 'Presente' },
  { color: 'bg-insignia-peligro/20', etiqueta: 'Ausente' },
  { color: 'bg-insignia-advertencia/20', etiqueta: 'Tardanza' },
]

const TIPOS_DOCUMENTOS = ['DNI Frente', 'DNI Dorso', 'Registro Frente', 'Registro Dorso']

const OPCIONES_HORARIO = [
  { valor: 'lunes_viernes', etiqueta: 'Lunes a Viernes' },
  { valor: 'lunes_sabado', etiqueta: 'Lunes a Sábado' },
  { valor: 'todos', etiqueta: '7 días' },
  { valor: 'custom', etiqueta: 'Personalizado' },
]

const OPCIONES_FICHAJE = [
  { valor: 'kiosco', etiqueta: 'Kiosco (llavero/PIN)' },
  { valor: 'automatico', etiqueta: 'Automático (PWA)' },
  { valor: 'manual', etiqueta: 'Manual' },
]

const OPCIONES_GENERO = [
  { valor: '', etiqueta: 'No especificado' },
  { valor: 'masculino', etiqueta: 'Masculino' },
  { valor: 'femenino', etiqueta: 'Femenino' },
  { valor: 'otro', etiqueta: 'Otro' },
]

// DIAS_SEMANA eliminado — se usa useFormato().diasSemanaCortos

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

// formatearMoneda eliminado — se usa useFormato().moneda

/** Obtiene los días del mes para el mini-calendario, respetando día de inicio */
function obtenerDiasMes(anio: number, mes: number, diaInicioSemana: number = 1) {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  const diaSemana = primerDia.getDay() // 0=domingo

  // Calcular offset según día de inicio (0=dom, 1=lun)
  const offset = (diaSemana - diaInicioSemana + 7) % 7

  const dias: (number | null)[] = []
  for (let i = 0; i < offset; i++) dias.push(null)
  for (let d = 1; d <= diasEnMes; d++) dias.push(d)

  return dias
}

/** Tipo de período calculado */
type Periodo = { inicio: Date; fin: Date; etiqueta: string }

/** Calcula la quincena para una fecha dada */
function obtenerQuincena(fecha: Date): Periodo {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()
  const dia = fecha.getDate()
  const nombreMes = fecha.toLocaleDateString('es', { month: 'long' })

  if (dia <= 15) {
    return {
      inicio: new Date(anio, mes, 1),
      fin: new Date(anio, mes, 15),
      etiqueta: `1ra Quincena de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${anio}`,
    }
  }

  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return {
    inicio: new Date(anio, mes, 16),
    fin: new Date(anio, mes, ultimoDia),
    etiqueta: `2da Quincena de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ${anio}`,
  }
}

/** Calcula el período según frecuencia y fecha de referencia */
function obtenerPeriodo(fecha: Date, frecuencia: string): Periodo {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()
  const nombreMes = fecha.toLocaleDateString('es', { month: 'long' })
  const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)

  switch (frecuencia) {
    case 'semanal': {
      const diaSemana = fecha.getDay()
      const lunes = new Date(fecha)
      lunes.setDate(fecha.getDate() - ((diaSemana + 6) % 7))
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      const dd = (d: Date) => d.getDate()
      return {
        inicio: new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()),
        fin: new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate()),
        etiqueta: `Semana del ${dd(lunes)} al ${dd(domingo)} de ${mesCapitalizado}`,
      }
    }
    case 'quincenal':
      return obtenerQuincena(fecha)
    case 'mensual':
    case 'eventual':
    default: {
      const ultimoDia = new Date(anio, mes + 1, 0).getDate()
      return {
        inicio: new Date(anio, mes, 1),
        fin: new Date(anio, mes, ultimoDia),
        etiqueta: `${mesCapitalizado} ${anio}`,
      }
    }
  }
}

/** Navega al período anterior o siguiente */
function navegarPeriodo(periodoActual: Periodo, direccion: 'anterior' | 'siguiente', frecuencia: string): Periodo {
  const ref = new Date(periodoActual.inicio)

  if (frecuencia === 'semanal') {
    ref.setDate(ref.getDate() + (direccion === 'siguiente' ? 7 : -7))
  } else if (frecuencia === 'quincenal') {
    if (direccion === 'siguiente') {
      if (ref.getDate() === 1) ref.setDate(16)
      else { ref.setMonth(ref.getMonth() + 1); ref.setDate(1) }
    } else {
      if (ref.getDate() === 16) ref.setDate(1)
      else { ref.setMonth(ref.getMonth() - 1); ref.setDate(16) }
    }
  } else {
    // mensual / eventual
    ref.setMonth(ref.getMonth() + (direccion === 'siguiente' ? 1 : -1))
  }

  return obtenerPeriodo(ref, frecuencia)
}

/* ═══════════════════════════════════════════════════
   COMPONENTES INTERNOS
   ═══════════════════════════════════════════════════ */

/** Días hasta el próximo cumpleaños (0 = hoy, -1 = no aplica) */
function diasHastaCumple(fechaNac: string | null): number {
  if (!fechaNac) return -1
  const hoy = new Date()
  const nac = new Date(fechaNac + 'T12:00:00')
  if (isNaN(nac.getTime())) return -1
  const cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())
  let diff = Math.floor((cumple.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  if (diff < 0) {
    const prox = new Date(hoy.getFullYear() + 1, nac.getMonth(), nac.getDate())
    diff = Math.floor((prox.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000)
  }
  return diff
}

/** Texto descriptivo del cumpleaños */
function textoCumple(dias: number, fechaNac: string | null): string {
  if (dias < 0 || !fechaNac) return ''
  const nac = new Date(fechaNac + 'T12:00:00')
  const hoy = new Date()
  const edadCumple = hoy.getFullYear() - nac.getFullYear() + (dias === 0 ? 0 : (hoy.getMonth() > nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() > nac.getDate()) ? 1 : 0))
  if (dias === 0) return `¡Cumple ${edadCumple} años hoy!`
  if (dias === 1) return `Cumple ${edadCumple} años mañana`
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return `Cumple ${edadCumple} años el ${fecha.toLocaleDateString('es', { weekday: 'long' })}`
}

/** Ítem de menú dropdown — reemplaza botones nativos repetidos */
function ItemMenu({ icono, children, onClick, variante = 'normal' }: {
  icono: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  variante?: 'normal' | 'advertencia' | 'peligro'
}) {
  const colores = {
    normal: 'text-texto-primario',
    advertencia: 'text-insignia-advertencia',
    peligro: 'text-insignia-peligro',
  }
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-superficie-hover bg-transparent border-none cursor-pointer text-left transition-colors ${colores[variante]}`}
    >
      <span className={variante === 'normal' ? 'text-texto-terciario' : ''}>{icono}</span>
      {children}
    </button>
  )
}

/** Encabezado de sección plano con línea inferior */
function SeccionEncabezado({ icono, titulo, accion }: { icono: React.ReactNode; titulo: string; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-borde-sutil">
      <div className="flex items-center gap-2">
        <span className="text-texto-terciario">{icono}</span>
        <h3 className="text-sm font-semibold text-texto-primario">{titulo}</h3>
      </div>
      {accion}
    </div>
  )
}

/** Stat card para el resumen */
function TarjetaStat({ etiqueta, valor, subvalor, icono, color = 'primario' }: {
  etiqueta: string
  valor: string | number
  subvalor?: string
  icono: React.ReactNode
  color?: 'primario' | 'exito' | 'advertencia' | 'peligro' | 'info'
}) {
  const colores = {
    primario: 'bg-insignia-primario-fondo text-insignia-primario-texto',
    exito: 'bg-insignia-exito-fondo text-insignia-exito-texto',
    advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto',
    peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto',
    info: 'bg-insignia-info-fondo text-insignia-info-texto',
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">{etiqueta}</span>
        <div className={`size-8 rounded-lg flex items-center justify-center ${colores[color]}`}>
          {icono}
        </div>
      </div>
      <p className="text-2xl font-bold text-texto-primario">{valor}</p>
      {subvalor && <p className="text-xs text-texto-terciario mt-0.5">{subvalor}</p>}
    </div>
  )
}

/** Mini-calendario del mes — compacto, círculos, bien alineado */
function MiniCalendario({ anio, mes, asistencias, diasLaborales, diasSemanaCortos, diaInicioSemana, formatearMes }: {
  anio: number
  mes: number
  asistencias: Record<number, 'presente' | 'ausente' | 'tardanza'>
  diasLaborales: number[]
  diasSemanaCortos: string[]
  diaInicioSemana: number
  formatearMes: (fecha: Date | string) => string
}) {
  const dias = obtenerDiasMes(anio, mes, diaInicioSemana)
  const hoy = new Date()
  const esHoy = (dia: number) => hoy.getFullYear() === anio && hoy.getMonth() === mes && hoy.getDate() === dia

  // Colores por estado
  const estiloEstado = {
    presente: 'bg-insignia-exito/20 text-insignia-exito',
    ausente: 'bg-insignia-peligro/20 text-insignia-peligro',
    tardanza: 'bg-insignia-advertencia/20 text-insignia-advertencia',
  }

  return (
    <div className="select-none">
      {/* Header del mes */}
      <p className="text-xs font-medium text-texto-secundario mb-3 capitalize">{formatearMes(new Date(anio, mes))}</p>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-px">
        {/* Encabezados de día */}
        {diasSemanaCortos.map((d, i) => (
          <div key={i} className="h-7 flex items-center justify-center text-xxs font-semibold text-texto-terciario/60 uppercase">
            {d}
          </div>
        ))}

        {/* Días */}
        {dias.map((dia, i) => {
          if (dia === null) return <div key={`v-${i}`} className="h-7" />

          const estado = asistencias[dia]
          const esLaboral = diasLaborales.includes(new Date(anio, mes, dia).getDay())
          const esPasado = new Date(anio, mes, dia) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
          const hoyEs = esHoy(dia)

          // Determinar estilo
          let clase = 'h-7 w-full flex items-center justify-center text-xs rounded-full transition-colors '

          if (hoyEs) {
            clase += 'font-bold text-texto-marca ring-[1.5px] ring-inset ring-texto-marca'
          } else if (estado) {
            clase += estiloEstado[estado] + ' font-medium'
          } else if (!esLaboral) {
            clase += 'text-texto-terciario/30'
          } else if (esPasado) {
            clase += 'text-texto-terciario/60'
          } else {
            clase += 'text-texto-secundario'
          }

          return (
            <div key={dia} className="flex items-center justify-center">
              <div className={clase}>
                {dia}
              </div>
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-borde-sutil">
        {ESTADOS_ASISTENCIA.map(l => (
          <div key={l.etiqueta} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${l.color}`} />
            <span className="text-xxs text-texto-terciario">{l.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════ */

export default function PaginaPerfilUsuario() {
  const params = useParams()
  const router = useRouter()
  const miembroId = params.id as string
  const { usuario: usuarioActual } = useAuth()
  const { empresa } = useEmpresa()
  const { setMigajaDinamica } = useNavegacion()
  const { t } = useTraduccion()
  const { esPropietario, esAdmin } = useRol()
  const fmt = useFormato()
  const [supabase] = useState(() => crearClienteNavegador())

  const [tab, setTab] = useState<TabPerfil>('resumen')
  const [cargando, setCargando] = useState(true)
  const [miembro, setMiembro] = useState<Miembro | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  /* ── Estado acciones de usuario ── */
  const [menuAcciones, setMenuAcciones] = useState(false)
  const menuAccionesRef = useRef<HTMLDivElement>(null)
  const [modalForzarPassword, setModalForzarPassword] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [accionCargando, setAccionCargando] = useState<string | null>(null)
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState(false)

  /* ── Estado sectores, puestos, info bancaria ── */
  const [sectores, setSectores] = useState<{ id: string; nombre: string }[]>([])
  const [puestos, setPuestos] = useState<{ id: string; nombre: string }[]>([])
  const [sectorActualId, setSectorActualId] = useState<string>('')
  const [infoBancaria, setInfoBancaria] = useState<Record<string, unknown> | null>(null)

  /* ── Estado kiosco ── */
  const [pinVisible, setPinVisible] = useState(false)
  const [capturandoRfid, setCapturandoRfid] = useState(false)
  const rfidInputRef = useRef<HTMLInputElement>(null)

  /* ── Estado contacto emergencia y documentos ── */
  const [contactoEmergencia, setContactoEmergencia] = useState<Record<string, unknown> | null>(null)
  const [documentosUsuario, setDocumentosUsuario] = useState<Record<string, unknown>[]>([])

  /* ── Estado pagos ── */
  const [compensacionAbierta, setCompensacionAbierta] = useState(false)
  const compensacionRef = useRef<HTMLDivElement>(null)
  const [modalLiquidacion, setModalLiquidacion] = useState(false)
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [guardandoPago, setGuardandoPago] = useState(false)
  // Campos del modal de liquidación
  const [liqConcepto, setLiqConcepto] = useState('')
  const [liqMonto, setLiqMonto] = useState('')
  const [liqNotas, setLiqNotas] = useState('')
  // Navegación de períodos en el modal
  const [periodoModal, setPeriodoModal] = useState<Periodo | null>(null)
  const [rangoPersonalizado, setRangoPersonalizado] = useState(false)
  const [rangoInicio, setRangoInicio] = useState('')
  const [rangoFin, setRangoFin] = useState('')
  // Comprobante
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const inputComprobanteRef = useRef<HTMLInputElement>(null)
  // Asistencias reales del período
  const [asistenciasPeriodo, setAsistenciasPeriodo] = useState<Record<string, unknown>[]>([])
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false)
  // Preview local de documentos (antes de que suba a storage)
  const [archivosDocLocal, setArchivosDocLocal] = useState<Record<string, { nombre: string; url: string | null; subiendo: boolean; error?: boolean }>>({})
  // Modal para ver documento ampliado
  const [docPreview, setDocPreview] = useState<{ titulo: string; url: string } | null>(null)
  // Recortador de imagen
  const [recortador, setRecortador] = useState<{ imagen: string; tipo: 'avatar' | 'kiosco' } | null>(null)

  /* ── Carga de datos ── */
  const cargarDatos = useCallback(async () => {
    if (!empresa) return
    setCargando(true)

    const { data: miembroData } = await supabase
      .from('miembros')
      .select('*')
      .eq('id', miembroId)
      .eq('empresa_id', empresa.id)
      .single()

    if (miembroData) {
      setMiembro(miembroData)

      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', miembroData.usuario_id)
        .single()

      if (perfilData) setPerfil(perfilData)

      // Sectores de la empresa
      const { data: sectoresData } = await supabase
        .from('sectores')
        .select('id, nombre')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('orden')
      if (sectoresData) setSectores(sectoresData)

      // Puestos de la empresa
      const { data: puestosData } = await supabase
        .from('puestos')
        .select('id, nombre')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('orden')
      if (puestosData) setPuestos(puestosData)

      // Sector actual del miembro
      const { data: miembroSectorData } = await supabase
        .from('miembros_sectores')
        .select('sector_id')
        .eq('miembro_id', miembroId)
        .eq('es_primario', true)
        .single()
      if (miembroSectorData) setSectorActualId(miembroSectorData.sector_id)

      // Info bancaria
      const { data: bancariaData } = await supabase
        .from('info_bancaria')
        .select('*')
        .eq('miembro_id', miembroId)
        .maybeSingle()
      if (bancariaData) setInfoBancaria(bancariaData)

      // Contacto de emergencia
      const { data: emergenciaData } = await supabase
        .from('contactos_emergencia')
        .select('*')
        .eq('miembro_id', miembroId)
        .single()
      if (emergenciaData) setContactoEmergencia(emergenciaData)

      // Documentos del usuario
      const { data: docsData } = await supabase
        .from('documentos_usuario')
        .select('*')
        .eq('miembro_id', miembroId)
      if (docsData) setDocumentosUsuario(docsData)
    }

    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  /* ── Autoguardado ── */
  const guardarPerfil = useCallback(async (datos: Record<string, unknown>) => {
    if (!perfil) return false
    try {
      const res = await fetch('/api/perfiles/actualizar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_id: perfil.id, ...datos }),
      })
      return res.ok
    } catch {
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil])

  const guardarMiembro = useCallback(async (datos: Record<string, unknown>) => {
    if (!miembro) return false
    const { error } = await supabase.from('miembros').update(datos).eq('id', miembroId)
    return !error
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembro, miembroId])

  const { estado: estadoPerfil, guardar: autoGuardarPerfil, setSnapshot: setSnapshotPerfil } = useAutoguardado({ onGuardar: guardarPerfil })
  const { estado: estadoMiembro, guardarInmediato: guardarMiembroInmediato, setSnapshot: setSnapshotMiembro } = useAutoguardado({ onGuardar: guardarMiembro })

  useEffect(() => {
    if (perfil) setSnapshotPerfil(perfil as unknown as Record<string, unknown>)
  }, [perfil, setSnapshotPerfil])

  useEffect(() => {
    if (miembro) setSnapshotMiembro(miembro as unknown as Record<string, unknown>)
  }, [miembro, setSnapshotMiembro])

  const puedeEditar = esPropietario || esAdmin

  /* ── Guardar sector del miembro ── */
  const guardarSector = useCallback(async (sectorId: string) => {
    if (!empresa) return
    setSectorActualId(sectorId)
    // Borrar asignación actual y crear nueva
    await supabase.from('miembros_sectores').delete().eq('miembro_id', miembroId)
    if (sectorId) {
      await supabase.from('miembros_sectores').insert({
        miembro_id: miembroId,
        sector_id: sectorId,
        es_primario: true,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* ── Guardar puesto del miembro ── */
  const guardarPuesto = useCallback(async (puestoId: string) => {
    setMiembro(p => p ? { ...p, puesto_id: puestoId || null } : null)
    await supabase.from('miembros').update({ puesto_id: puestoId || null }).eq('id', miembroId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId])

  /* ── Guardar info bancaria ── */
  const guardarInfoBancaria = useCallback(async (campo: string, valor: string) => {
    const datos = { ...infoBancaria, [campo]: valor || null }
    setInfoBancaria(datos)
    if (infoBancaria?.id) {
      await supabase.from('info_bancaria').update({ [campo]: valor || null }).eq('id', infoBancaria.id)
    } else {
      const { data } = await supabase.from('info_bancaria').insert({
        miembro_id: miembroId,
        [campo]: valor || null,
      }).select().single()
      if (data) setInfoBancaria(data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId, infoBancaria])

  /* ── Guardar contacto de emergencia ── */
  const guardarEmergencia = useCallback(async (campo: string, valor: string | Record<string, unknown>) => {
    const datos = { ...contactoEmergencia, [campo]: valor || null }
    setContactoEmergencia(datos)
    if (contactoEmergencia?.id) {
      await supabase.from('contactos_emergencia').update({ [campo]: valor || null }).eq('id', contactoEmergencia.id)
    } else {
      const { data } = await supabase.from('contactos_emergencia').insert({
        miembro_id: miembroId,
        nombre: campo === 'nombre' ? valor : '',
        [campo]: valor || null,
      }).select().single()
      if (data) setContactoEmergencia(data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId, contactoEmergencia])

  /* ── Cerrar menú acciones al hacer click afuera ── */
  useEffect(() => {
    if (!menuAcciones) return
    const handler = (e: MouseEvent) => {
      if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target as Node)) setMenuAcciones(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAcciones])

  /* ── Acciones de usuario ── */
  const ejecutarAccion = useCallback(async (accion: string) => {
    if (!miembroId) return
    setAccionCargando(accion)
    setMenuAcciones(false)

    try {
      if (accion === 'reset-password') {
        await fetch('/api/miembros/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
      } else if (accion === 'forzar-logout') {
        await fetch('/api/miembros/forzar-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
      } else if (accion === 'desactivar') {
        await fetch('/api/miembros/activar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId, activo: !(miembro?.activo as boolean) }),
        })
        cargarDatos()
      } else if (accion === 'forzar-password') {
        if (!nuevaPassword || nuevaPassword.length < 6) return
        await fetch('/api/miembros/forzar-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId, nueva_password: nuevaPassword }),
        })
        setModalForzarPassword(false)
        setNuevaPassword('')
      } else if (accion === 'eliminar') {
        await fetch('/api/miembros/eliminar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        router.push('/usuarios')
        return
      }
    } finally {
      setAccionCargando(null)
    }
  }, [miembroId, miembro, nuevaPassword, cargarDatos, router])

  /* ── Cerrar compensación al hacer click afuera ── */
  useEffect(() => {
    if (!compensacionAbierta) return
    const handler = (e: MouseEvent) => {
      if (compensacionRef.current && !compensacionRef.current.contains(e.target as Node)) {
        setCompensacionAbierta(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [compensacionAbierta])

  /* ── Cargar pagos ── */
  const cargarPagos = useCallback(async () => {
    if (!empresa || !miembroId) return
    setCargandoPagos(true)
    const { data } = await supabase
      .from('pagos_nomina')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .order('fecha_inicio_periodo', { ascending: false })
    if (data) setPagos(data)
    setCargandoPagos(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  useEffect(() => { cargarPagos() }, [cargarPagos])

  /* ── Cargar asistencias reales de un período ── */
  const cargarAsistenciasPeriodo = useCallback(async (inicio: Date, fin: Date) => {
    if (!empresa || !miembroId) return
    setCargandoAsistencias(true)
    const { data } = await supabase
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .gte('fecha', inicio.toISOString().split('T')[0])
      .lte('fecha', fin.toISOString().split('T')[0])
      .order('fecha', { ascending: true })
    if (data) setAsistenciasPeriodo(data)
    else setAsistenciasPeriodo([])
    setCargandoAsistencias(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* ── Subir comprobante a Supabase Storage ── */
  const subirComprobante = useCallback(async (): Promise<string | null> => {
    if (!archivoComprobante || !empresa) return null
    setSubiendoComprobante(true)
    const ext = archivoComprobante.name.split('.').pop() || 'pdf'
    const ruta = `${empresa.id}/${miembroId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('comprobantes-pago')
      .upload(ruta, archivoComprobante, { upsert: false })
    setSubiendoComprobante(false)
    if (error) return null
    const { data: urlData } = supabase.storage
      .from('comprobantes-pago')
      .getPublicUrl(ruta)
    return urlData?.publicUrl || null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivoComprobante, empresa, miembroId])

  /* ── Registrar pago ── */
  const registrarPago = useCallback(async () => {
    if (!empresa || !miembro || !usuarioActual || !perfil || !periodoModal) return
    setGuardandoPago(true)

    // Subir comprobante si hay
    let comprobanteUrl: string | null = null
    if (archivoComprobante) {
      comprobanteUrl = await subirComprobante()
    }

    const { error } = await supabase.from('pagos_nomina').insert({
      empresa_id: empresa.id,
      miembro_id: miembroId,
      fecha_inicio_periodo: periodoModal.inicio.toISOString().split('T')[0],
      fecha_fin_periodo: periodoModal.fin.toISOString().split('T')[0],
      concepto: liqConcepto || periodoModal.etiqueta,
      monto_sugerido: montoPagarRef.current,
      monto_abonado: parseFloat(liqMonto) || montoPagarRef.current,
      dias_habiles: diasHabilesQuincenaRef.current,
      dias_trabajados: diasTrabajadosQuincenaRef.current,
      dias_ausentes: statsAsistenciaRef.current.ausentes,
      tardanzas: statsAsistenciaRef.current.tardanzas,
      comprobante_url: comprobanteUrl,
      notas: liqNotas || null,
      creado_por: usuarioActual.id,
      creado_por_nombre: `${perfil.nombre} ${perfil.apellido}`,
    })

    setGuardandoPago(false)
    if (!error) {
      setModalLiquidacion(false)
      setLiqConcepto('')
      setLiqMonto('')
      setLiqNotas('')
      setArchivoComprobante(null)
      setPeriodoModal(null)
      setRangoPersonalizado(false)
      cargarPagos()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembro, miembroId, usuarioActual, perfil, periodoModal, liqConcepto, liqMonto, liqNotas, archivoComprobante, subirComprobante, cargarPagos])

  /* ── Eliminar pago ── */
  const eliminarPago = useCallback(async (pagoId: string) => {
    await supabase.from('pagos_nomina').delete().eq('id', pagoId)
    cargarPagos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarPagos])

  /* ── Datos derivados ── */
  const nombreCompleto = perfil ? `${perfil.nombre || 'Sin'} ${perfil.apellido || 'nombre'}` : ''

  // Setear migaja dinámica con el nombre del usuario
  useEffect(() => {
    if (nombreCompleto && miembroId) {
      setMigajaDinamica(`/usuarios/${miembroId}`, nombreCompleto)
    }
  }, [nombreCompleto, miembroId, setMigajaDinamica])

  const rolActual = (miembro?.rol as Rol) || 'empleado'
  const numeroEmpleado = String(miembro?.numero_empleado || '1').padStart(3, '0')

  const fechaNac = perfil?.fecha_nacimiento ? new Date(perfil.fecha_nacimiento) : null
  const edad = fechaNac ? Math.floor((Date.now() - fechaNac.getTime()) / 31557600000) : null

  /* Compensación */
  const compensacionTipo = (miembro?.compensacion_tipo as string) || 'fijo'
  const compensacionMonto = Number(miembro?.compensacion_monto) || 0
  const compensacionFrecuencia = (miembro?.compensacion_frecuencia as string) || 'mensual'
  const diasTrabajo = Number(miembro?.dias_trabajo) || 5

  const proyeccionMensual = useMemo(() => {
    if (compensacionTipo === 'por_dia') return compensacionMonto * diasTrabajo * 4.33
    if (compensacionTipo === 'por_hora') return compensacionMonto * 8 * diasTrabajo * 4.33
    return compensacionMonto
  }, [compensacionTipo, compensacionMonto, diasTrabajo])

  /** Proyección según frecuencia seleccionada */
  const proyeccionPorFrecuencia = useMemo(() => {
    if (compensacionTipo === 'fijo') return compensacionMonto
    const montoDiario = compensacionTipo === 'por_hora' ? compensacionMonto * 8 : compensacionMonto
    switch (compensacionFrecuencia) {
      case 'semanal': return montoDiario * diasTrabajo
      case 'quincenal': return montoDiario * Math.round(diasTrabajo * 2.17)
      case 'mensual': return montoDiario * Math.round(diasTrabajo * 4.33)
      case 'eventual': return montoDiario * diasTrabajo * 4.33
      default: return montoDiario * Math.round(diasTrabajo * 4.33)
    }
  }, [compensacionTipo, compensacionMonto, compensacionFrecuencia, diasTrabajo])


  /* Período actual según frecuencia configurada */
  const hoy = new Date()
  const periodoActual = useMemo(() => obtenerPeriodo(hoy, compensacionFrecuencia), [compensacionFrecuencia]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Período activo (modal o actual) */
  const periodoActivo = periodoModal || periodoActual

  /* Cargar asistencias del mes para el calendario */
  const [asistenciasMesRaw, setAsistenciasMesRaw] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!empresa || !miembroId) return
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    supabase
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .gte('fecha', inicio.toISOString().split('T')[0])
      .lte('fecha', fin.toISOString().split('T')[0])
      .then(({ data }) => { if (data) setAsistenciasMesRaw(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* Convertir asistencias raw a mapa por día del mes */
  const asistenciasMes = useMemo(() => {
    const resultado: Record<number, 'presente' | 'ausente' | 'tardanza'> = {}
    for (const reg of asistenciasMesRaw) {
      const fecha = new Date(reg.fecha as string)
      const dia = fecha.getDate()
      const estado = reg.estado as string
      if (estado === 'tardanza') resultado[dia] = 'tardanza'
      else if (estado === 'ausente' || estado === 'justificado') resultado[dia] = 'ausente'
      else resultado[dia] = 'presente'
    }
    return resultado
  }, [asistenciasMesRaw])

  /* Stats de asistencia del mes */
  const statsAsistencia = useMemo(() => {
    let presentes = 0, ausentes = 0, tardanzas = 0
    Object.values(asistenciasMes).forEach(e => {
      if (e === 'presente') presentes++
      else if (e === 'ausente') ausentes++
      else if (e === 'tardanza') tardanzas++
    })
    return { presentes, ausentes, tardanzas }
  }, [asistenciasMes])

  /* Días laborales (0=dom, 6=sab) para el calendario */
  const diasLaborales = useMemo(() => {
    if (diasTrabajo >= 7) return [0, 1, 2, 3, 4, 5, 6]
    if (diasTrabajo >= 6) return [1, 2, 3, 4, 5, 6]
    return [1, 2, 3, 4, 5]
  }, [diasTrabajo])

  /* Stats del período activo (para modal y tarjeta) calculados desde asistencias reales */
  const statsPeriodo = useMemo(() => {
    const datos = modalLiquidacion ? asistenciasPeriodo : asistenciasMesRaw
    const inicio = periodoActivo.inicio
    const fin = periodoActivo.fin

    // Contar días hábiles en el rango
    let habiles = 0
    const iter = new Date(inicio)
    while (iter <= fin) {
      if (diasLaborales.includes(iter.getDay())) habiles++
      iter.setDate(iter.getDate() + 1)
    }

    // Contar días trabajados y tardanzas desde registros reales
    const fechasTrabajadas = new Set<string>()
    let tardanzasCount = 0
    for (const reg of datos) {
      const fechaStr = reg.fecha as string
      const fecha = new Date(fechaStr)
      if (fecha >= inicio && fecha <= fin) {
        const estado = reg.estado as string
        if (estado === 'presente' || estado === 'tardanza') {
          fechasTrabajadas.add(fechaStr)
        }
        if (estado === 'tardanza') tardanzasCount++
      }
    }

    const trabajados = fechasTrabajadas.size
    const ausentes = Math.max(0, habiles - trabajados)

    return { habiles, trabajados, ausentes, tardanzas: tardanzasCount }
  }, [periodoActivo, asistenciasPeriodo, asistenciasMesRaw, diasLaborales, modalLiquidacion])

  /* Monto a pagar según stats del período */
  const diasTrabajadosQuincena = statsPeriodo.trabajados
  const diasHabilesQuincena = statsPeriodo.habiles

  const montoPagar = compensacionTipo === 'por_dia'
    ? compensacionMonto * diasTrabajadosQuincena
    : compensacionTipo === 'por_hora'
      ? compensacionMonto * 8 * diasTrabajadosQuincena
      : compensacionMonto

  /* Refs para usar en callbacks sin re-render */
  const montoPagarRef = { current: montoPagar }
  const diasTrabajadosQuincenaRef = { current: diasTrabajadosQuincena }
  const diasHabilesQuincenaRef = { current: diasHabilesQuincena }
  const statsAsistenciaRef = { current: statsPeriodo }

  /* Cargar asistencias al abrir modal o cambiar período */
  useEffect(() => {
    if (modalLiquidacion && periodoModal) {
      cargarAsistenciasPeriodo(periodoModal.inicio, periodoModal.fin)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalLiquidacion, periodoModal])

  /* Inicializar modal al abrir */
  useEffect(() => {
    if (modalLiquidacion && !periodoModal) {
      const periodo = obtenerPeriodo(hoy, compensacionFrecuencia)
      setPeriodoModal(periodo)
      setLiqConcepto(periodo.etiqueta)
      setLiqMonto(String(montoPagar))
    }
  }, [modalLiquidacion]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Actualizar concepto y monto al navegar períodos */
  useEffect(() => {
    if (periodoModal) {
      setLiqConcepto(periodoModal.etiqueta)
    }
  }, [periodoModal])

  useEffect(() => {
    if (modalLiquidacion) {
      setLiqMonto(String(montoPagar))
    }
  }, [montoPagar, modalLiquidacion])

  /** Genera etiqueta descriptiva para un rango y aplica como período del modal */
  const aplicarRangoCustom = useCallback((inicioStr: string, finStr: string) => {
    const inicio = new Date(inicioStr + 'T00:00:00')
    const fin = new Date(finStr + 'T00:00:00')
    if (inicio > fin) return

    // Generar etiqueta descriptiva: "17 al 20 de Marzo 2026"
    const dInicio = inicio.getDate()
    const dFin = fin.getDate()
    const mesInicio = inicio.toLocaleDateString('es', { month: 'long' })
    const mesFin = fin.toLocaleDateString('es', { month: 'long' })
    const anioFin = fin.getFullYear()
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    let etiqueta: string
    if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
      // Mismo mes: "17 al 20 de Marzo 2026"
      etiqueta = `${dInicio} al ${dFin} de ${cap(mesFin)} ${anioFin}`
    } else {
      // Meses distintos: "28 de Marzo al 5 de Abril 2026"
      etiqueta = `${dInicio} de ${cap(mesInicio)} al ${dFin} de ${cap(mesFin)} ${anioFin}`
    }

    setPeriodoModal({ inicio, fin, etiqueta })
    setLiqConcepto(etiqueta)
  }, [])

  const estadoIndicador = estadoPerfil !== 'idle' ? estadoPerfil : estadoMiembro

  /* ── Tabs config ── */
  const tabsConfig = [
    { clave: 'resumen', etiqueta: 'Resumen', icono: <User size={15} /> },
    { clave: 'informacion', etiqueta: 'Información', icono: <FileText size={15} /> },
    { clave: 'pagos', etiqueta: 'Pagos', icono: <Wallet size={15} /> },
    { clave: 'permisos', etiqueta: 'Permisos', icono: <Shield size={15} /> },
  ]

  /* ════════════ LOADING / ERROR ════════════ */
  if (cargando) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-24 bg-superficie-hover rounded" />
          <div className="h-20 bg-superficie-hover rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-superficie-hover rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!miembro || !perfil) {
    return <div className="p-8 text-center text-sm text-texto-terciario">Usuario no encontrado</div>
  }

  /* ════════════ RENDER ════════════ */
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ══════ CABECERO — solo indicador de guardado, migajas van en el header global ══════ */}
      {estadoIndicador !== 'idle' && (
        <div className="flex justify-end px-2">
          <IndicadorGuardado estado={estadoIndicador} />
        </div>
      )}

      {/* ══════ HEADER DEL USUARIO ══════ */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5 sm:p-6">
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
                  <button
                    aria-label="Editar foto de perfil"
                    onClick={() => setRecortador({ imagen: perfil.avatar_url!, tipo: 'avatar' })}
                    className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer border-none transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                  >
                    <Camera size={20} className="text-white" />
                  </button>
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
                  <button
                    onClick={async () => {
                      setPerfil(p => p ? { ...p, avatar_url: null } : null)
                      guardarPerfil({ avatar_url: null })
                    }}
                    className="absolute -bottom-1 -right-1 size-5 rounded-full bg-insignia-peligro flex items-center justify-center cursor-pointer border-2 border-superficie-tarjeta opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Eliminar foto"
                  >
                    <X size={10} className="text-white" />
                  </button>
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
                    {textoCumple(dias, perfil.fecha_nacimiento)}
                  </motion.span>
                )
                if (dias > 0 && dias <= 7) return (
                  <span className="flex items-center gap-1.5 text-insignia-advertencia/50">
                    <Cake size={13} />
                    {textoCumple(dias, perfil.fecha_nacimiento)}
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
                    className="absolute right-0 top-full mt-1 w-64 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden py-1"
                  >
                    <ItemMenu icono={<MailIcon size={15} />} onClick={() => ejecutarAccion('reset-password')}>Enviar reseteo de contraseña</ItemMenu>
                    <ItemMenu icono={<KeyRound size={15} />} onClick={() => { setMenuAcciones(false); setModalForzarPassword(true) }}>Forzar nueva contraseña</ItemMenu>
                    <ItemMenu icono={<LogOut size={15} />} onClick={() => ejecutarAccion('forzar-logout')}>Forzar cierre de sesión</ItemMenu>

                    <div className="border-t border-borde-sutil my-1" />

                    <ItemMenu icono={<Power size={15} />} variante="advertencia" onClick={() => ejecutarAccion('desactivar')}>
                      {miembro.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                    </ItemMenu>

                    {esPropietario && (
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

      {/* ══════ TABS ══════ */}
      <Tabs
        tabs={tabsConfig}
        activo={tab}
        onChange={(clave) => setTab(clave as TabPerfil)}
      />

      {/* ══════ CONTENIDO DE TABS ══════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >

          {/* ═══════════════════════════════
              TAB RESUMEN
              ═══════════════════════════════ */}
          {tab === 'resumen' && (
            <div className="space-y-5">
              {/* Stats rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TarjetaStat
                  etiqueta="Presentes"
                  valor={statsAsistencia.presentes}
                  subvalor="este mes"
                  icono={<Check size={16} />}
                  color="exito"
                />
                <TarjetaStat
                  etiqueta="Ausencias"
                  valor={statsAsistencia.ausentes}
                  subvalor="este mes"
                  icono={<X size={16} />}
                  color="peligro"
                />
                <TarjetaStat
                  etiqueta="Tardanzas"
                  valor={statsAsistencia.tardanzas}
                  subvalor="este mes"
                  icono={<Clock size={16} />}
                  color="advertencia"
                />
                <TarjetaStat
                  etiqueta="A pagar"
                  valor={fmt.moneda(montoPagar)}
                  subvalor={compensacionTipo === 'por_dia' ? `${fmt.moneda(compensacionMonto)} × ${diasTrabajadosQuincena} días` : compensacionFrecuencia}
                  icono={<DollarSign size={16} />}
                  color="primario"
                />
              </div>

              {/* Fila: Calendario + Datos rápidos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Mini calendario */}
                <Tarjeta titulo="Asistencias del mes" subtitulo={`${statsAsistencia.presentes + statsAsistencia.tardanzas} de ${Object.keys(asistenciasMes).length + (statsAsistencia.ausentes)} días laborales`}>
                  <MiniCalendario
                    anio={hoy.getFullYear()}
                    mes={hoy.getMonth()}
                    asistencias={asistenciasMes}
                    diasLaborales={diasLaborales}
                    diasSemanaCortos={fmt.diasSemanaCortos}
                    diaInicioSemana={fmt.diaInicioSemana}
                    formatearMes={(d) => fmt.fecha(d, { soloMes: true })}
                  />
                </Tarjeta>

                {/* Panel de compensación + datos */}
                <div className="space-y-4">
                  {/* Compensación resumen */}
                  <Tarjeta titulo={t('usuarios.compensacion')}>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Insignia color={compensacionTipo === 'por_dia' ? 'info' : compensacionTipo === 'por_hora' ? 'cyan' : 'primario'}>
                          {compensacionTipo === 'por_dia' ? 'Cobra por día' : compensacionTipo === 'por_hora' ? 'Cobra por hora' : 'Sueldo fijo'}
                        </Insignia>
                        <Insignia color="neutro">{
                          compensacionFrecuencia === 'semanal' ? 'Semanal' :
                          compensacionFrecuencia === 'quincenal' ? 'Quincenal' :
                          compensacionFrecuencia === 'eventual' ? 'Eventual' : 'Mensual'
                        }</Insignia>
                        <Insignia color="neutro">
                          {diasTrabajo === 7 ? '7/7' : diasTrabajo === 6 ? 'L-S' : diasTrabajo === 5 ? 'L-V' : `${diasTrabajo} días`}
                        </Insignia>
                      </div>

                      <div>
                        <p className="text-xs text-texto-terciario uppercase tracking-wide">
                          {compensacionTipo === 'por_dia' ? 'Tarifa diaria' : compensacionTipo === 'por_hora' ? 'Tarifa por hora' : 'Sueldo'}
                        </p>
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-bold text-texto-primario">{fmt.moneda(compensacionMonto)}</span>
                          {compensacionTipo !== 'fijo' && (
                            <span className="text-sm text-texto-terciario">
                              Proyección: <span className="text-insignia-exito font-medium">{fmt.moneda(proyeccionMensual)}</span>/mes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Período actual */}
                      <div className="border-t border-borde-sutil pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-texto-terciario uppercase tracking-wide flex items-center gap-1.5">
                              <CalendarDays size={12} />
                              {periodoActual.etiqueta}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-texto-secundario">
                                <strong className="text-texto-primario">{statsPeriodo.trabajados}</strong> días trabajados
                              </span>
                              <span className="text-sm text-texto-secundario">
                                <strong className="text-texto-primario">{statsPeriodo.ausentes}</strong> ausencias
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-texto-terciario">A pagar</p>
                            <p className="text-xl font-bold text-insignia-exito">{fmt.moneda(montoPagar)}</p>
                            {compensacionTipo === 'por_dia' && (
                              <p className="text-xs text-texto-terciario">{fmt.moneda(compensacionMonto)} × {statsPeriodo.trabajados} días</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Tarjeta>

                  {/* Documento */}
                  {perfil.documento_numero ? (
                    <Tarjeta compacta>
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-insignia-info-fondo flex items-center justify-center">
                          <Fingerprint size={16} className="text-insignia-info-texto" />
                        </div>
                        <div>
                          <p className="text-xs text-texto-terciario">Documento</p>
                          <p className="text-sm font-medium text-texto-primario">{perfil.documento_numero as string}</p>
                        </div>
                      </div>
                    </Tarjeta>
                  ) : null}

                  {/* Fecha nacimiento */}
                  {fechaNac && (
                    <Tarjeta compacta>
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-insignia-rosa-fondo flex items-center justify-center">
                          <Calendar size={16} className="text-insignia-rosa-texto" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-texto-terciario">Nacimiento</p>
                          <p className="text-sm font-medium text-texto-primario">
                            {fmt.fecha(fechaNac)}
                            {edad && <span className="text-texto-terciario font-normal"> · {edad} años</span>}
                          </p>
                        </div>
                      </div>
                    </Tarjeta>
                  )}
                </div>
              </div>

              {/* Resumen de permisos */}
              <Tarjeta titulo={t('usuarios.permisos')} subtitulo={`Rol base: ${ETIQUETA_ROL[rolActual]}`}
                acciones={
                  <Boton variante="fantasma" tamano="xs" onClick={() => setTab('permisos')} iconoDerecho={<ChevronRight size={14} />}>
                    Ver detalle
                  </Boton>
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {MODULOS_PREVIEW.map(mod => {
                    const permisosRol = PERMISOS_POR_ROL[rolActual]?.[mod.id as Modulo]
                    const tieneAcceso = rolActual === 'propietario' || rolActual === 'administrador' || !!permisosRol?.length
                    return (
                      <Insignia key={mod.id} color={tieneAcceso ? 'exito' : 'neutro'}>
                        {mod.nombre}
                      </Insignia>
                    )
                  })}
                  <Insignia color="neutro">+{Object.keys(ACCIONES_POR_MODULO).length - MODULOS_PREVIEW.length} más</Insignia>
                </div>
              </Tarjeta>

              {/* Configuración laboral rápida */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Tarjeta compacta>
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-insignia-violeta-fondo flex items-center justify-center">
                      <Clock size={16} className="text-insignia-violeta-texto" />
                    </div>
                    <div>
                      <p className="text-xs text-texto-terciario">Turno</p>
                      <p className="text-sm font-medium text-texto-primario">
                        {miembro.horario_tipo === 'lunes_sabado' ? 'L a S' :
                         miembro.horario_tipo === 'todos' ? '7 días' :
                         miembro.horario_tipo === 'custom' ? 'Personalizado' : 'L a V'}
                      </p>
                    </div>
                  </div>
                </Tarjeta>

                <Tarjeta compacta>
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-insignia-cyan-fondo flex items-center justify-center">
                      <Fingerprint size={16} className="text-insignia-cyan-texto" />
                    </div>
                    <div>
                      <p className="text-xs text-texto-terciario">Fichaje</p>
                      <p className="text-sm font-medium text-texto-primario capitalize">
                        {miembro.metodo_fichaje || 'Kiosco'}
                      </p>
                    </div>
                  </div>
                </Tarjeta>

                <Tarjeta compacta>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="size-9 rounded-lg bg-insignia-naranja-fondo flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-insignia-naranja-texto" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-texto-terciario">Ubicación</p>
                      <p className="text-sm font-medium text-texto-primario truncate" title={perfil.domicilio || undefined}>
                        {perfil.domicilio || 'Sin dirección'}
                      </p>
                    </div>
                  </div>
                </Tarjeta>
              </div>

              {/* Contacto de emergencia + Documentos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Contacto de emergencia */}
                <Tarjeta titulo="Contacto de emergencia" compacta>
                  {contactoEmergencia ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-insignia-peligro-fondo flex items-center justify-center">
                          <Heart size={16} className="text-insignia-peligro-texto" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-texto-primario">{contactoEmergencia.nombre as string}</p>
                          <p className="text-xs text-texto-terciario">{contactoEmergencia.relacion as string}</p>
                        </div>
                      </div>
                      {(contactoEmergencia.telefono as string) && (
                        <div className="flex items-center gap-2 text-sm text-texto-secundario pl-12">
                          <Phone size={12} className="text-texto-terciario" />
                          {contactoEmergencia.telefono as string}
                        </div>
                      )}
                      {(contactoEmergencia.direccion as string) && (
                        <div className="flex items-center gap-2 text-sm text-texto-secundario pl-12">
                          <MapPin size={12} className="text-texto-terciario" />
                          {contactoEmergencia.direccion as string}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-superficie-hover flex items-center justify-center">
                        <Heart size={16} className="text-texto-terciario" />
                      </div>
                      <p className="text-xs text-texto-terciario">Sin contacto de emergencia cargado</p>
                    </div>
                  )}
                </Tarjeta>

                {/* Documentos — resumen: solo frentes + botón ver todo */}
                <Tarjeta titulo="Documentos" compacta acciones={
                  <button
                    onClick={() => {
                      setTab('informacion')
                      setTimeout(() => {
                        document.getElementById('seccion-documentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 400)
                    }}
                    className="text-xs text-texto-marca hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                  >
                    Ver todo <ChevronRight size={12} />
                  </button>
                }>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { tipo: 'DNI Frente', titulo: 'DNI' },
                      { tipo: 'Registro Frente', titulo: 'Registro' },
                    ].map(({ tipo, titulo }) => {
                      const doc = documentosUsuario.find(d => (d.tipo as string) === tipo)
                      const previewLocal = archivosDocLocal[tipo]
                      const imgUrl = previewLocal?.url || (doc?.url as string | undefined) || null
                      return (
                        <div key={tipo}>
                          <p className="text-xxs text-texto-terciario/60 uppercase tracking-wide font-semibold text-center mb-1">{titulo}</p>
                          <div
                            className={`rounded-md overflow-hidden ${imgUrl ? 'cursor-pointer hover:opacity-80' : 'bg-superficie-hover/30'}`}
                            onClick={() => imgUrl && setDocPreview({ titulo: tipo, url: imgUrl })}
                          >
                            {imgUrl ? (
                              <img src={imgUrl} alt={tipo} className="w-full h-20 object-contain rounded-md bg-superficie-hover/20" />
                            ) : (
                              <div className="w-full h-20 flex flex-col items-center justify-center gap-1">
                                <Upload size={14} className="text-texto-terciario/25" />
                                <span className="text-xxs text-texto-terciario/30">Sin cargar</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Tarjeta>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════
              TAB INFORMACIÓN
              ═══════════════════════════════ */}
          {tab === 'informacion' && (
            <div className="space-y-8 p-4 sm:p-6">

              {/* ── 1. DATOS PERSONALES ── */}
              <section>
                <SeccionEncabezado icono={<User size={15} />} titulo={t('usuarios.datos_personales')} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input tipo="text" formato="nombre_persona" etiqueta={t('usuarios.nombre')} value={perfil.nombre || ''} onChange={(e) => setPerfil(p => p ? { ...p, nombre: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ nombre: perfil.nombre })} disabled={!puedeEditar} />
                  <Input tipo="text" formato="nombre_persona" etiqueta={t('usuarios.apellido')} value={perfil.apellido || ''} onChange={(e) => setPerfil(p => p ? { ...p, apellido: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ apellido: perfil.apellido })} disabled={!puedeEditar} />
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
                            <span className="text-xs text-insignia-advertencia/50">{textoCumple(diasHastaCumple(perfil.fecha_nacimiento), perfil.fecha_nacimiento)}</span>
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
                  <Input tipo="email" etiqueta="Correo personal" value={perfil.correo || ''} onChange={(e) => setPerfil(p => p ? { ...p, correo: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ correo: perfil.correo })} icono={<Mail size={15} />} disabled={!puedeEditar} />
                  <Input tipo="email" etiqueta="Correo empresa" value={perfil.correo_empresa || ''} onChange={(e) => setPerfil(p => p ? { ...p, correo_empresa: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ correo_empresa: perfil.correo_empresa })} icono={<Mail size={15} />} disabled={!puedeEditar} />
                  <Input tipo="tel" etiqueta="Teléfono personal" value={perfil.telefono || ''} onChange={(e) => setPerfil(p => p ? { ...p, telefono: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ telefono: perfil.telefono })} icono={<Phone size={15} />} disabled={!puedeEditar} />
                  <Input tipo="tel" etiqueta="Teléfono empresa" value={perfil.telefono_empresa || ''} onChange={(e) => setPerfil(p => p ? { ...p, telefono_empresa: e.target.value } : null)} onBlur={() => autoGuardarPerfil({ telefono_empresa: perfil.telefono_empresa })} icono={<Phone size={15} />} disabled={!puedeEditar} />
                </div>
              </section>

              {/* ── 3. DATOS LABORALES ── */}
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
                    { campo: 'horario_flexible', etiqueta: 'Horario flexible', desc: 'No se controla el horario de entrada/salida' },
                    { campo: 'salix_ia_habilitado', etiqueta: 'Acceso a Salix IA', desc: 'Puede usar el asistente de inteligencia artificial' },
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
              </section>

              {/* ── 4. ACCESO AL KIOSCO ── */}
              <section>
                <SeccionEncabezado icono={<KeyRound size={15} />} titulo="Acceso al kiosco" />
                <div className="space-y-5">
                  {/* Llavero RFID */}
                  <div>
                    <p className="text-sm font-semibold text-texto-primario mb-1">Código de llavero RFID</p>
                    <div className="flex items-center gap-2">
                      <Input
                        tipo="text"
                        value={miembro.kiosco_rfid || ''}
                        onChange={(e) => setMiembro(p => p ? { ...p, kiosco_rfid: e.target.value } : null)}
                        onBlur={() => guardarMiembro({ kiosco_rfid: miembro.kiosco_rfid || null })}
                        placeholder={capturandoRfid ? 'Esperando llavero...' : 'Pasar llavero por el lector...'}
                        formato={null}
                        disabled={!puedeEditar || capturandoRfid}
                        compacto
                      />
                      {puedeEditar && (
                        <Boton
                          variante={capturandoRfid ? 'primario' : 'secundario'}
                          tamano="sm"
                          icono={<Nfc size={14} className={capturandoRfid ? 'animate-pulse' : ''} />}
                          cargando={capturandoRfid}
                          onClick={() => {
                            if (capturandoRfid) {
                              // Cancelar captura
                              setCapturandoRfid(false)
                              return
                            }
                            setCapturandoRfid(true)
                            // Simular captura — en producción escucharía eventos del lector USB
                            // Por ahora genera un código hex aleatorio después de 2s
                            setTimeout(() => {
                              const codigo = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
                              setMiembro(p => p ? { ...p, kiosco_rfid: codigo } : null)
                              guardarMiembroInmediato({ kiosco_rfid: codigo })
                              setCapturandoRfid(false)
                            }, 2000)
                          }}
                        >
                          {capturandoRfid ? 'Capturando...' : 'Capturar'}
                        </Boton>
                      )}
                    </div>
                    <p className="text-xs text-texto-terciario mt-1">
                      {capturandoRfid
                        ? 'Pasá el llavero por el lector USB ahora...'
                        : 'Hacé clic en "Capturar" y luego pasá el llavero por el lector USB.'
                      }
                    </p>
                  </div>

                  {/* PIN del Kiosco — 6 dígitos */}
                  <div>
                    <p className="text-sm font-semibold text-texto-primario mb-1">PIN del kiosco <span className="font-normal text-texto-terciario">(6 dígitos)</span></p>
                    <div className="flex items-center gap-2">
                      <div className="max-w-[180px]">
                        <Input
                          tipo={pinVisible ? 'text' : 'password'}
                          value={miembro.kiosco_pin || ''}
                          onChange={(e) => setMiembro(p => p ? { ...p, kiosco_pin: e.target.value.replace(/\D/g, '').slice(0, 6) } : null)}
                          onBlur={() => guardarMiembro({ kiosco_pin: miembro.kiosco_pin || null })}
                          placeholder="000000"
                          formato={null}
                          disabled={!puedeEditar}
                          compacto
                          iconoDerecho={
                            <button
                              type="button"
                              onClick={() => setPinVisible(v => !v)}
                              className="bg-transparent border-none cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors p-0"
                            >
                              {pinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          }
                        />
                      </div>
                      {puedeEditar && (
                        <Boton
                          variante="fantasma"
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
                      )}
                    </div>
                    <p className="text-xs text-texto-terciario mt-1">Alternativa al llavero para emergencias. Ej: últimos 6 dígitos del DNI.</p>
                  </div>

                  {/* Foto para kiosco — formato vertical 3:4 */}
                  <div>
                    <p className="text-sm font-semibold text-texto-primario mb-1">Foto para kiosco</p>
                    <p className="text-xs text-texto-terciario mb-3">Foto vertical tipo carnet que se muestra en la pantalla del kiosco al fichar.</p>
                    <div className="flex items-start gap-4">
                      <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" id="foto-kiosco-upload"
                        onChange={(e) => {
                          const archivo = e.target.files?.[0]
                          if (!archivo) return
                          const url = URL.createObjectURL(archivo)
                          setRecortador({ imagen: url, tipo: 'kiosco' })
                          e.target.value = ''
                        }}
                      />
                      <div className="w-28 shrink-0">
                        {miembro.foto_kiosco_url ? (
                          <div className="relative group">
                            <img
                              src={miembro.foto_kiosco_url}
                              alt="Foto kiosco"
                              className="w-28 aspect-[3/4] object-cover rounded-lg border border-borde-sutil"
                            />
                            <button
                              onClick={() => setRecortador({ imagen: miembro.foto_kiosco_url!, tipo: 'kiosco' })}
                              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer border-none transition-opacity"
                              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                            >
                              <Camera size={18} className="text-white" />
                            </button>
                            {/* Eliminar foto kiosco */}
                            <button
                              onClick={async () => {
                                setMiembro(p => p ? { ...p, foto_kiosco_url: null } : null)
                                guardarMiembroInmediato({ foto_kiosco_url: null })
                              }}
                              className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-insignia-peligro flex items-center justify-center cursor-pointer border-2 border-superficie-tarjeta opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Eliminar foto"
                            >
                              <X size={10} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor="foto-kiosco-upload"
                            className="w-28 aspect-[3/4] rounded-lg border-2 border-dashed border-borde-fuerte flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-superficie-hover/30 hover:border-texto-marca/30 transition-all"
                          >
                            <Camera size={20} className="text-texto-terciario" />
                            <span className="text-xxs text-texto-terciario">Subir foto</span>
                          </label>
                        )}
                      </div>
                      <div className="text-xs text-texto-terciario space-y-1 pt-1">
                        <p>Formato vertical (3:4), tipo carnet</p>
                        <p>Se muestra al fichar en el kiosco</p>
                        <p>JPG o PNG, máx 2 MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 5. CONTACTO DE EMERGENCIA — conectado a BD ── */}
              <section>
                <SeccionEncabezado icono={<Heart size={15} />} titulo="Contacto de emergencia" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input tipo="text" formato="nombre_persona" etiqueta="Nombre" value={(contactoEmergencia?.nombre as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, nombre: e.target.value }))} onBlur={(e) => guardarEmergencia('nombre', e.target.value)} placeholder="Nombre completo" disabled={!puedeEditar} />
                  <Input tipo="text" etiqueta="Relación" value={(contactoEmergencia?.relacion as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, relacion: e.target.value }))} onBlur={(e) => guardarEmergencia('relacion', e.target.value)} placeholder="Padre, madre, pareja..." disabled={!puedeEditar} />
                  <Input tipo="tel" etiqueta="Teléfono" value={(contactoEmergencia?.telefono as string) || ''} onChange={(e) => setContactoEmergencia(p => ({ ...p, telefono: e.target.value }))} onBlur={(e) => guardarEmergencia('telefono', e.target.value)} placeholder="+54 11 1234-5678" icono={<Phone size={15} />} disabled={!puedeEditar} />
                  <div className="sm:col-span-2">
                    <BloqueDireccion
                      etiqueta="Dirección"
                      valorInicial={typeof contactoEmergencia?.direccion === 'object' ? contactoEmergencia.direccion as Partial<DatosDireccion> | null : contactoEmergencia?.direccion ? { textoCompleto: contactoEmergencia.direccion as string, calle: contactoEmergencia.direccion as string } : null}
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

              {/* ── 6. INFORMACIÓN BANCARIA — conectada a BD ── */}
              <section>
                <SeccionEncabezado icono={<CreditCard size={15} />} titulo="Información bancaria" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select etiqueta="Tipo de cuenta" opciones={[{ valor: '', etiqueta: 'No especificado' }, { valor: 'cbu', etiqueta: 'CBU — Cuenta bancaria' }, { valor: 'cvu', etiqueta: 'CVU — Cuenta virtual' }]} valor={(infoBancaria?.tipo_cuenta as string) || ''} onChange={(v) => guardarInfoBancaria('tipo_cuenta', v)} />
                  <Input tipo="text" formato="nombre_empresa" etiqueta={t('usuarios.banco')} value={(infoBancaria?.banco as string) || ''} onChange={(e) => setInfoBancaria(p => ({ ...p, banco: e.target.value }))} onBlur={(e) => guardarInfoBancaria('banco', e.target.value)} placeholder="Banco Nación, Mercado Pago..." disabled={!puedeEditar} />
                  <Input tipo="text" etiqueta={t('usuarios.cbu')} value={(infoBancaria?.numero_cuenta as string) || ''} onChange={(e) => setInfoBancaria(p => ({ ...p, numero_cuenta: e.target.value }))} onBlur={(e) => guardarInfoBancaria('numero_cuenta', e.target.value)} placeholder="Número de cuenta" formato={null} disabled={!puedeEditar} />
                  <Input tipo="text" etiqueta={t('usuarios.alias_bancario')} value={(infoBancaria?.alias as string) || ''} onChange={(e) => setInfoBancaria(p => ({ ...p, alias: e.target.value }))} onBlur={(e) => guardarInfoBancaria('alias', e.target.value)} placeholder="mi.alias.mp" formato="minusculas" disabled={!puedeEditar} />
                </div>
              </section>

              {/* ── 7. DOCUMENTOS ── */}
              <section id="seccion-documentos">
                <SeccionEncabezado icono={<FileText size={15} />} titulo="Documentos" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TIPOS_DOCUMENTOS.map(doc => {
                    const docExistente = documentosUsuario.find(d => (d.tipo as string) === doc)
                    const previewLocal = archivosDocLocal[doc]
                    const imgUrl = previewLocal?.url || (docExistente?.url as string | undefined) || null

                    return (
                      <div key={doc} className={`flex flex-col rounded-xl overflow-hidden border-2 transition-all ${imgUrl ? 'border-insignia-exito/40' : 'border-dashed border-borde-fuerte hover:border-texto-marca/30'}`}>

                        {/* Input oculto */}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" id={`doc-${doc}`}
                          onChange={async (e) => {
                            const archivo = e.target.files?.[0]
                            if (!archivo || !empresa) return
                            const previewUrl = archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null
                            setArchivosDocLocal(prev => ({ ...prev, [doc]: { nombre: archivo.name, url: previewUrl, subiendo: true } }))
                            const ext = archivo.name.split('.').pop() || 'jpg'
                            const ruta = `${empresa.id}/${miembroId}/docs/${doc.replace(/\s/g, '_').toLowerCase()}.${ext}`
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

                        {/* Área de imagen / placeholder — tamaño fijo */}
                        {imgUrl ? (
                          <div
                            className="relative aspect-[4/3] cursor-pointer group"
                            onClick={(e) => { e.preventDefault(); setDocPreview({ titulo: doc, url: imgUrl }) }}
                          >
                            <img src={imgUrl} alt={doc} className="w-full h-full object-contain bg-superficie-hover/30" />
                            {/* Overlay hover para ver */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {/* Spinner subiendo */}
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
                            <label htmlFor={`doc-${doc}`} className="shrink-0 cursor-pointer text-texto-terciario hover:text-texto-secundario transition-colors" title="Reemplazar">
                              <Pencil size={11} />
                            </label>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════════════════════
              TAB PAGOS
              ═══════════════════════════════ */}
          {tab === 'pagos' && (
            <div className="space-y-6">

              {/* ── COMPENSACIÓN — acordeón: click para expandir, click afuera para cerrar ── */}
              <div ref={compensacionRef}>
                <Tarjeta titulo={t('usuarios.compensacion')} acciones={puedeEditar && !compensacionAbierta ? <Boton variante="fantasma" tamano="xs" icono={<Pencil size={13} />} onClick={() => setCompensacionAbierta(true)}>Editar</Boton> : undefined}>
                  <AnimatePresence mode="wait">
                    {!compensacionAbierta ? (
                      /* ── RESUMEN COMPACTO ── */
                      <motion.div
                        key="resumen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => puedeEditar && setCompensacionAbierta(true)}
                        className={puedeEditar ? 'cursor-pointer' : ''}
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <Insignia color={compensacionTipo === 'por_dia' ? 'info' : compensacionTipo === 'por_hora' ? 'cyan' : 'primario'}>
                            {compensacionTipo === 'por_dia' ? 'Cobra por día' : compensacionTipo === 'por_hora' ? 'Cobra por hora' : 'Sueldo fijo'}
                          </Insignia>
                          <Insignia color="neutro">{
                            compensacionFrecuencia === 'semanal' ? 'Semanal' :
                            compensacionFrecuencia === 'quincenal' ? 'Quincenal' :
                            compensacionFrecuencia === 'eventual' ? 'Eventual' : 'Mensual'
                          }</Insignia>
                          <Insignia color="neutro">
                            {diasTrabajo === 7 ? '7/7' : diasTrabajo === 6 ? 'L-S' : diasTrabajo === 5 ? 'L-V' : `${diasTrabajo} días`}
                          </Insignia>
                        </div>

                        {compensacionMonto > 0 ? (
                          <div>
                            {/* Monto principal grande */}
                            <p className="text-xs text-texto-terciario uppercase tracking-wide">
                              {compensacionTipo === 'fijo' ? 'Sueldo mensual' : `${fmt.moneda(compensacionMonto)}/${compensacionTipo === 'por_hora' ? 'hora' : 'día'}`}
                            </p>
                            <p className="text-4xl font-bold text-texto-primario mt-1">
                              {compensacionTipo === 'fijo' ? fmt.moneda(compensacionMonto) : <>{fmt.moneda(proyeccionMensual)}<span className="text-lg font-normal text-texto-terciario">/mes</span></>}
                            </p>

                            {/* Desglose secundario */}
                            {compensacionTipo !== 'fijo' && (
                              <div className="flex items-center gap-4 mt-2 text-sm text-texto-terciario">
                                {compensacionFrecuencia !== 'mensual' && compensacionFrecuencia !== 'eventual' && (
                                  <span>
                                    ~{fmt.moneda(proyeccionPorFrecuencia)}
                                    <span className="text-texto-terciario/60">/{compensacionFrecuencia === 'quincenal' ? 'quincena' : 'semana'}</span>
                                  </span>
                                )}
                                <span className="text-texto-terciario/40">·</span>
                                <span className="text-texto-terciario/60">
                                  {diasTrabajo} días/sem × 4.33 sem
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-texto-terciario">Sin monto configurado</p>
                        )}
                      </motion.div>
                    ) : (
                      /* ── EXPANDIDO — edición ── */
                      <motion.div
                        key="edicion"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="space-y-6"
                      >
                        {/* Tipo */}
                        <div>
                          <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cómo se le paga a esta persona?</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja. El total depende de cuántos días asista.', icono: <CalendarDays size={20} /> },
                              { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo, sin importar los días que asista.', icono: <Landmark size={20} /> },
                            ].map(opcion => (
                              <button
                                key={opcion.valor}
                                onClick={() => {
                                  setMiembro(p => p ? { ...p, compensacion_tipo: opcion.valor as CompensacionTipo } : null)
                                  guardarMiembroInmediato({ compensacion_tipo: opcion.valor })
                                }}
                                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left cursor-pointer transition-all bg-transparent ${
                                  compensacionTipo === opcion.valor
                                    ? 'border-texto-marca bg-texto-marca/5'
                                    : 'border-borde-sutil hover:border-borde-fuerte'
                                }`}
                              >
                                <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  compensacionTipo === opcion.valor ? 'bg-texto-marca/15 text-texto-marca' : 'bg-superficie-hover text-texto-terciario'
                                }`}>
                                  {opcion.icono}
                                </div>
                                <div>
                                  <p className={`text-sm font-semibold ${compensacionTipo === opcion.valor ? 'text-texto-marca' : 'text-texto-primario'}`}>
                                    {opcion.titulo}
                                  </p>
                                  <p className="text-xs text-texto-terciario mt-0.5">{opcion.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Monto */}
                        <div>
                          <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">
                            {compensacionTipo === 'por_dia' ? '¿Cuánto gana por día trabajado?' : '¿Cuánto gana por período completo?'}
                          </p>
                          <div className="max-w-sm">
                            <Input
                              tipo="number"
                              value={String(miembro?.compensacion_monto || '')}
                              onChange={(e) => setMiembro(p => p ? { ...p, compensacion_monto: parseFloat(e.target.value) || null } : null)}
                              onBlur={(e) => guardarMiembroInmediato({ compensacion_monto: parseFloat(e.target.value) || null })}
                              icono={<DollarSign size={16} />}
                              formato={null}
                              placeholder="40000"
                            />
                          </div>
                          {compensacionTipo !== 'fijo' && compensacionMonto > 0 && (
                            <p className="text-xs text-texto-terciario mt-2">
                              Proyección mensual: <span className="text-insignia-exito font-medium">{fmt.moneda(proyeccionMensual)}</span>
                              <span className="ml-1">({diasTrabajo} días/sem × 4.33 semanas)</span>
                            </p>
                          )}
                        </div>

                        {/* Frecuencia */}
                        <div>
                          <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cada cuánto cobra esta persona?</p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { valor: 'semanal', etiqueta: 'Semanal', icono: <Calendar size={14} /> },
                              { valor: 'quincenal', etiqueta: 'Quincenal', icono: <CalendarDays size={14} /> },
                              { valor: 'mensual', etiqueta: 'Mensual', icono: <CalendarDays size={14} /> },
                              { valor: 'eventual', etiqueta: 'Eventual', icono: <CalendarDays size={14} /> },
                            ].map(f => (
                              <button
                                key={f.valor}
                                onClick={() => {
                                  setMiembro(p => p ? { ...p, compensacion_frecuencia: f.valor as CompensacionFrecuencia } : null)
                                  guardarMiembroInmediato({ compensacion_frecuencia: f.valor })
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-all bg-transparent ${
                                  compensacionFrecuencia === f.valor
                                    ? 'border-texto-marca bg-texto-marca/10 text-texto-marca'
                                    : 'border-borde-sutil text-texto-secundario hover:border-borde-fuerte'
                                }`}
                              >
                                {f.icono}
                                {f.etiqueta}
                              </button>
                            ))}
                          </div>
                          {compensacionTipo !== 'fijo' && compensacionMonto > 0 && (
                            <div className="mt-3 p-3 bg-superficie-hover/50 rounded-lg">
                              <p className="text-sm text-texto-secundario">
                                Cobro {ETIQUETA_FRECUENCIA[compensacionFrecuencia] || 'mensual'} estimado:{' '}
                                <span className="text-insignia-exito font-bold text-base">{fmt.moneda(proyeccionPorFrecuencia)}</span>
                              </p>
                              {compensacionFrecuencia !== 'mensual' && (
                                <p className="text-xs text-texto-terciario mt-1">
                                  Proyección mensual: {fmt.moneda(proyeccionMensual)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Días por semana */}
                        <div>
                          <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cuántos días por semana trabaja esta persona?</p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { valor: 1, etiqueta: '1', sub: '1 día' },
                              { valor: 2, etiqueta: '2', sub: '2 días' },
                              { valor: 3, etiqueta: '3', sub: '3 días' },
                              { valor: 4, etiqueta: '4', sub: '4 días' },
                              { valor: 5, etiqueta: 'L-V', sub: 'Lunes a Viernes' },
                              { valor: 6, etiqueta: 'L-S', sub: 'Lunes a Sábado' },
                              { valor: 7, etiqueta: '7/7', sub: 'Todos los días' },
                            ].map(d => (
                              <button
                                key={d.valor}
                                onClick={() => {
                                  setMiembro(p => p ? { ...p, dias_trabajo: d.valor } : null)
                                  guardarMiembroInmediato({ dias_trabajo: d.valor })
                                }}
                                className={`flex flex-col items-center px-3 py-2 rounded-lg border text-center cursor-pointer transition-all min-w-[60px] bg-transparent ${
                                  diasTrabajo === d.valor
                                    ? 'border-texto-marca bg-texto-marca/10 text-texto-marca'
                                    : 'border-borde-sutil text-texto-secundario hover:border-borde-fuerte'
                                }`}
                              >
                                <span className="text-sm font-bold">{d.etiqueta}</span>
                                <span className="text-xxs text-texto-terciario mt-0.5">{d.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Tarjeta>
              </div>

              {/* ── PERÍODO ACTUAL ── */}
              <Tarjeta
                titulo={`Período actual — ${periodoActual.etiqueta}`}
                acciones={puedeEditar ? (
                  <Boton
                    variante="primario"
                    tamano="sm"
                    icono={<Banknote size={15} />}
                    onClick={() => setModalLiquidacion(true)}
                  >
                    Pagar
                  </Boton>
                ) : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-texto-primario">
                        {statsPeriodo.trabajados}<span className="text-sm font-normal text-texto-terciario">/{statsPeriodo.habiles}</span>
                      </p>
                      <p className="text-xs text-texto-terciario uppercase">Trabajados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-insignia-peligro">{statsPeriodo.ausentes}</p>
                      <p className="text-xs text-texto-terciario uppercase">Ausencias</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-insignia-advertencia">{statsPeriodo.tardanzas}</p>
                      <p className="text-xs text-texto-terciario uppercase">Tardanzas</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-texto-terciario">A pagar</p>
                    <p className="text-2xl font-bold text-insignia-exito">{fmt.moneda(montoPagar)}</p>
                    {compensacionTipo === 'por_dia' && (
                      <p className="text-xs text-texto-terciario">{fmt.moneda(compensacionMonto)} × {statsPeriodo.trabajados} días</p>
                    )}
                  </div>
                </div>
              </Tarjeta>

              {/* ── HISTORIAL DE PAGOS ── */}
              <Tarjeta
                titulo="Historial de pagos"
                acciones={puedeEditar ? (
                  <Boton variante="fantasma" tamano="xs" icono={<Plus size={14} />} onClick={() => setModalLiquidacion(true)}>
                    Registrar pago
                  </Boton>
                ) : undefined}
              >
                {cargandoPagos ? (
                  <div className="py-8 text-center text-sm text-texto-terciario">Cargando pagos...</div>
                ) : pagos.length === 0 ? (
                  <div className="py-8 text-center">
                    <Banknote size={32} className="text-texto-terciario/30 mx-auto mb-2" />
                    <p className="text-sm text-texto-terciario">No hay pagos registrados para este usuario.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-borde-sutil">
                    {pagos.map((pago) => (
                      <div key={pago.id as string} className="flex items-center gap-4 py-3">
                        {/* Ícono */}
                        <div className="size-10 rounded-lg bg-insignia-exito-fondo flex items-center justify-center shrink-0">
                          <Receipt size={16} className="text-insignia-exito-texto" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-texto-primario truncate">{pago.concepto as string}</p>
                          <p className="text-xs text-texto-terciario">
                            {fmt.fecha(pago.fecha_inicio_periodo as string, { corta: true })}
                            {' — '}
                            {fmt.fecha(pago.fecha_fin_periodo as string)}
                            {(pago.dias_trabajados as number) > 0 && (
                              <span className="ml-2">· {pago.dias_trabajados as number} días trabajados</span>
                            )}
                          </p>
                        </div>

                        {/* Monto */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-insignia-exito">{fmt.moneda(pago.monto_abonado as number)}</p>
                          {(pago.monto_sugerido as number) && (pago.monto_abonado as number) !== (pago.monto_sugerido as number) && (
                            <p className="text-xxs text-texto-terciario line-through">{fmt.moneda(pago.monto_sugerido as number)}</p>
                          )}
                        </div>

                        {/* Fecha registro + acciones */}
                        <div className="text-right shrink-0">
                          <p className="text-xs text-texto-terciario">
                            {fmt.fecha(pago.creado_en as string, { corta: true })}
                          </p>
                          <p className="text-xxs text-texto-terciario">{pago.creado_por_nombre as string}</p>
                        </div>

                        {/* Eliminar */}
                        {esPropietario && (
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            soloIcono
                            icono={<Trash2 size={13} />}
                            onClick={() => eliminarPago(pago.id as string)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Tarjeta>

              {/* ── MODAL REGISTRAR LIQUIDACIÓN ── */}
              <Modal
                abierto={modalLiquidacion}
                onCerrar={() => {
                  setModalLiquidacion(false)
                  setLiqConcepto(''); setLiqMonto(''); setLiqNotas('')
                  setArchivoComprobante(null); setPeriodoModal(null)
                  setRangoPersonalizado(false)
                }}
                titulo="Registrar Liquidación"
                tamano="lg"
                acciones={
                  <div className="flex items-center gap-3 w-full">
                    <Boton
                      variante="primario"
                      icono={<Banknote size={16} />}
                      cargando={guardandoPago || subiendoComprobante}
                      onClick={registrarPago}
                    >
                      Registrar Pago
                    </Boton>
                    <Boton
                      variante="fantasma"
                      onClick={() => {
                        setModalLiquidacion(false)
                        setLiqConcepto(''); setLiqMonto(''); setLiqNotas('')
                        setArchivoComprobante(null); setPeriodoModal(null)
                        setRangoPersonalizado(false)
                      }}
                    >
                      Cancelar
                    </Boton>
                  </div>
                }
              >
                <div className="space-y-6">
                  {/* ── Navegador de período ── */}
                  <div>
                    <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-2">Período a liquidar</p>
                    <div className="bg-superficie-hover/50 rounded-xl border border-borde-sutil p-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => periodoModal && setPeriodoModal(navegarPeriodo(periodoModal, 'anterior', compensacionFrecuencia))}
                          className="size-9 rounded-lg border border-borde-sutil flex items-center justify-center text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors bg-transparent cursor-pointer"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <div className="text-center">
                          <p className="text-base font-bold text-texto-primario">{periodoModal?.etiqueta}</p>
                          <p className="text-xs text-texto-terciario mt-0.5">
                            {periodoModal && `${fmt.fecha(periodoModal.inicio)} — ${fmt.fecha(periodoModal.fin)}`}
                          </p>
                        </div>

                        <button
                          onClick={() => periodoModal && setPeriodoModal(navegarPeriodo(periodoModal, 'siguiente', compensacionFrecuencia))}
                          className="size-9 rounded-lg border border-borde-sutil flex items-center justify-center text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors bg-transparent cursor-pointer"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      {/* Rango personalizado */}
                      <button
                        onClick={() => setRangoPersonalizado(p => !p)}
                        className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-secundario mt-3 mx-auto bg-transparent border-none cursor-pointer transition-colors"
                      >
                        <ChevronDown size={12} className={`transition-transform ${rangoPersonalizado ? 'rotate-180' : ''}`} />
                        Elegir rango personalizado
                      </button>

                      <AnimatePresence>
                        {rangoPersonalizado && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-borde-sutil">
                              <SelectorFecha
                                etiqueta="Desde"
                                valor={rangoInicio || null}
                                onChange={(v) => {
                                  const nuevo = v || ''
                                  setRangoInicio(nuevo)
                                  if (nuevo && rangoFin) aplicarRangoCustom(nuevo, rangoFin)
                                }}
                                placeholder="Fecha inicio"
                              />
                              <SelectorFecha
                                etiqueta="Hasta"
                                valor={rangoFin || null}
                                onChange={(v) => {
                                  const nuevo = v || ''
                                  setRangoFin(nuevo)
                                  if (rangoInicio && nuevo) aplicarRangoCustom(rangoInicio, nuevo)
                                }}
                                placeholder="Fecha fin"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* ── Resumen del período ── */}
                  <div className="bg-superficie-hover/50 rounded-xl border border-borde-sutil p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="size-6 rounded bg-texto-marca/15 flex items-center justify-center">
                        <CalendarDays size={13} className="text-texto-marca" />
                      </div>
                      <p className="text-xs text-texto-terciario uppercase tracking-wide font-bold">Resumen del período</p>
                    </div>

                    {cargandoAsistencias ? (
                      <div className="py-4 text-center text-sm text-texto-terciario">Calculando...</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-4 text-center mb-4">
                          <div>
                            <p className="text-2xl font-black text-texto-primario">{statsPeriodo.habiles}</p>
                            <div className="h-px bg-borde-sutil my-1.5" />
                            <p className="text-xxs text-texto-terciario uppercase font-semibold">Hábiles</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-insignia-exito">{statsPeriodo.trabajados}</p>
                            <div className="h-px bg-insignia-exito/30 my-1.5" />
                            <p className="text-xxs text-texto-terciario uppercase font-semibold">Trabajados</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-insignia-peligro">{statsPeriodo.ausentes}</p>
                            <div className="h-px bg-insignia-peligro/30 my-1.5" />
                            <p className="text-xxs text-texto-terciario uppercase font-semibold">Ausencias</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-insignia-advertencia">{statsPeriodo.tardanzas}</p>
                            <div className="h-px bg-insignia-advertencia/30 my-1.5" />
                            <p className="text-xxs text-texto-terciario uppercase font-semibold">Tardanzas</p>
                          </div>
                        </div>

                        <div className="border-t border-borde-sutil pt-3 flex items-center justify-between">
                          <div>
                            <p className="text-xxs text-texto-terciario uppercase font-semibold">Monto sugerido</p>
                            <p className="text-xs text-texto-terciario">
                              {compensacionTipo === 'por_dia'
                                ? `${fmt.moneda(compensacionMonto)} × ${statsPeriodo.trabajados} días`
                                : compensacionTipo === 'por_hora'
                                  ? `${fmt.moneda(compensacionMonto)}/h × 8h × ${statsPeriodo.trabajados} días`
                                  : 'Sueldo fijo'
                              }
                            </p>
                          </div>
                          <p className="text-2xl font-black text-insignia-exito">{fmt.moneda(montoPagar)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Concepto y Monto en grilla ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      tipo="text"
                      etiqueta="Concepto"
                      value={liqConcepto}
                      onChange={(e) => setLiqConcepto(e.target.value)}
                      placeholder={periodoModal?.etiqueta || ''}
                    />
                    <Input
                      tipo="number"
                      etiqueta="Monto a pagar"
                      value={liqMonto}
                      onChange={(e) => setLiqMonto(e.target.value)}
                      icono={<DollarSign size={15} />}
                      formato={null}
                      placeholder={String(montoPagar)}
                    />
                  </div>

                  {/* ── Comprobante con upload real ── */}
                  <div>
                    <label className="text-sm font-medium text-texto-secundario mb-1 block">Comprobante (opcional)</label>
                    <input
                      ref={inputComprobanteRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0]
                        if (archivo) setArchivoComprobante(archivo)
                      }}
                    />
                    {archivoComprobante ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-borde-sutil bg-superficie-hover/30">
                        <div className="size-10 rounded-lg bg-insignia-exito-fondo flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-insignia-exito-texto" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-texto-primario truncate">{archivoComprobante.name}</p>
                          <p className="text-xxs text-texto-terciario">{(archivoComprobante.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Boton
                          variante="fantasma"
                          tamano="xs"
                          soloIcono
                          icono={<X size={14} />}
                          onClick={() => { setArchivoComprobante(null); if (inputComprobanteRef.current) inputComprobanteRef.current.value = '' }}
                        />
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Subir comprobante de pago"
                        onClick={() => inputComprobanteRef.current?.click()}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputComprobanteRef.current?.click() }}
                        className="border-2 border-dashed border-borde-fuerte rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-superficie-hover/30 hover:border-texto-marca/30 transition-all cursor-pointer"
                      >
                        <FileUp size={20} className="text-texto-terciario" />
                        <span className="text-sm font-medium text-texto-secundario">Subir recibo o comprobante</span>
                        <span className="text-xxs text-texto-terciario/60">PDF, JPG o PNG</span>
                      </div>
                    )}
                  </div>
                </div>

              </Modal>
            </div>
          )}

          {/* ═══════════════════════════════
              TAB PERMISOS — usa SeccionPermisos (componente de matriz)
              ═══════════════════════════════ */}
          {tab === 'permisos' && miembro && (
            <SeccionPermisos
              miembroId={miembro.id as string}
              rol={rolActual}
              permisosCustomIniciales={miembro.permisos_custom ? (miembro.permisos_custom as PermisosMapa) : null}
              onGuardar={async (permisos) => {
                await guardarMiembroInmediato({ permisos_custom: permisos })
                setMiembro(prev => prev ? { ...prev, permisos_custom: permisos } : null)
              }}
              onRevocar={async (motivo) => {
                const res = await fetch(`/api/miembros/${miembro.id}/revocar`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ motivo }),
                })
                if (!res.ok) throw new Error('Error al revocar')
                setMiembro(prev => prev ? { ...prev, permisos_custom: {} } : null)
              }}
            />
          )}

        </motion.div>
      </AnimatePresence>

      {/* ══════ MODALES DE ACCIONES ══════ */}

      {/* Forzar nueva contraseña */}
      <Modal
        abierto={modalForzarPassword}
        onCerrar={() => { setModalForzarPassword(false); setNuevaPassword('') }}
        titulo="Forzar nueva contraseña"
        tamano="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-texto-terciario">
            Ingresá la nueva contraseña para <strong className="text-texto-primario">{nombreCompleto}</strong>. Se aplicará inmediatamente.
          </p>
          <Input
            tipo="password"
            etiqueta="Nueva contraseña"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
          <div className="flex gap-3 pt-2">
            <Boton
              variante="primario"
              icono={<KeyRound size={15} />}
              cargando={accionCargando === 'forzar-password'}
              onClick={() => ejecutarAccion('forzar-password')}
              disabled={nuevaPassword.length < 6}
            >
              Cambiar contraseña
            </Boton>
            <Boton variante="fantasma" onClick={() => { setModalForzarPassword(false); setNuevaPassword('') }}>
              Cancelar
            </Boton>
          </div>
        </div>
      </Modal>

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
            if (!empresa) return
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
                guardarPerfil({ avatar_url: url })
              }
            } else {
              const ruta = `${empresa.id}/${miembroId}/kiosco.jpg`
              await supabase.storage.from('usuarios').upload(ruta, blob, { upsert: true, contentType: 'image/jpeg' })
              const { data: urlData } = supabase.storage.from('usuarios').getPublicUrl(ruta)
              const url = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null
              if (url) {
                setMiembro(p => p ? { ...p, foto_kiosco_url: url } : null)
                guardarMiembroInmediato({ foto_kiosco_url: url })
              }
            }
          }}
        />
      )}

      {/* Vista previa de documento */}
      <Modal
        abierto={!!docPreview}
        onCerrar={() => setDocPreview(null)}
        titulo={docPreview?.titulo || ''}
        tamano="xl"
      >
        {docPreview && (
          <div className="flex flex-col items-center gap-4">
            <img src={docPreview.url} alt={docPreview.titulo} className="w-full max-h-[60vh] object-contain rounded-lg" />
            <a
              href={docPreview.url}
              download={docPreview.titulo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-texto-marca hover:underline flex items-center gap-1.5"
            >
              <FileUp size={14} />
              Descargar imagen
            </a>
          </div>
        )}
      </Modal>

      {/* Confirmar eliminación */}
      <ModalConfirmacion
        abierto={modalConfirmarEliminar}
        onCerrar={() => setModalConfirmarEliminar(false)}
        onConfirmar={() => ejecutarAccion('eliminar')}
        titulo={t('usuarios.eliminar_usuario')}
        descripcion={`¿Estás seguro de que querés eliminar a ${nombreCompleto} de la empresa? Esta acción no se puede deshacer. Se borrarán todos sus datos, pagos y documentos.`}
        tipo="peligro"
        etiquetaConfirmar="Eliminar"
        cargando={accionCargando === 'eliminar'}
      />
    </div>
  )
}
