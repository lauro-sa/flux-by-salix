'use client'

import { Monitor } from 'lucide-react'
import { Separador } from '@/componentes/ui/Separador'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { useTema } from '@/hooks/useTema'
import type { Tema, Efecto, FondoCristal, EscalaTexto } from '@/hooks/useTema'

/**
 * SeccionApariencia — tarjetas nativas (no usa Boton porque Boton tiene
 * altura fija y no sirve como contenedor de previews). Tamaño de fuente,
 * modo de color, intensidad glass y fondo de pantalla.
 */

/* Mini preview de UI para las tarjetas de tema */
function MiniUI({ fondo, barra, lineas }: { fondo: string; barra: string; lineas: string }) {
  return (
    <div className={`w-full h-20 rounded-boton ${fondo} p-2 flex flex-col gap-1.5 border border-borde-sutil`}>
      <div className={`h-2 w-full rounded-sm ${barra}`} />
      <div className={`h-1.5 w-3/4 rounded-sm ${lineas}`} />
      <div className={`h-1.5 w-1/2 rounded-sm ${lineas}`} />
      <div className="mt-auto flex gap-1">
        <div className={`h-2.5 w-10 rounded-sm ${barra}`} />
        <div className={`h-2.5 w-8 rounded-sm ${lineas}`} />
      </div>
    </div>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-texto-terciario font-medium">{children}</span>
}

/* Clases compartidas para las tarjetas de opcion (selectores) */
const tarjeta = (activo: boolean, disabled = false) => [
  'relative rounded-boton border cursor-pointer transition-all text-left',
  'focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
  activo
    ? 'border-texto-marca bg-superficie-seleccionada'
    : 'border-borde-sutil bg-transparent hover:bg-superficie-hover',
  disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
].join(' ')

export function SeccionApariencia() {
  const {
    tema, efecto, fondoCristal, escala,
    soportaCristal, razonNoCristal,
    cambiarTema, cambiarEfecto, cambiarFondo, cambiarEscala,
  } = useTema()

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Apariencia"
        descripcion="Personalizá cómo ves la plataforma"
      />

      {/* Nota sobre por dispositivo */}
      <div className="flex items-start gap-2.5 p-3 rounded-card bg-superficie-tarjeta border border-borde-sutil text-xs text-texto-terciario leading-relaxed">
        <Monitor size={14} className="shrink-0 mt-0.5 text-texto-terciario" />
        <span>
          Tamaño de fuente, intensidad Glass y fondo se guardan <strong className="text-texto-primario">por plataforma</strong>: una configuración para celulares y otra para computadoras.
          El modo de color se guarda <strong className="text-texto-primario">en este dispositivo</strong>.
        </span>
      </div>

      {/* TAMAÑO DE FUENTE — layout horizontal (Aa + textos al lado) */}
      <div>
        <Etiqueta>Tamaño de fuente</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'compacto' as EscalaTexto, etiqueta: 'Normal', descripcion: 'Tamaño estándar', tamano: 'text-lg' },
            { clave: 'normal' as EscalaTexto, etiqueta: 'Mediano', descripcion: 'Un poco más grande', tamano: 'text-xl' },
            { clave: 'comodo' as EscalaTexto, etiqueta: 'Grande', descripcion: 'Más legible', tamano: 'text-2xl' },
          ]).map((e) => {
            const activo = escala === e.clave
            return (
              <button key={e.clave} onClick={() => cambiarEscala(e.clave)} className={`${tarjeta(activo)} flex items-center gap-3 px-3 py-2.5`}>
                <span className={`${e.tamano} font-bold shrink-0 ${activo ? 'text-texto-marca' : 'text-texto-secundario'}`}>Aa</span>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                  <span className="text-xxs text-texto-terciario">{e.descripcion}</span>
                </div>
                {activo && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </button>
            )
          })}
        </div>
      </div>

      <Separador />

      {/* MODO DE COLOR — layout vertical (preview arriba, texto abajo) */}
      <div>
        <Etiqueta>Modo de color</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'claro' as Tema, etiqueta: 'Claro', fondo: 'bg-superficie-tarjeta', barra: 'bg-borde-sutil', lineas: 'bg-superficie-app' },
            { clave: 'oscuro' as Tema, etiqueta: 'Oscuro', fondo: 'bg-superficie-sidebar', barra: 'bg-borde-fuerte', lineas: 'bg-superficie-tarjeta' },
            { clave: 'sistema' as Tema, etiqueta: 'Automático', fondo: 'bg-gradient-to-r from-superficie-tarjeta to-superficie-sidebar', barra: 'bg-texto-terciario', lineas: 'bg-texto-terciario/30' },
          ]).map((t) => {
            const activo = tema === t.clave
            return (
              <button key={t.clave} onClick={() => cambiarTema(t.clave)} className={`${tarjeta(activo)} flex flex-col items-center gap-2 p-3`}>
                <MiniUI fondo={t.fondo} barra={t.barra} lineas={t.lineas} />
                <span className={`text-sm font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>
                  {t.etiqueta}
                </span>
                {t.clave === 'sistema' && <span className="text-xxs text-texto-terciario -mt-1.5">(sistema)</span>}
                {activo && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </button>
            )
          })}
        </div>
      </div>

      <Separador />

      {/* INTENSIDAD GLASS */}
      <div>
        <Etiqueta>Intensidad glass</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'cristal' as Efecto, etiqueta: 'Glass', descripcion: 'Translúcido con blur', opacidad: 'opacity-30' },
            { clave: 'semi-cristal' as Efecto, etiqueta: 'Semi Glass', descripcion: 'Semi-opaco, menos blur', opacidad: 'opacity-60' },
            { clave: 'solido' as Efecto, etiqueta: 'Sólido', descripcion: 'Sin transparencia', opacidad: 'opacity-100' },
          ]).map((e) => {
            const activo = efecto === e.clave
            const deshabilitado = e.clave !== 'solido' && !soportaCristal
            return (
              <button
                key={e.clave}
                onClick={() => !deshabilitado && cambiarEfecto(e.clave)}
                disabled={deshabilitado}
                title={deshabilitado ? razonNoCristal : undefined}
                className={`${tarjeta(activo, deshabilitado)} flex flex-col items-center gap-2 p-3`}
              >
                <div className="w-full h-20 rounded-boton bg-gradient-to-br from-insignia-violeta/20 via-insignia-info/15 to-insignia-cyan/10 p-2 flex flex-col gap-1.5 border border-borde-sutil relative overflow-hidden">
                  <div className={`h-2 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad}`} />
                  <div className={`h-6 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad} mt-auto`} />
                </div>
                <span className={`text-sm font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario text-center -mt-1.5">{e.descripcion}</span>
                {activo && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </button>
            )
          })}
        </div>
        {!soportaCristal && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-card bg-insignia-advertencia-fondo text-insignia-advertencia-texto text-xs">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{razonNoCristal || 'Los efectos de transparencia requieren un dispositivo con GPU potente. En equipos más antiguos la interfaz puede sentirse lenta.'} Si notás problemas de rendimiento, usá el modo <strong>Sólido</strong>.</span>
          </div>
        )}
      </div>

      {/* FONDO DE PANTALLA (solo si no es sólido) */}
      {efecto !== 'solido' && (
        <>
          <Separador />
          <div>
            <Etiqueta>Fondo de pantalla</Etiqueta>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
              {([
                { clave: 'aurora' as FondoCristal, etiqueta: 'Aurora', descripcion: 'Colorido', gradiente: 'from-insignia-violeta/40 via-insignia-cyan/30 to-insignia-exito/20' },
                { clave: 'medianoche' as FondoCristal, etiqueta: 'Medianoche', descripcion: 'Azul profundo', gradiente: 'from-insignia-info/40 via-texto-marca/30 to-insignia-info/20' },
                { clave: 'ambar' as FondoCristal, etiqueta: 'Ámbar', descripcion: 'Cálido dorado', gradiente: 'from-insignia-advertencia/40 via-insignia-naranja/30 to-insignia-peligro/20' },
                { clave: 'ninguno' as FondoCristal, etiqueta: 'Sin fondo', descripcion: 'Solo blur', gradiente: '' },
              ]).map((f) => {
                const activo = fondoCristal === f.clave
                return (
                  <button key={f.clave} onClick={() => cambiarFondo(f.clave)} className={`${tarjeta(activo)} flex flex-col items-center gap-1.5 p-2.5`}>
                    <div className={`w-full h-14 rounded-boton border border-borde-sutil ${f.gradiente ? 'bg-gradient-to-br ' + f.gradiente : 'bg-superficie-app'}`} />
                    <span className={`text-xs font-medium ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>{f.etiqueta}</span>
                    <span className="text-xxs text-texto-terciario -mt-1">{f.descripcion}</span>
                    {activo && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-texto-marca" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
