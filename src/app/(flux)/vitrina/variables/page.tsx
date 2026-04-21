'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { ArrowLeft, Search, ChevronRight, Copy, Check, Database, FileText, User, Building2, X, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import { useTema } from '@/hooks/useTema'
import { useFormato } from '@/hooks/useFormato'
import { obtenerEntidades, obtenerVariablesAgrupadas, ETIQUETAS_GRUPO } from '@/lib/variables/registro'
import { formatearVariable } from '@/lib/variables/resolver'
import type { DefinicionEntidad, DefinicionVariable, ContextoVariables } from '@/lib/variables/tipos'
// Registrar todas las entidades
import '@/lib/variables/entidades'

/**
 * Vitrina de Variables — Flux by Salix
 * Muestra todas las variables disponibles organizadas por entidad y grupo.
 * Permite cargar un presupuesto y/o contacto real para previsualizar los valores.
 */

// Etiquetas de tipo de dato para los badges
const ETIQUETAS_TIPO: Record<string, string> = {
  texto: 'Texto',
  numero: 'Número',
  moneda: 'Moneda',
  porcentaje: '%',
  fecha: 'Fecha',
  fecha_hora: 'Fecha/Hora',
  booleano: 'Sí/No',
  email: 'Email',
  telefono: 'Tel',
  url: 'URL',
  imagen: 'Imagen',
}

const COLORES_ORIGEN: Record<string, string> = {
  columna: 'bg-blue-500/10 text-blue-400',
  calculado: 'bg-amber-500/10 text-amber-400',
  relacion: 'bg-purple-500/10 text-purple-400',
}

