'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, MapPin, Search } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputDireccion } from '@/componentes/ui/InputDireccion'
import type { Direccion } from '@/tipos/direccion'

/** Tipos de dirección */
const TIPOS_DIRECCION = [
  { valor: 'principal', etiqueta: 'Principal' },
  { valor: 'fiscal_facturacion', etiqueta: 'Fiscal / Facturación' },
  { valor: 'servicio_entrega', etiqueta: 'Servicio / Entrega' },
  { valor: 'otra', etiqueta: 'Otra' },
]

export interface DatosDireccionPlano {
  calle: string
  barrio: string
  codigoPostal: string
  provincia: string
  ciudad: string
  piso: string
  departamento: string
  pais: string
  lat: number | null
  lng: number | null
  textoCompleto: string
}

const VACIA: DatosDireccionPlano = {
  calle: '', barrio: '', codigoPostal: '', provincia: '',
  ciudad: '', piso: '', departamento: '', pais: '',
  lat: null, lng: null, textoCompleto: '',
}

export interface DireccionConTipo {
  id: string
  tipo: string
  datos: DatosDireccionPlano
}

interface Props {
  direcciones: DireccionConTipo[]
  onChange: (direcciones: DireccionConTipo[]) => void
  paises?: string[]
}

/**
 * DireccionesContacto — Pills de dirección + campos planos + buscador Google.
 * Diseño: "Dirección [Principal] [Otro] [+]" con campos underline debajo.
 */
