'use client'

import { useState, useEffect } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import {
  Plus, Trash2, Bot, MessageCircle, Hash, FileText,
} from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { EditorWhatsApp } from './EditorWhatsApp'

/**
 * Tipos internos del chatbot — opciones de menú y palabras clave.
 */
interface OpcionMenu {
  numero: string
  etiqueta: string
  respuesta: string
  descripcion?: string // Solo para listas
}

interface PalabraClave {
  palabras: string[]
  respuesta: string
  exacta: boolean
}

interface ConfigChatbot {
  activo: boolean
  bienvenida_activa: boolean
  mensaje_bienvenida: string
  bienvenida_frecuencia: string
  bienvenida_dias_sin_contacto: number
  menu_activo: boolean
  menu_tipo: 'texto' | 'botones' | 'lista'
  menu_titulo_lista: string
  mensaje_menu: string
  opciones_menu: OpcionMenu[]
  palabras_clave: PalabraClave[]
  mensaje_defecto: string
  palabra_transferir: string
  mensaje_transferencia: string
  modo: 'siempre' | 'fuera_horario'
}

const CHATBOT_DEFAULTS: ConfigChatbot = {
  activo: false,
  bienvenida_activa: true,
  mensaje_bienvenida: '¡Hola {{nombre}}! 👋 Gracias por comunicarte con nosotros.',
  bienvenida_frecuencia: 'dias_sin_contacto',
  bienvenida_dias_sin_contacto: 30,
  menu_activo: false,
  menu_tipo: 'botones',
  menu_titulo_lista: 'Ver opciones',
  mensaje_menu: '¿En qué podemos ayudarte?',
  opciones_menu: [
    { numero: '1', etiqueta: 'Productos', respuesta: 'Te envío información de nuestros productos...', descripcion: 'Info y catálogo' },
    { numero: '2', etiqueta: 'Precios', respuesta: 'Los precios dependen del trabajo. ¿Podrías contarnos qué necesitás?', descripcion: 'Consultar costos' },
    { numero: '3', etiqueta: 'Hablar con asesor', respuesta: '', descripcion: 'Te derivamos' },
  ],
  palabras_clave: [],
  mensaje_defecto: 'No entendí tu mensaje. Esperá que un asesor te atienda.',
  palabra_transferir: 'asesor',
  mensaje_transferencia: 'Te estoy derivando con un asesor. En breve te van a atender. 🙏',
  modo: 'siempre',
}

/**
 * Sección Chatbot — configuración del bot de WhatsApp con bienvenida, menú, palabras clave y transferencia.
 * Se usa en la configuración del inbox cuando la sección activa es "chatbot".
 */
