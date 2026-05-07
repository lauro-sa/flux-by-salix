'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users, FileText, MessageSquare, CheckSquare,
  ArrowRight, Mail,
  Image, Mic, File, Video,
  BarChart3, LayoutDashboard,
  ClipboardList, Calendar, StickyNote, BellRing,
  AlertTriangle, Clock,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useFormato } from '@/hooks/useFormato'
import { useRol } from '@/hooks/useRol'
import type { Modulo, Accion } from '@/tipos'
import { useTraduccion } from '@/lib/i18n'
import { Insignia } from '@/componentes/ui/Insignia'
import { Cargador } from '@/componentes/ui/Cargador'
import { Boton } from '@/componentes/ui/Boton'

// Widgets del dashboard
import { WidgetPipeline } from './WidgetPipeline'
import { WidgetProductosTop } from './WidgetProductosTop'
import { WidgetPorVencer } from './WidgetPorVencer'
import { WidgetAsistencia } from './WidgetAsistencia'
import { WidgetInbox } from './WidgetInbox'
import { WidgetCobros } from './WidgetCobros'
import { WidgetDetalleCobrosMes } from './WidgetDetalleCobrosMes'
import { WidgetComparativa } from './WidgetComparativa'
import { WidgetClientes } from './WidgetClientes'
import { WidgetRecientes } from './WidgetRecientes'
import { WidgetMisOrdenes } from './WidgetMisOrdenes'
import { WidgetOrdenesPorGestionar } from './WidgetOrdenesPorGestionar'
import { WidgetOrdenesResumen } from './WidgetOrdenesResumen'
import { WidgetSueldos } from './WidgetSueldos'
import { WidgetAsistenciaMensual } from './WidgetAsistenciaMensual'
import { HeroResumen } from './HeroResumen'
import { WidgetMiRecorrido } from './WidgetMiRecorrido'
import { WidgetLeadsNuevos } from './WidgetLeadsNuevos'
import { WidgetVisitasPorPlanificar } from './WidgetVisitasPorPlanificar'
import { Widget } from '@/componentes/entidad/Widget'

/**
 * ContenidoDashboard — Client Component con toda la lógica del dashboard.
 * Carga datos via useEffect (fetch a las APIs internas).
 * Envuelto en Suspense desde el Server Component page.tsx.
 */

// ─── Tipos ───

/** Permisos efectivos del usuario para renderizar widgets condicionalmente.
 *  Los bloques `null` en `DatosDashboard` vienen del endpoint cuando el
 *  usuario no tiene permiso al módulo correspondiente. */
interface PermisosDashboard {
  contactos: boolean
  presupuestos: boolean
  actividades: boolean
  productos: boolean
  asistencias: boolean
  presupuestos_todos: boolean
  asistencias_todos: boolean
  ordenes_trabajo: boolean
  ordenes_trabajo_todos: boolean
  nomina_todos: boolean
  inbox_whatsapp: boolean
  inbox_correo: boolean
  inbox_interno: boolean
  inbox: boolean
}

