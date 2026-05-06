'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Braces } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useEsMovil } from '@/hooks/useEsMovil'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { leerCampoDot } from '@/lib/workflows/resolver-variables'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import {
  parsearTexto,
  serializarExpresionVariable,
  type ExpresionVariable,
  type Segmento,
} from './parsear-expresion'
import PickerVariables from './PickerVariables'

/**
 * Input single-line con pills de variables (sub-PR 19.3b).
 *
 * Patrón clon de `InputAsuntoVariables` (validado en producción para
 * correos), extendido para soportar EXPRESIONES COMPLETAS con helpers
 * (`{{ ruta | helper(arg) }}`).
 *
 * Decisiones técnicas:
 *   • El componente NO usa el `ChipVariable` React renderizado por
 *     React — usa HTML manual (innerHTML) cuando el `valor` externo
 *     cambia. Razón: contenteditable + sub-renders React pelean por
 *     control del DOM y rompen el caret. El render "imperativo" es
 *     más estable.
 *   • La fuente única de verdad es el `valor: string` raw. El DOM se
 *     reconstruye desde ahí cada vez que cambia y NO matchea con el
 *     valorActualEnDOM (lo trackeamos en un ref para no rompernos a
 *     nosotros mismos).
 *   • Activación del picker: tecleo `{{` (modo "tipear-llaves") o
 *     click en ícono `{}` (modo "descubrir") o click en chip (modo
 *     "editar"). El picker mismo no sabe del modo — solo recibe ancla
 *     + onSeleccionar; el componente decide qué hacer con el callback.
 *
 * UX (caveats del coordinador):
 *   • Paste de texto con `{{ ... }}` parsea a chips, no queda literal.
 *   • Cursor después de insertar chip queda después + 1 espacio.
 *   • Selección parcial sobre chip → backspace/delete elimina chip
 *     entero (atomicidad nativa de contenteditable + nodo atom).
 */

interface Props {
  valor: string
  onChange: (raw: string) => void
  placeholder?: string
  /** Contexto enriquecido para resolver previews dentro de los chips. */
  contexto: ContextoVariables
  /** Fuentes disponibles según disparador (filtradas en el padre). */
  fuentes: FuenteVariables[]
  soloLectura?: boolean
  ariaLabel?: string
}

