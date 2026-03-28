'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  UserPlus, Download, Upload, Users, UserRoundSearch, Building2, Building, Truck,
  User, Tag, Hash, CreditCard, Link2, Mail, Phone, MessageCircle, Briefcase, Factory,
  Globe, MapPin, Tags, StickyNote, Calendar, UserCheck, Receipt, GraduationCap,
  Languages, Clock, Coins, Landmark, FileText, Star, Compass, ShieldCheck,
  Activity, FileBox, History, Trash2,
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
  direcciones: { id: string; texto: string | null; ciudad: string | null; provincia: string | null; es_principal: boolean }[]
  responsables: { usuario_id: string }[]
  vinculaciones: { vinculado: { id: string; nombre: string; apellido: string | null } }[]
}

const POR_PAGINA = 50

export default function PaginaContactos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [contactos, setContactos] = useState<FilaContacto[]>([])
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const [modalImportar, setModalImportar] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)

  // Ref para tener siempre el valor actual de busqueda sin re-crear callbacks
  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

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
  }, [])

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

  // 31 columnas — paridad con el viejo SalixCRM
  // El usuario oculta/muestra desde el panel de columnas de TablaDinamica
  const I = 12 // tamaño iconos columnas
  const columnas: ColumnaDinamica<FilaContacto>[] = [
    // ── IDENTIDAD ──
    {
      clave: 'nombre', etiqueta: 'Contacto', ancho: 250, ordenable: true, grupo: 'Identidad', icono: <User size={I} />,
      render: (fila) => {
        const clave = fila.tipo_contacto?.clave || 'persona'
        const color = COLOR_TIPO_CONTACTO[clave] || 'primario'
        const esPersona = ['persona', 'lead', 'equipo'].includes(clave)
        const nombreCompleto = `${fila.nombre}${fila.apellido ? ` ${fila.apellido}` : ''}`
        const iniciales = nombreCompleto.split(/\s+/).filter(Boolean).map((p, i, arr) => i === 0 || i === arr.length - 1 ? p[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2)
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
              {esPersona ? iniciales : (clave === 'edificio' ? <Building size={14} /> : clave === 'proveedor' ? <Truck size={14} /> : <Building2 size={14} />)}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-texto-primario truncate">{nombreCompleto}</div>
              {fila.cargo && <div className="text-xs text-texto-terciario truncate">{fila.cargo}</div>}
            </div>
          </div>
        )
      },
    },
    // 2. Tipo
    {
      clave: 'tipo', etiqueta: 'Tipo', ancho: 120, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      filtrable: true, tipoFiltro: 'multiple',
      opcionesFiltro: tiposContacto.map(t => ({ valor: t.clave, etiqueta: t.etiqueta })),
      obtenerValor: (fila) => fila.tipo_contacto?.clave || '',
      render: (fila) => {
        const tipo = fila.tipo_contacto
        if (!tipo) return null
        return <Insignia color={(COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro') as ColorInsignia}>{tipo.etiqueta}</Insignia>
      },
    },
    // 3. Código
    {
      clave: 'codigo', etiqueta: 'Código', ancho: 100, ordenable: true, grupo: 'Identidad', icono: <Hash size={I} />,
      render: (fila) => <span className="text-xs font-mono text-texto-terciario">{fila.codigo}</span>,
    },
    // 4. Identificación (CUIT/DNI)
    {
      clave: 'identificacion', etiqueta: 'Identificación', ancho: 160, grupo: 'Identidad', icono: <CreditCard size={I} />,
      render: (fila) => {
        const num = fila.numero_identificacion || fila.datos_fiscales?.cuit || fila.datos_fiscales?.dni
        if (!num) return null
        const tipo = fila.tipo_identificacion?.toUpperCase() || ''
        return <span className="text-texto-secundario text-xs">{tipo ? `${tipo}: ` : ''}{num}</span>
      },
    },
    // 5. Vinculado a
    {
      clave: 'vinculado_a', etiqueta: 'Vinculado a', ancho: 180, grupo: 'Identidad', icono: <Link2 size={I} />,
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
    // 6. Email
    {
      clave: 'correo', etiqueta: 'Email', ancho: 220, ordenable: true, grupo: 'Contacto', icono: <Mail size={I} />,
      render: (fila) => fila.correo ? <span className="text-texto-secundario truncate">{fila.correo}</span> : null,
    },
    // 7. Teléfono
    {
      clave: 'telefono', etiqueta: 'Teléfono', ancho: 150, grupo: 'Contacto', icono: <Phone size={I} />,
      render: (fila) => fila.telefono ? <span className="text-texto-secundario">{fila.telefono}</span> : null,
    },
    // 8. WhatsApp
    {
      clave: 'whatsapp', etiqueta: 'WhatsApp', ancho: 150, grupo: 'Contacto', icono: <MessageCircle size={I} />,
      render: (fila) => fila.whatsapp ? <span className="text-texto-secundario">{fila.whatsapp}</span> : null,
    },
    // 9. Cargo
    {
      clave: 'cargo', etiqueta: 'Cargo', ancho: 160, ordenable: true, grupo: 'Laboral', icono: <Briefcase size={I} />,
      render: (fila) => fila.cargo ? <span className="text-texto-secundario truncate">{fila.cargo}</span> : null,
    },
    // 10. Rubro
    {
      clave: 'rubro', etiqueta: 'Rubro', ancho: 160, ordenable: true, grupo: 'Laboral', icono: <Factory size={I} />,
      render: (fila) => fila.rubro ? <span className="text-texto-secundario truncate">{fila.rubro}</span> : null,
    },
    // 11. Web
    {
      clave: 'web', etiqueta: 'Web', ancho: 180, grupo: 'Contacto', icono: <Globe size={I} />,
      render: (fila) => fila.web ? <span className="text-texto-secundario truncate text-xs">{fila.web}</span> : null,
    },
    // 12. Dirección
    {
      clave: 'ubicacion', etiqueta: 'Dirección', ancho: 200, grupo: 'Contacto', icono: <MapPin size={I} />,
      render: (fila) => {
        const dir = fila.direcciones?.find(d => d.es_principal) || fila.direcciones?.[0]
        const texto = dir?.ciudad || dir?.texto
        return texto ? <span className="text-texto-terciario truncate">{texto}</span> : null
      },
    },
    // 13. Etiquetas
    {
      clave: 'etiquetas', etiqueta: 'Etiquetas', ancho: 200, grupo: 'Metadata', icono: <Tags size={I} />,
      render: (fila) => fila.etiquetas?.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          {fila.etiquetas.slice(0, 2).map(e => <Insignia key={e} color="neutro">{e}</Insignia>)}
          {fila.etiquetas.length > 2 && <span className="text-xs text-texto-terciario">+{fila.etiquetas.length - 2}</span>}
        </div>
      ) : null,
    },
    // 14. Notas
    {
      clave: 'notas', etiqueta: 'Notas', ancho: 200, grupo: 'Metadata', icono: <StickyNote size={I} />,
      render: (fila) => fila.notas ? <span className="text-texto-terciario text-xs truncate">{fila.notas.slice(0, 80)}</span> : null,
    },
    // 15. Creación
    {
      clave: 'creado_en', etiqueta: 'Creación', ancho: 120, ordenable: true, tipo: 'fecha', grupo: 'Metadata', icono: <Calendar size={I} />,
      render: (fila) => <span className="text-texto-terciario text-xs">{formatoFecha(fila.creado_en)}</span>,
    },
    // 16. Creado por
    {
      clave: 'creado_por', etiqueta: 'Creado por', ancho: 120, grupo: 'Metadata', icono: <UserCheck size={I} />,
      render: () => null, // TODO: resolver nombre del usuario desde creado_por UUID
    },
    // 17. Cond. IVA
    {
      clave: 'condicion_iva', etiqueta: 'Cond. IVA', ancho: 140, grupo: 'Fiscal', icono: <Receipt size={I} />,
      render: (fila) => {
        const c = fila.datos_fiscales?.condicion_iva
        return c ? <span className="text-texto-secundario text-xs">{ETIQUETAS_IVA[c] || c}</span> : null
      },
    },
    // 18. Título (Sr., Dra., Ing.)
    {
      clave: 'titulo', etiqueta: 'Título', ancho: 80, grupo: 'Identidad', icono: <GraduationCap size={I} />,
      render: (fila) => fila.titulo ? <span className="text-texto-secundario text-xs">{fila.titulo}</span> : null,
    },
    // 19. Idioma
    {
      clave: 'idioma', etiqueta: 'Idioma', ancho: 80, grupo: 'Comercial', icono: <Languages size={I} />,
      render: (fila) => fila.idioma ? <span className="text-texto-terciario text-xs">{fila.idioma.toUpperCase()}</span> : null,
    },
    // 20. Zona Horaria
    {
      clave: 'zona_horaria', etiqueta: 'Zona Horaria', ancho: 140, grupo: 'Comercial', icono: <Clock size={I} />,
      render: (fila) => fila.zona_horaria ? <span className="text-texto-terciario text-xs">{fila.zona_horaria}</span> : null,
    },
    // 21. Moneda
    {
      clave: 'moneda', etiqueta: 'Moneda', ancho: 80, grupo: 'Comercial', icono: <Coins size={I} />,
      render: (fila) => fila.moneda ? <span className="text-texto-terciario text-xs font-mono">{fila.moneda}</span> : null,
    },
    // 22. Lím. Crédito
    {
      clave: 'limite_credito', etiqueta: 'Lím. Crédito', ancho: 130, tipo: 'moneda', grupo: 'Comercial', icono: <Landmark size={I} />,
      alineacion: 'right',
      render: (fila) => fila.limite_credito && Number(fila.limite_credito) > 0
        ? <span className="text-texto-secundario text-xs font-mono">{Number(fila.limite_credito).toLocaleString('es-AR')}</span>
        : null,
    },
    // 23. Plazo Cliente
    {
      clave: 'plazo_pago_cliente', etiqueta: 'Plazo Cliente', ancho: 120, grupo: 'Comercial', icono: <Calendar size={I} />,
      render: (fila) => fila.plazo_pago_cliente ? <span className="text-texto-secundario text-xs">{fila.plazo_pago_cliente}</span> : null,
    },
    // 24. Plazo Proveedor
    {
      clave: 'plazo_pago_proveedor', etiqueta: 'Plazo Proveedor', ancho: 130, grupo: 'Comercial', icono: <Calendar size={I} />,
      render: (fila) => fila.plazo_pago_proveedor ? <span className="text-texto-secundario text-xs">{fila.plazo_pago_proveedor}</span> : null,
    },
    // 25. Pos. Fiscal
    {
      clave: 'posicion_fiscal', etiqueta: 'Pos. Fiscal', ancho: 120, grupo: 'Fiscal', icono: <ShieldCheck size={I} />,
      render: (fila) => {
        const pf = fila.datos_fiscales?.posicion_fiscal
        return pf ? <span className="text-texto-secundario text-xs">{pf}</span> : null
      },
    },
    // 26. Tipo IIBB
    {
      clave: 'tipo_iibb', etiqueta: 'Tipo IIBB', ancho: 120, grupo: 'Fiscal', icono: <FileText size={I} />,
      render: (fila) => {
        const t = fila.datos_fiscales?.tipo_iibb
        return t ? <span className="text-texto-secundario text-xs">{t}</span> : null
      },
    },
    // 27. Nro. IIBB
    {
      clave: 'numero_iibb', etiqueta: 'Nro. IIBB', ancho: 130, grupo: 'Fiscal', icono: <Hash size={I} />,
      render: (fila) => {
        const n = fila.datos_fiscales?.numero_iibb
        return n ? <span className="text-texto-secundario text-xs font-mono">{n}</span> : null
      },
    },
    // 28. Rank Cliente
    {
      clave: 'rank_cliente', etiqueta: 'Rank Cliente', ancho: 110, tipo: 'numero', grupo: 'Comercial', icono: <Star size={I} />,
      alineacion: 'center',
      render: (fila) => fila.rank_cliente ? <span className="text-texto-secundario text-xs">{fila.rank_cliente}</span> : null,
    },
    // 29. Rank Proveedor
    {
      clave: 'rank_proveedor', etiqueta: 'Rank Proveedor', ancho: 120, tipo: 'numero', grupo: 'Comercial', icono: <Star size={I} />,
      alineacion: 'center',
      render: (fila) => fila.rank_proveedor ? <span className="text-texto-secundario text-xs">{fila.rank_proveedor}</span> : null,
    },
    // 30. Origen
    {
      clave: 'origen', etiqueta: 'Origen', ancho: 110, grupo: 'Metadata', icono: <Compass size={I} />,
      render: (fila) => <span className="text-texto-terciario text-xs">{ETIQUETAS_ORIGEN[fila.origen] || fila.origen}</span>,
    },
    // 31. Asignado (primer responsable)
    {
      clave: 'asignado', etiqueta: 'Asignado', ancho: 120, grupo: 'Metadata', icono: <UserCheck size={I} />,
      render: () => null, // TODO: resolver nombre del usuario desde responsables[0].usuario_id
    },
    // 32. Etapa (pipeline)
    {
      clave: 'etapa', etiqueta: 'Etapa', ancho: 120, grupo: 'Comercial', icono: <Activity size={I} />,
      render: () => null, // TODO: implementar cuando exista el pipeline
    },
    // 33. Sector
    {
      clave: 'sector', etiqueta: 'Sector', ancho: 140, grupo: 'Laboral', icono: <Factory size={I} />,
      render: () => null, // TODO: campo no existe aún en el esquema
    },
    // 34. Actividades (conteo de pendientes)
    {
      clave: 'actividades', etiqueta: 'Actividades', ancho: 110, tipo: 'numero', grupo: 'Relaciones', icono: <Activity size={I} />,
      alineacion: 'center',
      render: () => null, // TODO: implementar cuando exista el módulo de actividades
    },
    // 35. Documentos (conteo)
    {
      clave: 'documentos', etiqueta: 'Documentos', ancho: 110, tipo: 'numero', grupo: 'Relaciones', icono: <FileBox size={I} />,
      alineacion: 'center',
      render: () => null, // TODO: implementar cuando exista el módulo de documentos
    },
  ]

  // Renderizar tarjeta para vista de tarjetas
  const renderizarTarjeta = (fila: FilaContacto) => {
    const tipo = fila.tipo_contacto
    const color = tipo ? (COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro') as ColorInsignia : 'neutro'
    const nombreCompleto = `${fila.nombre}${fila.apellido ? ` ${fila.apellido}` : ''}`

    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar nombre={nombreCompleto} tamano="md" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-texto-primario truncate">{nombreCompleto}</div>
            {fila.cargo && <div className="text-xs text-texto-terciario truncate">{fila.cargo}</div>}
          </div>
          {tipo && <Insignia color={color}>{tipo.etiqueta}</Insignia>}
        </div>
        <div className="flex flex-col gap-0.5 text-sm text-texto-secundario">
          {fila.correo && <span className="truncate">{fila.correo}</span>}
          {(fila.telefono || fila.whatsapp) && <span>{fila.telefono || fila.whatsapp}</span>}
        </div>
        {fila.etiquetas?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {fila.etiquetas.slice(0, 3).map(e => (
              <Insignia key={e} color="neutro">{e}</Insignia>
            ))}
          </div>
        )}
        <div className="text-xs text-texto-terciario font-mono">{fila.codigo}</div>
      </div>
    )
  }

  return (
    <>
    <PlantillaListado
      titulo="Contactos"
      icono={<Users size={20} />}
      accionPrincipal={{
        etiqueta: 'Nuevo contacto',
        icono: <UserPlus size={14} />,
        onClick: () => router.push('/contactos/nuevo'),
      }}
      acciones={[
        { id: 'importar', etiqueta: 'Importar', icono: <Upload size={14} />, onClick: () => setModalImportar(true) },
        { id: 'exportar', etiqueta: 'Exportar Excel', icono: <Download size={14} />, onClick: async () => {
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
            etiqueta: 'Eliminar',
            icono: <Trash2 size={14} />,
            onClick: eliminarContactosLote,
            peligro: true,
          },
        ]}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar contactos..."
        idModulo="contactos"
        onClickFila={(fila) => router.push(`/contactos/${fila.id}`)}
        renderTarjeta={renderizarTarjeta}
        mostrarResumen
        estadoVacio={
          <EstadoVacio
            icono={<UserRoundSearch size={52} strokeWidth={1} />}
            titulo="Por acá se está muy solo..."
            descripcion="Tu directorio está esperando su primer contacto. Dale vida sumando clientes, prospectos o proveedores."
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
