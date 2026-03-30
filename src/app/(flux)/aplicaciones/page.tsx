'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Check, Download, Trash2, Lock, AlertTriangle, ArrowLeft, CheckCircle2,
  Mail, Users, Zap, Calendar, MapPin, Route, Package,
  FileText, FileBarChart, Wrench, Clock, Shield, Rocket,
  MessageCircle, Brain, Globe, Sparkles, BarChart3, Landmark,
  UsersRound, Megaphone, Workflow, KanbanSquare, Bot, MessageSquareCode,
  type LucideIcon,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Modal } from '@/componentes/ui/Modal'
import { useModulos } from '@/hooks/useModulos'
import { useRol } from '@/hooks/useRol'
import { useToast } from '@/componentes/feedback/Toast'
import { useTraduccion } from '@/lib/i18n'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { ModuloConEstado, CategoriaModulo } from '@/tipos'

/**
 * Página de Aplicaciones — tienda de módulos de Flux.
 * Pantalla completa, grid compacto por categoría, sección próximamente.
 */

const ICONOS_MODULO: Record<string, LucideIcon> = {
  'mail': Mail, 'users': Users, 'zap': Zap, 'calendar': Calendar,
  'map-pin': MapPin, 'route': Route, 'package': Package,
  'file-text': FileText, 'file-bar-chart': FileBarChart, 'wrench': Wrench,
  'clock': Clock, 'shield': Shield, 'message-circle': MessageCircle,
  'brain': Brain, 'globe': Globe, 'whatsapp': IconoWhatsApp as unknown as LucideIcon,
  'megaphone': Megaphone, 'kanban': KanbanSquare, 'landmark': Landmark,
  'users-round': UsersRound, 'workflow': Workflow, 'bar-chart-3': BarChart3,
  'bot': Bot, 'sparkles': Sparkles, 'message-square-code': MessageSquareCode,
}

const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  base: LayoutGrid, operacional: Zap, documentos: FileText,
  comunicacion: MessageCircle, admin: Shield, premium: Sparkles,
  proximamente: Rocket,
}

// Las etiquetas de categoría se resuelven con t() en el componente

const ORDEN_CATEGORIAS: CategoriaModulo[] = ['premium', 'base', 'operacional', 'documentos', 'comunicacion', 'admin', 'proximamente']

// ═══════════════════════════════════════════════════
// Confetti
// ═══════════════════════════════════════════════════

function Confetti({ activo }: { activo: boolean }) {
  if (!activo) return null
  const particulas = Array.from({ length: 28 }, (_, i) => {
    const angulo = (i / 28) * 360
    const distancia = 70 + Math.random() * 100
    const tamano = 5 + Math.random() * 7
    const colores = ['var(--texto-marca)', 'var(--insignia-exito)', 'var(--insignia-advertencia)', 'var(--insignia-info)', '#f472b6', '#a78bfa']
    return (
      <motion.div
        key={i}
        initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        animate={{ opacity: 0, scale: 0, x: Math.cos((angulo * Math.PI) / 180) * distancia, y: Math.sin((angulo * Math.PI) / 180) * distancia }}
        transition={{ duration: 0.8, delay: Math.random() * 0.15, ease: 'easeOut' }}
        style={{
          position: 'absolute', width: tamano, height: tamano,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          backgroundColor: colores[i % colores.length],
          top: '50%', left: '50%', marginTop: -tamano / 2, marginLeft: -tamano / 2,
        }}
      />
    )
  })
  return <div className="pointer-events-none absolute inset-0 z-50">{particulas}</div>
}

// ═══════════════════════════════════════════════════
// Tarjeta de módulo
// ═══════════════════════════════════════════════════