export function DireccionesContacto({ direcciones, onChange, paises }: Props) {
  const [tabActiva, setTabActiva] = useState(0)
  const [montado, setMontado] = useState(false)

  // Evitar hydration mismatch: la dirección virtual solo se muestra en el cliente
  useEffect(() => setMontado(true), [])

  // ─── Acciones ───

  const agregar = useCallback(() => {
    const usados = direcciones.map(d => d.tipo)
    const tipo = TIPOS_DIRECCION.find(t => !usados.includes(t.valor))?.valor || 'otra'
    const nuevas = [...direcciones, { id: crypto.randomUUID(), tipo, datos: { ...VACIA } }]
    onChange(nuevas)
    setTabActiva(nuevas.length - 1)
  }, [direcciones, onChange])

  const eliminar = useCallback((i: number) => {
    const nuevas = direcciones.filter((_, idx) => idx !== i)
    onChange(nuevas)
    if (tabActiva >= nuevas.length) setTabActiva(Math.max(0, nuevas.length - 1))
  }, [direcciones, onChange, tabActiva])

  const cambiarTipo = useCallback((tipo: string) => {
    onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, tipo } : d))
  }, [direcciones, onChange, tabActiva])

  const cambiarCampo = useCallback((campo: keyof DatosDireccionPlano, valor: string) => {
    onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos: { ...d.datos, [campo]: valor } } : d))
  }, [direcciones, onChange, tabActiva])

  // Cuando se selecciona del buscador de Google
  const seleccionarDireccion = useCallback((dir: Direccion) => {
    const datos: DatosDireccionPlano = {
      calle: dir.calle, barrio: dir.barrio, codigoPostal: dir.codigoPostal,
      provincia: dir.provincia, ciudad: dir.ciudad, piso: '', departamento: '',
      pais: dir.pais, lat: dir.coordenadas?.lat ?? null, lng: dir.coordenadas?.lng ?? null,
      textoCompleto: dir.textoCompleto,
    }
    if (direcciones.length === 0) {
      // Primera dirección
      onChange([{ id: crypto.randomUUID(), tipo: 'principal', datos }])
      setTabActiva(0)
    } else {
      onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos } : d))
    }
  }, [direcciones, onChange, tabActiva])

  const etiquetaTipo = (tipo: string) => TIPOS_DIRECCION.find(t => t.valor === tipo)?.etiqueta || tipo

  // Si no hay direcciones y ya montó en cliente, mostrar una Principal virtual
  const esVirtual = direcciones.length === 0
  const dirsActuales = (esVirtual && montado)
    ? [{ id: 'dir-virtual', tipo: 'principal', datos: { ...VACIA } } as DireccionConTipo]
    : direcciones

  const dirActiva = dirsActuales[tabActiva] ?? dirsActuales[0]

  // Sincronizar cambios: si es virtual, crear la dirección real al escribir
  const manejarCampo = useCallback((campo: keyof DatosDireccionPlano, valor: string) => {
    if (esVirtual) {
      // Primera escritura → crear la dirección formalmente
      const nueva: DireccionConTipo = {
        id: crypto.randomUUID(),
        tipo: 'principal',
        datos: { ...VACIA, [campo]: valor },
      }
      onChange([nueva])
      setTabActiva(0)
    } else {
      cambiarCampo(campo, valor)
    }
  }, [esVirtual, onChange, cambiarCampo])

  return (
    <div className="space-y-4">

      {/* ── Header: título + pills + agregar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-texto-primario">Dirección</h3>

        {/* Pills de cada dirección */}
        {dirsActuales.map((d, i) => (
          <button key={d.id} type="button" onClick={() => setTabActiva(i)}
            className={[
              'group flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer',
              i === tabActiva
                ? 'bg-superficie-seleccionada text-texto-marca border-transparent'
                : 'bg-transparent text-texto-terciario border-borde-sutil hover:text-texto-secundario hover:border-borde-fuerte',
            ].join(' ')}
          >
            <MapPin size={11} />
            <span>{etiquetaTipo(d.tipo)}</span>
          </button>
        ))}

        <Boton variante="fantasma" tamano="xs" soloIcono icono={<Plus size={13} />} onClick={agregar} redondeado />
      </div>

      {/* ── Contenido de la dirección activa ── */}
      {dirActiva && (
        <AnimatePresence mode="wait">
          <motion.div
            key={dirActiva.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="space-y-3"
          >
            {/* Selector de tipo + eliminar */}
            <div className="flex items-center justify-between">
              <div className="w-48">
                <Select variante="plano"
                  opciones={TIPOS_DIRECCION}
                  valor={dirActiva.tipo}
                  onChange={(v) => esVirtual ? undefined : cambiarTipo(v)}
                  placeholder="Seleccionar..."
                />
              </div>
              {!esVirtual && (
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={16} />} onClick={() => eliminar(tabActiva)} className="text-texto-terciario hover:text-insignia-peligro" />
              )}
            </div>

            {/* Campos planos — siempre visibles */}
            <Input variante="plano" value={dirActiva.datos.calle}
              onChange={e => manejarCampo('calle', e.target.value)}
              placeholder="Calle y número" />

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input variante="plano" value={dirActiva.datos.barrio}
                  onChange={e => manejarCampo('barrio', e.target.value)}
                  placeholder="Barrio / Comuna" />
              </div>
              <Input variante="plano" value={dirActiva.datos.codigoPostal}
                onChange={e => manejarCampo('codigoPostal', e.target.value)}
                placeholder="C.P." />
            </div>

            <Input variante="plano" value={dirActiva.datos.provincia}
              onChange={e => manejarCampo('provincia', e.target.value)}
              placeholder="Provincia" />

            <Input variante="plano" value={dirActiva.datos.ciudad}
              onChange={e => manejarCampo('ciudad', e.target.value)}
              placeholder="Ciudad" />

            <div className="grid grid-cols-2 gap-4">
              <Input variante="plano" value={dirActiva.datos.piso}
                onChange={e => manejarCampo('piso', e.target.value)}
                placeholder="Piso" />
              <Input variante="plano" value={dirActiva.datos.departamento}
                onChange={e => manejarCampo('departamento', e.target.value)}
                placeholder="Depto / Timbre" />
            </div>

            {/* Buscador Google Maps al final */}
            <div className="pt-1">
              <InputDireccion
                valorInicial=""
                paises={paises}
                alSeleccionar={seleccionarDireccion}
                alLimpiar={() => {
                  if (!esVirtual) {
                    onChange(direcciones.map((d, i) => i === tabActiva ? { ...d, datos: { ...VACIA } } : d))
                  }
                }}
                ocultarDetalle
              />
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
