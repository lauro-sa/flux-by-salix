interface PropiedadesEncabezadoAuth {
  titulo: string
  descripcion?: string
}

function EncabezadoAuth({ titulo, descripcion }: PropiedadesEncabezadoAuth) {
  return (
    <div className="text-center mb-6">
      <h2 className="text-lg font-semibold text-texto-primario mb-1">{titulo}</h2>
      {descripcion && <p className="text-sm text-texto-terciario">{descripcion}</p>}
    </div>
  )
}

export { EncabezadoAuth, type PropiedadesEncabezadoAuth }