// Datos ficticios realistas para previsualizar todas las variables
const DATOS_FICTICIOS: ContextoVariables = {
  contacto: {
    nombre: 'Constructora', apellido: 'Del Sur S.A.',
    nombre_completo: 'Constructora Del Sur S.A.',
    codigo: 'C-0042', tipo: 'Empresa', titulo: '', cargo: '', rubro: 'Construcción',
    correo: 'info@constructoradelsur.com', telefono: '+54 11 4555-8900',
    whatsapp: '+5411 4555-8900', web: 'www.constructoradelsur.com',
    tipo_identificacion: 'CUIT', numero_identificacion: '30-71234567-9', pais_fiscal: 'AR',
    direccion: 'Av. Rivadavia 1234, Piso 8, Of. B, Balvanera, CABA, Buenos Aires',
    calle: 'Av. Rivadavia', numero_calle: '1234', calle_altura: 'Av. Rivadavia 1234',
    piso: 'Piso 8, Of. B',
    barrio: 'Balvanera', ciudad: 'CABA', provincia: 'Buenos Aires', pais: 'Argentina',
    codigo_postal: 'C1033AAO', timbre: '8B',
    moneda: 'ARS', idioma: 'es', notas: 'Cliente desde 2023, muy buen pagador.',
    creado_en: '2023-06-15T10:00:00Z',
  },
  presupuesto: {
    numero: 'Pres 26-078', estado: 'enviado', referencia: 'OC-2026-450',
    subtotal_neto: '2500000', total_impuestos: '525000', total_final: '3025000',
    moneda: 'ARS', cotizacion_cambio: '1',
    descuento_global: '5', descuento_global_monto: '131578.95',
    condicion_pago_label: '50% adelanto, 50% contra entrega',
    condicion_pago_tipo: 'hitos', dias_vencimiento: 30,
    nota_plan_pago: 'Primer pago al confirmar, segundo al finalizar instalación.',
    cantidad_cuotas: 3,
    cuota_1_descripcion: 'Adelanto al confirmar', cuota_1_porcentaje: '40', cuota_1_monto: '1210000',
    cuota_2_descripcion: 'Avance de obra 50%', cuota_2_porcentaje: '30', cuota_2_monto: '907500',
    cuota_3_descripcion: 'Contra entrega final', cuota_3_porcentaje: '30', cuota_3_monto: '907500',
    // Semánticas (se calculan, pero las pongo para los ficticios)
    adelanto_porcentaje: '40', adelanto_monto: '1210000', adelanto_descripcion: 'Adelanto al confirmar',
    pago_final_porcentaje: '30', pago_final_monto: '907500', pago_final_descripcion: 'Contra entrega final',
    cuotas_intermedias: 1,
    fecha_emision: '2026-04-10T00:00:00Z', fecha_vencimiento: '2026-05-10T00:00:00Z',
    fecha_emision_original: '2026-04-05T00:00:00Z', fecha_aceptacion: '',
    creado_por_nombre: 'Lauro Salinas', editado_por_nombre: 'Lauro Salinas',
    contacto_nombre: 'Constructora Del Sur S.A.', contacto_correo: 'info@constructoradelsur.com',
    contacto_telefono: '+54 11 4555-8900', contacto_direccion: 'Av. Rivadavia 1234, CABA',
    contacto_identificacion: '30-71234567-9',
  },
  dirigido_a: {
    nombre: 'María', apellido: 'García', nombre_completo: 'María García',
    cargo: 'Gerente de Compras', correo: 'maria.garcia@constructoradelsur.com',
    telefono: '+54 11 4555-8901', whatsapp: '+5411 4555-8901',
    direccion: 'San Martín 567, Piso 3, Microcentro, CABA',
    calle: 'San Martín', numero_calle: '567', calle_altura: 'San Martín 567', piso: 'Piso 3',
    barrio: 'Microcentro', ciudad: 'CABA', provincia: 'Buenos Aires',
    pais: 'Argentina', codigo_postal: 'C1004AAK',
    empresa_nombre: 'Constructora Del Sur S.A.',
  },
  empresa: {
    nombre: 'Herreelec S.R.L.', slug: 'herreelec', pais: 'AR',
    logo_url: '', correo: 'ventas@herreelec.com', telefono: '+54 11 5050-1234',
    pagina_web: 'www.herreelec.com', ubicacion: 'Av. Córdoba 4500, CABA',
  },
  actividad: {
    titulo: 'Llamar para confirmar presupuesto', descripcion: 'Seguimiento del presupuesto Pres 26-078',
    tipo_clave: 'llamada', prioridad: 'alta', estado_clave: 'pendiente',
    fecha_vencimiento: '2026-04-18T00:00:00Z', fecha_completada: '',
    creado_por_nombre: 'Lauro Salinas',
  },
  visita: {
    estado: 'completada', motivo: 'Relevamiento técnico', resultado: 'Se tomaron medidas del tablero principal',
    prioridad: 'media', temperatura: 'caliente', notas: 'Llevar multímetro y planos.',
    fecha_programada: '2026-04-15T09:00:00Z', fecha_inicio: '2026-04-15T08:45:00Z',
    fecha_llegada: '2026-04-15T09:10:00Z', fecha_completada: '2026-04-15T10:30:00Z',
    duracion_estimada_min: 60, duracion_real_min: 80,
    direccion_texto: 'Av. Rivadavia 1234, Piso 8, CABA',
    asignado_nombre: 'Nahuel Herrera', contacto_nombre: 'Constructora Del Sur S.A.',
    recibe_nombre: 'María García', recibe_telefono: '+54 11 4555-8901',
  },
  orden: {
    numero: 'OT-0136', titulo: 'Instalación tablero eléctrico oficinas P8',
    descripcion: 'Instalación completa de tablero seccional con 12 térmicas', estado: 'en_progreso',
    prioridad: 'alta', fecha_inicio: '2026-04-16T00:00:00Z',
    fecha_fin_estimada: '2026-04-25T00:00:00Z', fecha_fin_real: '',
    contacto_nombre: 'Constructora Del Sur S.A.', asignado_nombre: 'Nahuel Herrera',
  },
  conversacion: {
    tipo_canal: 'whatsapp', estado: 'abierta', asunto: 'Consulta tablero P8',
    ultimo_mensaje_texto: 'Perfecto, mañana a las 9 paso con el equipo.',
    ultimo_mensaje_en: '2026-04-17T14:30:00Z',
    asignado_a_nombre: 'Lauro Salinas', contacto_nombre: 'María García',
  },
  asistencia: {
    fecha: '2026-04-17', estado: 'cerrado', tipo: 'normal',
    hora_entrada: '2026-04-17T08:05:00Z', hora_salida: '2026-04-17T17:10:00Z',
    inicio_almuerzo: '2026-04-17T12:30:00Z', fin_almuerzo: '2026-04-17T13:15:00Z',
    salida_particular: '2026-04-17T15:00:00Z', vuelta_particular: '2026-04-17T15:25:00Z',
    puntualidad_min: -5, cierre_automatico: false,
    metodo_registro: 'app_movil', terminal_nombre: '', notas: '',
  },
  nomina: {
    concepto: 'Quincena 01-15 Abril 2026',
    fecha_inicio_periodo: '2026-04-01', fecha_fin_periodo: '2026-04-15',
    dias_habiles: 11, dias_trabajados: 10, dias_ausentes: 1, tardanzas: 2,
    monto_sugerido: '350000', monto_abonado: '340000', notas: 'Descuento 1 día ausente',
    creado_por_nombre: 'Lauro Salinas',
  },
  usuario: {
    nombre: 'Lauro', apellido: 'Salinas', nombre_completo: 'Lauro Salinas',
    correo: 'lauro@herreelec.com', telefono: '+54 11 5050-1234', rol: 'admin',
  },
  producto: {
    nombre: 'Térmicas Schneider 32A', codigo: 'P-0156', tipo: 'producto',
    descripcion: 'Llave termomagnética bipolar 32A curva C', descripcion_venta: 'Térmica 32A Schneider Electric',
    categoria: 'Protecciones', referencia_interna: 'SCH-IC60N-C32',
    costo: '15000', precio_unitario: '22500', moneda: 'ARS', unidad: 'un',
  },
  fecha: { hoy: new Date(), _locale: 'es-AR' },
}

