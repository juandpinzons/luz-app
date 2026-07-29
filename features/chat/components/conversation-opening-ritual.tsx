"use client";

import { useEffect, useState } from "react";

/**
 * Toda la coreografía deriva de estos cuatro números, nunca de
 * constantes independientes elegidas por separado -- es lo que hace
 * que el ritual se lea como un solo movimiento en vez de cuatro
 * animaciones que casualmente ocurren cerca una de otra. El orden es
 * literal: respira ~1s, "Welcome" se escribe, y solo cuando termina de
 * escribirse (nunca antes) puede empezar el pulso que la cierra.
 */
const BREATHE_BEFORE_TEXT_MS = 1000;
/** Debe coincidir con `--animate-script-reveal` (`app/globals.css`). */
const TEXT_REVEAL_DURATION_MS = 900;
/** Un respiro breve después de terminar de escribir -- nunca instantáneo, para que el pulso se sienta como una reacción, no como un cronómetro. */
const PULSE_BUFFER_MS = 150;
const MIN_RITUAL_DURATION_MS =
  BREATHE_BEFORE_TEXT_MS + TEXT_REVEAL_DURATION_MS + PULSE_BUFFER_MS;
/** Debe coincidir con `--animate-light-pulse`/`--animate-veil-dissolve`/`--animate-emerge` (`app/globals.css`) -- las tres comparten esta duración a propósito, para disolverse como un solo gesto. */
const PULSE_DURATION_MS = 700;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Todo lo que el ritual necesita para pintar el orbe como una
 * presencia real, no decorativa -- ver
 * `features/chat/services/generate-welcome.ts` (`OrbVisualSignature`),
 * la única fuente de estos valores. Nunca se define un segundo lugar
 * que decida calidez/ritmo/madurez por su cuenta.
 */
export interface RitualOrbSignature {
  maturityStage: "spark" | "steady" | "radiant";
  warmth: number;
  rhythmMs: number;
  anticipation: boolean;
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
   * Trazo corto (1-3 palabras) que reemplaza el "Welcome" fijo
   * original -- generado fresco cada vez (ver `generate-welcome.ts`).
   * `undefined` mientras la bienvenida real todavía no llegó: el
   * orbe respira igual, sin texto, nunca con un placeholder genérico.
   */
  cue?: string;
  /** Ver `RitualOrbSignature`. `undefined` usa una presencia neutral (mismo look de siempre) -- nunca bloquea el ritual. */
  orb?: RitualOrbSignature;
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
 * El momento en que LUZ despierta -- una esfera que respira, "Welcome"
 * escribiéndose como un trazo manual, y al terminar, un único pulso de
 * luz del que la conversación real emerge. Una sola coreografía
 * continua, no cuatro piezas independientes: el pulso de la esfera
 * (`light-pulse`), la disolución del velo que la rodea
 * (`veil-dissolve`) y el asentamiento de la conversación (`emerge`)
 * comparten el mismo instante de arranque y la misma duración
 * (`PULSE_DURATION_MS`) -- se leen como una sola luz que se expande y
 * dentro de la cual la conversación queda, nunca como una salida y una
 * entrada que casualmente coinciden. Deliberadamente NO es un loading
 * screen: su duración es fija, nunca depende de cuánto tarde una
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
 * `app/globals.css`, las animaciones quedan neutralizadas también a
 * nivel de CSS como respaldo (mismo criterio que el resto del
 * vocabulario de animación del proyecto).
 */
export function ConversationOpeningRitual({
  children,
  ready = true,
  cue,
  orb,
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
  // pulsando" es simplemente "ya terminó de escribirse Y el contenido
  // real ya está listo Y todavía no terminó de disolverse" -- nunca una
  // fuente de verdad propia que pueda desincronizarse de estas tres.
  const isPulsing = !reducedMotion && minDurationElapsed && ready && !exited;

  useEffect(() => {
    if (!isPulsing) {
      return;
    }
    const timer = setTimeout(() => setExited(true), PULSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isPulsing]);

  const showSphere = !reducedMotion && !exited;
  const contentAnimationClass = showSphere && !isPulsing ? "invisible" : "animate-emerge";

  return (
    <div className="relative h-full">
      {showSphere && <WelcomeSphere pulsing={isPulsing} cue={cue} orb={orb} />}

      <div className={`${contentClassName} ${contentAnimationClass}`}>{children}</div>
    </div>
  );
}

/** Presencia neutral cuando todavía no hay una `RitualOrbSignature` real (p. ej. mientras `/api/chat/welcome` sigue en vuelo) -- mismo look que el orbe siempre tuvo, nunca un estado roto. */
const NEUTRAL_ORB: RitualOrbSignature = {
  maturityStage: "steady",
  warmth: 0.45,
  rhythmMs: 4200,
  anticipation: false,
};

function WelcomeSphere({
  pulsing,
  cue,
  orb = NEUTRAL_ORB,
}: {
  pulsing: boolean;
  cue?: string;
  orb?: RitualOrbSignature;
}) {
  // Tamaño real, no solo un multiplicador cosmético -- una relación
  // más asentada literalmente ocupa más espacio. `radiant` gana además
  // una segunda capa de luz interior (ver abajo), nunca solo más
  // grande.
  const sizeClass =
    orb.maturityStage === "spark"
      ? "h-20 w-20 sm:h-24 sm:w-24"
      : orb.maturityStage === "radiant"
        ? "h-32 w-32 sm:h-36 sm:w-36"
        : "h-28 w-28 sm:h-32 sm:w-32";

  const glowAlpha = 0.18 + orb.warmth * 0.22;
  const glowSpread = orb.anticipation ? 24 : 18;
  const coreStop = orb.anticipation ? 60 : 55;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black ${
        pulsing ? "animate-veil-dissolve" : ""
      }`}
    >
      <div className="relative flex items-center justify-center">
        {orb.maturityStage === "radiant" && (
          <div
            className={`absolute rounded-full ${sizeClass} scale-125 ${pulsing ? "" : "animate-sphere-breathe"}`}
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(227, 177, 104, ${glowAlpha * 0.5}) 0%, transparent 70%)`,
              animationDuration: pulsing ? undefined : `${orb.rhythmMs}ms`,
            }}
          />
        )}
        <div
          className={`flex-shrink-0 rounded-full ${sizeClass} ${
            pulsing ? "animate-light-pulse" : "animate-sphere-breathe"
          }`}
          style={{
            background: `radial-gradient(circle at 35% 30%, #ffffff 0%, var(--color-luz) ${coreStop}%, rgba(227, 177, 104, 0.15) 100%)`,
            boxShadow: `0 0 ${60 + orb.warmth * 20}px ${glowSpread}px rgba(227, 177, 104, ${glowAlpha})`,
            animationDuration: pulsing ? undefined : `${orb.rhythmMs}ms`,
          }}
        />
      </div>
      {cue && (
        <span
          className="animate-script-reveal font-script text-4xl text-white/80 sm:text-5xl"
          style={{ animationDelay: `${BREATHE_BEFORE_TEXT_MS}ms` }}
        >
          {cue}
        </span>
      )}
    </div>
  );
}
