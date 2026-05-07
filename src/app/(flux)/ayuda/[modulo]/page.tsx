import { readFileSync } from 'fs'
import { join } from 'path'
import VistaAyuda from './_componentes/VistaAyuda'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ modulo: string }>
}

/**
 * Página de ayuda dinámica por módulo. Carga `docs/COMO_USAR_<MODULO>.md`
 * desde el filesystem y lo renderiza con react-markdown.
 *
 * Si el MD no existe, devuelve `contenido: null` y la vista muestra
 * mensaje informativo en lugar de error.
 *
 * Convención: ver `docs/CONVENCION_GUIAS_USUARIO.md`.
 */
export default async function PaginaAyudaModulo({ params }: Props) {
  const { modulo } = await params
  const slug = modulo.toLowerCase()
  const archivo = `COMO_USAR_${slug.toUpperCase()}.md`
  const ruta = join(process.cwd(), 'docs', archivo)

  let contenido: string | null = null
  try {
    contenido = readFileSync(ruta, 'utf-8')
  } catch {
    contenido = null
  }

  return <VistaAyuda slug={slug} contenido={contenido} />
}