interface PresupuestoResumen {
  id: string; numero: string; contacto_id: string | null;
  contacto_nombre: string | null; contacto_apellido: string | null; estado: string;
  atencion_contacto_id: string | null; atencion_nombre: string | null; atencion_cargo: string | null
}
interface ContactoResumen { id: string; nombre: string; apellido: string | null; tipo: string | null; correo: string | null }
interface ContactoHijo { id: string; nombre: string; apellido: string | null; correo: string | null; telefono: string | null; puesto_en_contenedor: string | null; tipo_contacto?: { clave: string; etiqueta: string } | null }

// ─── Combobox buscable (inline) ───

interface OpcionCombobox { valor: string; etiqueta: string; grupo?: string }
interface PropsCombobox {
  opciones: OpcionCombobox[]
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  icono?: React.ReactNode
}

function ComboboxBuscable({ opciones, valor, onChange, placeholder = 'Buscar...', icono }: PropsCombobox) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [abierto, setAbierto] = useState(false)
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const refContenedor = useRef<HTMLDivElement>(null)
  const refDropdown = useRef<HTMLDivElement>(null)
  const refInput = useRef<HTMLInputElement>(null)
  const refBoton = useRef<HTMLButtonElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 })

  const seleccionada = opciones.find(o => o.valor === valor)

  // Filtrar opciones por búsqueda
  const opcionesFiltradas = useMemo(() => {
    if (!busquedaLocal.trim()) return opciones
    const t = busquedaLocal.toLowerCase()
    return opciones.filter(o => o.etiqueta.toLowerCase().includes(t))
  }, [opciones, busquedaLocal])

  // Agrupar opciones
  const grupos = useMemo(() => {
    const map = new Map<string, OpcionCombobox[]>()
    for (const o of opcionesFiltradas) {
      const g = o.grupo || ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(o)
    }
    return Array.from(map.entries())
  }, [opcionesFiltradas])

  // Posición del dropdown
  useEffect(() => {
    if (!abierto || !refBoton.current) return
    const rect = refBoton.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) })
    setTimeout(() => refInput.current?.focus(), 50)
  }, [abierto])

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (refContenedor.current?.contains(target)) return
      if (refDropdown.current?.contains(target)) return
      setAbierto(false)
      setBusquedaLocal('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const seleccionar = (v: string) => {
    onChange(v)
    setAbierto(false)
    setBusquedaLocal('')
  }

  return (
    <div ref={refContenedor} className="relative">
      <button
        ref={refBoton}
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={[
          'flex items-center gap-2 w-full px-3 py-2 rounded-card border text-sm cursor-pointer transition-all text-left',
          abierto ? 'border-borde-foco shadow-foco' : 'border-borde-sutil',
          'bg-superficie-tarjeta',
        ].join(' ')}
      >
        {icono && <span className="shrink-0 text-texto-terciario">{icono}</span>}
        <span className={`flex-1 truncate ${seleccionada && seleccionada.valor ? 'text-texto-primario' : 'text-texto-terciario'}`}>
          {seleccionada && seleccionada.valor ? seleccionada.etiqueta : placeholder}
        </span>
        {valor && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); setBusquedaLocal('') }}
            className="shrink-0 p-0.5 rounded hover:bg-superficie-hover text-texto-terciario cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className={`shrink-0 text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={refDropdown}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed border border-borde-sutil rounded-card shadow-lg overflow-hidden"
              style={{
                top: posicion.top,
                left: posicion.left,
                width: posicion.width,
                zIndex: 9999,
                ...(esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }),
              }}
            >
              {/* Input de búsqueda */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-borde-sutil">
                <Search size={14} className="shrink-0 text-texto-terciario" />
                <input
                  ref={refInput}
                  type="text"
                  value={busquedaLocal}
                  onChange={(e) => setBusquedaLocal(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
                />
                {busquedaLocal && (
                  <button type="button" onClick={() => setBusquedaLocal('')} className="shrink-0 p-0.5 rounded hover:bg-superficie-hover text-texto-terciario">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Lista de opciones */}
              <div className="max-h-[min(18rem,60dvh)] overflow-y-auto">
                {grupos.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-texto-terciario">Sin resultados</div>
                )}
                {grupos.map(([grupo, items]) => (
                  <div key={grupo}>
                    {grupo && (
                      <div className="px-3 pt-2.5 pb-1 text-xxs font-semibold uppercase tracking-wider text-texto-terciario">{grupo}</div>
                    )}
                    {items.map(opcion => (
                      <button
                        key={opcion.valor}
                        type="button"
                        onClick={() => seleccionar(opcion.valor)}
                        className={[
                          'flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors',
                          opcion.valor === valor ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                        ].join(' ')}
                      >
                        <span className="flex-1 truncate">{opcion.etiqueta}</span>
                        {opcion.valor === valor && <Check size={14} className="text-texto-marca shrink-0" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export default function VitrinaVariables() {
  const router = useRouter()
  const { mostrar: mostrarToast } = useToast()
  const formato = useFormato()

  // Entidades del registro
  const [entidades, setEntidades] = useState<DefinicionEntidad[]>([])
  const [entidadActiva, setEntidadActiva] = useState<string>('')

  // Inicializar entidades en el cliente para evitar hydration mismatch
  useEffect(() => {
    const ents = obtenerEntidades()
    setEntidades(ents)
    if (ents.length > 0 && !entidadActiva) setEntidadActiva(ents[0].clave)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [busqueda, setBusqueda] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)

  // Datos reales para preview
  const [presupuestos, setPresupuestos] = useState<PresupuestoResumen[]>([])
  const [contactos, setContactos] = useState<ContactoResumen[]>([])
  const [hijosContacto, setHijosContacto] = useState<ContactoHijo[]>([])
  const [presupuestoId, setPresupuestoId] = useState('')
  const [contactoId, setContactoId] = useState('')
  const [dirigidoAId, setDirigidoAId] = useState('')
  const [contexto, setContexto] = useState<ContextoVariables>({})
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [datosFicticios, setDatosFicticios] = useState(false)

  const presupuestoSel = presupuestos.find(p => p.id === presupuestoId)

  // Opciones de contacto: si hay presupuesto, su contacto va primero
  const opcionesContacto = useMemo(() => {
    const opts: OpcionCombobox[] = [{ valor: '', etiqueta: 'Ninguno' }]
    const contactoIdPres = presupuestoSel?.contacto_id

    const delPres: OpcionCombobox[] = []
    const resto: OpcionCombobox[] = []
    for (const c of contactos) {
      const etiqueta = `${c.nombre}${c.apellido ? ' ' + c.apellido : ''}${c.tipo ? ' · ' + c.tipo : ''}`
      if (c.id === contactoIdPres) {
        delPres.push({ valor: c.id, etiqueta, grupo: 'Del presupuesto' })
      } else {
        resto.push({ valor: c.id, etiqueta, grupo: 'Todos los contactos' })
      }
    }

    // Si el contacto del presupuesto no estaba en la lista
    if (contactoIdPres && delPres.length === 0 && presupuestoSel) {
      const nombre = [presupuestoSel.contacto_nombre, presupuestoSel.contacto_apellido].filter(Boolean).join(' ')
      if (nombre) delPres.push({ valor: contactoIdPres, etiqueta: nombre, grupo: 'Del presupuesto' })
    }

    return [...opts, ...delPres, ...resto]
  }, [contactos, presupuestoSel])

  // Opciones de dirigido a: hijos del contacto seleccionado + atención del presupuesto
  const opcionesDirigidoA = useMemo(() => {
    const opts: OpcionCombobox[] = [{ valor: '', etiqueta: 'Ninguno' }]

    // Atención del presupuesto (si existe)
    if (presupuestoSel?.atencion_contacto_id && presupuestoSel.atencion_nombre) {
      opts.push({
        valor: `pres_atencion_${presupuestoSel.atencion_contacto_id}`,
        etiqueta: `${presupuestoSel.atencion_nombre}${presupuestoSel.atencion_cargo ? ' · ' + presupuestoSel.atencion_cargo : ''}`,
        grupo: 'Dirigido a del presupuesto',
      })
    }

    // Hijos/vinculados del contacto
    if (hijosContacto.length > 0) {
      for (const h of hijosContacto) {
        const nombre = [h.nombre, h.apellido].filter(Boolean).join(' ')
        const detalle = [h.puesto_en_contenedor, h.tipo_contacto?.etiqueta].filter(Boolean).join(' · ')
        opts.push({
          valor: h.id,
          etiqueta: `${nombre}${detalle ? ' · ' + detalle : ''}`,
          grupo: 'Contactos vinculados',
        })
      }
    }

    return opts
  }, [hijosContacto, presupuestoSel])

  // Cargar listas para los selectores
  useEffect(() => {
    fetch('/api/presupuestos?por_pagina=30&orden_dir=desc')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.presupuestos) setPresupuestos(data.presupuestos) })
      .catch(() => {})

    fetch('/api/contactos?por_pagina=50&orden=nombre&orden_dir=asc')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.contactos) setContactos(data.contactos) })
      .catch(() => {})
  }, [])

  // Cargar hijos cuando cambia el contacto
  useEffect(() => {
    if (!contactoId) { setHijosContacto([]); return }
    fetch(`/api/contactos/vinculaciones/hijos?ids=${contactoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.hijos?.[contactoId]) setHijosContacto(data.hijos[contactoId])
        else setHijosContacto([])
      })
      .catch(() => setHijosContacto([]))
  }, [contactoId])

  // Cargar datos reales cuando cambia la selección
  useEffect(() => {
    const cargar = async () => {
      setCargandoDatos(true)
      const nuevoContexto: ContextoVariables = {}

      // 1. Presupuesto
      if (presupuestoId) {
        try {
          const res = await fetch(`/api/presupuestos/${presupuestoId}`)
          if (res.ok) {
            const p = await res.json()
            nuevoContexto.presupuesto = {
              numero: p.numero, estado: p.estado, referencia: p.referencia,
              subtotal_neto: p.subtotal_neto, total_impuestos: p.total_impuestos,
              total_final: p.total_final, moneda: p.moneda, cotizacion_cambio: p.cotizacion_cambio,
              descuento_global: p.descuento_global, descuento_global_monto: p.descuento_global_monto,
              condicion_pago_label: p.condicion_pago_label, condicion_pago_tipo: p.condicion_pago_tipo,
              dias_vencimiento: p.dias_vencimiento, nota_plan_pago: p.nota_plan_pago,
              fecha_emision: p.fecha_emision, fecha_vencimiento: p.fecha_vencimiento,
              fecha_emision_original: p.fecha_emision_original, fecha_aceptacion: p.fecha_aceptacion,
              creado_por_nombre: p.creado_por_nombre, editado_por_nombre: p.editado_por_nombre,
              contacto_nombre: [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' '),
              contacto_correo: p.contacto_correo, contacto_telefono: p.contacto_telefono,
              contacto_direccion: p.contacto_direccion,
              contacto_identificacion: p.contacto_identificacion,
            }
            // Cuotas/hitos — ya vienen en la respuesta del presupuesto
            if (p.cuotas && Array.isArray(p.cuotas) && p.cuotas.length > 0) {
              const cuotas = (p.cuotas as { numero: number; descripcion: string; porcentaje: string; monto: string }[])
                .sort((a, b) => a.numero - b.numero)
              nuevoContexto.presupuesto!.cantidad_cuotas = cuotas.length
              cuotas.slice(0, 3).forEach((c, i) => {
                nuevoContexto.presupuesto![`cuota_${i + 1}_descripcion`] = c.descripcion || `Cuota ${i + 1}`
                nuevoContexto.presupuesto![`cuota_${i + 1}_porcentaje`] = c.porcentaje
                nuevoContexto.presupuesto![`cuota_${i + 1}_monto`] = c.monto
              })
            }
            // Contacto desde snapshot del presupuesto (si no hay contacto seleccionado)
            if (!contactoId && p.contacto_nombre) {
              nuevoContexto.contacto = {
                nombre: p.contacto_nombre, apellido: p.contacto_apellido,
                nombre_completo: [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' '),
                correo: p.contacto_correo, telefono: p.contacto_telefono,
                tipo: p.contacto_tipo,
                tipo_identificacion: p.contacto_condicion_iva ? 'CUIT' : '',
                numero_identificacion: p.contacto_identificacion,
              }
            }
            // Dirigido a desde presupuesto (si no hay dirigido_a seleccionado)
            if (!dirigidoAId && p.atencion_nombre) {
              nuevoContexto.dirigido_a = {
                nombre: p.atencion_nombre, cargo: p.atencion_cargo,
                correo: p.atencion_correo, nombre_completo: p.atencion_nombre,
              }
            }
          }
        } catch { /* sin datos */ }
      }

      // 2. Contacto independiente
      if (contactoId) {
        try {
          const res = await fetch(`/api/contactos/${contactoId}`)
          if (res.ok) {
            const c = await res.json()
            // Dirección principal (de contacto_direcciones)
            const dirPrincipal = (c.direcciones || []).find((d: Record<string, unknown>) => d.es_principal) || (c.direcciones || [])[0]
            nuevoContexto.contacto = {
              nombre: c.nombre, apellido: c.apellido,
              nombre_completo: [c.nombre, c.apellido].filter(Boolean).join(' '),
              codigo: c.codigo,
              tipo: c.tipo_contacto?.etiqueta || '',
              titulo: c.titulo, cargo: c.cargo, rubro: c.rubro,
              correo: c.correo, telefono: c.telefono, whatsapp: c.whatsapp, web: c.web,
              tipo_identificacion: c.tipo_identificacion,
              numero_identificacion: c.numero_identificacion,
              pais_fiscal: c.pais_fiscal,
              moneda: c.moneda, idioma: c.idioma, notas: c.notas,
              // Dirección principal
              direccion: dirPrincipal?.texto || [dirPrincipal?.calle, dirPrincipal?.numero, dirPrincipal?.piso, dirPrincipal?.ciudad, dirPrincipal?.provincia].filter(Boolean).join(', ') || '',
              calle: dirPrincipal?.calle || '',
              numero_calle: dirPrincipal?.numero || '',
              piso: dirPrincipal?.piso || '',
              barrio: dirPrincipal?.barrio || '',
              ciudad: dirPrincipal?.ciudad || '',
              provincia: dirPrincipal?.provincia || '',
              pais: dirPrincipal?.pais || '',
              codigo_postal: dirPrincipal?.codigo_postal || '',
              timbre: dirPrincipal?.timbre || '',
              creado_en: c.creado_en,
            }
          }
        } catch { /* sin datos */ }
      }

      // 3. Dirigido a independiente (contacto vinculado seleccionado)
      if (dirigidoAId) {
        // Si es la atención del presupuesto
        if (dirigidoAId.startsWith('pres_atencion_') && presupuestoSel) {
          nuevoContexto.dirigido_a = {
            nombre: presupuestoSel.atencion_nombre,
            cargo: presupuestoSel.atencion_cargo,
            nombre_completo: presupuestoSel.atencion_nombre,
          }
        } else {
          // Es un contacto vinculado — cargar sus datos completos
          try {
            const res = await fetch(`/api/contactos/${dirigidoAId}`)
            if (res.ok) {
              const c = await res.json()
              // Buscar su puesto en el contenedor (si existe en hijosContacto)
              const hijo = hijosContacto.find(h => h.id === dirigidoAId)
              const dirDa = (c.direcciones || []).find((d: Record<string, unknown>) => d.es_principal) || (c.direcciones || [])[0]
              nuevoContexto.dirigido_a = {
                nombre: c.nombre, apellido: c.apellido,
                nombre_completo: [c.nombre, c.apellido].filter(Boolean).join(' '),
                cargo: hijo?.puesto_en_contenedor || c.cargo || '',
                correo: c.correo, telefono: c.telefono, whatsapp: c.whatsapp,
                // Dirección del dirigido a
                direccion: dirDa?.texto || [dirDa?.calle, dirDa?.numero, dirDa?.ciudad, dirDa?.provincia].filter(Boolean).join(', ') || '',
                calle: dirDa?.calle || '', numero_calle: dirDa?.numero || '',
                piso: dirDa?.piso || '', barrio: dirDa?.barrio || '',
                ciudad: dirDa?.ciudad || '', provincia: dirDa?.provincia || '',
                pais: dirDa?.pais || '', codigo_postal: dirDa?.codigo_postal || '',
                empresa_nombre: nuevoContexto.contacto?.nombre_completo || nuevoContexto.contacto?.nombre || '',
              }
            }
          } catch { /* sin datos */ }
        }
      }

      // Fecha siempre disponible
      nuevoContexto.fecha = {
        hoy: new Date(),
        _locale: formato.locale,
        _zonaHoraria: formato.zonaHoraria,
        _formatoHora: formato.formatoHora,
      }

      setContexto(nuevoContexto)
      setCargandoDatos(false)
    }

    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presupuestoId, contactoId, dirigidoAId, formato.locale])

  // Grupos de la entidad activa
  const gruposActivos = useMemo(() => obtenerVariablesAgrupadas(entidadActiva), [entidadActiva])
  const entidadInfo = entidades.find(e => e.clave === entidadActiva)

  // Búsqueda global
  const resultadosBusqueda = useMemo(() => {
    if (!busqueda.trim()) return null
    const termino = busqueda.toLowerCase()
    const resultados: { entidad: DefinicionEntidad; variable: DefinicionVariable }[] = []
    for (const ent of entidades) {
      for (const v of ent.variables) {
        if (
          v.clave.toLowerCase().includes(termino) ||
          v.etiqueta.toLowerCase().includes(termino) ||
          v.descripcion?.toLowerCase().includes(termino) ||
          ent.etiqueta.toLowerCase().includes(termino)
        ) {
          resultados.push({ entidad: ent, variable: v })
        }
      }
    }
    return resultados
  }, [busqueda, entidades])

  // Obtener valor de preview
  const obtenerPreview = (claveEntidad: string, variable: DefinicionVariable): { valor: string | null; esCalculado: boolean } => {
    const datos = contextoEfectivo[claveEntidad]
    if (!datos) return { valor: null, esCalculado: false }

    if (variable.origen === 'calculado' && variable.calcular) {
      try {
        const val = variable.calcular(datos)
        if (val === null || val === undefined || val === '') return { valor: null, esCalculado: true }
        const moneda = (contextoEfectivo.presupuesto?.moneda || 'ARS') as string
        return { valor: formatearVariable(claveEntidad, variable.clave, val, moneda, formato.locale), esCalculado: true }
      } catch {
        return { valor: null, esCalculado: true }
      }
    }

    const val = datos[variable.clave]
    if (val === null || val === undefined || val === '') return { valor: null, esCalculado: false }
    const moneda = (contextoEfectivo.presupuesto?.moneda || 'ARS') as string
    return { valor: formatearVariable(claveEntidad, variable.clave, val, moneda, formato.locale), esCalculado: false }
  }

  const copiarVariable = (claveEntidad: string, claveCampo: string) => {
    const texto = `{{${claveEntidad}.${claveCampo}}}`
    navigator.clipboard.writeText(texto)
    setCopiado(texto)
    mostrarToast('exito', `Copiado: ${texto}`)
    setTimeout(() => setCopiado(null), 2000)
  }

  // Contexto efectivo: ficticios tiene prioridad, si no datos reales
  const contextoEfectivo = datosFicticios ? DATOS_FICTICIOS : contexto
  const tieneContexto = Object.keys(contextoEfectivo).length > 0

  // Contar variables con datos por entidad
  const conteoConDatos = useMemo(() => {
    const conteo: Record<string, { con: number; total: number }> = {}
    for (const ent of entidades) {
      let con = 0
      for (const v of ent.variables) {
        const { valor } = obtenerPreview(ent.clave, v)
        if (valor !== null) con++
      }
      conteo[ent.clave] = { con, total: ent.variables.length }
    }
    return conteo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidades, contextoEfectivo])

  // Renderizar una variable
  const renderVariable = (variable: DefinicionVariable, claveEntidad: string, mostrarEntidad?: string) => {
    const claveCompleta = `{{${claveEntidad}.${variable.clave}}}`
    const { valor, esCalculado } = obtenerPreview(claveEntidad, variable)
    const esCopiadoActual = copiado === claveCompleta

    return (
      <button
        key={`${claveEntidad}.${variable.clave}`}
        type="button"
        onClick={() => copiarVariable(claveEntidad, variable.clave)}
        className="group flex items-start gap-3 w-full p-3 rounded-card border border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-hover transition-colors text-left cursor-pointer"
      >
        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-texto-primario">{variable.etiqueta}</span>
            {mostrarEntidad && (
              <span className="text-xxs px-1.5 py-0.5 rounded-full bg-superficie-hover text-texto-terciario font-medium">{mostrarEntidad}</span>
            )}
            <span className={`text-xxs px-1.5 py-0.5 rounded-full ${COLORES_ORIGEN[variable.origen]}`}>
              {variable.origen}
            </span>
            <span className="text-xxs px-1.5 py-0.5 rounded-full bg-superficie-hover text-texto-terciario">
              {ETIQUETAS_TIPO[variable.tipo_dato] || variable.tipo_dato}
            </span>
          </div>

          {variable.descripcion && (
            <p className="text-xs text-texto-terciario">{variable.descripcion}</p>
          )}

          {/* Clave técnica */}
          <code className="text-xs font-mono text-texto-marca/70 block">{claveCompleta}</code>

          {/* Preview del valor */}
          {tieneContexto && (
            <div className="mt-1.5 pt-1.5 border-t border-borde-sutil">
              {valor !== null ? (
                <span className="text-xs font-medium" style={{ color: 'var(--insignia-exito)' }}>
                  → {valor} {esCalculado && <span className="text-texto-terciario font-normal">(calculado)</span>}
                </span>
              ) : (
                <span className="text-xs text-texto-terciario italic">Sin datos</span>
              )}
            </div>
          )}
        </div>

        {/* Botón copiar */}
        <span className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: esCopiadoActual ? 'var(--insignia-exito)' : 'var(--texto-terciario)' }}>
          {esCopiadoActual ? <Check size={14} /> : <Copy size={14} />}
        </span>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-superficie-app">
      {/* Header */}
      <div className="border-b border-borde-sutil bg-superficie-tarjeta/50 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Boton variante="fantasma" tamano="xs" soloIcono icono={<ArrowLeft size={18} />} onClick={() => router.back()} titulo="Volver" />
            <div>
              <h1 className="text-xl font-semibold text-texto-primario">Variables del sistema</h1>
              <p className="text-sm text-texto-terciario">
                {entidades.length} entidades · {entidades.reduce((s, e) => s + e.variables.length, 0)} variables disponibles
              </p>
            </div>
          </div>

          {/* Selectores de datos reales */}
          <div className="mt-4 p-4 rounded-card border border-borde-sutil bg-superficie-app space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-texto-terciario">
                <Database size={14} />
                <span className="font-medium">Previsualizar con datos</span>
              </div>
              <div className="flex items-center gap-3">
                {cargandoDatos && <span className="text-xs text-texto-terciario animate-pulse">Cargando...</span>}
                <button
                  type="button"
                  onClick={() => setDatosFicticios(!datosFicticios)}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium transition-colors cursor-pointer border',
                    datosFicticios
                      ? 'bg-texto-marca/10 border-texto-marca/30 text-texto-marca'
                      : 'bg-transparent border-borde-sutil text-texto-terciario hover:text-texto-secundario',
                  ].join(' ')}
                >
                  <span className={`size-2 rounded-full transition-colors ${datosFicticios ? 'bg-texto-marca' : 'bg-texto-terciario/40'}`} />
                  Datos de ejemplo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Documento */}
              <div className="space-y-1">
                <label className="text-xxs font-medium text-texto-terciario uppercase tracking-wider">Documento</label>
                <ComboboxBuscable
                  valor={presupuestoId}
                  onChange={(v) => {
                    setPresupuestoId(v)
                    if (v) {
                      const pres = presupuestos.find(p => p.id === v)
                      if (pres?.contacto_id) setContactoId(pres.contacto_id)
                      // Si tiene atención, autoseleccionarla
                      if (pres?.atencion_contacto_id) setDirigidoAId(`pres_atencion_${pres.atencion_contacto_id}`)
                      else setDirigidoAId('')
                    } else {
                      setDirigidoAId('')
                    }
                  }}
                  placeholder="Buscar presupuesto..."
                  icono={<FileText size={14} />}
                  opciones={[
                    { valor: '', etiqueta: 'Ninguno' },
                    ...presupuestos.map(p => ({
                      valor: p.id,
                      etiqueta: `${p.numero} — ${[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}`,
                    })),
                  ]}
                />
              </div>
              {/* Contacto */}
              <div className="space-y-1">
                <label className="text-xxs font-medium text-texto-terciario uppercase tracking-wider">
                  Contacto
                  {hijosContacto.length > 0 && <span className="text-texto-marca ml-1">· {hijosContacto.length} vinculados</span>}
                </label>
                <ComboboxBuscable
                  valor={contactoId}
                  onChange={(v) => { setContactoId(v); setDirigidoAId('') }}
                  placeholder="Buscar contacto..."
                  icono={<User size={14} />}
                  opciones={opcionesContacto}
                />
              </div>
              {/* Dirigido a */}
              <div className="space-y-1">
                <label className="text-xxs font-medium text-texto-terciario uppercase tracking-wider">Dirigido a</label>
                <ComboboxBuscable
                  valor={dirigidoAId}
                  onChange={setDirigidoAId}
                  placeholder={opcionesDirigidoA.length <= 1 ? 'Seleccionar contacto primero...' : 'Buscar vinculado...'}
                  icono={<Building2 size={14} />}
                  opciones={opcionesDirigidoA}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout: sidebar de entidades + contenido */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">

          {/* Sidebar de entidades */}
          <div className="space-y-1">
            {/* Buscador */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-terciario" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar variable..."
                className="w-full pl-9 pr-3 py-2 rounded-card border border-borde-sutil bg-superficie-tarjeta text-sm text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-borde-foco transition-colors"
              />
            </div>

            {entidades.map(ent => {
              const activa = ent.clave === entidadActiva && !busqueda
              const c = conteoConDatos[ent.clave]
              return (
                <button
                  key={ent.clave}
                  type="button"
                  onClick={() => { setEntidadActiva(ent.clave); setBusqueda('') }}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-card text-left transition-colors cursor-pointer',
                    activa ? 'bg-superficie-seleccionada text-texto-marca' : 'text-texto-secundario hover:bg-superficie-hover',
                  ].join(' ')}
                >
                  <span className="shrink-0 flex items-center" style={{ color: activa ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
                    {ent.icono}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{ent.etiqueta}</span>
                  <span className="text-xxs shrink-0" style={{ color: 'var(--texto-terciario)' }}>
                    {tieneContexto && c ? (
                      <span>
                        <span style={{ color: c.con > 0 ? 'var(--insignia-exito)' : undefined }}>{c.con}</span>/{c.total}
                      </span>
                    ) : ent.variables.length}
                  </span>
                  <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--texto-terciario)', opacity: activa ? 1 : 0 }} />
                </button>
              )
            })}
          </div>

          {/* Contenido principal */}
          <div className="space-y-6">
            {/* Búsqueda global */}
            {resultadosBusqueda !== null ? (
              <div>
                <h2 className="text-base font-semibold text-texto-primario mb-3">
                  Resultados para &quot;{busqueda}&quot;
                  <span className="text-sm font-normal text-texto-terciario ml-2">({resultadosBusqueda.length})</span>
                </h2>
                {resultadosBusqueda.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {resultadosBusqueda.map(({ entidad, variable }) =>
                      renderVariable(variable, entidad.clave, entidad.etiqueta)
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-texto-terciario text-sm">
                    No se encontraron variables que coincidan
                  </div>
                )}
              </div>
            ) : (
              /* Variables de la entidad activa */
              <>
                {entidadInfo && (
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--texto-marca)' }}>{entidadInfo.icono}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-texto-primario">{entidadInfo.etiqueta}</h2>
                      <p className="text-sm text-texto-terciario">{entidadInfo.variables.length} variables</p>
                    </div>
                  </div>
                )}

                {gruposActivos.map(grupo => (
                  <div key={grupo.clave}>
                    {gruposActivos.length > 1 && (
                      <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
                        {grupo.etiqueta}
                      </h3>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {grupo.variables.map(v => renderVariable(v, entidadActiva))}
                    </div>
                  </div>
                ))}

                {gruposActivos.length === 0 && (
                  <div className="text-center py-12 text-texto-terciario text-sm">
                    Esta entidad no tiene variables registradas
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
