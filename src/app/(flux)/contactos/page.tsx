'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  UserPlus, Download, Upload, Users, UserRoundSearch, Building2, Building, Truck,
  User, Tag, Hash, CreditCard, Link2, Mail, Phone, MessageCircle, Briefcase, Factory,
  Globe, MapPin, Tags, StickyNote, Calendar, Receipt, GraduationCap,
  Languages, Clock, Coins, Landmark, FileText, Star, Compass, ShieldCheck,
  Trash2, X,
} from 'lucide-react'
import { ModalImportar } from './_componentes/ModalImportar'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Avatar } from '@/componentes/ui/Avatar'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import type { TipoContacto } from '@/tipos'

// Tipo para las filas de la tabla — incluye todos los campos del API
interface FilaContacto {
  id: string
  codigo: string
  nombre: string
  apellido: string | null
  titulo: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  web: string | null
  cargo: string | null
  rubro: string | null
  moneda: string | null
  idioma: string | null
  zona_horaria: string | null
  pais_fiscal: string | null
  tipo_identificacion: string | null
  numero_identificacion: string | null
  datos_fiscales: Record<string, string> | null
  limite_credito: string | null
  plazo_pago_cliente: string | null
  plazo_pago_proveedor: string | null
  rank_cliente: number | null
  rank_proveedor: number | null
  etiquetas: string[]
  notas: string | null
  activo: boolean
  origen: string
  creado_por: string
  creado_en: string
  actualizado_en: string
  tipo_contacto: Pick<TipoContacto, 'id' | 'clave' | 'etiqueta' | 'icono' | 'color'>
  direcciones: { id: string; calle: string | null; texto: string | null; ciudad: string | null; provincia: string | null; es_principal: boolean }[]
  responsables: { usuario_id: string }[]
  vinculaciones: { vinculado: { id: string; nombre: string; apellido: string | null } }[]
}

const POR_PAGINA = 50

