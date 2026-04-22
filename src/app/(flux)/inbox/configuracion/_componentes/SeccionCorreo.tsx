'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/componentes/feedback/Toast'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { Alerta } from '@/componentes/ui/Alerta'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Plus, Mail, Shield, RefreshCw, Loader2 } from 'lucide-react'
import type { CanalMensajeria, ConfigMensajeria } from '@/tipos/inbox'
import { CanalCard } from './CanalCard'
import { useTraduccion } from '@/lib/i18n'
import { TIMEOUT_AUTH } from '@/lib/constantes/timeouts'

/**
 * Módulos donde las bandejas pueden enviar correo.
 * Se usa en la matriz de disponibilidad.
 */
const MODULOS_CORREO = [
  { slug: 'inbox', nombre: 'Inbox' },
  { slug: 'contactos', nombre: 'Contactos' },
  { slug: 'presupuestos', nombre: 'Presupuestos' },
  { slug: 'asistencias', nombre: 'Asistencias' },
  { slug: 'ordenes_trabajo', nombre: 'Órdenes de trabajo' },
  { slug: 'informes', nombre: 'Informes' },
  { slug: 'marketing', nombre: 'Marketing' },
]

/**
 * Sección de Correo — 4 subsecciones: bandejas, predeterminado, módulos, anti-spam.
 * Se usa en la configuración del inbox cuando la sección activa es "correo".
 */