export function SeccionChatbot() {
  const { t } = useTraduccion()
  const [config, setConfig] = useState<ConfigChatbot>(CHATBOT_DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Cargar config
  useEffect(() => {
    fetch('/api/inbox/chatbot')
      .then(r => r.json())
      .then(d => { if (d.config) setConfig({ ...CHATBOT_DEFAULTS, ...d.config }) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  // Guardar
  const guardar = async (cambios: Partial<ConfigChatbot>) => {
    const nueva = { ...config, ...cambios }
    setConfig(nueva)
    setGuardando(true)
    try {
      await fetch('/api/inbox/chatbot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
    } catch { /* silenciar */ }
    setGuardando(false)
  }

  // Agregar palabra clave
  const agregarPalabraClave = () => {
    guardar({
      palabras_clave: [...config.palabras_clave, { palabras: [''], respuesta: '', exacta: false }],
    })
  }

  // Actualizar palabra clave
  const actualizarPalabraClave = (indice: number, campo: keyof PalabraClave, valor: unknown) => {
    const nuevas = [...config.palabras_clave]
    nuevas[indice] = { ...nuevas[indice], [campo]: valor }
    guardar({ palabras_clave: nuevas })
  }

  // Eliminar palabra clave
  const eliminarPalabraClave = (indice: number) => {
    guardar({ palabras_clave: config.palabras_clave.filter((_, i) => i !== indice) })
  }

  // Agregar opción de menú
  const agregarOpcionMenu = () => {
    const siguiente = String(config.opciones_menu.length + 1)
    guardar({
      opciones_menu: [...config.opciones_menu, { numero: siguiente, etiqueta: '', respuesta: '' }],
    })
  }

  // Actualizar opción de menú
  const actualizarOpcionMenu = (indice: number, campo: keyof OpcionMenu, valor: string) => {
    const nuevas = [...config.opciones_menu]
    nuevas[indice] = { ...nuevas[indice], [campo]: valor }
    guardar({ opciones_menu: nuevas })
  }

  // Eliminar opción de menú
  const eliminarOpcionMenu = (indice: number) => {
    guardar({ opciones_menu: config.opciones_menu.filter((_, i) => i !== indice) })
  }

  if (cargando) return <CargadorSeccion />

  const estiloSeccion = { border: '1px solid var(--borde-sutil)' }

  return (
    <div className="space-y-5">
      {/* Header + toggle */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={estiloSeccion}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--texto-marca) 10%, transparent)' }}>
            <Bot size={20} style={{ color: 'var(--texto-marca)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
              Chatbot de WhatsApp
              {config.activo && (
                <span className="ml-2 text-xxs font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--insignia-exito) 15%, transparent)', color: 'var(--insignia-exito)' }}>
                  activo
                </span>
              )}
            </h3>
            <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
              Respuestas automáticas para clientes. Sin código.
            </p>
          </div>
        </div>
        <Interruptor activo={config.activo} onChange={(v) => guardar({ activo: v })} />
      </div>

      <div className={`space-y-4 ${!config.activo ? 'opacity-40 pointer-events-none' : ''}`}>

        {/* Cuándo disparar */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
            Cuándo disparar
          </p>
          <div className="space-y-2">
            <Select
              valor={config.modo}
              onChange={(v) => guardar({ modo: v as 'siempre' | 'fuera_horario' })}
              opciones={[
                { valor: 'siempre', etiqueta: 'Siempre activo' },
                { valor: 'fuera_horario', etiqueta: 'Solo fuera de horario' },
              ]}
            />
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
              {config.modo === 'siempre' ? 'Responde siempre que no haya un agente atendiendo' : 'Solo responde fuera del horario de atención'}
            </p>
          </div>
        </div>

        {/* Mensaje de bienvenida */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} style={{ color: 'var(--canal-whatsapp)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Mensaje de bienvenida</span>
            </div>
            <Interruptor activo={config.bienvenida_activa} onChange={(v) => guardar({ bienvenida_activa: v })} />
          </div>

          {config.bienvenida_activa && (
            <div className="space-y-3 pt-1">
              {/* Frecuencia */}
              <div>
                <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
                  Cuándo enviar
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      valor={config.bienvenida_frecuencia || 'dias_sin_contacto'}
                      onChange={(v) => guardar({ bienvenida_frecuencia: v })}
                      opciones={[
                        { valor: 'primera_vez', etiqueta: 'Solo la primera vez que escribe' },
                        { valor: 'siempre', etiqueta: 'Siempre que escribe' },
                        { valor: 'dias_sin_contacto', etiqueta: 'Si no habló en los últimos X días' },
                      ]}
                    />
                  </div>
                  {(config.bienvenida_frecuencia || 'dias_sin_contacto') === 'dias_sin_contacto' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Input
                        tipo="number"
                        min={1}
                        max={365}
                        value={config.bienvenida_dias_sin_contacto || 30}
                        onChange={(e) => guardar({ bienvenida_dias_sin_contacto: parseInt(e.target.value) || 30 })}
                        formato={null}
                        compacto
                        className="w-16 text-center"
                      />
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>días</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
                  Texto del mensaje
                </label>
                <EditorWhatsApp
                  valor={config.mensaje_bienvenida}
                  onChange={(v) => guardar({ mensaje_bienvenida: v })}
                  placeholder="¡Hola {{nombre}}! 👋 Gracias por comunicarte..."
                  titulo="Mensaje de bienvenida"
                />
              </div>

              {/* Variables */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Variables:</span>
                {[
                  { clave: '{{nombre}}', desc: 'Nombre del contacto' },
                  { clave: '{{empresa}}', desc: 'Tu empresa' },
                ].map(v => (
                  <Boton
                    key={v.clave}
                    variante="fantasma"
                    tamano="xs"
                    onClick={() => guardar({ mensaje_bienvenida: config.mensaje_bienvenida + ` ${v.clave}` })}
                    titulo={v.desc}
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
                  >
                    {v.clave}
                  </Boton>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Menú de opciones */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Menú de opciones</span>
            </div>
            <Interruptor activo={config.menu_activo} onChange={(v) => guardar({ menu_activo: v })} />
          </div>

          {config.menu_activo && (
            <>
              {/* Mensaje del menú */}
              <EditorWhatsApp
                valor={config.mensaje_menu}
                onChange={(v) => guardar({ mensaje_menu: v })}
                placeholder="¿En qué podemos ayudarte?"
                titulo="Mensaje del menú"
              />

              {/* Selector Botones vs Lista */}
              <div>
                <p className="text-xxs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--texto-terciario)' }}>
                  Tipo de menú
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'texto' as const, icono: <Hash size={16} />, nombre: 'Texto', desc: 'Sin límite — el cliente escribe el número' },
                    { id: 'botones' as const, icono: <MessageCircle size={16} />, nombre: 'Botones', desc: 'Hasta 3 — botones tocables' },
                    { id: 'lista' as const, icono: <FileText size={16} />, nombre: 'Lista', desc: 'Hasta 10 — menú desplegable' },
                  ]).map(t => (
                    <Boton
                      key={t.id}
                      variante={config.menu_tipo === t.id ? 'primario' : 'secundario'}
                      tamano="sm"
                      onClick={() => {
                        if (t.id === 'botones' && config.opciones_menu.length > 3) {
                          guardar({ menu_tipo: t.id, opciones_menu: config.opciones_menu.slice(0, 3) })
                        } else {
                          guardar({ menu_tipo: t.id })
                        }
                      }}
                      className="p-3 text-left"
                      style={{
                        border: `2px solid ${config.menu_tipo === t.id ? 'var(--texto-marca)' : 'var(--borde-sutil)'}`,
                        background: config.menu_tipo === t.id ? 'color-mix(in srgb, var(--texto-marca) 8%, transparent)' : 'transparent',
                      }}
                    >
                      <span className="block">
                        <span style={{ color: config.menu_tipo === t.id ? 'var(--texto-marca)' : 'var(--texto-terciario)' }} className="mb-1.5 block">{t.icono}</span>
                        <span className="text-xs font-semibold block" style={{ color: config.menu_tipo === t.id ? 'var(--texto-marca)' : 'var(--texto-primario)' }}>
                          {t.nombre}
                        </span>
                        <span className="text-xxs block" style={{ color: 'var(--texto-terciario)' }}>{t.desc}</span>
                      </span>
                    </Boton>
                  ))}
                </div>
              </div>

              {/* Título del botón de lista (solo si es lista) */}
              {config.menu_tipo === 'lista' && (
                <div>
                  <label className="text-xxs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>
                    Texto del botón que abre la lista
                  </label>
                  <Input
                    value={config.menu_titulo_lista}
                    onChange={(e) => guardar({ menu_titulo_lista: e.target.value })}
                    compacto
                    formato={null}
                    placeholder="Ver opciones"
                    maxLength={20}
                  />
                </div>
              )}

              {/* Opciones */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                  Opciones {config.opciones_menu.length}/{config.menu_tipo === 'botones' ? 3 : config.menu_tipo === 'lista' ? 10 : '∞'}
                </p>
                {config.opciones_menu.length < (config.menu_tipo === 'botones' ? 3 : config.menu_tipo === 'lista' ? 10 : 99) && (
                  <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarOpcionMenu}>
                    Agregar opción
                  </Boton>
                )}
              </div>

              {config.opciones_menu.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-6 rounded-lg cursor-pointer"
                  style={{ border: '2px dashed var(--borde-sutil)' }}
                  onClick={agregarOpcionMenu}
                >
                  <Plus size={20} style={{ color: 'var(--texto-terciario)' }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--texto-terciario)' }}>
                    Agregá al menos una opción para que el bot funcione
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {config.opciones_menu.map((op, i) => {
                    const tipo = config.menu_tipo

                    // TEXTO NUMERADO
                    if (tipo === 'texto') {
                      return (
                        <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--superficie-hover)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm flex-shrink-0" style={{ color: 'var(--texto-marca)' }}>
                              {i + 1}️⃣
                            </span>
                            <Input
                              value={op.etiqueta}
                              onChange={(e) => actualizarOpcionMenu(i, 'etiqueta', e.target.value)}
                              compacto
                              formato={null}
                              placeholder="Texto de la opción"
                              className="flex-1"
                            />
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => eliminarOpcionMenu(i)} />
                          </div>
                          <div className="ml-8">
                            <EditorWhatsApp
                              valor={op.respuesta}
                              onChange={(v) => actualizarOpcionMenu(i, 'respuesta', v)}
                              placeholder={!op.respuesta ? '(Sin respuesta = transfiere a agente)' : 'Respuesta automática...'}
                              titulo={`Respuesta: ${op.etiqueta || `Opción ${i + 1}`}`}
                              alturaMinima={80}
                            />
                          </div>
                        </div>
                      )
                    }

                    // BOTONES
                    if (tipo === 'botones') {
                      return (
                        <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--borde-sutil)' }}>
                          {/* Simula un botón de WhatsApp */}
                          <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'var(--superficie-hover)' }}>
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xxs font-bold"
                              style={{ background: 'var(--texto-marca)', color: 'var(--texto-inverso)' }}
                            >
                              {i + 1}
                            </div>
                            <Input
                              value={op.etiqueta}
                              onChange={(e) => actualizarOpcionMenu(i, 'etiqueta', e.target.value)}
                              compacto
                              formato={null}
                              placeholder="Texto del botón (máx 20)"
                              maxLength={20}
                              className="flex-1"
                            />
                            <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{(op.etiqueta || '').length}/20</span>
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => eliminarOpcionMenu(i)} />
                          </div>
                          <div className="px-3 py-2" style={{ background: 'var(--superficie-tarjeta)' }}>
                            <EditorWhatsApp
                              valor={op.respuesta}
                              onChange={(v) => actualizarOpcionMenu(i, 'respuesta', v)}
                              placeholder={!op.respuesta ? '(Sin respuesta = transfiere a agente)' : 'Respuesta al tocar este botón...'}
                              titulo={`Respuesta: ${op.etiqueta || `Botón ${i + 1}`}`}
                              alturaMinima={80}
                            />
                          </div>
                        </div>
                      )
                    }

                    // LISTA
                    return (
                      <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--borde-sutil)' }}>
                        <div className="px-3 py-2.5 space-y-1.5" style={{ background: 'var(--superficie-hover)' }}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xxs font-bold"
                              style={{ background: 'var(--texto-marca)', color: 'var(--texto-inverso)' }}
                            >
                              {i + 1}
                            </div>
                            <Input
                              value={op.etiqueta}
                              onChange={(e) => actualizarOpcionMenu(i, 'etiqueta', e.target.value)}
                              compacto
                              formato={null}
                              placeholder="Título de la opción (máx 24)"
                              maxLength={24}
                              className="flex-1"
                            />
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => eliminarOpcionMenu(i)} />
                          </div>
                          <Input
                            value={op.descripcion || ''}
                            onChange={(e) => actualizarOpcionMenu(i, 'descripcion', e.target.value)}
                            compacto
                            formato={null}
                            placeholder="Descripción corta (opcional, máx 72)"
                            maxLength={72}
                            className="ml-7"
                          />
                        </div>
                        <div className="px-3 py-2" style={{ background: 'var(--superficie-tarjeta)' }}>
                          <EditorWhatsApp
                            valor={op.respuesta}
                            onChange={(v) => actualizarOpcionMenu(i, 'respuesta', v)}
                            placeholder={!op.respuesta ? '(Sin respuesta = transfiere a agente)' : 'Respuesta al elegir esta opción...'}
                            titulo={`Respuesta: ${op.etiqueta || `Opción ${i + 1}`}`}
                            alturaMinima={80}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Palabras clave */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🔑</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Respuestas por palabra clave</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Si el mensaje del cliente contiene alguna de estas palabras, el bot responde automáticamente.
          </p>

          <div className="space-y-2">
            {config.palabras_clave.map((pc, i) => (
              <div key={i} className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'var(--superficie-hover)' }}>
                <div className="flex items-center gap-2">
                  <Input
                    value={pc.palabras.join(', ')}
                    onChange={(e) => actualizarPalabraClave(i, 'palabras', e.target.value.split(',').map(p => p.trim().toLowerCase()).filter(Boolean))}
                    compacto
                    formato={null}
                    placeholder="Palabras separadas por coma: precio, costo, cuanto"
                    className="flex-1"
                  />
                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar" icono={<Trash2 size={12} />} onClick={() => eliminarPalabraClave(i)} />
                </div>
                <EditorWhatsApp
                  valor={pc.respuesta}
                  onChange={(v) => actualizarPalabraClave(i, 'respuesta', v)}
                  placeholder="Respuesta automática cuando detecta estas palabras..."
                  titulo="Respuesta por palabra clave"
                  alturaMinima={80}
                />
              </div>
            ))}
          </div>
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />} onClick={agregarPalabraClave}>
            Agregar palabra clave
          </Boton>
        </div>

        {/* Mensaje por defecto */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <div className="flex items-center gap-2">
            <span className="text-sm">❓</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Mensaje por defecto</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Se envía cuando el bot no entiende el mensaje del cliente.
          </p>
          <EditorWhatsApp
            valor={config.mensaje_defecto}
            onChange={(v) => guardar({ mensaje_defecto: v })}
            placeholder="No entendí tu mensaje..."
            titulo="Mensaje por defecto"
            alturaMinima={80}
          />
        </div>

        {/* Transferencia a agente */}
        <div className="p-4 rounded-xl space-y-3" style={estiloSeccion}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🙋</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--texto-primario)' }}>Transferir a agente</span>
          </div>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Cuando el cliente escribe esta palabra, el bot deja de responder y un agente toma la conversación.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Palabra clave</label>
              <Input
                value={config.palabra_transferir}
                onChange={(e) => guardar({ palabra_transferir: e.target.value.toLowerCase() })}
                compacto
                formato={null}
              />
            </div>
            <div>
              <label className="text-xxs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Mensaje al transferir</label>
              <Input
                value={config.mensaje_transferencia}
                onChange={(e) => guardar({ mensaje_transferencia: e.target.value })}
                compacto
                formato={null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
