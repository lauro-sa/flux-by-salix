/**
 * Ejecutor: buscar_direccion
 * Valida y busca una dirección usando Google Places API.
 * Devuelve la dirección formateada con calle, barrio, ciudad, provincia, CP, coordenadas.
 * Se usa para: validar antes de guardar en un contacto, buscar una dirección para visitas.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { validarDireccion } from '@/lib/agente-ia/validar-direccion'

export async function ejecutarBuscarDireccion(
  _ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const texto = (params.texto as string)?.trim()
  if (!texto || texto.length < 5) {
    return { exito: false, error: 'Se requiere un texto de dirección con al menos 5 caracteres' }
  }

  const resultado = await validarDireccion(texto)

  if (!resultado) {
    return {
      exito: false,
      error: `No encontré una dirección para "${texto}". Probá con más detalle (calle + número + ciudad).`,
    }
  }

  // Formatear mensaje
  const partes: string[] = [
    `📍 *Dirección encontrada:*`,
    `*${resultado.textoCompleto}*`,
    '',
  ]

  if (resultado.calle) partes.push(`🏠 Calle: ${resultado.calle}`)
  if (resultado.barrio) partes.push(`📌 Barrio: ${resultado.barrio}`)
  if (resultado.ciudad) partes.push(`🏙 Ciudad: ${resultado.ciudad}`)
  if (resultado.provincia) partes.push(`🗺 Provincia: ${resultado.provincia}`)
  if (resultado.coordenadas) {
    partes.push(`📐 Coordenadas: ${resultado.coordenadas.lat.toFixed(5)}, ${resultado.coordenadas.lng.toFixed(5)}`)
  }

  return {
    exito: true,
    datos: resultado,
    mensaje_usuario: partes.join('\n'),
  }
}