interface DatosDashboard {
  permisos: PermisosDashboard
  contactos: {
    total: number
    recientes: Array<{ id: string; nombre: string; apellido?: string; correo?: string; telefono?: string; creado_en: string; tipo_clave?: string; tipo_etiqueta?: string; tipo_color?: string }>
    crecimiento_semanal: Array<{ semana: string; cantidad: number }>
  } | null
  presupuestos: {
    total: number
    por_estado: Record<string, number>
    recientes: Array<{ id: string; numero: string; estado: string; contacto_nombre?: string; contacto_apellido?: string; total?: number; creado_en: string }>
    pipeline_montos: Record<string, number>
    por_vencer: Array<{ id: string; numero: string; estado: string; contacto_nombre?: string; contacto_apellido?: string; total?: number; fecha_vencimiento: string }>
  } | null
  conversaciones: {
    abiertas: number
    por_canal: Record<string, number>
    sin_leer: number
  } | null
  actividades: {
    pendientes: Array<{ id: string; titulo: string; tipo_clave: string; estado_clave: string; prioridad: string; fecha_vencimiento: string | null; asignados: { id: string; nombre: string }[] }>
    total_pendientes: number
    total_hoy: number
    completadas_hoy: number
    por_persona: Array<{ nombre: string; pendientes: number; completadas: number }>
  } | null
  alertas: {
    recordatorios_hoy: number
    notas_con_cambios: number
  }
  productos: {
    top: Array<{ id: string; nombre: string; tipo: string; precio_unitario: number | null; veces_presupuestado: number; veces_vendido: number }>
  } | null
  asistencia: {
    hoy: { presentes: number; ausentes: number; tardanzas: number; total: number } | null
    detalle_hoy: Array<{
      id: string; miembro_id: string; usuario_id: string; nombre: string; estado: string; tipo: string
      hora_entrada: string | null; hora_salida: string | null; puntualidad_min: number | null
      metodo_registro: string; sector: string | null; puesto: string | null; rol: string | null
    }>
    semana: Record<string, { presentes: number; ausentes: number; tardanzas: number }>
    usuario_id: string
  } | null
  ingresos: {
    por_mes: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
    por_anio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
    detalle_mes_actual: Array<{ id: string; numero: string; estado: string; contacto_nombre: string | null; contacto_apellido: string | null; total: number; fecha: string }>
  } | null
  cobros: {
    cobrado_por_mes: Record<string, { cantidad: number; monto: number }>
    proyeccion_por_mes: Record<string, { cantidad: number; monto: number }>
    detalle: Array<{
      pago_id: string | null
      presupuesto_id: string
      presupuesto_numero: string
      presupuesto_total: number
      presupuesto_saldo: number
      presupuesto_subtotal_neto: number
      presupuesto_total_impuestos: number
      presupuesto_fecha_aceptacion: string | null
      presupuesto_estado: string
      presupuesto_cuotas_count: number
      presupuesto_cuotas_cobradas: number
      contacto_nombre: string | null
      contacto_apellido: string | null
      fecha_pago: string
      monto: number
      monto_neto: number
      monto_iva: number
      cuota_numero: number | null
      cuota_descripcion: string | null
      metodo: string | null
      tipo_estimacion: 'real' | 'completado_total' | 'orden_venta_adelanto' | 'sin_cobros'
    }>
  } | null
  comparativa: {
    presupuestos_por_mes: Record<string, { creados: number; monto_total: number }>
    contactos_por_mes: Record<string, number>
  } | null
  clientes: {
    activos_por_tipo: Record<string, { etiqueta: string; cantidad: number }>
    total_activos: number
    nuevos_por_mes: Record<string, Record<string, number>>
  } | null
  mensajes_recientes: Array<{
    id: string; texto: string | null; remitente_nombre: string | null; remitente_tipo: string
    es_entrante: boolean; tipo_contenido: string; correo_asunto: string | null; correo_de: string | null
    creado_en: string; conversacion_id: string; tipo_canal: string; contacto_nombre: string | null
    nombre_canal: string | null
  }>
  actividades_proximas: Array<{
    id: string; titulo: string; tipo_clave: string; estado_clave: string
    prioridad: string; fecha_vencimiento: string; asignados: { id: string; nombre: string }[]
  }>
  ordenes_trabajo: {
    por_estado: Record<string, number>
    completadas_mes: number
    tiempo_promedio_cierre_dias: number
    total: number
  } | null
  nomina: {
    sugerido_mes: number
    abonado_mes: number
    pendiente_mes: number
    cant_personas: number
    cant_pendientes: number
    adelantos_activos_personas: number
    adelantos_monto_total: number
  } | null
}

interface MetricasInbox {
  resumen: {
    mensajes_recibidos: number
    mensajes_enviados: number
    conversaciones_nuevas: number
    conversaciones_resueltas: number
    sla_cumplido_pct: number
    tiempo_respuesta_promedio_min: number
    tiempo_resolucion_promedio_hrs: number
  }
  por_agente: Array<{ nombre: string; asignadas: number; resueltas: number; sla_cumplido: number; sla_total: number }>
}

// ─── Helpers ───

function obtenerClaveSaludo(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'dashboard.saludos.buenos_dias'
  if (hora < 19) return 'dashboard.saludos.buenas_tardes'
  return 'dashboard.saludos.buenas_noches'
}

function obtenerNombreUsuario(usuario: { user_metadata?: Record<string, string> } | null): string {
  if (!usuario?.user_metadata) return ''
  return usuario.user_metadata.nombre || usuario.user_metadata.full_name?.split(' ')[0] || ''
}

function claveMesActual(): string {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
}

