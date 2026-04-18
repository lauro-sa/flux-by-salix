/**
 * BloqueDireccion — Buscador de direcciones + campos individuales editables.
 * Al buscar y seleccionar una dirección de Google, se llenan automáticamente
 * los campos: calle, barrio, ciudad, provincia, código postal, país, piso/depto.
 * Cada campo es editable manualmente después de la selección.
 * Se usa en: formularios de usuarios, contactos, empresas, visitas.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/componentes/ui/Input'
import { InputDireccion } from '@/componentes/ui/InputDireccion'
import type { Direccion } from '@/tipos/direccion'

/** Estructura de dirección para guardar en BD (jsonb) */
export interface DatosDireccion {
  calle: string
  barrio: string
  ciudad: string
  provincia: string
  codigoPostal: string
  pais: string
  piso: string
  departamento: string
  referencia: string
  coordenadas: { lat: number; lng: number } | null
  textoCompleto: string
}

const DIRECCION_VACIA: DatosDireccion = {
  calle: '',
  barrio: '',
  ciudad: '',
  provincia: '',
  codigoPostal: '',
  pais: '',
  piso: '',
  departamento: '',
  referencia: '',
  coordenadas: null,
  textoCompleto: '',
}

/** Calcula distancia en km entre dos coordenadas usando fórmula de Haversine */
function calcularDistanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Formatea distancia para mostrar */
function formatearDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

interface PropiedadesBloqueDireccion {
  /** Etiqueta del buscador */
  etiqueta?: string
  /** Valor inicial (objeto de dirección desde BD) */
  valorInicial?: Partial<DatosDireccion> | null
  /** Códigos de país ISO para restringir búsqueda */
  paises?: string[]
  /** Callback al cambiar cualquier campo — recibe la dirección completa */
  alCambiar?: (direccion: DatosDireccion) => void
  /** Deshabilitado */
  deshabilitado?: boolean
  /** Mostrar campos piso/depto/referencia */
  mostrarExtras?: boolean
  /** Clase CSS adicional */
  className?: string
  /** Modo compacto — menos campos visibles, solo calle + ciudad */
  compacto?: boolean
  /** Coordenadas de referencia para mostrar distancia (ej: ubicación de la empresa) */
  coordenadasReferencia?: { lat: number; lng: number } | null
  /** Etiqueta del punto de referencia (ej: "la empresa") */
  etiquetaReferencia?: string
}

/** Genera el texto completo concatenando los campos */
function generarTextoCompleto(dir: DatosDireccion): string {
  const partes = [
    dir.calle,
    dir.piso && dir.departamento ? `Piso ${dir.piso}, Depto ${dir.departamento}` : dir.piso ? `Piso ${dir.piso}` : dir.departamento ? `Depto ${dir.departamento}` : '',
    dir.barrio,
    dir.ciudad,
    dir.provincia,
    dir.codigoPostal,
    dir.pais,
  ].filter(Boolean)
  return partes.join(', ')
}

