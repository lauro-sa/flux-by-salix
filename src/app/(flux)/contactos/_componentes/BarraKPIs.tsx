'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, CalendarCheck, FileText, Receipt, ClipboardList,
  MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import { ModalVisitasContacto } from './ModalVisitasContacto'

// ─── Tipos ───

interface KPIs {
  vinculaciones: number
  presupuestos: { total: number; monto: number }
  conversaciones: number
  visitas: number
  actividades: number
  facturas: { total: number; monto: number }
  ordenes: number
}

interface ItemKPI {
  clave: string
  etiqueta: string
  icono: typeof Users
  total: number
  ruta: string
}

// ─── Componente ───

export function BarraKPIs({ contactoId, contactoNombre }: { contactoId: string; contactoNombre: string }) {
  const { t } = useTraduccion()
  const router = useRouter()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [modalVisitas, setModalVisitas] = useState(false)

  // Navegación anterior/siguiente — usa la lista de IDs guardada en sessionStorage
  const vecinos = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('contactos_lista_ids')
      if (!raw) return { anterior: null, siguiente: null }
      const ids: string[] = JSON.parse(raw)
      const idx = ids.indexOf(contactoId)
      if (idx === -1) return { anterior: null, siguiente: null }
      return {
        anterior: idx > 0 ? ids[idx - 1] : null,
        siguiente: idx < ids.length - 1 ? ids[idx + 1] : null,
      }
    } catch { return { anterior: null, siguiente: null } }
  }, [contactoId])

  // Cargar KPIs
  useEffect(() => {
    setKpis(null)
    fetch(`/api/contactos/${contactoId}/kpis`)
      .then(r => r.json())
      .then(setKpis)
      .catch(() => {})
  }, [contactoId])

  // Items con datos reales o ceros mientras carga
  const k = kpis || { vinculaciones: 0, presupuestos: { total: 0, monto: 0 }, conversaciones: 0, visitas: 0, actividades: 0, facturas: { total: 0, monto: 0 }, ordenes: 0 }
  const cargandoKpis = !kpis

  const items: ItemKPI[] = [
    { clave: 'vinculaciones', etiqueta: t('contactos.titulo'), icono: Users, total: k.vinculaciones, ruta: `/contactos?vinculado_de=${contactoId}&origen=${encodeURIComponent(`/contactos/${contactoId}`)}` },
    { clave: 'presupuestos', etiqueta: t('navegacion.presupuestos'), icono: FileText, total: k.presupuestos.total, ruta: `/presupuestos?contacto_id=${contactoId}&origen=${encodeURIComponent(`/contactos/${contactoId}`)}` },
    { clave: 'conversaciones', etiqueta: 'Mensajes', icono: MessageSquare, total: k.conversaciones, ruta: `/inbox?contacto_id=${contactoId}` },
    { clave: 'facturas', etiqueta: 'Facturas', icono: Receipt, total: k.facturas.total, ruta: '' },
    { clave: 'visitas', etiqueta: t('visitas.titulo'), icono: CalendarCheck, total: k.visitas, ruta: '__modal_visitas__' },
    { clave: 'actividades', etiqueta: t('actividades.titulo'), icono: ClipboardList, total: k.actividades, ruta: '' },
    { clave: 'ordenes', etiqueta: 'Órdenes', icono: ClipboardList, total: k.ordenes, ruta: '' },
  ]

  return (
    <div className="relative flex items-center justify-center gap-1.5">
      {/* Flecha izquierda — contacto anterior */}
      <Boton
        variante="secundario"
        tamano="xs"
        soloIcono
        icono={<ChevronLeft size={16} />}
        onClick={() => vecinos.anterior && router.push(`/contactos/${vecinos.anterior}?nav=1`)}
        disabled={!vecinos.anterior}
        titulo={vecinos.anterior ? 'Contacto anterior' : undefined}
      />

      {/* KPIs */}
      <div className={`flex items-stretch gap-0 overflow-x-auto rounded-xl border border-borde-sutil bg-superficie-tarjeta transition-opacity duration-200 ${cargandoKpis ? 'opacity-40' : ''}`} style={{ scrollbarWidth: 'none' }}>
        {items.map((item, i) => {
          const Icono = item.icono
          const tieneRuta = !!item.ruta
          const tieneValor = item.total > 0
          return (
            <button
              key={item.clave}
              type="button"
              onClick={() => {
                if (item.ruta === '__modal_visitas__') { setModalVisitas(true); return }
                if (tieneRuta) router.push(item.ruta)
              }}
              disabled={!tieneRuta}
              className={[
                'flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                i > 0 ? 'border-l border-borde-sutil' : '',
                tieneRuta && tieneValor ? 'cursor-pointer hover:bg-superficie-hover' : 'cursor-default',
                'bg-transparent border-none',
                !tieneValor ? 'opacity-35' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                <Icono size={13} className={tieneValor ? 'text-texto-secundario' : 'text-texto-terciario'} />
                <span className="text-xs text-texto-terciario whitespace-nowrap">{item.etiqueta}</span>
              </div>
              <span className={`text-lg font-bold ${tieneValor ? 'text-texto-primario' : 'text-texto-terciario'}`}>{item.total}</span>
            </button>
          )
        })}
      </div>

      {/* Flecha derecha — contacto siguiente */}
      <Boton
        variante="secundario"
        tamano="xs"
        soloIcono
        icono={<ChevronRight size={16} />}
        onClick={() => vecinos.siguiente && router.push(`/contactos/${vecinos.siguiente}?nav=1`)}
        disabled={!vecinos.siguiente}
        titulo={vecinos.siguiente ? 'Contacto siguiente' : undefined}
      />

      {/* Modal de visitas del contacto */}
      <ModalVisitasContacto
        abierto={modalVisitas}
        onCerrar={() => setModalVisitas(false)}
        contactoId={contactoId}
        contactoNombre={contactoNombre}
      />
    </div>
  )
}
