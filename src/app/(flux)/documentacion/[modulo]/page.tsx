import { readFileSync } from 'fs'
import { join } from 'path'
import VistaDocumentacion from './_componentes/VistaDocumentacion'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ modulo: string }>
}

/**
 * Página de documentación dinámica por módulo. Carga
 * `docs/DOCUMENTACION_<MODULO>.md` desde el filesystem y lo renderiza
 * con react-markdown.
 *
 * Si el MD no existe, devuelve `contenido: null` y la vista muestra
 * mensaje informativo en lugar de error.
 *
 * Convención: ver `docs/CONVENCION_DOCUMENTACION_USUARIO.md`.
 */
export default async function PaginaDocumentacionModulo({ params }: Props) {
  const { modulo } = await params
  const slug = modulo.toLowerCase()
  const archivo = `DOCUMENTACION_${slug.toUpperCase()}.md`
  const ruta = join(process.cwd(), 'docs', archivo)

  let contenido: string | null = null
  try {
    contenido = readFileSync(ruta, 'utf-8')
  } catch {
    contenido = null
  }

  return <VistaDocumentacion slug={slug} contenido={contenido} />
}