function claveMesAnterior(): string {
  const fecha = new Date(); fecha.setMonth(fecha.getMonth() - 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

const COLOR_ESTADO_PRESUPUESTO: Record<string, 'neutro' | 'info' | 'advertencia' | 'exito' | 'peligro' | 'naranja' | 'violeta'> = {
  borrador: 'neutro',
  enviado: 'violeta',
  confirmado_cliente: 'info',
  orden_venta: 'exito',
  aceptado: 'exito',
  rechazado: 'peligro',
  vencido: 'naranja',
  cancelado: 'neutro',
}

const COLOR_TIPO_CONTACTO: Record<string, string> = {
  persona: 'primario',
  empresa: 'info',
  edificio: 'cyan',
  proveedor: 'naranja',
  lead: 'advertencia',
  equipo: 'exito',
}

const ETIQUETA_ESTADO: Record<string, string> = {
  confirmado_cliente: 'Confirmado',
  orden_venta: 'Orden',
}

// ─── Animaciones ───

const contenedorVariantes = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariantes = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ─── Componente principal ───

export default function ContenidoDashboard() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { moneda, fechaRelativa, fecha: formatoFecha, locale: formatoLocale } = useFormato()
  const { tienePermiso } = useRol()
  const router = useRouter()

  // Acceso a inbox (WhatsApp / Correo / Interno): cualquiera de los tres
  // habilita el botón y el widget de mensajes recientes.
  const permisosInbox =
    tienePermiso('inbox_whatsapp', 'ver_propio') || tienePermiso('inbox_whatsapp', 'ver_todos') ||
    tienePermiso('inbox_correo', 'ver_propio')   || tienePermiso('inbox_correo', 'ver_todos') ||
    tienePermiso('inbox_interno', 'ver_propio')  || tienePermiso('inbox_interno', 'ver_todos')

  const [pestana, setPestana] = useState<'general' | 'metricas'>('general')
  const [datos, setDatos] = useState<DatosDashboard | null>(null)
  const [metricas, setMetricas] = useState<MetricasInbox | null>(null)
  const [cargando, setCargando] = useState(true)

  const claveSaludo = useMemo(() => obtenerClaveSaludo(), [])
  const nombre = useMemo(() => obtenerNombreUsuario(usuario), [usuario])

  useEffect(() => {
    if (!empresa) return
    const cargar = async () => {
      setCargando(true)
      try {
        const [resDash, resMetricas] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/inbox/metricas?desde=' + new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
        ])
        if (resDash.ok) setDatos(await resDash.json())
        if (resMetricas.ok) setMetricas(await resMetricas.json())
      } catch (err) {
        console.error('Error cargando dashboard:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [empresa])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Cargador tamano="pagina" />
      </div>
    )
  }

  // Fichaje del usuario actual (si existe) para mostrar estado arriba
  const miFichaje = datos?.asistencia?.detalle_hoy?.find(d => d.usuario_id === datos.asistencia?.usuario_id) ?? null

  return (
    <div className="px-4 sm:px-6 pt-3 sm:pt-5 pb-12">
      {/* ─── Header: Saludo + estado de jornada + Pestañas ─── */}
      <div className="mb-5 sm:mb-6">
        {/* Fila superior: saludo a la izquierda, pestañas a la derecha */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg sm:text-2xl font-bold text-texto-primario leading-tight min-w-0 truncate">
            {t(claveSaludo)}{nombre ? `, ${nombre}` : ''}
          </h1>

          {/* Pestañas: en mobile solo iconos compactos, en desktop texto + icono */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-superficie-hover/50 rounded-card p-0.5 shrink-0">
            <button
              onClick={() => setPestana('general')}
              className={`flex items-center gap-1.5 justify-center px-2 sm:px-3 h-8 text-xs font-medium rounded-boton transition-colors ${
                pestana === 'general'
                  ? 'bg-superficie-tarjeta text-texto-primario shadow-sm border border-borde-sutil'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
              aria-label="General"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">General</span>
            </button>
            <button
              onClick={() => setPestana('metricas')}
              className={`flex items-center gap-1.5 justify-center px-2 sm:px-3 h-8 text-xs font-medium rounded-boton transition-colors ${
                pestana === 'metricas'
                  ? 'bg-superficie-tarjeta text-texto-primario shadow-sm border border-borde-sutil'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
              aria-label="Métricas"
            >
              <BarChart3 size={13} />
              <span className="hidden sm:inline">Métricas</span>
            </button>
          </div>
        </div>

        {/* Fila inferior: empresa + jornada */}
        <p className="text-xs sm:text-sm text-texto-terciario mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
          <span className="truncate">{empresa ? (empresa as Record<string, unknown>).nombre as string : 'Flux by Salix'}</span>
          {miFichaje && <LineaJornada fichaje={miFichaje} />}
        </p>
      </div>

      {/* ─── Contenido por pestaña ─── */}
      <motion.div
        key={pestana}
        className="space-y-4 lg:space-y-5"
        variants={contenedorVariantes}
        initial="oculto"
        animate="visible"
      >
        {pestana === 'general' ? (
          <PestanaGeneral
            datos={datos}
            metricas={metricas}
            t={t}
            moneda={moneda}
            fechaRelativa={fechaRelativa}
            formatoFecha={formatoFecha}
            formatoLocale={formatoLocale}
            router={router}
            tienePermiso={tienePermiso}
            permisosInbox={permisosInbox}
          />
        ) : (
          <PestanaMetricas
            datos={datos}
            metricas={metricas}
            moneda={moneda}
          />
        )}
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// PESTAÑA GENERAL
// ═══════════════════════════════════════════════════════

function PestanaGeneral({
  datos, metricas: _metricas, t, moneda, fechaRelativa, formatoFecha, formatoLocale: _formatoLocale, router,
  tienePermiso, permisosInbox,
}: {
  datos: DatosDashboard | null
  metricas: MetricasInbox | null
  t: (k: string) => string
  moneda: (n: number) => string
  fechaRelativa: (f: string) => string
  formatoFecha: (fecha: Date | string, opciones?: { conHora?: boolean; corta?: boolean; soloMes?: boolean }) => string
  formatoLocale: string
  router: ReturnType<typeof useRouter>
  tienePermiso: (modulo: Modulo, accion: Accion) => boolean
  permisosInbox: boolean
}) {
  // Alertas accionables: solo las que tienen datos
  const actividadesVencidas = datos?.actividades?.pendientes.filter(a => a.fecha_vencimiento && new Date(a.fecha_vencimiento) < new Date()).length ?? 0
  const actividadesHoy = datos?.actividades?.total_hoy ?? 0
  const recordatoriosHoy = datos?.alertas?.recordatorios_hoy ?? 0
  const notasCambios = datos?.alertas?.notas_con_cambios ?? 0
  const borradores = datos?.presupuestos?.por_estado?.borrador ?? 0
  const sinLeer = datos?.conversaciones?.sin_leer ?? 0
  const porVencer = datos?.presupuestos?.por_vencer?.length ?? 0

  const chips: Array<{ icono: React.ReactNode; texto: string; color: string; onClick: () => void }> = []
  // Orden: vencidas → hoy → recordatorios → notas cambios → por vencer → sin leer → borradores
  if (actividadesVencidas > 0) chips.push({ icono: <AlertTriangle size={12} />, texto: `${actividadesVencidas} vencida${actividadesVencidas > 1 ? 's' : ''}`, color: 'text-insignia-peligro-texto bg-insignia-peligro-fondo border-insignia-peligro-fondo', onClick: () => router.push('/actividades?filtro=vencidas') })
  if (actividadesHoy > 0) chips.push({ icono: <CheckSquare size={12} />, texto: `${actividadesHoy} hoy`, color: 'text-insignia-exito-texto bg-insignia-exito-fondo border-insignia-exito-fondo', onClick: () => router.push('/actividades?fecha=hoy') })
  if (recordatoriosHoy > 0) chips.push({ icono: <BellRing size={12} />, texto: `${recordatoriosHoy} recordatorio${recordatoriosHoy > 1 ? 's' : ''}`, color: 'text-insignia-naranja-texto bg-insignia-naranja-fondo border-insignia-naranja-fondo', onClick: () => window.dispatchEvent(new Event('flux:abrir-recordatorios')) })
  if (notasCambios > 0) chips.push({ icono: <StickyNote size={12} />, texto: `${notasCambios} nota${notasCambios > 1 ? 's' : ''} con cambios`, color: 'text-insignia-primario-texto bg-insignia-primario-fondo border-insignia-primario-fondo', onClick: () => window.dispatchEvent(new Event('flux:abrir-notas')) })
  if (porVencer > 0) chips.push({ icono: <Clock size={12} />, texto: `${porVencer} por vencer`, color: 'text-insignia-advertencia-texto bg-insignia-advertencia-fondo border-insignia-advertencia-fondo', onClick: () => router.push('/presupuestos?filtro=por_vencer') })
  if (sinLeer > 0) chips.push({ icono: <Mail size={12} />, texto: `${sinLeer} sin leer`, color: 'text-insignia-violeta-texto bg-insignia-violeta-fondo border-insignia-violeta-fondo', onClick: () => router.push('/inbox') })
  if (borradores > 0) chips.push({ icono: <FileText size={12} />, texto: `${borradores} borrador${borradores > 1 ? 'es' : ''}`, color: 'text-texto-terciario bg-superficie-hover/50 border-borde-sutil', onClick: () => router.push('/presupuestos?estado=borrador') })

  return (
    <>
      {/* Chips de alerta accionables */}
      {chips.length > 0 && (
        <motion.div variants={itemVariantes} className="flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={c.onClick}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-boton border ${c.color} hover:opacity-80 transition-opacity cursor-pointer`}
            >
              {c.icono}
              {c.texto}
            </button>
          ))}
        </motion.div>
      )}

      {/* Bloque "Accionar ahora": widgets que dependen de rol/módulo */}
      {/* Cada widget además se auto-oculta si no hay datos (ver total === 0 → null) */}
      {/* Grid adaptable: aprovecha ancho en pantallas grandes para no scrollear de más */}
      <motion.div variants={itemVariantes} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
        {/* Recorrido del día: cualquier rol con módulo visitas activo y visitas asignadas hoy */}
        <Widget modulo="visitas">
          <WidgetMiRecorrido />
        </Widget>

        {/* Visitas por planificar: provisorias (IA) + sin asignar. Admin/gestor/supervisor/propietario */}
        <Widget modulo="visitas" rolEn={['propietario', 'administrador', 'gestor', 'supervisor']}>
          <WidgetVisitasPorPlanificar />
        </Widget>

        {/* Órdenes por gestionar: sin asignar o sin publicar. Admin/gestor/propietario */}
        <Widget modulo="ordenes_trabajo" rolEn={['propietario', 'administrador', 'gestor']}>
          <WidgetOrdenesPorGestionar />
        </Widget>

        {/* Mis órdenes pendientes: cualquier rol con el módulo activo; el endpoint aplica soloPropio */}
        <Widget modulo="ordenes_trabajo">
          <WidgetMisOrdenes />
        </Widget>

        {/* Leads nuevos: roles que manejan contactos comerciales */}
        <Widget rolEn={['propietario', 'administrador', 'gestor', 'supervisor', 'vendedor']}>
          <WidgetLeadsNuevos />
        </Widget>
      </motion.div>

      {/* Accesos rápidos — cada botón solo aparece si el usuario tiene permiso
          para CREAR ese tipo de registro o abrir el módulo correspondiente.
          "Nota" y "Recordatorio" son personales (no requieren módulo). */}
      <motion.div variants={itemVariantes} className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {tienePermiso('contactos', 'crear') && (
          <BotonRapido etiqueta={t('contactos.nuevo')} icono={<Users size={18} strokeWidth={1.5} />} colorIcono="text-insignia-primario-texto" colorFondo="bg-insignia-primario-fondo" onClick={() => router.push('/contactos/nuevo?desde=dashboard')} />
        )}
        {tienePermiso('presupuestos', 'crear') && (
          <BotonRapido etiqueta="Presupuesto" icono={<FileText size={18} strokeWidth={1.5} />} colorIcono="text-insignia-info-texto" colorFondo="bg-insignia-info-fondo" onClick={() => router.push('/presupuestos/nuevo?desde=dashboard')} />
        )}
        {tienePermiso('actividades', 'crear') && (
          <BotonRapido etiqueta="Actividad" icono={<CheckSquare size={18} strokeWidth={1.5} />} colorIcono="text-insignia-exito-texto" colorFondo="bg-insignia-exito-fondo" onClick={() => router.push('/actividades?crear=true')} />
        )}
        {/* Notas y recordatorios son personales — siempre disponibles */}
        <BotonRapido etiqueta="Nota" icono={<StickyNote size={18} strokeWidth={1.5} />} colorIcono="text-insignia-advertencia-texto" colorFondo="bg-insignia-advertencia-fondo" onClick={() => window.dispatchEvent(new Event('flux:abrir-notas'))} />
        <BotonRapido etiqueta="Recordatorio" icono={<BellRing size={18} strokeWidth={1.5} />} colorIcono="text-insignia-naranja-texto" colorFondo="bg-insignia-naranja-fondo" onClick={() => window.dispatchEvent(new Event('flux:abrir-recordatorios'))} />
        {tienePermiso('calendario', 'crear') && (
          <BotonRapido etiqueta="Evento" icono={<Calendar size={18} strokeWidth={1.5} />} colorIcono="text-insignia-violeta-texto" colorFondo="bg-insignia-violeta-fondo" onClick={() => router.push('/calendario?crear=true')} />
        )}
        {tienePermiso('productos', 'crear') && (
          <BotonRapido etiqueta="Producto" icono={<ClipboardList size={18} strokeWidth={1.5} />} colorIcono="text-texto-secundario" colorFondo="bg-superficie-hover" onClick={() => router.push('/productos?crear=true')} />
        )}
        {permisosInbox && (
          <BotonRapido etiqueta="Inbox" icono={<MessageSquare size={18} strokeWidth={1.5} />} colorIcono="text-texto-secundario" colorFondo="bg-superficie-hover" onClick={() => router.push('/inbox')} />
        )}
      </motion.div>

      {/* Historial reciente — ancho completo */}
      <motion.div variants={itemVariantes}>
        <WidgetRecientes />
      </motion.div>

      {/* Asistencia — ancho completo. Requiere asistencias:ver_todos para los
          totales del equipo; con solo ver_propio el widget se oculta. */}
      {datos?.asistencia?.hoy && datos.permisos.asistencias_todos && (datos.asistencia.hoy.total > 0 || Object.keys(datos.asistencia.semana).length > 0) && (
        <motion.div variants={itemVariantes}>
          <WidgetAsistencia
            hoy={datos.asistencia.hoy}
            detalle_hoy={datos.asistencia.detalle_hoy || []}
            semana={datos.asistencia.semana}
            usuario_id={datos.asistencia.usuario_id || ''}
          />
        </motion.div>
      )}

      {/* 4 tarjetas recientes — cada una se muestra solo si el usuario tiene
          permiso al módulo correspondiente (el endpoint devuelve null en caso
          contrario, así que hacemos doble chequeo: permiso + datos). */}
      <motion.div variants={itemVariantes} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {datos?.permisos?.presupuestos && (
          <TarjetaReciente
            titulo="Últimos presupuestos"
            icono={<FileText size={14} />}
            colorFondo="bg-insignia-info-fondo"
            colorIcono="text-insignia-info-texto"
            verTodo={() => router.push('/presupuestos')}
          >
            {datos?.presupuestos?.recientes && datos.presupuestos.recientes.length > 0 ? (
              datos.presupuestos.recientes.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => router.push(`/presupuestos/${p.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/presupuestos/${p.id}`) } }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-texto-primario">{p.numero}</span>
                      <Insignia color={COLOR_ESTADO_PRESUPUESTO[p.estado] || 'neutro'}>{ETIQUETA_ESTADO[p.estado] || p.estado}</Insignia>
                    </div>
                    <p className="text-xxs text-texto-terciario truncate mt-0.5">{[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {p.total != null && <p className="text-sm font-semibold text-texto-primario tabular-nums leading-tight">{moneda(p.total)}</p>}
                    <p className="text-xxs text-texto-terciario mt-0.5">{fechaRelativa(p.creado_en)}</p>
                  </div>
                </div>
              ))
            ) : <p className="text-xs text-texto-terciario text-center py-4">Sin presupuestos</p>}
          </TarjetaReciente>
        )}

        {datos?.permisos?.contactos && (
          <TarjetaReciente
            titulo="Últimos contactos"
            icono={<Users size={14} />}
            colorFondo="bg-insignia-primario-fondo"
            colorIcono="text-insignia-primario-texto"
            verTodo={() => router.push('/contactos')}
          >
            {datos?.contactos?.recientes && datos.contactos.recientes.length > 0 ? (
              datos.contactos.recientes.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => router.push(`/contactos/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/contactos/${c.id}`) } }}>
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="size-7 rounded-full bg-superficie-hover flex items-center justify-center text-xxs font-semibold text-texto-secundario shrink-0">
                      {(c.nombre?.[0] || '').toUpperCase()}{(c.apellido?.[0] || '').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-texto-primario truncate">{[c.nombre, c.apellido].filter(Boolean).join(' ')}</p>
                        {c.tipo_etiqueta && <Insignia color={(COLOR_TIPO_CONTACTO[c.tipo_clave || ''] || 'neutro') as 'neutro' | 'primario' | 'info' | 'exito' | 'naranja' | 'advertencia'}>{c.tipo_etiqueta}</Insignia>}
                      </div>
                      <p className="text-xxs text-texto-terciario truncate mt-0.5">{c.correo || c.telefono || ''}</p>
                    </div>
                  </div>
                  <span className="text-xxs text-texto-terciario shrink-0 ml-2">{fechaRelativa(c.creado_en)}</span>
                </div>
              ))
            ) : <p className="text-xs text-texto-terciario text-center py-4">Sin contactos</p>}
          </TarjetaReciente>
        )}

        {datos?.permisos?.actividades && (
          <TarjetaReciente
            titulo="Próximas actividades"
            icono={<CheckSquare size={14} />}
            colorFondo="bg-insignia-exito-fondo"
            colorIcono="text-insignia-exito-texto"
            verTodo={() => router.push('/actividades')}
          >
            {datos?.actividades_proximas && datos.actividades_proximas.length > 0 ? (
              datos.actividades_proximas.map(act => (
                <div key={act.id} className="flex items-center justify-between py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => router.push('/actividades')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/actividades') } }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-texto-primario truncate">{act.titulo}</span>
                      {act.prioridad === 'alta' && <Insignia color="peligro">!</Insignia>}
                    </div>
                    {Array.isArray(act.asignados) && act.asignados.length > 0 && (
                      <p className="text-xxs text-texto-terciario truncate mt-0.5">
                        {act.asignados.length === 1 ? act.asignados[0].nombre : `${act.asignados.map(a => a.nombre).join(', ')}`}
                      </p>
                    )}
                  </div>
                  <span className="text-xxs text-texto-terciario shrink-0 ml-2">
                    {formatoFecha(act.fecha_vencimiento, { corta: true })}
                  </span>
                </div>
              ))
            ) : <p className="text-xs text-texto-terciario text-center py-4">Sin actividades próximas</p>}
          </TarjetaReciente>
        )}

        {datos?.permisos?.inbox && (
          <TarjetaMensajesRecientes mensajes={datos?.mensajes_recientes || []} />
        )}
      </motion.div>
    </>
  )
}

