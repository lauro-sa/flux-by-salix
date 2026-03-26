'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { UserPlus, Download, Upload, Users, UserRoundSearch, Building2, Building, Truck } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Avatar } from '@/componentes/ui/Avatar'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import type { TipoContacto } from '@/tipos'

// Tipo para las filas de la tabla
interface FilaContacto {
  id: string
  codigo: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  cargo: string | null
  etiquetas: string[]
  activo: boolean
  creado_en: string
  tipo_contacto: Pick<TipoContacto, 'id' | 'clave' | 'etiqueta' | 'icono' | 'color'>
  direcciones: { id: string; texto: string | null; ciudad: string | null; es_principal: boolean }[]
}

export default function PaginaContactos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [contactos, setContactos] = useState<FilaContacto[]>([])
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const refImportar = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)

  // Cargar tipos de contacto para los filtros
  useEffect(() => {
    fetch('/api/contactos/tipos')
      .then(r => r.json())
      .then(data => {
        if (data.tipos_contacto) setTiposContacto(data.tipos_contacto)
      })
      .catch(() => {})
  }, [])

  // Cargar contactos
  const cargarContactos = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.set('busqueda', busqueda)
      params.set('por_pagina', '50')

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
  }, [busqueda])

  useEffect(() => {
    const timeout = setTimeout(cargarContactos, busqueda ? 400 : 0)
    return () => clearTimeout(timeout)
  }, [cargarContactos])

  // Columnas de la tabla
  const columnas: ColumnaDinamica<FilaContacto>[] = [
    {
      clave: 'nombre',
      etiqueta: 'Nombre',
      ancho: 250,
      ordenable: true,
      render: (fila) => {
        const clave = fila.tipo_contacto?.clave || 'persona'
        const color = COLOR_TIPO_CONTACTO[clave] || 'primario'
        const esPersona = ['persona', 'lead', 'equipo'].includes(clave)
        const nombreCompleto = `${fila.nombre}${fila.apellido ? ` ${fila.apellido}` : ''}`
        const iniciales = nombreCompleto.split(/\s+/).filter(Boolean).map((p, i, arr) => i === 0 || i === arr.length - 1 ? p[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2)

        return (
          <div className="flex items-center gap-2.5">
            <div
              className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}
            >
              {esPersona ? iniciales : (
                clave === 'edificio' ? <Building size={14} /> :
                clave === 'proveedor' ? <Truck size={14} /> :
                <Building2 size={14} />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-texto-primario truncate">{nombreCompleto}</div>
              {fila.cargo && <div className="text-xs text-texto-terciario truncate">{fila.cargo}</div>}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'tipo',
      etiqueta: 'Tipo',
      ancho: 120,
      ordenable: true,
      filtrable: true,
      tipoFiltro: 'multiple',
      opcionesFiltro: tiposContacto.map(t => ({ valor: t.clave, etiqueta: t.etiqueta })),
      obtenerValor: (fila) => fila.tipo_contacto?.clave || '',
      render: (fila) => {
        const tipo = fila.tipo_contacto
        if (!tipo) return null
        const color = (COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro') as ColorInsignia
        return <Insignia color={color}>{tipo.etiqueta}</Insignia>
      },
    },
    {
      clave: 'correo',
      etiqueta: 'Correo',
      ancho: 220,
      ordenable: true,
      render: (fila) => fila.correo ? (
        <span className="text-texto-secundario truncate">{fila.correo}</span>
      ) : null,
    },
    {
      clave: 'telefono',
      etiqueta: 'Teléfono',
      ancho: 160,
      render: (fila) => {
        const tel = fila.telefono || fila.whatsapp
        return tel ? <span className="text-texto-secundario">{tel}</span> : null
      },
    },
    {
      clave: 'ubicacion',
      etiqueta: 'Ubicación',
      ancho: 180,
      render: (fila) => {
        const dir = fila.direcciones?.find(d => d.es_principal) || fila.direcciones?.[0]
        const texto = dir?.ciudad || dir?.texto
        return texto ? <span className="text-texto-terciario truncate">{texto}</span> : null
      },
    },
    {
      clave: 'etiquetas',
      etiqueta: 'Etiquetas',
      ancho: 200,
      render: (fila) => fila.etiquetas?.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap">
          {fila.etiquetas.slice(0, 2).map(e => (
            <Insignia key={e} color="neutro">{e}</Insignia>
          ))}
          {fila.etiquetas.length > 2 && (
            <span className="text-xs text-texto-terciario">+{fila.etiquetas.length - 2}</span>
          )}
        </div>
      ) : null,
    },
    {
      clave: 'codigo',
      etiqueta: 'Código',
      ancho: 100,
      ordenable: true,
      render: (fila) => (
        <span className="text-xs font-mono text-texto-terciario">{fila.codigo}</span>
      ),
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
        { id: 'importar', etiqueta: 'Importar', icono: <Upload size={14} />, onClick: () => refImportar.current?.click() },
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {
          window.open('/api/contactos/exportar', '_blank')
        }},
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/contactos/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        datos={contactos}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas']}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar contactos..."
        idModulo="contactos"
        onClickFila={(fila) => router.push(`/contactos/${fila.id}`)}
        renderTarjeta={renderizarTarjeta}
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

    {/* Input oculto para importar CSV */}
    <input
      ref={refImportar}
      type="file"
      accept=".csv,.txt"
      className="hidden"
      onChange={async (e) => {
        const archivo = e.target.files?.[0]
        if (!archivo) return
        const formData = new FormData()
        formData.append('archivo', archivo)
        try {
          const res = await fetch('/api/contactos/importar', { method: 'POST', body: formData })
          const data = await res.json()
          alert(`Importación completada: ${data.creados} creados, ${data.errores} errores de ${data.total} filas`)
          cargarContactos()
        } catch {
          alert('Error al importar')
        }
        e.target.value = ''
      }}
    />
    </>
  )
}