export function BloqueDireccion({
  etiqueta = 'Dirección',
  valorInicial,
  paises,
  alCambiar,
  deshabilitado = false,
  mostrarExtras = true,
  className = '',
  compacto = false,
  coordenadasReferencia,
  etiquetaReferencia = 'la empresa',
}: PropiedadesBloqueDireccion) {
  const [direccion, setDireccion] = useState<DatosDireccion>(() => ({
    ...DIRECCION_VACIA,
    ...valorInicial,
  }))
  const [expandido, setExpandido] = useState(false)

  // Sincronizar con valor inicial externo
  useEffect(() => {
    if (valorInicial) {
      setDireccion(prev => ({ ...DIRECCION_VACIA, ...valorInicial }))
      // Si hay datos, mostrar los campos
      const tieneDatos = valorInicial.calle || valorInicial.ciudad || valorInicial.provincia
      if (tieneDatos) setExpandido(true)
    }
  }, [valorInicial])

  /** Actualizar un campo individual y notificar */
  const actualizarCampo = useCallback((campo: keyof DatosDireccion, valor: string) => {
    setDireccion(prev => {
      const nueva = { ...prev, [campo]: valor }
      nueva.textoCompleto = generarTextoCompleto(nueva)
      return nueva
    })
  }, [])

  /** Notificar al padre cuando se hace blur en cualquier campo */
  const notificarCambio = useCallback(() => {
    const dirActualizada = { ...direccion, textoCompleto: generarTextoCompleto(direccion) }
    alCambiar?.(dirActualizada)
  }, [direccion, alCambiar])

  /** Cuando se selecciona una dirección del buscador */
  const manejarSeleccion = useCallback((dir: Direccion) => {
    const nueva: DatosDireccion = {
      calle: dir.calle,
      barrio: dir.barrio,
      ciudad: dir.ciudad,
      provincia: dir.provincia,
      codigoPostal: dir.codigoPostal,
      pais: dir.pais,
      piso: direccion.piso, // mantener lo que ya escribió
      departamento: direccion.departamento,
      referencia: direccion.referencia,
      coordenadas: dir.coordenadas,
      textoCompleto: dir.textoCompleto,
    }
    setDireccion(nueva)
    setExpandido(true)
    alCambiar?.(nueva)
  }, [direccion.piso, direccion.departamento, direccion.referencia, alCambiar])

  const tieneDatos = direccion.calle || direccion.ciudad

  // Calcular distancia al punto de referencia
  const distancia = useMemo(() => {
    if (!coordenadasReferencia || !direccion.coordenadas) return null
    return calcularDistanciaKm(direccion.coordenadas, coordenadasReferencia)
  }, [coordenadasReferencia, direccion.coordenadas])

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Buscador principal */}
      <InputDireccion
        etiqueta={etiqueta}
        valorInicial={direccion.textoCompleto || direccion.calle}
        paises={paises}
        alSeleccionar={manejarSeleccion}
        alLimpiar={() => {
          setDireccion(DIRECCION_VACIA)
          setExpandido(false)
          alCambiar?.(DIRECCION_VACIA)
        }}
        deshabilitado={deshabilitado}
        ocultarDetalle
      />

      {/* Campos individuales — aparecen al seleccionar o si ya hay datos */}
      <AnimatePresence>
        {(expandido || tieneDatos) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-card border border-borde-sutil bg-superficie-app p-3 flex flex-col gap-3">
              {/* Encabezado sutil */}
              <div className="flex items-center gap-2 text-xs text-texto-terciario">
                <MapPin size={12} />
                <span>Detalle de dirección</span>
                <span className="ml-auto flex items-center gap-3">
                  {distancia !== null && (
                    <span className="flex items-center gap-1 text-texto-marca font-medium">
                      <Navigation size={11} />
                      {formatearDistancia(distancia)} de {etiquetaReferencia}
                    </span>
                  )}
                  {direccion.coordenadas && (
                    <span className="text-texto-terciario/50">
                      {direccion.coordenadas.lat.toFixed(4)}, {direccion.coordenadas.lng.toFixed(4)}
                    </span>
                  )}
                </span>
              </div>

              {/* Calle (ancho completo) */}
              <Input
                tipo="text"
                etiqueta="Calle y número"
                value={direccion.calle}
                onChange={(e) => actualizarCampo('calle', e.target.value)}
                onBlur={notificarCambio}
                disabled={deshabilitado}
                compacto
              />

              {/* Piso / Depto / Referencia */}
              {mostrarExtras && (
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    tipo="text"
                    etiqueta="Piso"
                    value={direccion.piso}
                    onChange={(e) => actualizarCampo('piso', e.target.value)}
                    onBlur={notificarCambio}
                    disabled={deshabilitado}
                    placeholder="3"
                    compacto
                  />
                  <Input
                    tipo="text"
                    etiqueta="Depto"
                    value={direccion.departamento}
                    onChange={(e) => actualizarCampo('departamento', e.target.value)}
                    onBlur={notificarCambio}
                    disabled={deshabilitado}
                    placeholder="A"
                    compacto
                  />
                  <Input
                    tipo="text"
                    etiqueta="Referencia"
                    value={direccion.referencia}
                    onChange={(e) => actualizarCampo('referencia', e.target.value)}
                    onBlur={notificarCambio}
                    disabled={deshabilitado}
                    placeholder="Timbre 4"
                    compacto
                  />
                </div>
              )}

              {/* Barrio / Ciudad */}
              <div className={`grid gap-3 ${compacto ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <Input
                  tipo="text"
                  etiqueta="Barrio"
                  value={direccion.barrio}
                  onChange={(e) => actualizarCampo('barrio', e.target.value)}
                  onBlur={notificarCambio}
                  disabled={deshabilitado}
                  compacto
                />
                <Input
                  tipo="text"
                  etiqueta="Ciudad"
                  value={direccion.ciudad}
                  onChange={(e) => actualizarCampo('ciudad', e.target.value)}
                  onBlur={notificarCambio}
                  disabled={deshabilitado}
                  compacto
                />
              </div>

              {/* Provincia / CP / País */}
              <div className={`grid gap-3 ${compacto ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <Input
                  tipo="text"
                  etiqueta="Provincia"
                  value={direccion.provincia}
                  onChange={(e) => actualizarCampo('provincia', e.target.value)}
                  onBlur={notificarCambio}
                  disabled={deshabilitado}
                  compacto
                />
                <Input
                  tipo="text"
                  etiqueta="Código postal"
                  value={direccion.codigoPostal}
                  onChange={(e) => actualizarCampo('codigoPostal', e.target.value)}
                  onBlur={notificarCambio}
                  disabled={deshabilitado}
                  compacto
                />
                {!compacto && (
                  <Input
                    tipo="text"
                    etiqueta="País"
                    value={direccion.pais}
                    onChange={(e) => actualizarCampo('pais', e.target.value)}
                    onBlur={notificarCambio}
                    disabled={deshabilitado}
                    compacto
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
