'use client'

import { Monitor } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Separador } from '@/componentes/ui/Separador'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
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

      {/* TAMAÑO DE FUENTE */}
      <div>
        <Etiqueta>Tamaño de fuente</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'compacto' as EscalaTexto, etiqueta: 'Normal', descripcion: 'Tamaño estándar', tamano: 'text-lg' },
            { clave: 'normal' as EscalaTexto, etiqueta: 'Mediano', descripcion: 'Un poco más grande', tamano: 'text-xl' },
            { clave: 'comodo' as EscalaTexto, etiqueta: 'Grande', descripcion: 'Más legible', tamano: 'text-2xl' },
          ]).map((e) => (
            <Boton
              key={e.clave}
              variante={escala === e.clave ? 'secundario' : 'fantasma'}
              onClick={() => cambiarEscala(e.clave)}
              className={`relative !justify-start !text-left ${
                escala === e.clave ? '!border-texto-marca !bg-superficie-seleccionada' : '!border-borde-sutil'
              }`}
            >
              <span className={`${e.tamano} font-bold ${escala === e.clave ? 'text-texto-marca' : 'text-texto-secundario'} shrink-0`}>Aa</span>
              <div className="flex flex-col min-w-0">
                <span className={`text-sm font-medium ${escala === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario">{e.descripcion}</span>
              </div>
              {escala === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </Boton>
          ))}
        </div>
      </div>

      <Separador />

      {/* MODO DE COLOR */}
      <div>
        <Etiqueta>Modo de color</Etiqueta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          {([
            { clave: 'claro' as Tema, etiqueta: 'Claro', fondo: 'bg-superficie-tarjeta', barra: 'bg-borde-sutil', lineas: 'bg-superficie-app' },
            { clave: 'oscuro' as Tema, etiqueta: 'Oscuro', fondo: 'bg-superficie-sidebar', barra: 'bg-borde-fuerte', lineas: 'bg-superficie-tarjeta' },
            { clave: 'sistema' as Tema, etiqueta: 'Automático', fondo: 'bg-gradient-to-r from-superficie-tarjeta to-superficie-sidebar', barra: 'bg-texto-terciario', lineas: 'bg-texto-terciario/30' },
          ]).map((t) => (
            <Boton
              key={t.clave}
              variante={tema === t.clave ? 'secundario' : 'fantasma'}
              onClick={() => cambiarTema(t.clave)}
              className={`relative !flex-col !items-center ${
                tema === t.clave ? '!border-texto-marca !bg-superficie-seleccionada' : '!border-borde-sutil'
              }`}
            >
              <MiniUI fondo={t.fondo} barra={t.barra} lineas={t.lineas} />
              <span className={`text-sm font-medium ${tema === t.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>
                {t.etiqueta}
              </span>
              {t.clave === 'sistema' && <span className="text-xxs text-texto-terciario">(sistema)</span>}
              {tema === t.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
            </Boton>
          ))}
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
            const deshabilitado = e.clave !== 'solido' && !soportaCristal
            return (
              <Boton
                key={e.clave}
                variante={efecto === e.clave ? 'secundario' : 'fantasma'}
                onClick={() => !deshabilitado && cambiarEfecto(e.clave)}
                disabled={deshabilitado}
                titulo={deshabilitado ? razonNoCristal : undefined}
                className={`relative !flex-col !items-center ${
                  efecto === e.clave ? '!border-texto-marca !bg-superficie-seleccionada' : '!border-borde-sutil'
                }`}
              >
                <div className="w-full h-20 rounded-boton bg-gradient-to-br from-insignia-violeta/20 via-insignia-info/15 to-insignia-cyan/10 p-2 flex flex-col gap-1.5 border border-borde-sutil relative overflow-hidden">
                  <div className={`h-2 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad}`} />
                  <div className={`h-6 w-full rounded-sm bg-superficie-tarjeta ${e.opacidad} mt-auto`} />
                </div>
                <span className={`text-sm font-medium ${efecto === e.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{e.etiqueta}</span>
                <span className="text-xxs text-texto-terciario text-center">{e.descripcion}</span>
                {efecto === e.clave && <span className="absolute top-2 right-2 size-2 rounded-full bg-texto-marca" />}
              </Boton>
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
              ]).map((f) => (
                <Boton
                  key={f.clave}
                  variante={fondoCristal === f.clave ? 'secundario' : 'fantasma'}
                  onClick={() => cambiarFondo(f.clave)}
                  className={`relative !flex-col !items-center ${
                    fondoCristal === f.clave ? '!border-texto-marca !bg-superficie-seleccionada' : '!border-borde-sutil'
                  }`}
                >
                  <div className={`w-full h-14 rounded-boton border border-borde-sutil ${f.gradiente ? 'bg-gradient-to-br ' + f.gradiente : 'bg-superficie-app'}`} />
                  <span className={`text-xs font-medium ${fondoCristal === f.clave ? 'text-texto-marca' : 'text-texto-primario'}`}>{f.etiqueta}</span>
                  <span className="text-xxs text-texto-terciario">{f.descripcion}</span>
                  {fondoCristal === f.clave && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-texto-marca" />}
                </Boton>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