// ═══════════════════════════════════════════════════════
// PESTAÑA MÉTRICAS
// ═══════════════════════════════════════════════════════

function PestanaMetricas({
  datos, metricas, moneda,
}: {
  datos: DatosDashboard | null
  metricas: MetricasInbox | null
  moneda: (n: number) => string
}) {
  return (
    <>
      {/* ─── Hero ejecutivo: 4 KPIs arriba de todo ─── */}

      {datos?.cobros && datos?.presupuestos && (
        <motion.div variants={itemVariantes}>
          <HeroResumen
            cobradoPorMes={datos.cobros.cobrado_por_mes}
            porEstado={datos.presupuestos.por_estado}
            pipelineMontos={datos.presupuestos.pipeline_montos}
            formatoMoneda={moneda}
          />
        </motion.div>
      )}

      {/* ─── Bloque financiero: cuánto entró (3 widgets full width) ─── */}

      {datos?.cobros && (
        <motion.div variants={itemVariantes}>
          <WidgetDetalleCobrosMes
            detalle={datos.cobros.detalle}
            formatoMoneda={moneda}
          />
        </motion.div>
      )}

      {datos?.cobros && (
        <motion.div variants={itemVariantes}>
          <WidgetCobros
            cobradoPorMes={datos.cobros.cobrado_por_mes}
            proyeccionPorMes={datos.cobros.proyeccion_por_mes}
            devengadoPorMes={datos.ingresos?.por_mes ?? {}}
            detalle={datos.cobros.detalle}
            formatoMoneda={moneda}
          />
        </motion.div>
      )}

      {/* Sueldos del mes (full width, navegable, con detalle por persona).
          El widget hace su propio fetch y maneja errores de permisos. */}
      <motion.div variants={itemVariantes}>
        <WidgetSueldos formatoMoneda={moneda} />
      </motion.div>

      {datos?.presupuestos && (
        <motion.div variants={itemVariantes}>
          <WidgetPipeline
            porEstado={datos.presupuestos.por_estado}
            pipelineMontos={datos.presupuestos.pipeline_montos}
            formatoMoneda={moneda}
          />
        </motion.div>
      )}

      {/* ─── Bloque comercial: tendencia + cartera (medianos lado a lado) ─── */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {datos?.comparativa && (
          <motion.div variants={itemVariantes}>
            <WidgetComparativa
              presupuestosPorMes={datos.comparativa.presupuestos_por_mes}
              contactosPorMes={datos.comparativa.contactos_por_mes}
              formatoMoneda={moneda}
            />
          </motion.div>
        )}
        {datos?.clientes && (
          <motion.div variants={itemVariantes}>
            <WidgetClientes
              activosPorTipo={datos.clientes.activos_por_tipo}
              totalActivos={datos.clientes.total_activos}
              nuevosPorMes={datos.clientes.nuevos_por_mes}
            />
          </motion.div>
        )}
      </div>

      {/* ─── Stat cards pequeñas: resúmenes operativos (3 por fila, mismo alto) ─── */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 items-stretch">
        {datos?.presupuestos && (
          <motion.div variants={itemVariantes} className="h-full">
            <WidgetPorVencer
              presupuestos={datos.presupuestos.por_vencer || []}
              formatoMoneda={moneda}
            />
          </motion.div>
        )}
        {datos?.ordenes_trabajo && datos.ordenes_trabajo.total > 0 && (
          <motion.div variants={itemVariantes} className="h-full">
            <WidgetOrdenesResumen
              porEstado={datos.ordenes_trabajo.por_estado}
              completadasMes={datos.ordenes_trabajo.completadas_mes}
              tiempoPromedioCierreDias={datos.ordenes_trabajo.tiempo_promedio_cierre_dias}
              total={datos.ordenes_trabajo.total}
            />
          </motion.div>
        )}
        {metricas && (
          <motion.div variants={itemVariantes} className="h-full">
            <WidgetInbox resumen={metricas.resumen} porAgente={metricas.por_agente} />
          </motion.div>
        )}
      </div>

      {/* ─── Asistencia del equipo (full width, navegable mes a mes) ─── */}

      {datos?.permisos?.asistencias_todos && (
        <motion.div variants={itemVariantes}>
          <WidgetAsistenciaMensual />
        </motion.div>
      )}

      {/* ─── Catálogo: ranking de productos (al final, mediano full width) ─── */}

      {datos?.productos?.top && datos.productos.top.length > 0 && (
        <motion.div variants={itemVariantes}>
          <WidgetProductosTop productos={datos.productos.top} formatoMoneda={moneda} />
        </motion.div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════

/**
 * LineaJornada — Indicador compacto de fichaje del usuario junto al saludo.
 * Muestra estado (En turno / Almorzando / ...) + hora de entrada + duración trabajada.
 */
function LineaJornada({ fichaje }: { fichaje: NonNullable<DatosDashboard['asistencia']>['detalle_hoy'][number] }) {
  const ahora = Date.now()
  const min = fichaje.hora_entrada
    ? Math.max(0, Math.round(((['activo', 'en_almuerzo', 'en_particular'].includes(fichaje.estado) ? ahora : (fichaje.hora_salida ? new Date(fichaje.hora_salida).getTime() : ahora)) - new Date(fichaje.hora_entrada).getTime()) / 60000))
    : 0
  const h = Math.floor(min / 60)
  const m = min % 60
  const duracion = h === 0 ? `${m}m` : m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`

  const etiquetaEstado =
    fichaje.estado === 'activo' ? 'En turno'
    : fichaje.estado === 'en_almuerzo' ? 'Almorzando'
    : fichaje.estado === 'en_particular' ? 'Trámite'
    : fichaje.estado === 'cerrado' ? 'Cerrado'
    : fichaje.estado === 'ausente' ? 'Ausente'
    : fichaje.estado

  const colorPunto =
    fichaje.estado === 'activo' ? 'bg-asistencia-presente'
    : fichaje.estado === 'en_almuerzo' ? 'bg-asistencia-almuerzo'
    : fichaje.estado === 'cerrado' ? 'bg-texto-terciario'
    : 'bg-asistencia-ausente'

  const hora = fichaje.hora_entrada
    ? (() => { const d = new Date(fichaje.hora_entrada!); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })()
    : null

  return (
    <>
      <span className="text-texto-terciario/40">·</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`size-[6px] rounded-full ${colorPunto}`} />
        <span className="text-texto-secundario">{etiquetaEstado}</span>
        {hora && <span className="text-texto-terciario tabular-nums">desde {hora}</span>}
        {min > 0 && <span className="text-texto-terciario/70 tabular-nums">· {duracion}</span>}
      </span>
    </>
  )
}

function TarjetaReciente({
  titulo, icono, colorFondo = 'bg-superficie-hover', colorIcono = 'text-texto-secundario', verTodo, children,
}: {
  titulo: string
  icono: React.ReactNode
  colorFondo?: string
  colorIcono?: string
  verTodo: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5 flex flex-col">
      <div className="flex items-center gap-2.5 min-w-0 mb-3">
        <span className={`size-7 rounded-card flex items-center justify-center ${colorFondo} ${colorIcono} shrink-0`}>
          {icono}
        </span>
        <h3 className="text-sm font-semibold text-texto-primario truncate">{titulo}</h3>
      </div>
      <div className="space-y-0.5 flex-1">{children}</div>
      <button
        onClick={verTodo}
        className="mt-3 pt-2.5 border-t border-borde-sutil/60 inline-flex items-center justify-center gap-1 text-xxs font-medium text-texto-terciario hover:text-texto-marca transition-colors cursor-pointer w-full"
        aria-label={`Ver todo ${titulo}`}
      >
        Ver todo <ArrowRight size={10} />
      </button>
    </div>
  )
}

function TarjetaMensajesRecientes({ mensajes }: { mensajes: DatosDashboard['mensajes_recientes'] }) {
  const [canal, setCanal] = useState<string>('todos')
  const { fecha: fmtFecha, locale: fmtLocale } = useFormato()

  const canalesConDatos = Array.from(new Set(mensajes.map(m => m.tipo_canal))).filter(Boolean)
  const canalesBase = ['whatsapp', 'correo', 'interno']
  const canalesDisponibles = ['todos', ...canalesBase.filter(c => canalesConDatos.includes(c)), ...canalesConDatos.filter(c => !canalesBase.includes(c))]

  const ETIQUETA_CANAL: Record<string, string> = { todos: 'Todos', whatsapp: 'WhatsApp', correo: 'Correo', interno: 'Interno' }
  const ICONO_TIPO_CONTENIDO: Record<string, React.ReactNode> = {
    imagen: <Image size={10} />, audio: <Mic size={10} />, documento: <File size={10} />, video: <Video size={10} />,
  }

  const filtrados = canal === 'todos' ? mensajes : mensajes.filter(m => m.tipo_canal === canal)

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="size-7 rounded-card flex items-center justify-center bg-insignia-violeta-fondo text-insignia-violeta-texto shrink-0">
          <MessageSquare size={14} />
        </span>
        <h3 className="text-sm font-semibold text-texto-primario">Últimos mensajes</h3>
      </div>

      {canalesDisponibles.length > 2 && (
        <div className="flex items-center gap-1 mb-3">
          {canalesDisponibles.map(c => (
            <button
              key={c}
              onClick={() => setCanal(c)}
              className={`px-2 py-0.5 text-xxs rounded-boton transition-colors ${canal === c ? 'bg-superficie-hover text-texto-primario font-medium' : 'text-texto-terciario hover:text-texto-secundario'}`}
            >
              {ETIQUETA_CANAL[c] || c}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-0.5">
        {filtrados.length > 0 ? (
          filtrados.slice(0, 5).map(m => {
            const preview = m.correo_asunto || m.texto || `[${m.tipo_contenido}]`
            return (
              <div key={m.id} className="flex items-start gap-2 py-2 px-1.5 rounded-boton hover:bg-superficie-hover transition-colors">
                <div className={`size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  m.tipo_canal === 'whatsapp' ? 'bg-canal-whatsapp/15 text-canal-whatsapp'
                  : m.tipo_canal === 'correo' ? 'bg-canal-correo/15 text-canal-correo'
                  : 'bg-canal-interno/15 text-canal-interno'
                }`}>
                  {m.tipo_canal === 'whatsapp' ? <IconoWhatsApp size={10} /> : m.tipo_canal === 'correo' ? <Mail size={10} /> : <MessageSquare size={10} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-texto-primario truncate">
                      {m.es_entrante ? (m.contacto_nombre || m.remitente_nombre || m.correo_de || 'Contacto') : 'Tú'}
                    </span>
                    {m.nombre_canal && <span className="text-xxs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded shrink-0">{m.nombre_canal}</span>}
                    {m.tipo_contenido !== 'texto' && ICONO_TIPO_CONTENIDO[m.tipo_contenido] && <span className="text-texto-terciario">{ICONO_TIPO_CONTENIDO[m.tipo_contenido]}</span>}
                    <span className="text-xxs text-texto-terciario ml-auto shrink-0">
                      {(() => {
                        const fecha = new Date(m.creado_en)
                        const hoy = new Date()
                        const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
                        if (fecha.toDateString() === hoy.toDateString()) return 'Hoy'
                        if (fecha.toDateString() === ayer.toDateString()) return 'Ayer'
                        const diffDias = Math.floor((hoy.getTime() - fecha.getTime()) / 86400000)
                        if (diffDias < 7) return fecha.toLocaleDateString(fmtLocale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
                        return fmtFecha(fecha, { corta: true })
                      })()}
                    </span>
                  </div>
                  <p className="text-xxs text-texto-terciario truncate">{preview?.slice(0, 60)}</p>
                </div>
              </div>
            )
          })
        ) : <p className="text-xs text-texto-terciario text-center py-3">Sin mensajes</p>}
      </div>
    </div>
  )
}

/**
 * BotonRapido — Tarjeta cuadrada con icono arriba + etiqueta abajo.
 * Diseñada para tap target grande en mobile (mínimo 64px de alto).
 */
function BotonRapido({
  etiqueta, icono, colorIcono, colorFondo, onClick,
}: {
  etiqueta: string
  icono: React.ReactNode
  colorIcono: string
  colorFondo: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-1.5 aspect-square sm:aspect-auto sm:py-2.5 lg:py-2 rounded-card border border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte hover:bg-superficie-hover/40 transition-all cursor-pointer active:scale-[0.97]"
    >
      <span className={`size-9 sm:size-8 lg:size-7 rounded-card flex items-center justify-center ${colorFondo} ${colorIcono} group-hover:scale-105 transition-transform`}>
        {icono}
      </span>
      <span className="text-[11px] font-medium text-texto-secundario group-hover:text-texto-primario transition-colors leading-tight text-center px-1">
        {etiqueta}
      </span>
    </button>
  )
}