export function SeccionCorreo({
  canalesCorreo,
  config,
  onAgregarCanal,
  onRecargar,
  onGuardarConfig,
}: {
  canalesCorreo: CanalMensajeria[]
  config: ConfigMensajeria | null
  onAgregarCanal: () => void
  onRecargar: () => void
  onGuardarConfig: (cambios: Partial<ConfigMensajeria>) => void
}) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const configAny = config as unknown as Record<string, unknown> | null
  const [listaPermitidos, setListaPermitidos] = useState(
    ((configAny?.correo_lista_permitidos as string[]) || []).join('\n')
  )
  const [listaBloqueados, setListaBloqueados] = useState(
    ((configAny?.correo_lista_bloqueados as string[]) || []).join('\n')
  )

  // Tipos de contacto y reglas por tipo
  const [tiposContacto, setTiposContacto] = useState<{ id: string; etiqueta: string; icono: string }[]>([])
  const [reglasPorTipo, setReglasPorTipo] = useState<Record<string, string>>({}) // tipo_contacto_id → canal_id

  // Cargar tipos de contacto y reglas
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resTipos, resReglas] = await Promise.all([
          fetch('/api/contactos/tipos'),
          fetch('/api/inbox/correo/tipo-contacto'),
        ])
        const [dataTipos, dataReglas] = await Promise.all([resTipos.json(), resReglas.json()])

        setTiposContacto((dataTipos.tipos || []).filter((t: { activo: boolean }) => t.activo))

        // Convertir array de reglas a mapa tipo_contacto_id → canal_id
        const mapa: Record<string, string> = {}
        for (const r of (dataReglas.reglas || [])) {
          mapa[r.tipo_contacto_id] = r.canal_id
        }
        setReglasPorTipo(mapa)
      } catch {
        // silenciar
      }
    }
    cargarDatos()
  }, [canalesCorreo])

  const guardarListas = () => {
    const permitidos = listaPermitidos.split('\n').map(l => l.trim()).filter(Boolean)
    const bloqueados = listaBloqueados.split('\n').map(l => l.trim()).filter(Boolean)
    onGuardarConfig({
      ...config,
      correo_lista_permitidos: permitidos,
      correo_lista_bloqueados: bloqueados,
    } as Partial<ConfigMensajeria>)
  }

  const [sincronizando, setSincronizando] = useState(false)
  const [resultadoSync, setResultadoSync] = useState<string | null>(null)

  const sincronizarAhora = async () => {
    setSincronizando(true)
    setResultadoSync(null)
    try {
      const resultados = await Promise.allSettled(
        canalesCorreo.map(canal =>
          fetch('/api/inbox/correo/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canal_id: canal.id }),
          }).then(r => r.json())
        )
      )

      let totalNuevos = 0
      let errores = 0
      for (const r of resultados) {
        if (r.status === 'fulfilled' && r.value.resultados) {
          totalNuevos += r.value.resultados.reduce((s: number, x: { mensajes_nuevos: number }) => s + x.mensajes_nuevos, 0)
        } else {
          errores++
        }
      }

      if (errores > 0) {
        setResultadoSync(`${totalNuevos} correo${totalNuevos !== 1 ? 's' : ''} nuevo${totalNuevos !== 1 ? 's' : ''}. ${errores} canal${errores !== 1 ? 'es' : ''} con error.`)
      } else {
        setResultadoSync(`Sincronización completa. ${totalNuevos} correo${totalNuevos !== 1 ? 's' : ''} nuevo${totalNuevos !== 1 ? 's' : ''}.`)
      }
    } catch {
      setResultadoSync('Error al sincronizar.')
    } finally {
      setSincronizando(false)
      setTimeout(() => setResultadoSync(null), TIMEOUT_AUTH)
    }
  }

  // Hacer principal
  const hacerPrincipal = async (canalId: string) => {
    try {
      await fetch(`/api/correo/canales/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_principal: true }),
      })
      mostrar('exito', 'Cuenta principal actualizada')
      onRecargar()
    } catch {
      mostrar('error', 'Error al cambiar cuenta principal')
    }
  }

  // Guardar regla por tipo de contacto
  const guardarReglaTipo = async (tipoContactoId: string, canalId: string) => {
    const nuevasReglas = { ...reglasPorTipo }
    if (canalId) {
      nuevasReglas[tipoContactoId] = canalId
    } else {
      delete nuevasReglas[tipoContactoId]
    }
    setReglasPorTipo(nuevasReglas)

    try {
      await fetch('/api/inbox/correo/tipo-contacto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reglas: Object.entries(nuevasReglas).map(([tipoId, cId]) => ({
            tipo_contacto_id: tipoId,
            canal_id: cId,
          })),
        }),
      })
    } catch {
      mostrar('error', 'Error al guardar regla')
    }
  }

  // Guardar módulos disponibles de una bandeja
  const guardarModulosBandeja = async (canalId: string, modulos: string[]) => {
    try {
      await fetch(`/api/correo/canales/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulos_disponibles: modulos }),
      })
    } catch {
      mostrar('error', 'Error al guardar módulos')
    }
  }

  // Ordenar: principal primero, después por fecha de creación
  const canalesOrdenados = [...canalesCorreo].sort((a, b) => {
    if (a.es_principal && !b.es_principal) return -1
    if (!a.es_principal && b.es_principal) return 1
    return 0
  })

  const canalPrincipal = canalesCorreo.find(c => c.es_principal)
  const emailDeCanal = (canal: CanalMensajeria) => {
    const cfg = canal.config_conexion as Record<string, unknown>
    return (cfg.email || cfg.usuario || canal.nombre) as string
  }

  return (
    <div className="space-y-8">
      {/* 1. BANDEJAS DE CORREO */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Bandejas de correo
            </h3>
            {canalesCorreo.length > 0 && (
              <Boton
                variante="secundario"
                tamano="xs"
                icono={sincronizando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                onClick={sincronizarAhora}
                disabled={sincronizando}
              >
                {sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
              </Boton>
            )}
          </div>
          <Boton variante="primario" tamano="sm" icono={<Plus size={14} />} onClick={onAgregarCanal}>
            Agregar bandeja
          </Boton>
        </div>

        {resultadoSync && (
          <Alerta tipo={resultadoSync.includes('Error') ? 'peligro' : 'exito'} cerrable onCerrar={() => setResultadoSync(null)}>
            {resultadoSync}
          </Alerta>
        )}

        <p className="text-xs mb-3" style={{ color: 'var(--texto-terciario)' }}>
          Bandejas compartidas del equipo (ventas@, soporte@, info@…). Expandí cada tarjeta para ver datos de conexión, asignar agentes, editar la firma o marcar como principal.
          Las bandejas personales de cada usuario se conectan desde su perfil en Usuarios → Correo.
        </p>

        {canalesCorreo.length === 0 ? (
          <EstadoVacio
            icono={<Mail />}
            titulo="Sin bandejas compartidas"
            descripcion="Conectá una bandeja del equipo (ventas@, soporte@, info@). Para correos personales de un usuario, hacelo desde su perfil."
          />
        ) : (
          <div className="space-y-4">
            {canalesOrdenados.map((canal) => (
              <CanalCard key={canal.id} canal={canal} onRecargar={onRecargar} onHacerPrincipal={hacerPrincipal} />
            ))}
          </div>
        )}
      </div>

      {/* 2. CORREO PREDETERMINADO */}
      {canalesCorreo.length > 0 && (
        <div className="pt-6" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
            Correo predeterminado
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--texto-terciario)' }}>
            Cuando envíes un correo, el sistema seleccionará automáticamente la bandeja configurada. Siempre podrás cambiarla manualmente antes de enviar.
          </p>

          {/* Cuenta principal */}
          <div
            className="p-3 rounded-card mb-4 flex items-center gap-3"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <Shield size={16} style={{ color: 'var(--texto-marca)' }} />
            <div className="flex-1">
              <p className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>
                Cuenta principal
              </p>
              <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                {canalPrincipal
                  ? `${canalPrincipal.nombre} (${emailDeCanal(canalPrincipal)})`
                  : 'Ninguna — marcá una bandeja como principal desde la lista de arriba'
                }
              </p>
            </div>
            {canalPrincipal && (
              <Insignia color="primario" tamano="sm">Principal</Insignia>
            )}
          </div>

          {/* Reglas por tipo de contacto */}
          {tiposContacto.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--texto-secundario)' }}>
                Reglas por tipo de contacto
              </p>
              <div className="space-y-2">
                {tiposContacto.map((tipo) => (
                  <div
                    key={tipo.id}
                    className="flex items-center gap-3 p-2 rounded-card"
                    style={{ background: 'var(--superficie-tarjeta)' }}
                  >
                    <span className="text-xs font-medium flex-1 min-w-0" style={{ color: 'var(--texto-primario)' }}>
                      {tipo.etiqueta}
                    </span>
                    <Select
                      valor={reglasPorTipo[tipo.id] || ''}
                      onChange={(v) => guardarReglaTipo(tipo.id, v)}
                      opciones={[
                        { valor: '', etiqueta: 'Usar cuenta principal' },
                        ...canalesOrdenados.map(c => ({
                          valor: c.id,
                          etiqueta: `${c.nombre} (${emailDeCanal(c)})`,
                        })),
                      ]}
                      variante="plano"
                      className="text-xs max-w-[280px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DISPONIBILIDAD EN MÓDULOS */}
      {canalesCorreo.length > 0 && (
        <div className="pt-6" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
            Disponibilidad en módulos
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--texto-terciario)' }}>
            Configurá en qué módulos aparece cada bandeja al enviar correos. Si no marcás ninguno, estará disponible en todos.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--texto-secundario)' }}>
                    Bandeja
                  </th>
                  {MODULOS_CORREO.map(mod => (
                    <th key={mod.slug} className="text-center py-2 px-2 font-medium" style={{ color: 'var(--texto-terciario)' }}>
                      {mod.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {canalesOrdenados.map((canal) => {
                  const mods = canal.modulos_disponibles || []
                  const todosActivos = mods.length === 0 // vacío = disponible en todos
                  return (
                    <tr key={canal.id} style={{ borderTop: '1px solid var(--borde-sutil)' }}>
                      <td className="py-2 pr-3 font-medium" style={{ color: 'var(--texto-primario)' }}>
                        <div className="flex items-center gap-2">
                          <span>{canal.nombre}</span>
                          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                            {emailDeCanal(canal)}
                          </span>
                        </div>
                      </td>
                      {MODULOS_CORREO.map(mod => {
                        const activo = todosActivos || mods.includes(mod.slug)
                        return (
                          <td key={mod.slug} className="text-center py-2 px-2">
                            <input
                              type="checkbox"
                              checked={activo}
                              onChange={() => {
                                let nuevos: string[]
                                if (todosActivos) {
                                  // Pasar de "todos" a "todos menos este"
                                  nuevos = MODULOS_CORREO.map(m => m.slug).filter(s => s !== mod.slug)
                                } else if (activo) {
                                  nuevos = mods.filter(m => m !== mod.slug)
                                  // Si queda vacío o igual a todos, volver a vacío
                                  if (nuevos.length === 0) nuevos = []
                                } else {
                                  nuevos = [...mods, mod.slug]
                                  // Si se marcaron todos, volver a vacío (= todos)
                                  if (nuevos.length === MODULOS_CORREO.length) nuevos = []
                                }
                                guardarModulosBandeja(canal.id, nuevos)
                                // Actualizar estado local optimista
                                canal.modulos_disponibles = nuevos
                                onRecargar()
                              }}
                              className="w-4 h-4 rounded cursor-pointer accent-[var(--texto-marca)]"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FILTRO ANTI-SPAM */}
      <div className="pt-6" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
          Filtro anti-spam
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--texto-terciario)' }}>
          Emails o dominios (uno por línea). Los permitidos nunca se marcan como spam. Los bloqueados se auto-clasifican como spam.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--insignia-exito)' }}>
              Permitidos
            </label>
            <TextArea
              value={listaPermitidos}
              onChange={(e) => setListaPermitidos(e.target.value)}
              onBlur={guardarListas}
              rows={5}
              compacto
              monoespacio
              placeholder="cliente@empresa.com&#10;@socio.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--insignia-peligro)' }}>
              Bloqueados
            </label>
            <TextArea
              value={listaBloqueados}
              onChange={(e) => setListaBloqueados(e.target.value)}
              onBlur={guardarListas}
              rows={5}
              compacto
              monoespacio
              placeholder="spam@dominio.com&#10;@marketing-masivo.com"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
