/**
 * Animación de confeti con canvas para cumpleaños en el kiosco.
 * Dos modos: explosión central (entrada) y lluvia desde arriba (salida).
 */

interface Pieza {
  x: number
  y: number
  vx: number
  vy: number
  rotacion: number
  vRotacion: number
  tamano: number
  color: string
  forma: 'circulo' | 'cuadrado'
  opacidad: number
}

const COLORES = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
]

function crearPieza(anchoCanvas: number, altoCanvas: number, modo: 'explosion' | 'lluvia'): Pieza {
  const color = COLORES[Math.floor(Math.random() * COLORES.length)]
  const forma = Math.random() > 0.5 ? 'circulo' : 'cuadrado'
  const tamano = 6 + Math.random() * 6

  if (modo === 'explosion') {
    // Desde el centro, hacia arriba/afuera
    const angulo = Math.random() * Math.PI * 2
    const velocidad = 3 + Math.random() * 6
    return {
      x: anchoCanvas / 2,
      y: altoCanvas / 2,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad - 4, // sesgo hacia arriba
      rotacion: Math.random() * 360,
      vRotacion: (Math.random() - 0.5) * 10,
      tamano,
      color,
      forma,
      opacidad: 1,
    }
  }

  // Lluvia: desde arriba, cayendo
  return {
    x: Math.random() * anchoCanvas,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 2,
    vy: 2 + Math.random() * 3,
    rotacion: Math.random() * 360,
    vRotacion: (Math.random() - 0.5) * 8,
    tamano,
    color,
    forma,
    opacidad: 1,
  }
}

/**
 * Lanza confeti en un contenedor HTML.
 * @param contenedor - elemento donde montar el canvas
 * @param modo - 'explosion' (cumpleaños entrada) o 'lluvia' (cumpleaños salida)
 * @param duracionMs - duración total de la animación
 */
export function lanzarConfeti(
  contenedor: HTMLElement,
  modo: 'explosion' | 'lluvia' = 'explosion',
  duracionMs: number = 3000,
) {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '50'
  contenedor.style.position = 'relative'
  contenedor.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  canvas.width = contenedor.clientWidth
  canvas.height = contenedor.clientHeight

  const piezas: Pieza[] = []
  const cantidadPiezas = 60

  for (let i = 0; i < cantidadPiezas; i++) {
    piezas.push(crearPieza(canvas.width, canvas.height, modo))
  }

  const inicio = performance.now()
  let frameId: number

  function dibujar(ahora: number) {
    const transcurrido = ahora - inicio
    const progreso = Math.min(transcurrido / duracionMs, 1)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const pieza of piezas) {
      pieza.x += pieza.vx
      pieza.vy += 0.15 // gravedad
      pieza.y += pieza.vy
      pieza.rotacion += pieza.vRotacion

      // Fade out en el último 30%
      if (progreso > 0.7) {
        pieza.opacidad = Math.max(0, 1 - (progreso - 0.7) / 0.3)
      }

      ctx.save()
      ctx.translate(pieza.x, pieza.y)
      ctx.rotate((pieza.rotacion * Math.PI) / 180)
      ctx.globalAlpha = pieza.opacidad
      ctx.fillStyle = pieza.color

      if (pieza.forma === 'circulo') {
        ctx.beginPath()
        ctx.arc(0, 0, pieza.tamano / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-pieza.tamano / 2, -pieza.tamano / 2, pieza.tamano, pieza.tamano)
      }

      ctx.restore()
    }

    if (progreso < 1) {
      frameId = requestAnimationFrame(dibujar)
    } else {
      canvas.remove()
    }
  }

  frameId = requestAnimationFrame(dibujar)

  // Cleanup seguro
  setTimeout(() => {
    cancelAnimationFrame(frameId)
    if (canvas.parentNode) canvas.remove()
  }, duracionMs + 100)
}