export default function InputConVariables({
  valor,
  onChange,
  placeholder,
  contexto,
  fuentes,
  soloLectura = false,
  ariaLabel,
}: Props) {
  const { t } = useTraduccion()
  const esMovil = useEsMovil()
  const editableRef = useRef<HTMLDivElement>(null)
  const valorEnDomRef = useRef<string>('')
  const [picker, setPicker] = useState<
    | { abierto: false }
    | {
        abierto: true
        ancla: { top: number; left: number; width: number }
        textoInicial: string
        modo: 'tipear-llaves' | 'descubrir' | 'editar'
        chipDataRawAReemplazar?: string
      }
  >({ abierto: false })

  // ─── Render inicial / sincronización desde el padre ──────────────
  // Cuando el `valor` externo cambia y NO es lo que hay en el DOM, hacemos
  // un re-render imperativo. Si fuimos nosotros los que generamos el
  // cambio (via onChange), `valorEnDomRef` ya tiene ese valor y skipeamos.
  useEffect(() => {
    if (!editableRef.current) return
    if (valor === valorEnDomRef.current) return
    editableRef.current.innerHTML = renderizarSegmentosAHtml(
      parsearTexto(valor),
      contexto,
    )
    valorEnDomRef.current = valor
  }, [valor, contexto])

  // ─── Reconstruir raw desde el DOM ────────────────────────────────
  const reconstruirRaw = useCallback((): string => {
    const root = editableRef.current
    if (!root) return ''
    let out = ''
    root.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent ?? ''
      } else if (node instanceof HTMLElement) {
        const raw = node.getAttribute('data-raw')
        if (raw) out += raw
        else out += node.textContent ?? ''
      }
    })
    return out
  }, [])

  // ─── Handler central onInput ─────────────────────────────────────
  const onInput = useCallback(() => {
    const nuevo = reconstruirRaw()
    valorEnDomRef.current = nuevo
    onChange(nuevo)
  }, [onChange, reconstruirRaw])

  // ─── Detectar `{{` antes del caret para abrir el picker ─────────
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (soloLectura) return
      if (e.key !== '{' && e.key !== '}') return // optimización: solo testeamos al teclear llaves
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (!range.collapsed) return
      // Texto a la izquierda del caret dentro del nodo actual.
      const startNode = range.startContainer
      if (startNode.nodeType !== Node.TEXT_NODE) return
      const izq = (startNode.textContent ?? '').slice(0, range.startOffset)
      // ¿Termina en `{{` no precedido por otro `{`?
      if (!/\{\{$/.test(izq)) return
      // Abrimos el picker debajo del caret.
      const rect = (editableRef.current as HTMLElement | null)?.getBoundingClientRect()
      if (!rect) return
      setPicker({
        abierto: true,
        ancla: { top: rect.bottom, left: rect.left, width: rect.width },
        textoInicial: '',
        modo: 'tipear-llaves',
      })
    },
    [soloLectura],
  )

  // ─── Click en chip → abrir picker en modo edición ───────────────
  const onClickContenedor = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (soloLectura) return
      const target = e.target as HTMLElement | null
      const chip = target?.closest('[data-variable]') as HTMLElement | null
      if (!chip) return
      e.preventDefault()
      const raw = chip.getAttribute('data-raw') ?? ''
      const rect = (editableRef.current as HTMLElement | null)?.getBoundingClientRect()
      if (!rect) return
      setPicker({
        abierto: true,
        ancla: { top: rect.bottom, left: rect.left, width: rect.width },
        textoInicial: '',
        modo: 'editar',
        chipDataRawAReemplazar: raw,
      })
    },
    [soloLectura],
  )

  // ─── Paste handler: parsear texto plano y dejar que el effect re-renderice ─
  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (soloLectura) return
      e.preventDefault()
      const texto = e.clipboardData.getData('text/plain')
      // Insertamos el texto crudo en la posición del caret. El effect
      // reconstruye el DOM desde el `valor` actualizado en el siguiente
      // render. Para mantenerlo simple, simplemente CONCATENAMOS el texto
      // pegado al final del valor — perdemos la posición del caret pero
      // no rompemos chips existentes. UX validada en correos.
      const nuevo = (valorEnDomRef.current ?? valor) + texto
      valorEnDomRef.current = nuevo
      onChange(nuevo)
    },
    [onChange, soloLectura, valor],
  )

  // ─── Insertar / reemplazar variable desde el picker ─────────────
  const cerrarPicker = useCallback(() => setPicker({ abierto: false }), [])

  const insertarOEditar = useCallback(
    (expresion: ExpresionVariable) => {
      const expRaw = serializarExpresionVariable(expresion) + ' '
      let nuevo: string
      if (picker.abierto && picker.modo === 'editar' && picker.chipDataRawAReemplazar) {
        // Reemplazar por raw — substring exacto, primer match.
        nuevo = (valorEnDomRef.current ?? valor).replace(
          picker.chipDataRawAReemplazar,
          expresion ? serializarExpresionVariable(expresion) : '',
        )
      } else if (picker.abierto && picker.modo === 'tipear-llaves') {
        // Borrar el `{{` antes del caret y meter expresión + espacio.
        const base = (valorEnDomRef.current ?? valor).replace(/\{\{$/, '')
        nuevo = base + expRaw
      } else {
        // Modo 'descubrir' — append al final con un espacio antes si hace falta.
        const actual = valorEnDomRef.current ?? valor
        const sep = actual.length > 0 && !actual.endsWith(' ') ? ' ' : ''
        nuevo = actual + sep + expRaw
      }
      valorEnDomRef.current = nuevo
      onChange(nuevo)
      cerrarPicker()
    },
    [cerrarPicker, onChange, picker, valor],
  )

  // ─── Abrir picker en modo "descubrir" desde el botón {} ─────────
  const abrirPickerDescubrir = useCallback(() => {
    if (soloLectura) return
    const rect = (editableRef.current as HTMLElement | null)?.getBoundingClientRect()
    if (!rect) return
    setPicker({
      abierto: true,
      ancla: { top: rect.bottom, left: rect.left, width: rect.width },
      textoInicial: '',
      modo: 'descubrir',
    })
  }, [soloLectura])

  return (
    <div className="relative">
      <div
        className={[
          'flex items-center gap-2 rounded-input border bg-superficie-tarjeta px-3 py-2',
          soloLectura ? 'border-borde-sutil opacity-70' : 'border-borde-fuerte focus-within:border-borde-foco focus-within:shadow-foco',
          'transition-all duration-150',
        ].join(' ')}
      >
        <div
          ref={editableRef}
          contentEditable={!soloLectura}
          suppressContentEditableWarning
          onInput={onInput}
          onKeyUp={onKeyUp}
          onPaste={onPaste}
          onClick={onClickContenedor}
          aria-label={ariaLabel}
          data-placeholder={placeholder}
          className="flex-1 min-w-0 outline-none text-sm text-texto-primario whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-texto-placeholder"
        />

        {!soloLectura && (
          <Tooltip contenido={t('flujos.picker.boton_insertar')}>
            <button
              type="button"
              onClick={abrirPickerDescubrir}
              className="shrink-0 inline-flex items-center justify-center size-7 rounded-md text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover transition-colors cursor-pointer"
              aria-label={t('flujos.picker.boton_insertar')}
            >
              <Braces size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {picker.abierto && (
        <PickerVariables
          abierto
          ancla={picker.ancla}
          fuentes={fuentes}
          contexto={contexto}
          textoInicial={picker.textoInicial}
          onSeleccionar={insertarOEditar}
          onCerrar={cerrarPicker}
          esMovil={esMovil}
        />
      )}
    </div>
  )
}

// =============================================================
// Render imperativo de segmentos a HTML
// =============================================================
// Generamos HTML directo (no JSX) porque el componente vive dentro de
// un `contentEditable` y mezclar React con DOM mutable rompe el caret.
// El HTML acá tiene que matchear el shape esperado por `reconstruirRaw`:
// chips con `data-raw` y atributo `data-variable`.

function renderizarSegmentosAHtml(segs: Segmento[], contexto: ContextoVariables): string {
  return segs
    .map((s) => {
      if (s.tipo === 'texto') {
        return escaparHtml(s.valor)
      }
      const raw = serializarExpresionVariable(s.expresion)
      const preview = obtenerPreview(s.expresion, contexto)
      const tienePreview = preview !== null && preview.length > 0
      const texto = tienePreview ? preview : s.expresion.ruta.split('.').slice(-1)[0]
      const claseColor = tienePreview
        ? 'bg-texto-marca/15 text-texto-marca'
        : 'bg-superficie-hover text-texto-secundario'
      return [
        `<span data-variable data-raw="${escaparAttr(raw)}" contenteditable="false" `,
        `class="inline-flex items-center mx-0.5 rounded px-1.5 py-0.5 text-sm ${claseColor} cursor-pointer select-none" `,
        `title="${escaparAttr(raw)}${tienePreview ? ` → ${escaparAttr(preview!)}` : ''}">`,
        escaparHtml(texto),
        `</span>`,
      ].join('')
    })
    .join('')
}

function obtenerPreview(expresion: ExpresionVariable, contexto: ContextoVariables): string | null {
  // El preview no aplica los helpers — solo lee el path crudo. Aplicar
  // helpers tipo `moneda` requeriría llamar al resolver completo, que
  // exige `empresa.moneda` y demás. Para 19.3b nos quedamos con valor
  // crudo; los helpers se ven en el chip pero el preview muestra el
  // valor sin formato. Mejorable después.
  const valor = leerCampoDot(expresion.ruta, contexto)
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor).slice(0, 40)
  }
  return null
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escaparAttr(s: string): string {
  return escaparHtml(s)
}