export default function PaginaContactos() {
  const { t } = useTraduccion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const vinculadoDe = searchParams.get('vinculado_de')
  const origenUrl = searchParams.get('origen')
  const [busqueda, setBusqueda] = useState('')
  const [contactos, setContactos] = useState<FilaContacto[]>([])
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const [modalImportar, setModalImportar] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [nombreFiltro, setNombreFiltro] = useState<string | null>(null)

  // Ref para tener siempre el valor actual de busqueda sin re-crear callbacks
  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  const pathname = usePathname()
  const { setMigajaDinamica } = useNavegacion()

  // Resolver nombre del contacto filtrado + migaja
  useEffect(() => {
    if (!vinculadoDe) { setNombreFiltro(null); return }
    fetch(`/api/contactos/${vinculadoDe}`)
      .then(r => r.json())
      .then(d => {
        const nombre = d.nombre ? `${d.nombre}${d.apellido ? ` ${d.apellido}` : ''}` : null
        setNombreFiltro(nombre)
        if (nombre && origenUrl) {
          setMigajaDinamica(origenUrl, nombre)
        }
      })
      .catch(() => {})
  }, [vinculadoDe, origenUrl, setMigajaDinamica])

  // Eliminar contactos en lote
  const eliminarContactosLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/contactos/${id}`, { method: 'DELETE' })
        )
      )
      setContactos(prev => prev.filter(c => !ids.has(c.id)))
      setTotal(prev => prev - ids.size)
    } catch (err) {
      console.error('Error al eliminar contactos:', err)
    }
  }, [])

  // Fetch de contactos — función estable
  const fetchContactos = useCallback(async (p: number) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      const b = busquedaRef.current
      if (b) params.set('busqueda', b)
      if (vinculadoDe) params.set('vinculado_de', vinculadoDe)
      params.set('pagina', String(p))
      params.set('por_pagina', String(POR_PAGINA))

      const res = await fetch(`/api/contactos?${params}`)
      const data = await res.json()

      if (data.contactos) {
        setContactos(data.contactos)
        setTotal(data.total)
      }
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [vinculadoDe])

  // Cargar tipos (solo una vez)
  const cargaInicialRef = useRef(false)
  useEffect(() => {
    if (cargaInicialRef.current) return
    cargaInicialRef.current = true
    fetch('/api/contactos/tipos').then(r => r.json()).then(tipos => {
      if (tipos.tipos_contacto) setTiposContacto(tipos.tipos_contacto)
    }).catch(() => {})
  }, [])

  // Cargar contactos al cambiar página
  useEffect(() => {
    fetchContactos(pagina)
  }, [pagina, fetchContactos])

  // Recargar al cambiar búsqueda (con debounce, reseteando a página 1)
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    const timeout = setTimeout(() => {
      if (pagina === 1) {
        // Ya estamos en página 1, el efecto de pagina no se dispara, llamar directo
        fetchContactos(1)
      } else {
        // Cambiar a página 1 dispara el efecto de arriba
        setPagina(1)
      }
    }, 300)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // Wrapper para importación y otros re-fetches
  const recargarContactos = useCallback(() => {
    setPagina(1)
    fetchContactos(1)
  }, [fetchContactos])

  // Helpers de formato
  const ETIQUETAS_IVA: Record<string, string> = {
    responsable_inscripto: 'Resp. Inscripto', monotributista: 'Monotributista',
    exento: 'Exento', consumidor_final: 'Cons. Final', no_responsable: 'No Responsable',
  }
  const ETIQUETAS_ORIGEN: Record<string, string> = {
    manual: 'Manual', importacion: 'Importación', ia_captador: 'IA Captador', usuario: 'Usuario',
  }
  const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

  /** Columnas visibles por defecto — las esenciales para el día a día */
  const COLUMNAS_VISIBLES_DEFAULT = ['codigo', 'nombre', 'correo', 'whatsapp', 'ubicacion', 'etiquetas']

  /* ── Columnas de la tabla ──
     Orden lógico: identidad → contacto → laboral → comercial → fiscal → metadata
     Visibles por defecto: las más usadas en el día a día
     Columnas TODO (sin datos aún) eliminadas — se agregan cuando el módulo exista */
  const I = 12
  const columnas: ColumnaDinamica<FilaContacto>[] = [

    /* ── Identidad ── */
    {
      clave: 'codigo', etiqueta: t('comun.codigo'), ancho: 90, ordenable: true, grupo: t('comun.identidad'), icono: <Hash size={I} />,
      render: (fila) => <span className="text-xs font-mono text-texto-terciario">{fila.codigo}</span>,
    },
    {
      clave: 'nombre', etiqueta: t('comun.contacto'), ancho: 260, ordenable: true, grupo: t('comun.identidad'), icono: <User size={I} />,
      render: (fila) => {
        const clave = fila.tipo_contacto?.clave || 'persona'
        const color = COLOR_TIPO_CONTACTO[clave] || 'primario'
        const esPersona = ['persona', 'lead', 'equipo'].includes(clave)
        const nombreCompleto = `${fila.nombre}${fila.apellido ? ` ${fila.apellido}` : ''}`
        const iniciales = nombreCompleto.split(/\s+/).filter(Boolean).map((p, i, arr) => i === 0 || i === arr.length - 1 ? p[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2)
        const tipo = fila.tipo_contacto
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
              {esPersona ? iniciales : (clave === 'edificio' ? <Building size={14} /> : clave === 'proveedor' ? <Truck size={14} /> : <Building2 size={14} />)}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-texto-primario truncate">{nombreCompleto}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {tipo && (
                  <span className="inline-flex items-center rounded-full px-1.5 py-px text-xxs font-medium whitespace-nowrap"
                    style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
                    {tipo.etiqueta}
                  </span>
                )}
                {fila.cargo && <span className="text-xs text-texto-terciario truncate">{fila.cargo}</span>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      clave: 'tipo', etiqueta: t('comun.tipo'), ancho: 120, ordenable: true, grupo: t('comun.identidad'), icono: <Tag size={I} />,
      filtrable: true, tipoFiltro: 'pills',
      opcionesFiltro: tiposContacto.map(t => ({ valor: t.clave, etiqueta: t.etiqueta })),
      obtenerValor: (fila) => fila.tipo_contacto?.clave || '',
      render: (fila) => {
        const tipo = fila.tipo_contacto
        if (!tipo) return null
        return <Insignia color={(COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro') as ColorInsignia}>{tipo.etiqueta}</Insignia>
      },
    },
    {
      clave: 'titulo', etiqueta: t('contactos.titulo_campo'), ancho: 80, grupo: t('comun.identidad'), icono: <GraduationCap size={I} />,
      render: (fila) => fila.titulo ? <span className="text-texto-secundario text-xs">{fila.titulo}</span> : null,
    },
    {
      clave: 'identificacion', etiqueta: t('contactos.identificacion'), ancho: 160, grupo: t('comun.identidad'), icono: <CreditCard size={I} />,
      render: (fila) => {
        const num = fila.numero_identificacion || fila.datos_fiscales?.cuit || fila.datos_fiscales?.dni
        if (!num) return null
        const limpio = num.replace(/\D/g, '')
        const tipo = fila.tipo_identificacion?.toUpperCase() || (limpio.length === 11 ? 'CUIT' : limpio.length >= 7 && limpio.length <= 8 ? 'DNI' : '')
        return (
          <div className="min-w-0">
            <div className="font-mono text-xs text-texto-secundario">{num}</div>
            {tipo && <div className="text-xxs text-texto-terciario">{tipo}</div>}
          </div>
        )
      },
    },
    {
      clave: 'vinculado_a', etiqueta: t('contactos.vinculado_a'), ancho: 180, grupo: t('comun.identidad'), icono: <Link2 size={I} />,
      render: (fila) => {
        const vinc = fila.vinculaciones?.[0]?.vinculado
        if (!vinc) return null
        const nombre = `${vinc.nombre}${vinc.apellido ? ` ${vinc.apellido}` : ''}`
        const mas = (fila.vinculaciones?.length || 0) - 1
        return (
          <span className="text-texto-secundario text-xs truncate">
            {nombre}{mas > 0 && <span className="text-texto-terciario"> +{mas}</span>}
          </span>
        )
      },
    },

    /* ── Contacto ── */
    {
      clave: 'correo', etiqueta: t('contactos.correo'), ancho: 220, ordenable: true, grupo: t('comun.contacto'), icono: <Mail size={I} />,
      render: (fila) => fila.correo ? <span className="text-texto-secundario truncate">{fila.correo}</span> : null,
    },
    {
      clave: 'telefono', etiqueta: t('contactos.telefono'), ancho: 150, grupo: t('comun.contacto'), icono: <Phone size={I} />,
      render: (fila) => fila.telefono ? <span className="text-texto-secundario">{fila.telefono}</span> : null,
    },
    {
      clave: 'whatsapp', etiqueta: t('contactos.whatsapp'), ancho: 150, grupo: t('comun.contacto'), icono: <MessageCircle size={I} />,
      render: (fila) => fila.whatsapp ? <span className="text-texto-secundario">{fila.whatsapp}</span> : null,
    },
    {
      clave: 'ubicacion', etiqueta: t('contactos.direccion'), ancho: 200, grupo: t('comun.contacto'), icono: <MapPin size={I} />,
      render: (fila) => {
        const dir = fila.direcciones?.find(d => d.es_principal) || fila.direcciones?.[0]
        if (!dir) return null
        const calle = dir.calle || dir.texto
        return calle ? (
          <div className="min-w-0">
            <span className="text-texto-secundario truncate block">{calle}</span>
            {dir.ciudad && <span className="text-texto-terciario text-xs truncate block">{dir.ciudad}{dir.provincia ? `, ${dir.provincia}` : ''}</span>}
          </div>
        ) : null
      },
    },
    {
      clave: 'web', etiqueta: t('comun.web'), ancho: 180, grupo: t('comun.contacto'), icono: <Globe size={I} />,
      render: (fila) => fila.web ? <span className="text-texto-secundario truncate text-xs">{fila.web}</span> : null,
    },

    /* ── Laboral ── */
    {
      clave: 'cargo', etiqueta: t('comun.cargo'), ancho: 160, ordenable: true, grupo: t('comun.laboral'), icono: <Briefcase size={I} />,
      render: (fila) => fila.cargo ? <span className="text-texto-secundario truncate">{fila.cargo}</span> : null,
    },
    {
      clave: 'rubro', etiqueta: t('comun.rubro'), ancho: 160, ordenable: true, grupo: t('comun.laboral'), icono: <Factory size={I} />,
      render: (fila) => fila.rubro ? <span className="text-texto-secundario truncate">{fila.rubro}</span> : null,
    },

    /* ── Comercial ── */
    {
      clave: 'moneda', etiqueta: t('comun.moneda_label'), ancho: 80, grupo: t('comun.comercial'), icono: <Coins size={I} />,
      render: (fila) => fila.moneda ? <span className="text-texto-terciario text-xs font-mono">{fila.moneda}</span> : null,
    },
    {
      clave: 'limite_credito', etiqueta: t('contactos.limite_credito'), ancho: 130, tipo: 'moneda', grupo: t('comun.comercial'), icono: <Landmark size={I} />,
      alineacion: 'right', resumen: 'suma',
      render: (fila) => fila.limite_credito && Number(fila.limite_credito) > 0
        ? <span className="text-texto-secundario text-xs font-mono">{Number(fila.limite_credito).toLocaleString('es-AR')}</span>
        : null,
    },
    {
      clave: 'plazo_pago_cliente', etiqueta: t('contactos.plazo_cliente'), ancho: 120, grupo: t('comun.comercial'), icono: <Calendar size={I} />,
      render: (fila) => fila.plazo_pago_cliente ? <span className="text-texto-secundario text-xs">{fila.plazo_pago_cliente}</span> : null,
    },
    {
      clave: 'plazo_pago_proveedor', etiqueta: t('contactos.plazo_proveedor'), ancho: 130, grupo: t('comun.comercial'), icono: <Calendar size={I} />,
      render: (fila) => fila.plazo_pago_proveedor ? <span className="text-texto-secundario text-xs">{fila.plazo_pago_proveedor}</span> : null,
    },
    {
      clave: 'rank_cliente', etiqueta: t('contactos.rank_cliente'), ancho: 110, tipo: 'numero', grupo: t('comun.comercial'), icono: <Star size={I} />,
      alineacion: 'center', resumen: 'promedio',
      render: (fila) => fila.rank_cliente ? <span className="text-texto-secundario text-xs">{fila.rank_cliente}</span> : null,
    },
    {
      clave: 'rank_proveedor', etiqueta: t('contactos.rank_proveedor'), ancho: 120, tipo: 'numero', grupo: t('comun.comercial'), icono: <Star size={I} />,
      alineacion: 'center', resumen: 'promedio',
      render: (fila) => fila.rank_proveedor ? <span className="text-texto-secundario text-xs">{fila.rank_proveedor}</span> : null,
    },
    {
      clave: 'idioma', etiqueta: t('comun.idioma'), ancho: 80, grupo: t('comun.comercial'), icono: <Languages size={I} />,
      render: (fila) => fila.idioma ? <span className="text-texto-terciario text-xs">{fila.idioma.toUpperCase()}</span> : null,
    },
    {
      clave: 'zona_horaria', etiqueta: t('comun.zona_horaria'), ancho: 140, grupo: t('comun.comercial'), icono: <Clock size={I} />,
      render: (fila) => fila.zona_horaria ? <span className="text-texto-terciario text-xs">{fila.zona_horaria}</span> : null,
    },

    /* ── Fiscal ── */
    {
      clave: 'condicion_iva', etiqueta: t('contactos.condicion_iva'), ancho: 140, grupo: t('comun.fiscal'), icono: <Receipt size={I} />,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'responsable_inscripto', etiqueta: t('contactos.iva_resp_inscripto') },
        { valor: 'monotributista', etiqueta: t('contactos.iva_monotributista') },
        { valor: 'exento', etiqueta: t('contactos.iva_exento') },
        { valor: 'consumidor_final', etiqueta: t('contactos.iva_cons_final') },
        { valor: 'no_responsable', etiqueta: t('contactos.iva_no_responsable') },
      ],
      obtenerValor: (fila) => fila.datos_fiscales?.condicion_iva || '',
      render: (fila) => {
        const c = fila.datos_fiscales?.condicion_iva
        return c ? <span className="text-texto-secundario text-xs">{ETIQUETAS_IVA[c] || c}</span> : null
      },
    },
    {
      clave: 'posicion_fiscal', etiqueta: t('contactos.posicion_fiscal'), ancho: 120, grupo: t('comun.fiscal'), icono: <ShieldCheck size={I} />,
      render: (fila) => {
        const pf = fila.datos_fiscales?.posicion_fiscal
        return pf ? <span className="text-texto-secundario text-xs">{pf}</span> : null
      },
    },
    {
      clave: 'tipo_iibb', etiqueta: t('contactos.tipo_iibb'), ancho: 120, grupo: t('comun.fiscal'), icono: <FileText size={I} />,
      render: (fila) => {
        const t = fila.datos_fiscales?.tipo_iibb
        return t ? <span className="text-texto-secundario text-xs">{t}</span> : null
      },
    },
    {
      clave: 'numero_iibb', etiqueta: t('contactos.nro_iibb'), ancho: 130, grupo: t('comun.fiscal'), icono: <Hash size={I} />,
      render: (fila) => {
        const n = fila.datos_fiscales?.numero_iibb
        return n ? <span className="text-texto-secundario text-xs font-mono">{n}</span> : null
      },
    },

    /* ── Metadata ── */
    {
      clave: 'etiquetas', etiqueta: t('contactos.etiquetas'), ancho: 200, grupo: t('comun.metadata'), icono: <Tags size={I} />,
      render: (fila) => fila.etiquetas?.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          {fila.etiquetas.slice(0, 2).map(e => <Insignia key={e} color="neutro">{e}</Insignia>)}
          {fila.etiquetas.length > 2 && <span className="text-xs text-texto-terciario">+{fila.etiquetas.length - 2}</span>}
        </div>
      ) : null,
    },
    {
      clave: 'origen', etiqueta: t('comun.origen'), ancho: 110, grupo: t('comun.metadata'), icono: <Compass size={I} />,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'manual', etiqueta: t('contactos.origen_manual') },
        { valor: 'importacion', etiqueta: t('contactos.origen_importacion') },
        { valor: 'ia_captador', etiqueta: t('contactos.origen_ia') },
        { valor: 'usuario', etiqueta: t('contactos.origen_usuario') },
      ],
      render: (fila) => <span className="text-texto-terciario text-xs">{ETIQUETAS_ORIGEN[fila.origen] || fila.origen}</span>,
    },
    {
      clave: 'notas', etiqueta: t('comun.notas'), ancho: 200, grupo: t('comun.metadata'), icono: <StickyNote size={I} />,
      render: (fila) => fila.notas ? <span className="text-texto-terciario text-xs truncate">{fila.notas.slice(0, 80)}</span> : null,
    },
    {
      clave: 'creado_en', etiqueta: t('comun.creacion'), ancho: 120, ordenable: true, tipo: 'fecha', grupo: t('comun.metadata'), icono: <Calendar size={I} />,
      render: (fila) => <span className="text-texto-terciario text-xs">{formatoFecha(fila.creado_en)}</span>,
    },
  ]

  // Renderizar tarjeta para vista de tarjetas
  const renderizarTarjeta = (fila: FilaContacto) => {
    const tipo = fila.tipo_contacto
    const color = tipo ? (COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro') as ColorInsignia : 'neutro'
    const nombreCompleto = `${fila.nombre}${fila.apellido ? ` ${fila.apellido}` : ''}`
    const dir = fila.direcciones?.find(d => d.es_principal) || fila.direcciones?.[0]
    const ubicacion = dir?.calle || dir?.texto
    const tieneDetalle = fila.telefono || fila.whatsapp || ubicacion

    return (
      <div className="p-4 flex flex-col gap-3">
        {/* ── Identidad ── */}
        <div className="flex items-center gap-2.5">
          <Avatar nombre={nombreCompleto} tamano="md" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-texto-primario truncate">{nombreCompleto}</div>
            <div className="text-xs text-texto-terciario truncate">{fila.correo || t('comun.sin_correo')}</div>
          </div>
        </div>

        {/* ── Tipo + Cargo ── */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {tipo && <Insignia color={color} tamano="sm">{tipo.etiqueta}</Insignia>}
            {fila.codigo && <span className="text-xs text-texto-terciario font-mono">{fila.codigo}</span>}
          </div>
          {fila.cargo && <p className="text-xs text-texto-terciario truncate">{fila.cargo}{fila.rubro ? ` · ${fila.rubro}` : ''}</p>}
        </div>

        {/* ── Etiquetas ── */}
        {fila.etiquetas?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {fila.etiquetas.slice(0, 3).map(e => (
              <Insignia key={e} color="neutro" tamano="sm">{e}</Insignia>
            ))}
            {fila.etiquetas.length > 3 && <span className="text-xs text-texto-terciario">+{fila.etiquetas.length - 3}</span>}
          </div>
        )}

        {/* ── Detalle ── */}
        {tieneDetalle && (
          <div className="border-t border-borde-sutil pt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-terciario">
            {(fila.telefono || fila.whatsapp) && (
              <span className="flex items-center gap-1">
                <Phone size={10} className="shrink-0" />
                {fila.telefono || fila.whatsapp}
              </span>
            )}
            {ubicacion && (
              <span className="flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                {ubicacion}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <PlantillaListado
      titulo={t('contactos.titulo')}
      icono={<Users size={20} />}
      accionPrincipal={{
        etiqueta: t('contactos.nuevo'),
        icono: <UserPlus size={14} />,
        onClick: () => router.push('/contactos/nuevo'),
      }}
      acciones={[
        { id: 'importar', etiqueta: t('comun.importar'), icono: <Upload size={14} />, onClick: () => setModalImportar(true) },
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: async () => {
          const res = await fetch('/api/contactos/exportar')
          if (!res.ok) return
          const blob = await res.blob()
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `contactos_${new Date().toISOString().slice(0, 10)}.xlsx`
          a.click()
          URL.revokeObjectURL(a.href)
        }},
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/contactos/configuracion')}
    >
      <TablaDinamica
        chipFiltro={vinculadoDe && nombreFiltro ? (
          <button
            type="button"
            onClick={() => router.replace('/contactos')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-superficie-elevada text-texto-primario border border-borde-sutil hover:border-borde-fuerte transition-colors cursor-pointer shrink-0"
          >
            {nombreFiltro}
            <X size={10} className="text-texto-terciario" />
          </button>
        ) : undefined}
        columnas={columnas}
        datos={contactos}
        claveFila={(r) => r.id}
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        vistas={['lista', 'tarjetas']}
        seleccionables
        accionesLote={[
          {
            id: 'eliminar',
            etiqueta: t('comun.eliminar'),
            icono: <Trash2 size={14} />,
            onClick: eliminarContactosLote,
            peligro: true,
          },
        ]}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder={t('contactos.buscar_placeholder')}
        idModulo="contactos"
        columnasVisiblesDefault={COLUMNAS_VISIBLES_DEFAULT}
        opcionesOrden={[
          { etiqueta: t('comun.mas_recientes'), clave: 'creado_en', direccion: 'desc' },
          { etiqueta: t('comun.mas_antiguos'), clave: 'creado_en', direccion: 'asc' },
          { etiqueta: t('comun.nombre_az'), clave: 'nombre', direccion: 'asc' },
          { etiqueta: t('comun.nombre_za'), clave: 'nombre', direccion: 'desc' },
        ]}
        onClickFila={(fila) => {
          // Guardar IDs de la lista actual para navegación anterior/siguiente
          try { sessionStorage.setItem('contactos_lista_ids', JSON.stringify(contactos.map(c => c.id))) } catch {}
          router.push(`/contactos/${fila.id}`)
        }}
        renderTarjeta={renderizarTarjeta}
        mostrarResumen
        estadoVacio={
          <EstadoVacio
            icono={<UserRoundSearch size={52} strokeWidth={1} />}
            titulo="Por acá se está muy solo..."
            descripcion={t('contactos.descripcion_vacia')}
            accion={
              <Boton onClick={() => router.push('/contactos/nuevo')}>
                Sumar primer contacto
              </Boton>
            }
          />
        }
      />
    </PlantillaListado>

    {/* Modal de importación con pasos (subir, mapear, preview, importar, resultado) */}
    <ModalImportar
      abierto={modalImportar}
      onCerrar={() => setModalImportar(false)}
      onImportacionCompleta={recargarContactos}
    />
    </>
  )
}
