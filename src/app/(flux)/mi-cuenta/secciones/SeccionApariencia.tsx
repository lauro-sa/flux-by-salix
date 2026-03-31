'use client'

import { Monitor } from 'lucide-react'
import { Separador } from '@/componentes/ui/Separador'
import { useTema } from '@/hooks/useTema'
import type { Tema, Efecto, FondoCristal, EscalaTexto } from '@/hooks/useTema'

/**
 * SeccionApariencia — mismos selectores visuales de la vitrina.
 * Tamaño de fuente, modo de color, intensidad glass, fondo de pantalla.
 * Los cambios se aplican inmediatamente y se guardan por dispositivo.
 */

/* Mini preview de UI para las tarjetas de tema */
function MiniUI({ fondo, barra, lineas }: { fondo: string; barra: string; lineas: string }) {
  return (
    <div className={`w-full h-20 rounded-md ${fondo} p-2 flex flex-col gap-1.5 border border-borde-sutil`}>
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

export function SeccionApariencia() {
  const {
    tema, efecto, fondoCristal, escala,
    soportaCristal, razonNoCristal,
    cambiarTema, cambiarEfecto, cambiarFondo, cambiarEscala,
  } = useTema()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-texto-primario mb-1">Apariencia</h2>
        <p className="text-sm text-texto-terciario">Personalizá cómo ves la plataforma</p>
      </div>

      {/* Nota sobre por dispositivo */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-superficie-tarjeta border border-borde-sutil text-xs text-texto-terciario leading-relaxed">
        <Monitor size={14} className="shrink-0 mt-0.5 text-texto-terciario" />
        <span>
          Tamaño de fuente, intensidad Glass y fondo se guardan <strong className="text-texto-primario">por plataforma</strong>: una configuración para celulares y otra para computadoras.
          El modo de color se guarda <strong className="text-texto-primario">en este dispositivo</strong>.
        </span>
      </div>

      {/* TAMAÑO DE FUENTE */}
      <div>
        <Etiqueta>Tamaño de fuente</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'compacto' as EscalaTexto, etiqueta: 'Normal', descripcion: 'Tamaño estándar', tamano: 'text-lg' },
            { clave: 'normal' as EscalaTexto, etiqueta: 'Mediano', descripcion: 'Un poco más grande', tamano: 'text-xl' },
            { clave: 'comodo' as EscalaTexto, etiqueta: 'Grande', descripcion: 'Más legible', tamano: 'text-2xl' },
          ]).map((e) => (
            <button
              key={e.clave}
              onClick={() => cambiarEscala(e.clave)}
              className={`
                relative flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer text-left bg-transparent
                ${escala === e.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil hover:bg-superficie-hover'}
              `}
            >
              <span className={`${e.tamano} font-bold ${escala === e.clave ? 'text-texto-marca' : 'text-texto-secundario'} shrink-0`}>Aa</span>
              <div className="flex flex-col min-w-0">
                <span className={`text-sm font-medium ${escala === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario">{e.descripcion}</span>
              </div>
              {escala === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </button>
          ))}
        </div>
      </div>

      <Separador />

      {/* MODO DE COLOR */}
      <div>
        <Etiqueta>Modo de color</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'claro' as Tema, etiqueta: 'Claro', fondo: 'bg-white', barra: 'bg-gray-200', lineas: 'bg-gray-100' },
            { clave: 'oscuro' as Tema, etiqueta: 'Oscuro', fondo: 'bg-zinc-900', barra: 'bg-zinc-700', lineas: 'bg-zinc-800' },
            { clave: 'sistema' as Tema, etiqueta: 'Automático', fondo: 'bg-gradient-to-r from-white to-zinc-900', barra: 'bg-gray-400', lineas: 'bg-gray-500' },
          ]).map((t) => (
            <button
              key={t.clave}
              onClick={() => cambiarTema(t.clave)}
              className={`
                relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer bg-transparent
                ${tema === t.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil hover:bg-superficie-hover'}
              `}
            >
              <MiniUI fondo={t.fondo} barra={t.barra} lineas={t.lineas} />
              <span className={`text-sm font-medium ${tema === t.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>
                {t.etiqueta}
              </span>
              {t.clave === 'sistema' && <span className="text-xxs text-texto-terciario">(sistema)</span>}
              {tema === t.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </button>
          ))}
        </div>
      </div>

      <Separador />

      {/* INTENSIDAD GLASS */}
      <div>
        <Etiqueta>Intensidad glass</Etiqueta>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'cristal' as Efecto, etiqueta: 'Glass', descripcion: 'Translúcido con blur', opacidad: 'opacity-30' },
            { clave: 'semi-cristal' as Efecto, etiqueta: 'Semi Glass', descripcion: 'Semi-opaco, menos blur', opacidad: 'opacity-60' },
            { clave: 'solido' as Efecto, etiqueta: 'Sólido', descripcion: 'Sin transparencia', opacidad: 'opacity-100' },
          ]).map((e) => {
            const deshabilitado = e.clave !== 'solido' && !soportaCristal
            return (
              <button
                key={e.clave}
                onClick={() => !deshabilitado && cambiarEfecto(e.clave)}
                disabled={deshabilitado}
                className={`
                  relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer bg-transparent
                  ${efecto === e.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil hover:bg-superficie-hover'}
                  ${deshabilitado ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={deshabilitado ? razonNoCristal : undefined}
              >
                <div className="w-full h-20 rounded-md bg-gradient-to-br from-violet-500/20 via-blue-500/15 to-cyan-500/10 p-2 flex flex-col gap-1.5 border border-borde-sutil relative overflow-hidden">
                  <div className={`h-2 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad}`} />
                  <div className={`h-6 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad} mt-auto`} />
                </div>
                <span className={`text-sm font-medium ${efecto === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario text-center">{e.descripcion}</span>
                {efecto === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </button>
            )
          })}
        </div>
        {!soportaCristal && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-insignia-advertencia-fondo text-insignia-advertencia-texto text-xs">
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
                { clave: 'aurora' as FondoCristal, etiqueta: 'Aurora', descripcion: 'Colorido', gradiente: 'from-violet-600/40 via-cyan-500/30 to-emerald-500/20' },
                { clave: 'medianoche' as FondoCristal, etiqueta: 'Medianoche', descripcion: 'Azul profundo', gradiente: 'from-blue-700/40 via-indigo-600/30 to-blue-900/20' },
                { clave: 'ambar' as FondoCristal, etiqueta: 'Ámbar', descripcion: 'Cálido dorado', gradiente: 'from-amber-500/40 via-orange-500/30 to-red-500/20' },
                { clave: 'ninguno' as FondoCristal, etiqueta: 'Sin fondo', descripcion: 'Solo blur', gradiente: '' },
              ]).map((f) => (
                <button
                  key={f.clave}
                  onClick={() => cambiarFondo(f.clave)}
                  className={`
                    relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer bg-transparent
                    ${fondoCristal === f.clave ? 'border-texto-marca bg-superficie-seleccionada' : 'border-borde-sutil hover:bg-superficie-hover'}
                  `}
                >
                  <div className={`w-full h-14 rounded-md border border-borde-sutil ${f.gradiente ? 'bg-gradient-to-br ' + f.gradiente : 'bg-superficie-app'}`} />
                  <span className={`text-xs font-medium ${fondoCristal === f.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{f.etiqueta}</span>
                  <span className="text-xxs text-texto-terciario">{f.descripcion}</span>
                  {fondoCristal === f.clave && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-texto-marca" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
