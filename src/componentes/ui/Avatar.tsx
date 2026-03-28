'use client'

type TamanoAvatar = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface PropiedadesAvatar {
  nombre: string
  foto?: string | null
  tamano?: TamanoAvatar
  enLinea?: boolean
  className?: string
}

const clasesTamano: Record<TamanoAvatar, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

const coloresAvatar = [
  'bg-insignia-primario', 'bg-insignia-exito', 'bg-insignia-info',
  'bg-insignia-rosa', 'bg-insignia-violeta', 'bg-insignia-cyan',
  'bg-insignia-naranja', 'bg-insignia-advertencia',
]

function obtenerIniciales(nombre: string): string {
  // Eliminar emojis y símbolos especiales para que no aparezcan como "?" en el avatar
  const limpio = nombre.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').trim()
  if (!limpio) return nombre.trim().slice(0, 1) || '?'
  const partes = limpio.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return limpio.slice(0, 2).toUpperCase()
}

function obtenerColor(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  return coloresAvatar[Math.abs(hash) % coloresAvatar.length]
}

/**
 * Avatar — Muestra foto del usuario o iniciales con color.
 * Se usa en: sidebar, header, listas de usuarios, chatter, asignaciones.
 */
function Avatar({ nombre, foto, tamano = 'md', enLinea, className = '' }: PropiedadesAvatar) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {foto ? (
        <img
          src={foto}
          alt={nombre}
          className={`${clasesTamano[tamano]} rounded-full object-cover`}
        />
      ) : (
        <div className={`${clasesTamano[tamano]} ${obtenerColor(nombre)} rounded-full flex items-center justify-center text-white font-semibold`}>
          {obtenerIniciales(nombre)}
        </div>
      )}
      {enLinea !== undefined && (
        <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-superficie-tarjeta ${enLinea ? 'bg-insignia-exito' : 'bg-texto-terciario'}`} />
      )}
    </div>
  )
}

export { Avatar, type PropiedadesAvatar }