function TarjetaModulo({ modulo, onClick }: { modulo: ModuloConEstado; onClick: () => void }) {
  const Icono = ICONOS_MODULO[modulo.icono] || LayoutGrid
  const estaActivo = modulo.es_base || (modulo.instalado && modulo.activo)
  const esPremium = modulo.categoria === 'premium'
  const esProximamente = modulo.categoria === 'proximamente'
  const desactivadoConPurga = modulo.instalado && !modulo.activo && modulo.dias_restantes_purga !== null

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: esProximamente ? 1 : 1.06 }}
      whileTap={{ scale: esProximamente ? 1 : 0.95 }}
      onClick={esProximamente ? undefined : onClick}
      className={`flex flex-col items-center gap-1.5 bg-transparent border-none p-0 group ${esProximamente ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <div className="relative">
        {/* Badge ADD-ON */}
        {esPremium && !estaActivo && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-px rounded text-xxs font-bold uppercase tracking-wider bg-texto-marca/20 text-texto-marca border border-texto-marca/25">
            add-on
          </div>
        )}

        {/* Ícono */}
        <div className={`
          w-16 h-16 rounded-xl flex items-center justify-center transition-all border
          ${esProximamente
            ? 'bg-superficie-elevada/50 border-borde-sutil/50 text-texto-terciario/40'
            : estaActivo
              ? 'bg-texto-marca/8 border-texto-marca/20 text-texto-marca'
              : desactivadoConPurga
                ? 'bg-insignia-advertencia/8 border-insignia-advertencia/20 text-insignia-advertencia'
                : 'bg-superficie-elevada border-borde-sutil text-texto-terciario group-hover:border-borde-fuerte group-hover:text-texto-secundario'
          }
        `}>
          <Icono size={26} strokeWidth={1.5} />
        </div>

        {/* Check instalado */}
        {estaActivo && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-insignia-exito flex items-center justify-center shadow-sm border-[1.5px] border-superficie-app">
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}

        {/* Badge purga */}
        {desactivadoConPurga && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-insignia-advertencia flex items-center justify-center shadow-sm border-[1.5px] border-superficie-app">
            <AlertTriangle size={9} className="text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Nombre */}
      <span className={`text-xs font-medium text-center leading-tight max-w-[90px] ${
        esProximamente ? 'text-texto-terciario/50' : estaActivo ? 'text-texto-primario' : 'text-texto-secundario'
      }`}>
        {modulo.nombre}
      </span>

      {/* Pronto */}
      {esProximamente && (
        <span className="text-xxs font-semibold uppercase tracking-wider text-texto-terciario/40 -mt-1">
          Pronto
        </span>
      )}

      {desactivadoConPurga && (
        <span className="text-xxs text-insignia-advertencia -mt-1">{modulo.dias_restantes_purga}d</span>
      )}
    </motion.button>
  )
}

// ═══════════════════════════════════════════════════
// Modal detalle — como la foto: ícono+nombre horizontal, features con checks
// ═══════════════════════════════════════════════════

function ModalModulo({
  modulo, abierto, onCerrar, onInstalar, onDesinstalar, puedeGestionar, confettiActivo,
}: {
  modulo: ModuloConEstado | null; abierto: boolean; onCerrar: () => void
  onInstalar: (slug: string) => void; onDesinstalar: (slug: string) => void
  puedeGestionar: boolean; confettiActivo: boolean
}) {
  const [cargando, setCargando] = useState(false)
  const { t } = useTraduccion()
  if (!modulo) return null

  const Icono = ICONOS_MODULO[modulo.icono] || LayoutGrid
  const estaActivo = modulo.es_base || (modulo.instalado && modulo.activo)
  const desactivadoConPurga = modulo.instalado && !modulo.activo && modulo.dias_restantes_purga !== null

  const manejarInstalar = async () => { setCargando(true); await onInstalar(modulo.slug); setCargando(false) }
  const manejarDesinstalar = async () => { setCargando(true); await onDesinstalar(modulo.slug); setCargando(false) }

  const accion = () => {
    if (modulo.es_base) return null
    if (modulo.precio_mensual_usd > 0 && !estaActivo) {
      return <Boton variante="secundario" tamano="md" icono={<Lock size={16} />} disabled>Próximamente</Boton>
    }
    if (estaActivo) {
      return <Boton variante="peligro" tamano="md" icono={<Trash2 size={16} />} onClick={manejarDesinstalar} cargando={cargando} disabled={!puedeGestionar}>{t('aplicaciones.desinstalar')}</Boton>
    }
    return <Boton variante="primario" tamano="md" icono={<Download size={16} />} onClick={manejarInstalar} cargando={cargando} disabled={!puedeGestionar}>{desactivadoConPurga ? 'Reinstalar' : t('aplicaciones.instalar')}</Boton>
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={modulo.nombre}
      tamano="md"
      acciones={
        <div className="flex items-center gap-3 w-full">
          <Boton variante="secundario" tamano="md" onClick={onCerrar}>{t('comun.cerrar')}</Boton>
          {accion()}
        </div>
      }
    >
      <div className="flex flex-col gap-5 relative">
        <Confetti activo={confettiActivo} />

        {/* Header: ícono + nombre + badge */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center ${
              estaActivo ? 'bg-texto-marca/10 text-texto-marca' : 'bg-superficie-elevada text-texto-terciario'
            }`}
          >
            <Icono size={32} strokeWidth={1.5} />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-texto-primario">{modulo.nombre}</h3>
            <div className="flex items-center gap-2 mt-1">
              {estaActivo && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-insignia-exito bg-insignia-exito/10 px-2 py-0.5 rounded-full">
                  <Check size={11} /> {t('aplicaciones.instalado')}
                </span>
              )}
              {modulo.es_base && (
                <span className="text-xs text-texto-terciario bg-superficie-elevada px-2 py-0.5 rounded-full">Incluido</span>
              )}
              {modulo.precio_mensual_usd > 0 && (
                <span className="text-xs font-medium text-texto-marca bg-texto-marca/10 px-2 py-0.5 rounded-full">US${modulo.precio_mensual_usd}/mes</span>
              )}
            </div>
          </div>
        </div>

        {/* Descripción */}
        <p className="text-sm text-texto-primario font-medium">{modulo.descripcion}</p>

        {/* Features con checks */}
        {modulo.features && modulo.features.length > 0 && (
          <div className="rounded-xl border border-borde-sutil p-4 flex flex-col gap-3">
            {modulo.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-texto-marca shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-texto-secundario leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alerta de purga */}
        {desactivadoConPurga && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-insignia-advertencia/10 border border-insignia-advertencia/20">
            <AlertTriangle size={16} className="text-insignia-advertencia shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-insignia-advertencia">Datos en período de gracia</p>
              <p className="text-xs text-texto-secundario mt-0.5">
                Tenés {modulo.dias_restantes_purga} días para reinstalar antes de que se eliminen los datos.
              </p>
            </div>
          </div>
        )}

        {!puedeGestionar && !modulo.es_base && (
          <p className="text-xs text-texto-terciario">Solo el propietario o administrador puede gestionar módulos.</p>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════
// Página principal
// ═══════════════════════════════════════════════════

export default function PaginaAplicaciones() {
  const router = useRouter()
  const { t } = useTraduccion()
  const { modulos, cargando, instalar, desinstalar } = useModulos()
  const { esPropietario, esAdmin } = useRol()
  const { mostrar } = useToast()

  const [moduloSeleccionado, setModuloSeleccionado] = useState<ModuloConEstado | null>(null)
  const [confettiActivo, setConfettiActivo] = useState(false)
  const puedeGestionar = esPropietario || esAdmin

  const modulosPorCategoria = useMemo(() => {
    const mapa = new Map<CategoriaModulo, ModuloConEstado[]>()
    for (const cat of ORDEN_CATEGORIAS) {
      const items = modulos.filter(m => m.categoria === cat)
      if (items.length > 0) mapa.set(cat, items)
    }
    return mapa
  }, [modulos])

  const manejarInstalar = async (slug: string) => {
    const resultado = await instalar(slug)
    if (resultado.error) {
      mostrar('error', resultado.error)
    } else {
      mostrar('exito', 'Módulo instalado correctamente')
      setConfettiActivo(true)
      setTimeout(() => setConfettiActivo(false), 1000)
      setTimeout(() => {
        setModuloSeleccionado(prev => prev ? { ...prev, instalado: true, activo: true, purga_programada_en: null, dias_restantes_purga: null } : null)
      }, 100)
    }
  }

  const manejarDesinstalar = async (slug: string) => {
    const resultado = await desinstalar(slug)
    if (resultado.error) {
      mostrar('error', resultado.error)
    } else {
      mostrar('info', 'Módulo desinstalado · 30 días para recuperar datos')
      setModuloSeleccionado(prev => prev ? { ...prev, instalado: true, activo: false, dias_restantes_purga: 30, purga_programada_en: new Date(Date.now() + 30 * 86400000).toISOString() } : null)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="shrink-0 w-full max-w-3xl mx-auto px-6 pt-8 pb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-texto-terciario hover:text-texto-primario transition-colors bg-transparent border-none cursor-pointer mb-5"
        >
          <ArrowLeft size={16} />
          {t('comun.volver')}
        </button>
        <h1 className="text-2xl font-bold text-texto-primario">{t('aplicaciones.titulo')}</h1>
        <p className="text-sm text-texto-secundario mt-1">
          Instalá y gestioná los módulos de tu espacio de trabajo
        </p>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-texto-marca border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-6">
          {Array.from(modulosPorCategoria.entries()).map(([categoria, items]) => {
            const IconoCat = ICONOS_CATEGORIA[categoria] || LayoutGrid
            const esCatProximamente = categoria === 'proximamente'
            return (
              <div key={categoria} className="mb-6">
                {/* Header categoría */}
                <div className="flex items-center gap-2 mb-3.5">
                  <IconoCat size={14} strokeWidth={2} className={categoria === 'premium' ? 'text-texto-marca' : 'text-texto-terciario'} />
                  <h2 className={`text-xs font-bold uppercase tracking-[0.15em] ${
                    categoria === 'premium' ? 'text-texto-marca' : 'text-texto-terciario'
                  }`}>
                    {t(`aplicaciones.categorias.${categoria}`)}
                  </h2>
                  <div className="flex-1 h-px bg-borde-sutil" />
                </div>

                {/* Grid — 4 columnas, compacto */}
                <div className="flex flex-wrap" style={{ gap: '16px 0' }}>
                  <AnimatePresence mode="popLayout">
                    {items.map(modulo => (
                      <div key={modulo.slug} className="w-1/4 flex justify-center">
                        <TarjetaModulo
                          modulo={modulo}
                          onClick={() => setModuloSeleccionado(modulo)}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <ModalModulo
        modulo={moduloSeleccionado}
        abierto={!!moduloSeleccionado}
        onCerrar={() => { setModuloSeleccionado(null); setConfettiActivo(false) }}
        onInstalar={manejarInstalar}
        onDesinstalar={manejarDesinstalar}
        puedeGestionar={puedeGestionar}
        confettiActivo={confettiActivo}
      />
    </div>
  )
}
