"use client";

import { useEffect, useState } from "react";

/** "1-2 segundos" (spec) -- el mínimo que la esfera respira antes de poder ceder el paso. */
const MIN_RITUAL_DURATION_MS = 1500;
/** Debe coincidir con `--animate-sphere-exit`/`--animate-conversation-enter` (`app/globals.css`) -- cuánto dura la transición de salida antes de desmontar la esfera. */
const EXIT_DURATION_MS = 550;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface ConversationOpeningRitualProps {
  children: React.ReactNode;
  /**
   * El ritual nunca cede el paso antes de que esto sea `true`, sin
   * importar cuánto tiempo lleve respirando -- nunca revela un estado
   * de carga (skeleton) detrás de sí (eso lo convertiría exactamente
   * en el "loading screen" que este componente existe para no
   * parecer). Con datos ya listos (el caso normal, servidos por el
   * propio Server Component), el mínimo de `MIN_RITUAL_DURATION_MS` es
   * lo único que se espera. Por defecto `true`: un consumidor que no
   * tiene ningún estado de carga que coordinar puede ignorar esta prop
   * por completo.
   */
  ready?: boolean;
  /**
   * Clases del contenedor real de `children` -- este componente no
   * conoce el layout interno de quien lo use (`flex flex-col`, grid,
   * lo que sea), así que nunca lo asume; el default reproduce
   * exactamente lo que `/chat` ya necesitaba (`flex h-full flex-col`)
   * antes de envolverlo.
   */
  contentClassName?: string;
}

/**
 * Pequeño ritual de bienvenida al abrir una conversación -- una esfera
 * que respira, la palabra "Welcome" apareciendo como un trazo manual
 * (script cursivo, Sacramento, revelándose de izquierda a derecha en
 * vez de un simple fade), y la conversación real revelándose después
 * (fade + slide). Deliberadamente NO es un loading screen: su duración
 * es fija (`MIN_RITUAL_DURATION_MS`), nunca depende de cuánto tarde una
 * petición real -- lo único que la extiende es esperar a que el
 * contenido real ya esté listo, para no ceder el paso a un skeleton
 * debajo (ver `ready`).
 *
 * Desacoplado a propósito: no sabe nada de mensajes, conversaciones ni
 * `/chat` -- envuelve cualquier `children` y decide únicamente cuándo
 * mostrarlo. Reutilizable en cualquier otra pantalla que quiera el
 * mismo ritual de apertura (`/conversations/[id]`, a futuro) sin
 * duplicar esta lógica.
 *
 * `prefers-reduced-motion` se respeta en dos capas: aquí, el ritual
 * completo se salta (el contenido aparece de inmediato, sin ninguna
 * animación de entrada) -- nunca solo "más rápido", sino ausente; y en
 * `app/globals.css`, las cuatro animaciones quedan neutralizadas
 * también a nivel de CSS como respaldo (mismo criterio que el resto
 * del vocabulario de animación del proyecto).
 */
export function ConversationOpeningRitual({
  children,
  ready = true,
  contentClassName = "flex h-full flex-col",
}: ConversationOpeningRitualProps) {
  // Inicializador perezoso, no un efecto: se resuelve durante el primer
  // render mismo, así que alguien con reduced-motion nunca llega a
  // pintar la esfera ni por un frame (a diferencia de decidirlo en un
  // efecto, que siempre corre después del primer render).
  const [reducedMotion] = useState(prefersReducedMotion);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_RITUAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  // Derivado, no una tercera pieza de estado sincronizada a mano: "está
  // saliendo" es simplemente "ya pasó el mínimo Y el contenido real ya
  // está listo Y todavía no terminó de salir" -- nunca una fuente de
  // verdad propia que pueda desincronizarse de estas tres.
  const isExiting = !reducedMotion && minDurationElapsed && ready && !exited;

  useEffect(() => {
    if (!isExiting) {
      return;
    }
    const timer = setTimeout(() => setExited(true), EXIT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isExiting]);

  const showSphere = !reducedMotion && !exited;
  const contentAnimationClass =
    showSphere && !isExiting ? "invisible" : "animate-conversation-enter";

  return (
    <div className="relative h-full">
      {showSphere && <WelcomeSphere exiting={isExiting} />}

      <div className={`${contentClassName} ${contentAnimationClass}`}>{children}</div>
    </div>
  );
}

function WelcomeSphere({ exiting }: { exiting: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black ${
        exiting ? "animate-sphere-exit" : ""
      }`}
    >
      <div
        className="h-28 w-28 flex-shrink-0 animate-sphere-breathe rounded-full sm:h-32 sm:w-32"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #ffffff 0%, var(--color-luz) 55%, rgba(227, 177, 104, 0.15) 100%)",
          boxShadow: "0 0 70px 18px rgba(227, 177, 104, 0.25)",
        }}
      />
      <span className="animate-script-reveal font-script text-4xl text-white/80 [animation-delay:550ms] sm:text-5xl">
        Welcome
      </span>
    </div>
  );
}
