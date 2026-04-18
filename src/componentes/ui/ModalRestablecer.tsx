'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, User } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

interface ContactoAfectado {
  id: string
  nombre: string
  apellido: string
}

interface ItemAfectado {
  nombre: string
  id?: string
  contactos: ContactoAfectado[]
}

interface DatosPreview {
  tipo: string
  itemsActuales: { id: string; nombre: string }[]
  itemsAfectados: ItemAfectado[]
  predefinidos: string[]
}

interface PropiedadesModalRestablecer {
  abierto: boolean
  onCerrar: () => void
  tipo: string
  etiquetaTipo: string
  onRestablecido: () => void
}

/**
 * ModalRestablecer — Modal de migración inteligente al restablecer predefinidos.
 * Muestra los items con contactos asignados y permite reasignarlos antes de restablecer.
 */
export function ModalRestablecer({ abierto, onCerrar, tipo, etiquetaTipo, onRestablecido }: PropiedadesModalRestablecer) {
  const { t } = useTraduccion()
  const [cargando, setCargando] = useState(true)
  const [aplicando, setAplicando] = useState(false)
  const [preview, setPreview] = useState<DatosPreview | null>(null)
  const [mapeos, setMapeos] = useState<Record<string, string>>({})
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // Cargar preview al abrir
  const cargarPreview = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/contactos/config/restablecer/preview?tipo=${tipo}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)

      // Inicializar mapeos: los que ya están en predefinidos se mantienen, el resto queda sin asignar
      const mapeosIniciales: Record<string, string> = {}
      for (const item of data.itemsAfectados) {
        const clave = item.id || item.nombre
        if (data.predefinidos.includes(item.nombre)) {
          mapeosIniciales[clave] = '__mantener__'
        } else {
          mapeosIniciales[clave] = '' // Sin decisión
        }
      }
      setMapeos(mapeosIniciales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar preview')
    } finally {
      setCargando(false)
    }
  }, [tipo])

  useEffect(() => {
    if (abierto) cargarPreview()
  }, [abierto, cargarPreview])

  // Verificar que todos los items afectados tienen decisión
  const todosResueltos = preview?.itemsAfectados.every(item => {
    const clave = item.id || item.nombre
    return mapeos[clave] && mapeos[clave] !== ''
  }) ?? true

  // Contar sin resolver
  const sinResolver = preview?.itemsAfectados.filter(item => {
    const clave = item.id || item.nombre
    return !mapeos[clave] || mapeos[clave] === ''
  }).length ?? 0

  // Aplicar cambios
  const aplicar = async () => {
    if (!todosResueltos) return
    setAplicando(true)
    setError(null)
    try {
      // Convertir mapeos: para relaciones usamos id como clave, para el resto usamos nombre
      const mapeosFinales: Record<string, string> = {}
      for (const item of preview?.itemsAfectados || []) {
        const clave = item.id || item.nombre
        const destino = mapeos[clave]
        if (destino) {
          // Para relaciones, la clave del mapeo es el id
          // Para el resto, la clave es el nombre del item
          if (tipo === 'relacion' && item.id) {
            mapeosFinales[item.id] = destino
          } else {
            mapeosFinales[item.nombre] = destino
          }
        }
      }

      const res = await fetch('/api/contactos/config/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, mapeos: mapeosFinales }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      onRestablecido()
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer')
    } finally {
      setAplicando(false)
    }
  }

  // Toggle expandir contactos de un item
  const toggleExpandido = (clave: string) => {
    setExpandidos(prev => ({ ...prev, [clave]: !prev[clave] }))
  }

  // Opciones para el select de destino
  const opcionesDestino = [
    { valor: '', etiqueta: '— Elegir acción —' },
    ...(preview?.predefinidos || []).map(nombre => ({
      valor: nombre,
      etiqueta: `Cambiar a "${nombre}"`,
    })),
    { valor: '__mantener__', etiqueta: 'Mantener (no eliminar)' },
    { valor: '__eliminar__', etiqueta: 'Eliminar de los contactos' },
  ]

  // Acción en lote
  const aplicarATodos = (valor: string) => {
    if (!preview) return
    const nuevosMapeos: Record<string, string> = { ...mapeos }
    for (const item of preview.itemsAfectados) {
      const clave = item.id || item.nombre
      // Solo aplicar a los que no están en predefinidos
      if (!preview.predefinidos.includes(item.nombre)) {
        nuevosMapeos[clave] = valor
      }
    }
    setMapeos(nuevosMapeos)
  }

  const hayItemsNoDefault = preview?.itemsAfectados.some(
    item => !preview.predefinidos.includes(item.nombre)
  ) ?? false

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Restablecer ${etiquetaTipo}`} tamano="xl">
      {cargando ? (
        <CargadorSeccion />
      ) : error ? (
        <div className="p-4 rounded-card bg-insignia-peligro-fondo text-insignia-peligro-texto text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : preview?.itemsAfectados.length === 0 ? (
        // Sin contactos afectados — restablecer directo
        <div className="space-y-4">
          <p className="text-base text-texto-secundario">
            Ningún contacto tiene {etiquetaTipo} asignados. Se puede restablecer sin afectar datos.
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
            <Boton onClick={aplicar} cargando={aplicando} icono={<RefreshCw size={14} />}>
              Restablecer
            </Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Advertencia */}
          <div className="p-3 rounded-card bg-insignia-advertencia-fondo/50 border border-insignia-advertencia-fondo">
            <p className="text-base text-texto-secundario">
              Los siguientes {etiquetaTipo} tienen contactos asignados. Elegí qué hacer con cada uno antes de restablecer.
            </p>
          </div>

          {/* Acción en lote */}
          {hayItemsNoDefault && (
            <div className="flex items-center gap-3 p-3 rounded-card border border-borde-sutil bg-superficie-elevada/50">
              <span className="text-xs text-texto-terciario shrink-0">Aplicar a todos:</span>
              <div className="flex gap-2 flex-wrap">
                <Boton variante="secundario" tamano="xs" onClick={() => aplicarATodos('__mantener__')}>
                  Mantener todos
                </Boton>
                <Boton variante="secundario" tamano="xs" onClick={() => aplicarATodos('__eliminar__')} className="hover:border-insignia-peligro">
                  Eliminar todos
                </Boton>
              </div>
            </div>
          )}

          {/* Lista de items afectados */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {preview?.itemsAfectados.map(item => {
              const clave = item.id || item.nombre
              const expandido = expandidos[clave] || false
              const esDefault = preview.predefinidos.includes(item.nombre)

              return (
                <div
                  key={clave}
                  className={`rounded-card border transition-colors ${
                    !mapeos[clave] || mapeos[clave] === ''
                      ? 'border-insignia-advertencia-fondo bg-insignia-advertencia-fondo/10'
                      : 'border-borde-sutil'
                  }`}
                >
                  {/* Encabezado del item */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Botón expandir */}
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Expandir" icono={expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />} onClick={() => toggleExpandido(clave)} />

                    {/* Nombre y conteo */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-texto-primario">{item.nombre}</span>
                      <span className="text-xs text-texto-terciario ml-2">
                        {item.contactos.length} contacto{item.contactos.length !== 1 ? 's' : ''}
                      </span>
                      {esDefault && (
                        <span className="text-xs text-insignia-exito-texto ml-2">(se mantiene por default)</span>
                      )}
                    </div>

                    {/* Select de acción */}
                    {!esDefault && (
                      <div className="shrink-0 w-[220px]">
                        <Select
                          opciones={opcionesDestino}
                          valor={mapeos[clave] || ''}
                          onChange={(valor) => setMapeos(prev => ({ ...prev, [clave]: valor }))}
                          variante="plano"
                        />
                      </div>
                    )}
                  </div>

                  {/* Lista de contactos expandida */}
                  {expandido && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="rounded-boton border border-borde-sutil bg-superficie-app/50 divide-y divide-borde-sutil max-h-[200px] overflow-y-auto">
                        {item.contactos.map(contacto => (
                          <div key={contacto.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <User size={12} className="text-texto-terciario shrink-0" />
                            <span className="text-texto-primario">
                              {contacto.nombre} {contacto.apellido}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between pt-2 border-t border-borde-sutil">
            <div className="text-xs text-texto-terciario">
              {sinResolver > 0 && (
                <span className="text-insignia-advertencia-texto">
                  {sinResolver} sin resolver
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
              <Boton
                onClick={aplicar}
                cargando={aplicando}
                disabled={!todosResueltos}
                icono={<RefreshCw size={14} />}
              >
                Restablecer
              </Boton>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
