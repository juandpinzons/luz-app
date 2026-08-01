# Orb (Misión "Orb Experience V1")

La esfera que respira en la apertura de `/chat` -- identidad estable
por persona, profundidad de la relación, y un momento real, sin
inventar nunca nada. Este documento cierra el módulo: qué decide cada
capa, por qué está separada de las demás, y qué se dejó fuera a
propósito.

## Cuatro capas, cuatro preguntas (Objetivo E)

```
personId ──────────────┐
maturity inputs ───────┼──→ build-orb-state.ts ──→ OrbState ──→ derive-orb-animation.ts ──→ OrbVisualState ──→ OrbSphere (render)
moment inputs ──────────┘         │                                    │
                                    │                                    │
                            derive-maturity.ts                  domain/orb-palette.ts
                            derive-orb-moment.ts                (rgb, nunca aquí)
```

1. **Identidad** (`domain/orb-palette.ts`): `deriveOrbPalette(personId)` -- un hash estable elige una de 6 paletas cálidas. Nunca cambia, nunca es una señal sobre la persona.
2. **Profundidad de la relación** (`services/derive-maturity.ts`): `maturityStage`/`warmth`/`anticipation`, a partir de mensajes totales + señales de `RealitySnapshot` (estilo de comunicación, creencias en formación, curiosidad pendiente, fechas límite). Misma lógica que ya vivía en `generate-welcome.ts` antes de esta misión -- reubicada, no rediseñada.
3. **El momento** (`services/derive-orb-moment.ts`): `OrbMoment` -- hechos puntuales y verificables sobre AHORA (Objetivo B, ver abajo).
4. **El modelo de animación** (`services/derive-orb-animation.ts`): traduce las tres piezas anteriores a un `OrbVisualState` -- números finales, listos para CSS. Toda constante numérica vive en este único archivo.
5. **El render** (`components/orb-sphere.tsx`): recibe un `OrbVisualState` completo, solo lo pinta. Cero decisiones.

`application/build-orb-state.ts` es el único punto de entrada público: junta 1-4 (`buildOrbState`) o las cinco (`buildOrbVisualState`, lo que usa `generate-welcome.ts`).

## Objetivo A + B: emoción a través de la realidad, nunca inventada

`OrbMoment` (`domain/orb-state.ts`) tiene seis campos, cada uno trazable a un hecho real y barato de obtener en el momento en que se genera la bienvenida del chat:

| Campo | Fuente real | Ejemplo textual de la misión |
|---|---|---|
| `timeOfDay` | Hora real en Bogotá | "brillo suave de la mañana" |
| `hadMeaningfulConversationRecently` | `RealitySnapshot.memory.items[0].occurredAt` | "halo un poco más fuerte tras una conversación" |
| `hasBeenQuiet` | `msSinceLastMessage` (el mismo dato que ya recibe `generateWelcome`) | "luz más suave tras varios días de silencio" |
| `hasImportantMeetingSoon` | `HomeCalendarContext.meetingMoments` (Calendar Foundation) | "reunión importante hoy" |
| `completedSomethingRecently` | Goal/Project real con `status: "completed"` reciente (`orb-life-signals.ts`) | "pulso diminuto al completar algo importante" |
| `reconnectedRecently` | Relationship real con `updatedAt` reciente (`orb-life-signals.ts`) | "borde más cálido tras un reencuentro" |

**Por qué no se usa `PresenceState`/`ExperienceState`/`HomeState` completos todavía:** esos tres viven en el pipeline de `/dashboard` (snapshot → recomendaciones → presencia → home → experiencia, con su propio registro de rotación en `events`). Traer ese pipeline completo a CADA apertura de chat habría significado (a) una sincronización de calendario y varias consultas más por mensaje -- justo el tipo de latencia que la misión anterior ("mejora la apertura del chat") pidió eliminar -- y (b) escribir en el mismo registro de rotación que `/dashboard` usa para decidir "no repitas la misma tarjeta 3 días seguidos", contaminando esa decisión con una visita que no fue al Dashboard. En su lugar, el orbe lee el subconjunto de esas mismas fuentes de verdad (calendario real, memorias reales, goals/projects/relaciones reales) que ya está disponible o es barato de obtener sin ese costo. Ninguna fuente prohibida por el Objetivo B se usó -- solo un subconjunto deliberado de las permitidas.

