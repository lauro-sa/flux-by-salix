'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Buscador } from '@/componentes/ui/Buscador'
import { formatearTelefono } from '@/lib/formato'

/**
 * SelectorNuevoChat — Reemplaza la lista de conversaciones en la columna izquierda
 * cuando el usuario aprieta "+". Patrón "Nuevo chat" de WhatsApp móvil:
 *
 *   ◂ Nuevo chat
 *   [🔍 Buscar...]
 *   A ─────────────
 *     Ana López     +54 9 11 1234 5678
 *     Andrés Pérez  +54 9 11 8765 4321
 *   B ─────────────
 *     Bruno Soto    ...
 *
 * Para `audiencia='clientes'` lista contactos con WhatsApp cargado.
 * Para `audiencia='empleados'` lista miembros con teléfono cargado.
 * Al seleccionar un ítem, el padre abre el modal de plantillas precargado.
 */

interface PropiedadesSelector {
  audiencia: 'clientes' | 'empleados'
  /** Volver a la lista de conversaciones */
  onCerrar: () => void
  /** Llamado cuando el usuario elige un destinatario */
  onSeleccionar: (destinatario: Destinatario) => void
}

export interface Destinatario {
  id: string
  nombre: string
  telefono: string
  tipo: 'cliente' | 'empleado'
  avatar_url?: string | null
  detalle?: string | null
  /** Si false, el destinatario no tiene teléfono/WA cargado. Se muestra atenuado
      y al hacer click se navega al detalle para completar el dato. */
  disponible: boolean
}

/**
 * Cache module-level por audiencia. Se preserva mientras el usuario está dentro
 * de /whatsapp (se limpia al navegar fuera y recargar). Hace que al apretar "+"
 * la lista aparezca instantánea desde la segunda vez, mientras un fetch en
 * background revalida los datos.
 */
const cacheDestinatarios = new Map<'clientes' | 'empleados', Destinatario[]>()

/** Quita acentos y pasa a minúsculas para comparar (mismo helper de validaciones.ts inlined chico). */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Devuelve la inicial alfabética para agrupar; sin acentos. Números/símbolos → '#'. */
function letraInicial(nombre: string): string {
  const limpio = normalizar(nombre.trim())
  const primera = limpio.charAt(0).toUpperCase()
  return /^[A-Z]$/.test(primera) ? primera : '#'
}

