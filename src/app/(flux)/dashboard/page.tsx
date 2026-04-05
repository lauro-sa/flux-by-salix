'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users, FileText, MessageSquare, CheckSquare,
  Plus, ArrowRight, Mail, MessageCircle,
  Image, Mic, File, Video,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Insignia } from '@/componentes/ui/Insignia'
import { Cargador } from '@/componentes/ui/Cargador'
import { Boton } from '@/componentes/ui/Boton'

// Widgets del dashboard
import { WidgetPipeline } from './_componentes/WidgetPipeline'
import { WidgetActividades } from './_componentes/WidgetActividades'
import { WidgetCrecimientoContactos } from './_componentes/WidgetCrecimientoContactos'
import { WidgetProductosTop } from './_componentes/WidgetProductosTop'
import { WidgetPorVencer } from './_componentes/WidgetPorVencer'
import { WidgetAsistencia } from './_componentes/WidgetAsistencia'
import { WidgetInbox } from './_componentes/WidgetInbox'
import { WidgetIngresos } from './_componentes/WidgetIngresos'
import { WidgetComparativa } from './_componentes/WidgetComparativa'
import { WidgetClientes } from './_componentes/WidgetClientes'

/**
 * Página de Dashboard — Panel de inicio con resumen completo de la actividad.
 * Muestra métricas clave, pipeline de ventas, actividades, inbox, contactos,
 * productos top, presupuestos por vencer y asistencia del equipo.
 */

// ─── Tipos ───