**Nunca se infiere personalidad ni estado de ánimo.** Cada campo de `OrbMoment` es una observación puntual ("¿pasó X en las últimas N horas/días?"), nunca una combinación interpretada como "está feliz" o "está distante". La traducción a números de animación (`derive-orb-animation.ts`) tampoco decide un "mood": cada señal activa suma o resta un empujón pequeño e independiente sobre un canal visual concreto.

## Objetivo A: capas visuales, no un color nuevo

Ningún campo de `OrbMoment` cambia `paletteName` ni el color de identidad -- todo se expresa en **cinco canales transitorios**, todos en `OrbVisualState`:

- `coreGlowAlpha` -- intensidad del brillo central (conversación reciente y logros la suben; silencio y noche la bajan; mañana la sube un poco).
- `glowBlurPx` -- suavidad/difusión (silencio la sube: luz más difusa, no más débil).
- `glowSpreadPx` / `coreStopPercent` -- alcance y "foco" del resplandor (una reunión pronto ensancha el alcance; el silencio afloja el foco).
- `rhythmMs` -- ritmo de respiración (una reunión pronto lo acelera un poco; el silencio lo relaja).
- `edgeWarmthAlpha` -- un aro cálido adicional, exclusivo de un reencuentro reciente.

Cada ajuste está capado (`MIN_CORE_GLOW_ALPHA`/`MAX_CORE_GLOW_ALPHA`, etc. en `derive-orb-animation.ts`) para que ninguna combinación de señales reales, por muchas que coincidan el mismo día, se vuelva llamativa. "Nada de partículas": se consideró y se descartó a propósito -- un sistema de partículas real necesitaría su propio ciclo de animación (riesgo directo al Objetivo D, "sin loops de animación que consuman CPU") y, para lo sutil que pide el Objetivo A, no aporta sobre lo que los cinco canales de arriba ya cubren.

## Objetivo C: nunca repetitivo, nunca aleatorio

Ninguna de las funciones de este módulo usa `Math.random()` ni ninguna fuente de aleatoriedad. La variación entre visitas viene, en cambio, de que las entradas mismas cambian con el tiempo real: `msSinceLastMessage`, la hora actual, si hay una memoria reciente, si hay una reunión pronto -- todas se recalculan desde cero en cada bienvenida, a partir de la realidad en ese instante. Misma realidad → mismo `OrbVisualState`, siempre (`features/orb/tests/orb-state.examples.ts` lo verifica). Realidad distinta → salida distinta, también siempre -- sin necesitar comparar contra una visita anterior guardada.

## Objetivo D: performance

- Todas las animaciones siguen siendo CSS (`@keyframes` en `app/globals.css`, `transform`/`opacity`) -- cero `requestAnimationFrame`, cero loop de JS.
- `OrbSphere` memoiza sus tres objetos de estilo (`useMemo`) -- solo se recalculan cuando `state`/`pulsing` cambian de verdad.
- El aro cálido (`edgeWarmthAlpha`) es estático (una intensidad de color, no una animación) -- no necesita su propia regla de `prefers-reduced-motion`.
- `prefers-reduced-motion` se sigue respetando en las mismas dos capas de siempre (`ConversationOpeningRitual` se salta el ritual completo; `app/globals.css` neutraliza las animaciones como respaldo) -- esta misión no agregó ninguna animación nueva con nombre propio, así que no hizo falta tocar esa regla.

## Qué se dejó fuera a propósito (no son placeholders, son límites de alcance)

- **`PresenceOrb`** (`components/ui/presence-orb.tsx`, el indicador pequeño de `/dashboard`) sigue con su propio gradiente ámbar fijo, sin paleta ni momento -- es un componente deliberadamente aparte desde antes de esta misión (ver su propio docblock), y esta misión es sobre la esfera de `/chat`. Unificarlos es una mejora futura real, no un cabo suelto de esta.
- **`getUpcomingEvents`** y cualquier "reunión importante" fuera de la ventana que Calendar Foundation ya categoriza (`meetingMoments`) no se leen aparte -- el orbe reutiliza esa categorización ya existente, nunca inventa una ventana de tiempo propia.

## Pruebas

```bash
npx tsx features/orb/tests/orb-state.examples.ts
```

Ver el archivo para el detalle de cada escenario (Objetivo F): usuario nuevo, usuario activo, semana silenciosa, reunión importante hoy, logro reciente, reencuentro, determinismo (misma entrada -> misma salida) y evolución determinística (entrada distinta -> salida distinta).
