'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Building2, Globe, Mail, Phone, MapPin, Link as LinkIcon, Receipt, Landmark, Lock, LockOpen } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { BloqueDireccion, type DatosDireccion } from '@/componentes/ui/BloqueDireccion'
import { formatearTelefono, aplicarMascara } from '@/lib/formato'
import { CargadorLogo, type VarianteLogo } from '@/componentes/ui/CargadorLogo'
import { SelectorColor, extraerColoresDeImagen } from '@/componentes/ui/SelectorColor'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useTraduccion } from '@/lib/i18n'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { etiquetaPais } from '@/lib/paises'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import type { CampoFiscalPais } from '@/tipos/contacto'

/**
 * Sección General — datos básicos de la empresa.
 * Autoguardado al salir de cada campo. Sin botón guardar.
 */
export function SeccionGeneral() {
  const { t } = useTraduccion()
  const { empresa } = useEmpresa()

  const [nombre, setNombre] = useState('')
  const [descripcionEmpresa, setDescripcionEmpresa] = useState('')
  const [slug, setSlug] = useState('')
  const [slugBloqueado, setSlugBloqueado] = useState(true)
  const [ubicacion, setUbicacion] = useState('')
  const [direccionEmpresa, setDireccionEmpresa] = useState<Record<string, unknown> | null>(null)
  const [paginaWeb, setPaginaWeb] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [logoCuadrado, setLogoCuadrado] = useState<string | null>(null)
  const [logoApaisado, setLogoApaisado] = useState<string | null>(null)
  const [colorMarca, setColorMarca] = useState('#6366f1')
  const [coloresLogo, setColoresLogo] = useState<string[]>([])
  const [datosFiscales, setDatosFiscales] = useState<Record<string, string>>({})
  const [camposFiscales, setCamposFiscales] = useState<CampoFiscalPais[]>([])
  const [paisesEmpresa, setPaisesEmpresa] = useState<string[]>([])
  const [datosBancarios, setDatosBancarios] = useState<{
    banco: string; titular: string; numero_cuenta: string; cbu: string; alias: string
  }>({ banco: '', titular: '', numero_cuenta: '', cbu: '', alias: '' })

  // Filtrar campos fiscales que aplican a "empresa" (no de identificación personal como DNI)
  const camposFiscalesEmpresa = useMemo(
    () => camposFiscales.filter(c => c.aplica_a.includes('empresa')),
    [camposFiscales]
  )

  // Agrupar campos por país para renderizado con separador
  const camposPorPais = useMemo(() => {
    const mapa = new Map<string, CampoFiscalPais[]>()
    for (const campo of camposFiscalesEmpresa) {
      const lista = mapa.get(campo.pais) || []
      lista.push(campo)
      mapa.set(campo.pais, lista)
    }
    return mapa
  }, [camposFiscalesEmpresa])

  const guardarEnServidor = useCallback(async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/empresas/actualizar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    return res.ok
  }, [])

  const { estado, puedeDeshacer, guardar, setSnapshot, deshacer } = useAutoguardado({ onGuardar: guardarEnServidor })

  useEffect(() => {
    if (!empresa) return

    const cargar = async () => {
      const supabase = crearClienteNavegador()
      const { data } = await supabase
        .from('empresas')
        .select('nombre, slug, ubicacion, direccion, pagina_web, correo, telefono, logo_url, color_marca, color_secundario, color_terciario, datos_fiscales, datos_bancarios, paises')
        .eq('id', empresa.id)
        .single()

      if (data) {
        setNombre(data.nombre || '')
        setSlug(data.slug || '')
        setUbicacion(data.ubicacion || '')
        setDireccionEmpresa(data.direccion as Record<string, unknown> | null)
        setPaginaWeb(data.pagina_web || '')
        setCorreo(data.correo || '')
        const telFormateado = data.telefono ? formatearTelefono(data.telefono) : ''
        setTelefono(telFormateado)
        // Si el formato cambió, guardarlo ya formateado en la BD
        if (data.telefono && telFormateado !== data.telefono) {
          guardarEnServidor({ telefono: telFormateado })
        }
        setLogoCuadrado(data.logo_url || null)
        setColorMarca(data.color_marca || COLOR_MARCA_DEFECTO)

        // Extraer colores del logo si existe
        if (data.logo_url) {
          extraerColoresDeImagen(data.logo_url).then(setColoresLogo).catch(() => {})
        }

        // Datos bancarios
        const bancarios = (data.datos_bancarios as { banco: string; titular: string; numero_cuenta: string; cbu: string; alias: string }) || {}
        setDatosBancarios({
          banco: bancarios.banco || '',
          titular: bancarios.titular || '',
          numero_cuenta: bancarios.numero_cuenta || '',
          cbu: bancarios.cbu || '',
          alias: bancarios.alias || '',
        })

        // Datos fiscales
        const fiscales = (data.datos_fiscales as Record<string, string>) || {}
        setDatosFiscales(fiscales)
        const paises = data.paises?.length ? data.paises : []
        setPaisesEmpresa(paises)

        // Cargar campos fiscales según países configurados
        if (paises.length > 0) {
          const { data: campos } = await supabase
            .from('campos_fiscales_pais')
            .select('*')
            .in('pais', paises)
            .order('orden')
          if (campos) setCamposFiscales(campos as CampoFiscalPais[])
        }

        setSnapshot({
          nombre: data.nombre || '',
          slug: data.slug || '',
          ubicacion: data.ubicacion || '',
          pagina_web: data.pagina_web || '',
          correo: data.correo || '',
          telefono: telFormateado,
        })
      }

      // Cargar descripcion por separado (campo puede no existir si la migración no se aplicó)
      try {
        const { data: descData } = await supabase
          .from('empresas')
          .select('descripcion')
          .eq('id', empresa.id)
          .single()
        if (descData) setDescripcionEmpresa((descData as Record<string, unknown>).descripcion as string || '')
      } catch { /* columna puede no existir aún */ }

      const { data: urlApaisado } = supabase.storage
        .from('logos')
        .getPublicUrl(`${empresa.id}/apaisado.png`)

      const res = await fetch(urlApaisado.publicUrl, { method: 'HEAD' })
      if (res.ok) setLogoApaisado(urlApaisado.publicUrl)
    }

    cargar()
  }, [empresa])

  const subirLogo = async (blob: Blob, variante: VarianteLogo) => {
    if (!empresa) return
    const supabase = crearClienteNavegador()
    const nombreArchivo = `${empresa.id}/${variante}.png`

    const { error } = await supabase.storage
      .from('logos')
      .upload(nombreArchivo, blob, { upsert: true, contentType: 'image/png' })

    if (error) return

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(nombreArchivo)
    const urlConCache = `${urlData.publicUrl}?t=${Date.now()}`

    if (variante === 'cuadrado') {
      setLogoCuadrado(urlConCache)
      await guardarEnServidor({ logo_url: urlData.publicUrl })
      // Extraer colores del nuevo logo
      extraerColoresDeImagen(urlConCache).then(setColoresLogo).catch(() => {})
    } else {
      setLogoApaisado(urlConCache)
    }
  }

  const eliminarLogo = async (variante: VarianteLogo) => {
    if (!empresa) return
    const supabase = crearClienteNavegador()
    await supabase.storage.from('logos').remove([`${empresa.id}/${variante}.png`])

    if (variante === 'cuadrado') {
      setLogoCuadrado(null)
      await guardarEnServidor({ logo_url: null })
    } else {
      setLogoApaisado(null)
    }
  }

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Información general"
        descripcion="Datos básicos de tu empresa visibles para todos los miembros."
        accion={
          <IndicadorGuardado estado={estado} puedeDeshacer={puedeDeshacer} onDeshacer={async () => {
            const restaurados = await deshacer()
            if (restaurados) {
              if ('nombre' in restaurados) setNombre(restaurados.nombre as string)
              if ('slug' in restaurados) setSlug(restaurados.slug as string)
              if ('ubicacion' in restaurados) setUbicacion(restaurados.ubicacion as string)
              if ('pagina_web' in restaurados) setPaginaWeb(restaurados.pagina_web as string)
              if ('correo' in restaurados) setCorreo(restaurados.correo as string)
              if ('telefono' in restaurados) setTelefono(restaurados.telefono as string)
            }
          }} />
        }
      />

      {/* ══ Panel: Información general ══ */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-white/[0.07]">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(91,71,224,0.15)' }}>
            <Building2 size={15} style={{ color: '#8B78F0' }} />
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-texto-primario">Información general</h3>
            <p className="text-[11px] text-texto-terciario mt-0.5">Datos básicos de tu empresa visibles para todos los miembros.</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input tipo="text" formato="nombre_empresa" etiqueta={t('empresa.nombre')}
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              onBlur={() => nombre && guardar({ nombre })} icono={<Building2 size={16} />} />
            <div className="relative">
              <Input tipo="text" formato="slug" etiqueta={t('empresa.slug')}
                value={slug} onChange={(e) => setSlug(e.target.value)}
                onBlur={() => { slug && guardar({ slug }); setSlugBloqueado(true) }}
                readOnly={slugBloqueado} icono={<Globe size={16} />}
                iconoDerecho={
                  <Boton variante="fantasma" tamano="xs" soloIcono
                    icono={slugBloqueado ? <Lock size={14} /> : <LockOpen size={14} />}
                    onClick={() => setSlugBloqueado(prev => !prev)}
                    titulo={slugBloqueado ? 'Desbloquear para editar' : 'Bloquear subdominio'} />
                }
                ayuda={slug ? `${slug}.fluxsalix.com` : ''}
                className={slugBloqueado ? 'opacity-70' : ''} />
            </div>
          </div>

          <Input tipo="text" etiqueta={t('empresa.descripcion')}
            value={descripcionEmpresa} onChange={(e) => setDescripcionEmpresa(e.target.value)}
            onBlur={() => guardar({ descripcion: descripcionEmpresa })}
            placeholder="Ej: Metalúrgica - herrería de obra" />

          <BloqueDireccion etiqueta={t('comun.ubicacion')}
            valorInicial={direccionEmpresa as Partial<DatosDireccion> | null}
            alCambiar={(dir) => {
              setUbicacion(dir.textoCompleto)
              setDireccionEmpresa(dir as unknown as Record<string, unknown>)
              guardarEnServidor({ ubicacion: dir.textoCompleto, direccion: dir })
            }} mostrarExtras={false} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input tipo="email" etiqueta={t('empresa.correo_contacto')} placeholder="info@miempresa.com"
              value={correo} onChange={(e) => setCorreo(e.target.value)}
              onBlur={() => guardar({ correo })} icono={<Mail size={16} />} />
            <Input tipo="tel" etiqueta={t('empresa.telefono')} placeholder="+54 11 1234-5678"
              value={telefono} onChange={(e) => setTelefono(e.target.value)}
              onBlur={() => guardar({ telefono })} icono={<Phone size={16} />} />
          </div>

          <Input tipo="url" etiqueta={t('comun.web')} placeholder="https://miempresa.com"
            value={paginaWeb} onChange={(e) => setPaginaWeb(e.target.value)}
            onBlur={() => guardar({ pagina_web: paginaWeb })} icono={<LinkIcon size={16} />} />
        </div>
      </div>

      {/* ══ Panel: Datos fiscales ══ */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-white/[0.07]">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(240,146,58,0.15)' }}>
            <Receipt size={15} style={{ color: '#F0923A' }} />
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-texto-primario">Datos fiscales</h3>
            <p className="text-[11px] text-texto-terciario mt-0.5">
              {paisesEmpresa.length > 0
                ? 'Identificación fiscal según los países configurados en Regionalización.'
                : 'Configurá al menos un país en Regionalización para ver los campos fiscales.'}
            </p>
          </div>
        </div>

        {camposFiscalesEmpresa.length > 0 && (
          <div className="px-6 py-5 space-y-5">
            {Array.from(camposPorPais.entries()).map(([codigoPais, campos]) => (
              <div key={codigoPais} className="rounded-lg border border-white/[0.06] overflow-hidden">
                {/* Header del país */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                  <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
                    {etiquetaPais(codigoPais)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 py-3">
                  {campos.map(campo => (
                    <div key={campo.clave}>
                      {campo.tipo_campo === 'select' && campo.opciones ? (
                        <Select etiqueta={campo.etiqueta}
                          opciones={[{ valor: '', etiqueta: 'Seleccionar...' }, ...(campo.opciones as { valor: string; etiqueta: string }[])]}
                          valor={datosFiscales[campo.clave] || ''}
                          onChange={(v) => { setDatosFiscales(prev => { const n = { ...prev, [campo.clave]: v }; guardarEnServidor({ datos_fiscales: n }); return n }) }} />
                      ) : (
                        <Input tipo="text" etiqueta={campo.etiqueta}
                          placeholder={campo.mascara?.replace(/#/g, '0') || campo.etiqueta}
                          value={datosFiscales[campo.clave] || ''}
                          onChange={(e) => {
                            const valorNuevo = campo.mascara ? aplicarMascara(e.target.value, campo.mascara) : e.target.value
                            setDatosFiscales(prev => ({ ...prev, [campo.clave]: valorNuevo }))
                          }}
                          onBlur={() => { setDatosFiscales(prev => { guardarEnServidor({ datos_fiscales: prev }); return prev }) }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Panel: Datos bancarios ══ */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-white/[0.07]">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(76,175,80,0.15)' }}>
            <Landmark size={15} style={{ color: '#4CAF50' }} />
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-texto-primario">Datos bancarios</h3>
            <p className="text-[11px] text-texto-terciario mt-0.5">Cuenta bancaria principal. Se usa como base en presupuestos y portal de clientes.</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              tipo="text"
              etiqueta="Banco"
              placeholder="Ej: Santander, Galicia, BBVA"
              value={datosBancarios.banco}
              onChange={(e) => setDatosBancarios(prev => ({ ...prev, banco: e.target.value }))}
              onBlur={() => guardarEnServidor({ datos_bancarios: datosBancarios })}
              icono={<Landmark size={16} />}
            />
            <Input
              tipo="text"
              etiqueta="Titular"
              placeholder="Razón social o nombre del titular"
              value={datosBancarios.titular}
              onChange={(e) => setDatosBancarios(prev => ({ ...prev, titular: e.target.value }))}
              onBlur={() => guardarEnServidor({ datos_bancarios: datosBancarios })}
            />
          </div>
          <Input
            tipo="text"
            etiqueta="Número de cuenta"
            placeholder="Ej: 500-066601/3"
            value={datosBancarios.numero_cuenta}
            onChange={(e) => setDatosBancarios(prev => ({ ...prev, numero_cuenta: e.target.value }))}
            onBlur={() => guardarEnServidor({ datos_bancarios: datosBancarios })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              tipo="text"
              etiqueta="CBU"
              placeholder="22 dígitos"
              value={datosBancarios.cbu}
              onChange={(e) => setDatosBancarios(prev => ({ ...prev, cbu: e.target.value }))}
              onBlur={() => guardarEnServidor({ datos_bancarios: datosBancarios })}
            />
            <Input
              tipo="text"
              etiqueta="Alias"
              placeholder="Ej: miempresa.pagos"
              value={datosBancarios.alias}
              onChange={(e) => setDatosBancarios(prev => ({ ...prev, alias: e.target.value }))}
              onBlur={() => guardarEnServidor({ datos_bancarios: datosBancarios })}
            />
          </div>
        </div>
      </div>

      {/* ══ Panel: Identidad visual ══ */}
      <div className="border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-white/[0.07]">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(236,64,122,0.15)' }}>
            <Globe size={15} style={{ color: '#EC407A' }} />
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-texto-primario">Identidad visual</h3>
            <p className="text-[11px] text-texto-terciario mt-0.5">Logos y color de marca usados en el sidebar, documentos, membretes y comunicaciones.</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CargadorLogo variante="cuadrado" urlActual={logoCuadrado}
              onSubir={(blob) => subirLogo(blob, 'cuadrado')} onEliminar={() => eliminarLogo('cuadrado')} />
            <CargadorLogo variante="apaisado" urlActual={logoApaisado}
              onSubir={(blob) => subirLogo(blob, 'apaisado')} onEliminar={() => eliminarLogo('apaisado')} />
          </div>

          <div className="border-t border-white/[0.07]" />

          <SelectorColor valor={colorMarca} coloresLogo={coloresLogo}
            onChange={(c) => { setColorMarca(c); guardar({ color_marca: c }) }} />
        </div>
      </div>
    </div>
  )
}