export function SelectorNuevoChat({ audiencia, onCerrar, onSeleccionar }: PropiedadesSelector) {
  const router = useRouter()
  // Si hay cache, arrancamos directamente con esos datos (lista visible al instante).
  const cacheado = cacheDestinatarios.get(audiencia)
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>(cacheado ?? [])
  // Solo mostramos el loader cuando NO hay cache; con cache hacemos revalidación silenciosa.
  const [cargando, setCargando] = useState(!cacheado)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Cargar (o revalidar) destinatarios según audiencia desde el endpoint unificado.
  useEffect(() => {
    let cancelado = false
    const hayCache = cacheDestinatarios.has(audiencia)
    // Si no hay cache, mostramos loader; si hay, mantenemos la lista vieja a la vista.
    setError(null)
    if (!hayCache) {
      setDestinatarios([])
      setCargando(true)
    }

    fetch(`/api/whatsapp/destinatarios?audiencia=${audiencia}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Error al cargar destinatarios')
        return r.json() as Promise<{ destinatarios: Destinatario[] }>
      })
      .then((data) => {
        if (cancelado) return
        const lista = data.destinatarios || []
        cacheDestinatarios.set(audiencia, lista)
        setDestinatarios(lista)
      })
      .catch((e: Error) => {
        if (!cancelado && !hayCache) setError(e.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => { cancelado = true }
  }, [audiencia])

  // Filtrar por búsqueda (nombre o teléfono, sin acentos) y agrupar por letra inicial
  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim())
    const filtrados = q
      ? destinatarios.filter(d =>
          normalizar(d.nombre).includes(q) || d.telefono.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        )
      : destinatarios

    const ordenados = [...filtrados].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)))

    const mapa = new Map<string, Destinatario[]>()
    for (const d of ordenados) {
      const letra = letraInicial(d.nombre)
      const arr = mapa.get(letra) ?? []
      arr.push(d)
      mapa.set(letra, arr)
    }
    // Ordenar letras: A-Z primero, luego '#'
    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
  }, [destinatarios, busqueda])

  const totalFiltrado = grupos.reduce((acc, [, items]) => acc + items.length, 0)
  const totalCargados = destinatarios.length
  // Pluralización simple para placeholder/contadores en español.
  const sustantivoSingular = audiencia === 'clientes' ? 'cliente' : 'empleado'
  const sustantivoPlural = audiencia === 'clientes' ? 'clientes' : 'empleados'
  const placeholderBuscador = totalCargados === 1
    ? `Buscar entre 1 ${sustantivoSingular}...`
    : `Buscar entre ${totalCargados} ${sustantivoPlural}...`

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden md:border-r md:border-borde-sutil">
      {/* Header — misma estructura/altura que el header de ListaConversaciones:
          p-3 px-4 + space-y-2 con la fila de título arriba y el Buscador reutilizable abajo. */}
      <div className="p-3 px-4 space-y-2" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={<ArrowLeft size={16} />}
              onClick={onCerrar}
              titulo="Volver"
            />
            <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Nuevo chat
            </span>
          </div>
        </div>

        {/* Buscador reutilizable con borde resaltado (es el control principal de esta vista).
            debounce={0} porque el filtrado es 100% cliente sobre la lista ya cargada. */}
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder={placeholderBuscador}
          debounce={0}
          autoFocus
          bordeResaltado
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto scrollbar-auto-oculto">
        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--texto-terciario)' }} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm" style={{ color: 'var(--insignia-peligro)' }}>{error}</p>
          </div>
        ) : totalFiltrado === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
              {busqueda
                ? 'Sin resultados.'
                : audiencia === 'clientes'
                  ? 'No hay contactos con WhatsApp cargado.'
                  : 'No hay empleados con teléfono cargado.'}
            </p>
          </div>
        ) : (
          grupos.map(([letra, items]) => (
            <div key={letra}>
              {/* Header de letra sticky — separa los grupos alfabéticos */}
              <div
                className="sticky top-0 z-10 px-4 py-1 text-xxs font-semibold uppercase tracking-wider"
                style={{ background: 'var(--superficie-tarjeta)', color: 'var(--texto-terciario)', borderBottom: '1px solid var(--borde-sutil)' }}
              >
                {letra}
              </div>
              {items.map(d => {
                const irAlDetalle = () => {
                  // Navegamos al detalle preservando ?desde=/whatsapp para que las migajas
                  // muestren "WhatsApp" como página anterior y se pueda volver con un click.
                  const ruta = d.tipo === 'cliente' ? `/contactos/${d.id}` : `/usuarios/${d.id}`
                  router.push(`${ruta}?desde=/whatsapp`)
                }
                return (
                  <div
                    key={d.id}
                    className={`group flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      d.disponible ? 'cursor-pointer hover:bg-[var(--superficie-hover)]' : ''
                    }`}
                    onClick={d.disponible ? () => onSeleccionar(d) : undefined}
                    style={{ borderBottom: '1px solid var(--borde-sutil)' }}
                  >
                    <div className={d.disponible ? '' : 'opacity-50'}>
                      <Avatar nombre={d.nombre} foto={d.avatar_url || undefined} tamano="sm" />
                    </div>
                    <div className={`flex-1 min-w-0 ${d.disponible ? '' : 'opacity-50'}`}>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                        {d.nombre}
                      </p>
                      <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                        {d.disponible
                          ? <>{d.detalle ? `${d.detalle} · ` : ''}{formatearTelefono(d.telefono)}</>
                          : <>{d.detalle ? `${d.detalle} · ` : ''}{d.tipo === 'cliente' ? 'Sin WhatsApp' : 'Sin teléfono'}</>
                        }
                      </p>
                    </div>
                    {/* Botón explícito para ir al detalle. En items con WA aparece solo en hover
                        (atajo útil); en items sin WA siempre visible (única acción posible). */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); irAlDetalle() }}
                      title={d.tipo === 'cliente' ? 'Abrir contacto' : 'Abrir empleado'}
                      className={`flex-shrink-0 flex items-center justify-center size-7 rounded-boton transition-all hover:bg-[var(--superficie-app)] ${
                        d.disponible ? 'opacity-0 group-hover:opacity-100' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ color: 'var(--texto-terciario)' }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