interface DatosDashboard {
  contactos: {
    total: number
    recientes: Array<{ id: string; nombre: string; apellido?: string; correo?: string; telefono?: string; creado_en: string; tipo_clave?: string; tipo_etiqueta?: string; tipo_color?: string }>
    crecimiento_semanal: Array<{ semana: string; cantidad: number }>
  }
  presupuestos: {
    total: number
    por_estado: Record<string, number>
    recientes: Array<{ id: string; numero: string; estado: string; contacto_nombre?: string; contacto_apellido?: string; total?: number; creado_en: string }>
    pipeline_montos: Record<string, number>
    por_vencer: Array<{ id: string; numero: string; estado: string; contacto_nombre?: string; contacto_apellido?: string; total?: number; fecha_vencimiento: string }>
  }
  conversaciones: {
    abiertas: number
    por_canal: Record<string, number>
    sin_leer: number
  }
  actividades: {
    pendientes: Array<{ id: string; titulo: string; tipo_clave: string; estado_clave: string; prioridad: string; fecha_vencimiento: string | null; asignado_nombre: string | null }>
    total_pendientes: number
    completadas_hoy: number
    por_persona: Array<{ nombre: string; pendientes: number; completadas: number }>
  }
  productos: {
    top: Array<{ id: string; nombre: string; tipo: string; precio_unitario: number | null; veces_presupuestado: number; veces_vendido: number }>
  }
  asistencia: {
    hoy: { presentes: number; ausentes: number; tardanzas: number; total: number }
    semana: Record<string, { presentes: number; ausentes: number; tardanzas: number }>
  }
  ingresos: {
    por_mes: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
    por_anio: Record<string, { cantidad: number; monto: number; ordenes_cantidad: number; ordenes_monto: number }>
  }
  comparativa: {
    presupuestos_por_mes: Record<string, { creados: number; monto_total: number }>
    contactos_por_mes: Record<string, number>
  }
  clientes: {
    activos_por_tipo: Record<string, { etiqueta: string; cantidad: number }>
    total_activos: number
    nuevos_por_mes: Record<string, Record<string, number>>
  }
  mensajes_recientes: Array<{
    id: string; texto: string | null; remitente_nombre: string | null; remitente_tipo: string
    es_entrante: boolean; tipo_contenido: string; correo_asunto: string | null; correo_de: string | null
    creado_en: string; conversacion_id: string; tipo_canal: string; contacto_nombre: string | null
    nombre_canal: string | null
  }>
  actividades_proximas: Array<{
    id: string; titulo: string; tipo_clave: string; estado_clave: string
    prioridad: string; fecha_vencimiento: string; asignado_nombre: string | null
  }>
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

// ─── Animaciones ───

const contenedorVariantes = {
  oculto: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariantes = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ─── Componente principal ───

export default function PaginaDashboard() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { moneda, fechaRelativa } = useFormato()
  const router = useRouter()

  const [datos, setDatos] = useState<DatosDashboard | null>(null)
  const [metricas, setMetricas] = useState<MetricasInbox | null>(null)
  const [cargando, setCargando] = useState(true)

  const claveSaludo = useMemo(() => obtenerClaveSaludo(), [])
  const nombre = useMemo(() => obtenerNombreUsuario(usuario), [usuario])

  // Cargar datos
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

  return (
    <motion.div
      className="space-y-8 px-4 sm:px-6 pt-4 sm:pt-5 pb-12"
      variants={contenedorVariantes}
      initial="oculto"
      animate="visible"
    >
      {/* ─── Saludo ─── */}
      <motion.div variants={itemVariantes}>
        <h1 className="text-2xl font-bold text-texto-primario">
          {t(claveSaludo)}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="text-sm text-texto-terciario mt-1">
          {empresa ? (empresa as Record<string, unknown>).nombre as string : 'Flux by Salix'}
        </p>
      </motion.div>

      {/* ─── KPIs compactos ─── */}
      <motion.div variants={itemVariantes} className="grid grid-cols-4 gap-3">
        <KpiCompacto
          titulo={t('contactos.titulo')}
          valor={datos?.contactos.total ?? 0}
          icono={<Users size={16} strokeWidth={1.5} />}
          color="primario"
          detalle={(() => {
            const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
            const n = datos?.comparativa?.contactos_por_mes?.[mesActual] ?? 0
            return n > 0 ? `+${n} este mes` : undefined
          })()}
          onClick={() => router.push('/contactos')}
        />
        <KpiCompacto
          titulo={t('navegacion.presupuestos')}
          valor={datos?.presupuestos.total ?? 0}
          icono={<FileText size={16} strokeWidth={1.5} />}
          color="info"
          detalle={(() => {
            const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
            const n = datos?.comparativa?.presupuestos_por_mes?.[mesActual]?.creados ?? 0
            return n > 0 ? `+${n} este mes` : undefined
          })()}
          onClick={() => router.push('/presupuestos')}
        />
        <KpiCompacto
          titulo="Actividades"
          valor={datos?.actividades?.total_pendientes ?? 0}
          icono={<CheckSquare size={16} strokeWidth={1.5} />}
          color="exito"
          detalle={(() => {
            const v = datos?.actividades?.pendientes.filter(a => a.fecha_vencimiento && new Date(a.fecha_vencimiento) < new Date()).length ?? 0
            return v > 0 ? `${v} vencida${v > 1 ? 's' : ''}` : undefined
          })()}
          onClick={() => router.push('/actividades')}
        />
        <KpiCompacto
          titulo="Inbox"
          valor={datos?.conversaciones.abiertas ?? 0}
          icono={<MessageSquare size={16} strokeWidth={1.5} />}
          color="violeta"
          detalle={(() => {
            const s = datos?.conversaciones.sin_leer ?? 0
            return s > 0 ? `${s} sin leer` : undefined
          })()}
          onClick={() => router.push('/inbox')}
        />
      </motion.div>

      {/* ─── Accesos rápidos ─── */}
      <motion.div variants={itemVariantes} className="flex flex-wrap gap-2">
        <BotonRapido etiqueta={t('contactos.nuevo')} icono={<Users size={15} />} onClick={() => router.push('/contactos/nuevo')} />
        <BotonRapido etiqueta={t('documentos.tipos.presupuesto')} icono={<FileText size={15} />} onClick={() => router.push('/presupuestos/nuevo')} />
        <BotonRapido etiqueta="Actividad" icono={<CheckSquare size={15} />} onClick={() => router.push('/actividades')} />
        <BotonRapido etiqueta={t('dashboard.ir_al_inbox')} icono={<MessageSquare size={15} />} onClick={() => router.push('/inbox')} />
      </motion.div>

      {/* ─── Recientes: 4 tarjetas con listas ─── */}
      <motion.div variants={itemVariantes} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Últimos presupuestos */}
        <TarjetaReciente
          titulo="Últimos presupuestos"
          icono={<FileText size={14} />}
          verTodo={() => router.push('/presupuestos')}
        >
          {datos?.presupuestos.recientes && datos.presupuestos.recientes.length > 0 ? (
            datos.presupuestos.recientes.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                onClick={() => router.push(`/presupuestos/${p.id}`)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-texto-primario">{p.numero}</span>
                    <Insignia color={COLOR_ESTADO_PRESUPUESTO[p.estado] || 'neutro'}>
                      {p.estado === 'confirmado_cliente' ? 'Confirmado' : p.estado === 'orden_venta' ? 'Orden' : p.estado}
                    </Insignia>
                  </div>
                  <p className="text-xxs text-texto-terciario truncate">
                    {[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {p.total != null && <p className="text-xs font-semibold text-texto-primario tabular-nums">{moneda(p.total)}</p>}
                  <p className="text-xxs text-texto-terciario">{fechaRelativa(p.creado_en)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-texto-terciario text-center py-3">Sin presupuestos</p>
          )}
        </TarjetaReciente>

        {/* Últimos contactos */}
        <TarjetaReciente
          titulo="Últimos contactos"
          icono={<Users size={14} />}
          verTodo={() => router.push('/contactos')}
        >
          {datos?.contactos.recientes && datos.contactos.recientes.length > 0 ? (
            datos.contactos.recientes.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                onClick={() => router.push(`/contactos/${c.id}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded-full bg-superficie-hover flex items-center justify-center text-xxs font-semibold text-texto-secundario shrink-0">
                    {(c.nombre?.[0] || '').toUpperCase()}{(c.apellido?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-texto-primario truncate">
                        {[c.nombre, c.apellido].filter(Boolean).join(' ')}
                      </p>
                      {c.tipo_etiqueta && (
                        <Insignia color={(COLOR_TIPO_CONTACTO[c.tipo_clave || ''] || 'neutro') as 'neutro' | 'primario' | 'info' | 'exito' | 'naranja' | 'advertencia'}>
                          {c.tipo_etiqueta}
                        </Insignia>
                      )}
                    </div>
                    <p className="text-xxs text-texto-terciario truncate">{c.correo || c.telefono || ''}</p>
                  </div>
                </div>
                <span className="text-xxs text-texto-terciario shrink-0 ml-2">{fechaRelativa(c.creado_en)}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-texto-terciario text-center py-3">Sin contactos</p>
          )}
        </TarjetaReciente>

        {/* Próximas actividades */}
        <TarjetaReciente
          titulo="Próximas actividades"
          icono={<CheckSquare size={14} />}
          verTodo={() => router.push('/actividades')}
        >
          {datos?.actividades_proximas && datos.actividades_proximas.length > 0 ? (
            datos.actividades_proximas.map(act => (
              <div
                key={act.id}
                className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                onClick={() => router.push('/actividades')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-texto-primario truncate">{act.titulo}</span>
                    {act.prioridad === 'alta' && <Insignia color="peligro">!</Insignia>}
                  </div>
                  {act.asignado_nombre && (
                    <p className="text-xxs text-texto-terciario truncate">{act.asignado_nombre}</p>
                  )}
                </div>
                <span className="text-xxs text-texto-terciario shrink-0 ml-2">
                  {new Date(act.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-texto-terciario text-center py-3">Sin actividades próximas</p>
          )}
        </TarjetaReciente>

        {/* Últimos mensajes */}
        <TarjetaMensajesRecientes
          mensajes={datos?.mensajes_recientes || []}
          fechaRelativa={fechaRelativa}
        />
      </motion.div>

      {/* ─── Fila 1: Presupuestos vs Ventas (full width) ─── */}
      {datos?.ingresos && datos?.comparativa && (
        <motion.div variants={itemVariantes}>
          <WidgetIngresos
            cerradosPorMes={datos.ingresos.por_mes}
            cerradosPorAnio={datos.ingresos.por_anio}
            emitidosPorMes={datos.comparativa.presupuestos_por_mes}
            formatoMoneda={moneda}
          />
        </motion.div>
      )}

      {/* ─── Fila 2: Comparativa interanual + Pipeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datos?.comparativa && (
          <motion.div variants={itemVariantes}>
            <WidgetComparativa
              presupuestosPorMes={datos.comparativa.presupuestos_por_mes}
              contactosPorMes={datos.comparativa.contactos_por_mes}
              formatoMoneda={moneda}
            />
          </motion.div>
        )}

        {datos?.presupuestos && (
          <motion.div variants={itemVariantes}>
            <WidgetPipeline
              porEstado={datos.presupuestos.por_estado}
              pipelineMontos={datos.presupuestos.pipeline_montos}
              formatoMoneda={moneda}
            />
          </motion.div>
        )}

      </div>

      {/* ─── Fila 3: Clientes + Actividades ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datos?.clientes && (
          <motion.div variants={itemVariantes}>
            <WidgetClientes
              activosPorTipo={datos.clientes.activos_por_tipo}
              totalActivos={datos.clientes.total_activos}
              nuevosPorMes={datos.clientes.nuevos_por_mes}
            />
          </motion.div>
        )}

        {datos?.actividades && (
          <motion.div variants={itemVariantes}>
            <WidgetActividades
              pendientes={datos.actividades.pendientes}
              totalPendientes={datos.actividades.total_pendientes}
              completadasHoy={datos.actividades.completadas_hoy}
              porPersona={datos.actividades.por_persona}
            />
          </motion.div>
        )}
      </div>

      {/* ─── Fila 4: Crecimiento contactos + Inbox ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datos?.contactos.crecimiento_semanal && datos.contactos.crecimiento_semanal.length > 0 && (
          <motion.div variants={itemVariantes}>
            <WidgetCrecimientoContactos crecimientoSemanal={datos.contactos.crecimiento_semanal} />
          </motion.div>
        )}

        {metricas && (
          <motion.div variants={itemVariantes}>
            <WidgetInbox resumen={metricas.resumen} porAgente={metricas.por_agente} />
          </motion.div>
        )}
      </div>

      {/* ─── Fila 5: Por vencer + Productos top ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datos?.presupuestos.por_vencer && datos.presupuestos.por_vencer.length > 0 && (
          <motion.div variants={itemVariantes}>
            <WidgetPorVencer presupuestos={datos.presupuestos.por_vencer} formatoMoneda={moneda} />
          </motion.div>
        )}

        {datos?.productos.top && datos.productos.top.length > 0 && (
          <motion.div variants={itemVariantes}>
            <WidgetProductosTop productos={datos.productos.top} formatoMoneda={moneda} />
          </motion.div>
        )}
      </div>

      {/* ─── Fila 6: Asistencia (si hay datos) ─── */}
      {datos?.asistencia && (datos.asistencia.hoy.total > 0 || Object.keys(datos.asistencia.semana).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={itemVariantes}>
            <WidgetAsistencia hoy={datos.asistencia.hoy} semana={datos.asistencia.semana} />
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Subcomponentes ───

/** KPI compacto — una línea con icono, valor y detalle */
function KpiCompacto({
  titulo, valor, icono, color, detalle, onClick,
}: {
  titulo: string; valor: number | string; icono: React.ReactNode
  color: 'primario' | 'info' | 'exito' | 'violeta'; detalle?: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-superficie-tarjeta border border-borde-sutil rounded-lg py-3 px-4 cursor-pointer hover:border-borde-fuerte hover:shadow-sm transition-all duration-150"
    >
      <div className="flex items-center gap-3">
        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 bg-insignia-${color}-fondo text-insignia-${color}-texto`}>
          {icono}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-texto-primario leading-tight">{valor}</span>
            <span className="text-xxs text-texto-terciario truncate">{titulo}</span>
          </div>
          {detalle && (
            <p className="text-xxs text-texto-terciario truncate">{detalle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Tarjeta de lista reciente — header con icono + título + "ver todo" */
function TarjetaReciente({
  titulo, icono, verTodo, children,
}: {
  titulo: string; icono: React.ReactNode; verTodo: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-texto-terciario">{icono}</span>
          <h3 className="text-xs font-semibold text-texto-primario">{titulo}</h3>
        </div>
        <button onClick={verTodo} className="text-xxs text-texto-terciario hover:text-texto-secundario flex items-center gap-1 transition-colors">
          Ver todo <ArrowRight size={10} />
        </button>
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  )
}

/** Tarjeta de mensajes recientes con pestañas de canal */
function TarjetaMensajesRecientes({
  mensajes, fechaRelativa,
}: {
  mensajes: DatosDashboard['mensajes_recientes']
  fechaRelativa: (fecha: string) => string
}) {
  const [canal, setCanal] = useState<string>('todos')

  // Siempre mostrar los canales principales + los que tengan datos
  const canalesConDatos = Array.from(new Set(mensajes.map(m => m.tipo_canal))).filter(Boolean)
  const canalesBase = ['whatsapp', 'correo', 'interno']
  const canalesDisponibles = ['todos', ...canalesBase.filter(c => canalesConDatos.includes(c)), ...canalesConDatos.filter(c => !canalesBase.includes(c))]

  const ETIQUETA_CANAL: Record<string, string> = {
    todos: 'Todos',
    whatsapp: 'WhatsApp',
    correo: 'Correo',
    interno: 'Interno',
  }

  const ICONO_TIPO_CONTENIDO: Record<string, React.ReactNode> = {
    imagen: <Image size={10} />,
    audio: <Mic size={10} />,
    documento: <File size={10} />,
    video: <Video size={10} />,
  }

  const filtrados = canal === 'todos' ? mensajes : mensajes.filter(m => m.tipo_canal === canal)

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-texto-terciario"><MessageSquare size={14} /></span>
          <h3 className="text-xs font-semibold text-texto-primario">Últimos mensajes</h3>
        </div>
      </div>

      {/* Pestañas de canal */}
      {canalesDisponibles.length > 2 && (
        <div className="flex items-center gap-1 mb-3">
          {canalesDisponibles.map(c => (
            <button
              key={c}
              onClick={() => setCanal(c)}
              className={`px-2 py-0.5 text-xxs rounded-md transition-colors ${
                canal === c
                  ? 'bg-superficie-hover text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              {ETIQUETA_CANAL[c] || c}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="space-y-0.5">
        {filtrados.length > 0 ? (
          filtrados.slice(0, 5).map(m => {
            const preview = m.correo_asunto || m.texto || `[${m.tipo_contenido}]`
            return (
              <div
                key={m.id}
                className="flex items-start gap-2 py-1.5 px-1 rounded-md hover:bg-superficie-hover transition-colors"
              >
                {/* Indicador de canal */}
                <div className={`size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  m.tipo_canal === 'whatsapp' ? 'bg-canal-whatsapp/15 text-canal-whatsapp'
                  : m.tipo_canal === 'correo' ? 'bg-canal-correo/15 text-canal-correo'
                  : 'bg-canal-interno/15 text-canal-interno'
                }`}>
                  {m.tipo_canal === 'whatsapp' ? <MessageCircle size={10} />
                    : m.tipo_canal === 'correo' ? <Mail size={10} />
                    : <MessageSquare size={10} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-texto-primario truncate">
                      {m.es_entrante ? (m.contacto_nombre || m.remitente_nombre || m.correo_de || 'Contacto') : 'Tú'}
                    </span>
                    {m.nombre_canal && (
                      <span className="text-xxs text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded shrink-0">{m.nombre_canal}</span>
                    )}
                    {m.tipo_contenido !== 'texto' && ICONO_TIPO_CONTENIDO[m.tipo_contenido] && (
                      <span className="text-texto-terciario">{ICONO_TIPO_CONTENIDO[m.tipo_contenido]}</span>
                    )}
                    <span className="text-xxs text-texto-terciario ml-auto shrink-0">
                      {(() => {
                        const fecha = new Date(m.creado_en)
                        const hoy = new Date()
                        const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
                        const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        if (fecha.toDateString() === hoy.toDateString()) return hora
                        if (fecha.toDateString() === ayer.toDateString()) return `Ayer ${hora}`
                        return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                      })()}
                    </span>
                  </div>
                  <p className="text-xxs text-texto-terciario truncate">{preview?.slice(0, 60)}</p>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-xs text-texto-terciario text-center py-3">Sin mensajes</p>
        )}
      </div>
    </div>
  )
}

function BotonRapido({
  etiqueta, icono, onClick,
}: {
  etiqueta: string; icono: React.ReactNode; onClick: () => void
}) {
  return (
    <Boton variante="secundario" tamano="sm" icono={<Plus size={13} strokeWidth={2} />} onClick={onClick}>
      {etiqueta}
    </Boton>
  )
}
