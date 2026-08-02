# Presence Avatar -- arquitectura y estado determinístico

Misión: llevar a LUZ de "texto en una pantalla" a una presencia visual continua -- el personaje llama (boceto "LUZ Visual Identity Concept": una llama con cara, expresiones y poses) que vive en home, chat y dashboard. **Este módulo entrega la arquitectura y el estado determinístico (`PresenceAvatarState`). El personaje, la ilustración, la animación (SVG/Rive/Lottie/React) y su integración visual en las pantallas son responsabilidad de Product Engineering ("I7") -- ver "Guía de integración para I7" más abajo.** Ningún componente de UI, ninguna página, ningún asset visual se crea en esta misión.

## Qué responde

**"¿Qué debería mostrar el personaje de LUZ ahora mismo?"** -- combinando dos capas, deliberadamente separadas:

1. **`AvatarMoodSignal`** (`services/derive-mood.ts`) -- determinístico, derivado EXCLUSIVAMENTE de `PresenceState` + `ExperienceState` + `NarrativeState` + `IdentitySnapshot` (los cuatro contratos que pide la misión, todos ya calculados por sus propios módulos). Responde "¿cómo se siente LUZ respecto a la vida de esta persona ahora mismo?" -- un agregado de días/meses, nunca de un solo mensaje.
2. **`AvatarInteractionSignal`** (`domain/avatar-interaction-signal.ts`) -- en vivo, de la sesión actual (¿la IA está respondiendo?, ¿la persona está escribiendo?, ¿cuánto silencio real hay?). Nunca derivable de los cuatro motores de arriba -- son agregados de días/meses, ninguno puede responder honestamente "¿está escribiendo ahora mismo?". Responsabilidad de quien integra el componente construirlo en cada render.

`resolveAvatarState` (`services/resolve-avatar-state.ts`) combina ambas en `PresenceAvatarState` -- el único objeto que un componente de render necesita leer. `application/build-presence-avatar-state.ts` hace los dos pasos en una sola llamada.

## Relación con `features/orb/` -- no se toca, no se reemplaza

`features/orb/` ya existe, ya está en producción ("Orb Experience V1 -- pulido final, cierra el módulo") y sigue intacto: es la esfera que respira en la apertura de `/chat`, deliberadamente acotada (Objetivo B de su propia misión) a un subconjunto barato de señales para no pagar latencia extra en cada apertura de chat, con un modelo de animación CONTINUO (canales `coreGlowAlpha`/`glowBlurPx`/etc., 0-1, listos para CSS) sobre una esfera abstracta, no un personaje ilustrado.

Este módulo es intencionalmente distinto, no una segunda versión de lo mismo:

| | `features/orb/` | `features/avatar/` (este módulo) |
|---|---|---|
| Superficie | Solo la apertura de `/chat` | Home, chat, dashboard -- continuo |
| Entradas | Subconjunto barato (`OrbMoment`, 6 hechos puntuales) | Los 4 estados completos ya calculados (Presence/Experience/Narrative/Identity) |
| Modelo | Canales numéricos continuos (glow/blur/spread) | Máquina de estados discreta (`emotion`/`animation`) |
| Personaje | Esfera abstracta, identidad por color (`OrbPaletteName`) | Personaje ilustrado con cara/cuerpo (boceto de la misión) |

**Cero archivos de `features/orb/` tocados en esta misión** (verificado). La pregunta de si la esfera de apertura de chat debería, a futuro, fundirse con este personaje (p. ej. el personaje entra con la animación `wave` en vez del ritual de la esfera) es una decisión de producto/visual real -- se deja marcada aquí, no decidida unilateralmente (fuera del alcance de arquitectura/sistemas). `components/ui/presence-orb.tsx` (el indicador pequeño de `/dashboard`) tampoco se toca, mismo criterio.

## Estructura

```
avatar/
  domain/          PresenceAvatarState y sus tipos (el contrato)
  services/        derive-mood (4 motores -> AvatarMoodSignal), resolve-avatar-state (+ interacción -> PresenceAvatarState)
  application/      buildPresenceAvatarState -- el único punto de entrada público
  tests/            fixtures.ts + script standalone con los escenarios de validación
```

## Por qué `emotion` != boceto original (y por qué eso es correcto)

El boceto de la misión sugiere `emotion: "calm" | "happy" | "curious" | "thinking" | "celebrating"`. Esta implementación usa `AVATAR_EMOTIONS = ["calm", "happy", "curious", "attentive", "celebrating"]` -- dos cambios deliberados, explicados aquí porque la misión explícitamente invita a "rename if objectively better":

1. **`"thinking"` se movió a `AvatarAnimation`.** Pensar es una ACTIVIDAD (qué está haciendo LUZ ahora mismo -- generando una respuesta), no una disposición (cómo se siente respecto a la vida de la persona). Un rig de personaje real separa "qué expresión tiene la cara" de "qué animación corre en el cuerpo" -- exactamente la distinción que Rive/Lottie modelan con capas independientes (ver "Guía de integración para I7"). Mezclar ambas en un solo eje habría forzado a elegir, por ejemplo, entre mostrar que LUZ está `celebrating` (mood real) o que está `thinking` (actividad real) en el mismo instante, cuando en realidad pueden coexistir: cara feliz, cuerpo generando una respuesta.
2. **Se añadió `"attentive"` en vez de usar algo como `"concerned"`.** La personalidad de LUZ (boceto: "Warm", "Empathetic", "she encourages", "she's present, not intrusive") excluye una expresión que se lea como preocupación/alarma. `attentive` es la traducción visual honesta de "Presence marcó una urgencia real" sin inventar un estado emocional negativo que la evidencia no respalda (Principio 1 del motor: nunca afirmar más de lo que la evidencia sostiene) -- "algo merece tu atención" es objetivamente distinto de "algo está mal".

Los cuatro campos que el boceto sí pedía explícitamente (`emotion`/`animation`/`intensity`/`gaze`) siguen presentes tal cual en `PresenceAvatarState`.

## Reglas de mood -- prioridad, no mezcla

`services/derive-mood.ts`, cinco reglas, en orden -- solo UNA gana, cada una ya reutiliza una decisión que Presence/Experience/Narrative/Identity tomó primero (nunca vuelve a evaluar urgencia/importancia/momentum desde cero):

| Prioridad | Condición real | Emotion | Intensity |
|---|---|---|---|
| 1 | `presence.urgency === "critical"` con recomendaciones reales pendientes | `attentive` | 1.0 |
| 2 | `narrative.celebrationCandidates` no vacío, o `experience.primary?.category === "celebration"` | `celebrating` | `max(0.6, score/4)` |
| 3 | `presence.urgency === "high"` con recomendaciones reales pendientes | `attentive` | 0.6 |
| 4 | `identity.emergingThemes` no vacío, o `narrative.currentActiveStory?.echo` real | `curious` | peso del tema / 100, o 0.5 |
| 5 | `presence.encouragement` real, o `identity.primaryIdentity` en momentum `stable`/`emerging`/`renewing` | `happy` | 0.5 / 0.45 |
| -- | Ninguna de las anteriores | `calm` | 0.25 |

Orden deliberado: una urgencia crítica real siempre lidera (algo necesita a la persona AHORA); una celebración real gana sobre preocupación moderada (personalidad cálida antes que alarmista); curiosidad antes que calidez genérica (algo nuevo emergiendo merece más que un "bien" de fondo).

## Reglas de resolución -- interacción en vivo siempre gana sobre el mood de fondo

`services/resolve-avatar-state.ts`:

| Prioridad | Condición real | `animation` | Nota |
|---|---|---|---|
| 1 | `interaction.isAiResponding` | `think` | `emotion`/`gaze`/`focusRef` de fondo se conservan -- la cara sigue mostrando el mood real mientras el cuerpo "piensa" |
| 2 | `interaction.isUserTyping` | `listen` | `gaze` siempre `"user"`, sin importar qué mood hubiera elegido |
| 3 | Silencio real (≥5 min) en horas de la noche (0-5h local) | `sleep` | `emotion` se relaja a `calm` -- dormir con una celebración activa no es coherente |
| -- | Ninguna de las anteriores | `jump` (celebrating) / `nod` (attentive) / `idle` (el resto) | Animación ambiente derivada de `mood.emotion` |

`breathe`/`blink` (del boceto original) no son estados que este backend elija -- son micro-loops involuntarios, ver más abajo.

## Validación

```bash
npx tsx features/avatar/tests/build-presence-avatar-state.examples.ts
```

16 escenarios, todos pasando: las cinco reglas de mood individualmente, dos de conflicto de prioridad explícito (urgencia crítica vs. celebración; celebración vs. urgencia alta), las tres reglas de interacción en vivo, animación ambiente sin interacción, y determinismo (misma entrada -> mismo JSON byte a byte). `tsc --noEmit` y `eslint features/avatar` limpios.

---

## Guía de integración para I7

Todo lo de aquí en adelante es **propuesta técnica para Product Engineering**, no código de este módulo -- decisiones de tooling/visual/UX quedan en manos de quien implemente.

### 1. Cómo obtener un `PresenceAvatarState`

```ts
import { buildPresenceAvatarState } from "@/features/avatar";

const avatarState = buildPresenceAvatarState({
  presence,   // ya calculado -- buildPresenceState()
  experience, // ya calculado -- buildExperienceState()
  narrative,  // ya calculado -- buildNarrativeState()
  identity,   // ya calculado -- assembleIdentityEvolution() (features/identity-evolution)
  interaction: {
    isAiResponding, // el mismo estado que ya alimenta components/ui/typing-indicator.tsx
    isUserTyping,
    msSinceLastActivity,
    localHour: new Date().getHours(),
  },
});
```

`presence`/`experience`/`narrative` ya se calculan hoy en el pipeline de `/dashboard`; `identity` es una capacidad nueva (`features/identity-evolution/`, esta misma sesión) sin consumidor real todavía -- **esta es la primera vez que tendría uno**. Un hook cliente (`usePresenceAvatarState()`) que recalcule `interaction` en cada tick/evento y vuelva a llamar `buildPresenceAvatarState` con el mismo `mood` (cacheado, recalculado solo cuando cambian los cuatro estados de fondo) es razonable -- separar "recalcular mood" (caro, una vez por carga de página) de "resolver interacción" (barato, en cada cambio de `isTyping`/`isAiResponding`) evita rehacer el trabajo agregado en cada tecla.

### 2. Mapeo expresión <-> `emotion`

El boceto ya trae 6 caras en el panel "EXPRESSIONS" -- mapeo sugerido a los 5 valores de `AvatarEmotion` (una expresión puede cubrir dos emociones cercanas si el ilustrador lo prefiere, esto es orientativo):

| `emotion` | Expresión | Ref. del boceto |
|---|---|---|
| `calm` | Neutral, contenta, ojos suaves | cara "content" del panel de expresiones |
| `happy` | Sonrisa abierta | "Yay!"/cara feliz |
| `curious` | Cejas levantadas, mirada de lado | "Curious" |
| `attentive` | Ligeramente inclinada, atenta -- NUNCA preocupada/triste | entre "Thinking..." y la cara neutral -- evitar cualquier cara que lea como alarma |
| `celebrating` | Ojos cerrados de alegría, boca abierta | "Yay!"/"Proud of you" |

### 3. Mapeo pose/motion <-> `animation`

| `animation` | Pose del boceto | Disparo |
|---|---|---|
| `idle` | Postura de reposo | Ambiente, sin interacción real |
| `wave` | "Hello!" | Sugerido para el PRIMER render de una sesión (equivalente al ritual de bienvenida que hoy cubre `features/orb/` en `/chat`) -- no lo decide este backend, es un trigger de entrada del lado del cliente |
| `jump` | "Yay!" | `emotion === "celebrating"` sin interacción real encima |
| `hug` | (no está en el boceto de poses -- libre para I7) | Disponible para un momento de consuelo/cierre real, sin regla de disparo automática todavía (ver "Extensiones futuras") |
| `nod` | "You got this!" | `emotion === "attentive"` sin interacción real encima |
| `listen` | -- | `interaction.isUserTyping` |
| `think` | "Thinking..." | `interaction.isAiResponding` |
| `sleep` | -- | Silencio real + noche |

`breathe`/`blink` (mencionados en el boceto original) se recomiendan como micro-loops involuntarios con su propio temporizador aleatorio de UI (ej. parpadear cada 3-6s), activos EN CUALQUIER `animation`, nunca como un valor que este backend deba elegir -- igual que un parpadeo real no depende de en qué esté pensando la persona.

### 4. Arquitectura de animación recomendada -- capas, no un solo estado

Un rig de personaje real (Rive es la recomendación más directa dado el boceto -- soporta múltiples "State Machine layers" nativamente; Lottie con un `.json` por combinación es la alternativa más simple pero menos flexible) debería separar:

- **Capa "Face"** -- dirigida por `emotion` (5 valores).
- **Capa "Body"** -- dirigida por `animation` (8 valores, incluyendo los one-shot `wave`/`jump`/`hug`/`nod`).
- **Capa "Idle micro-loop"** -- `breathe`/`blink`, siempre activa, independiente de las otras dos.

Esto evita el problema combinatorio de necesitar un asset por cada par `(emotion, animation)` -- exactamente el mismo motivo por el que este backend separó los dos ejes (ver arriba).

### 5. Performance -- mismo estándar que `features/orb/` ya estableció

- Preferir animación CSS/`transform`/Rive-nativo sobre loops de `requestAnimationFrame` propios.
- Respetar `prefers-reduced-motion` (misma disciplina de dos capas que ya aplica `ConversationOpeningRitual`/`app/globals.css`).
- `intensity` (0-1) está pensado para escalar amplitud/velocidad de una animación ya elegida, no para generar una animación nueva -- mantiene el número de assets/estados acotado.

### 6. Dónde integrar

Home, `/chat`, `/dashboard` -- las tres superficies que la misión nombra. `focusRef` (`{kind, title}`) da suficiente contexto semántico para que cada página decida hacia dónde "mira" el personaje en su propio layout (nunca coordenadas de píxeles desde el backend) -- ej. en `/dashboard`, `focusRef.kind === "presence_focus"` podría orientar la mirada hacia la tarjeta de atención correspondiente.

## Debilidades conocidas

- **`hug` no tiene regla de disparo automática.** Está en el vocabulario (`AvatarAnimation`) porque el boceto lo sugiere como pose de consuelo, pero ninguna de las cinco reglas de mood lo activa hoy -- no hay todavía una señal real y distinguible de "esto amerita consuelo" (distinta de `attentive`) en los cuatro motores actuales.
- **`wave` (saludo de entrada) no tiene trigger en este módulo.** Es, a propósito, una decisión de sesión/cliente ("¿es la primera vez que se monta el componente hoy?"), no algo derivable de un snapshot agregado -- documentado como responsabilidad de integración, no un olvido.
- **Sin wiring real todavía.** Ningún componente, página ni hook consume `buildPresenceAvatarState` hoy (cero import cruzado desde `app/`/`components/`, verificado) -- arquitectura y estado listos, integración visual pendiente por diseño de esta misión.
- **`identity` (Identity Evolution) requiere `assembleIdentityEvolution`, que toca la base de datos.** En un render de servidor esto es una consulta más por page load -- razonable para home/dashboard (ya hacen varias), a evaluar en `/chat` si la latencia de apertura vuelve a ser una restricción dura (mismo problema de fondo que ya documentó `features/orb/README.md` para su propio caso).
- **Constantes de primera iteración** (`SLEEP_INACTIVITY_MS`, umbrales de intensidad) -- razonadas, no verificadas contra uso real todavía, mismo criterio que `features/identity-evolution/`.

## Extensiones futuras (máximo 5)

1. **Wiring real** en home/chat/dashboard -- un hook `usePresenceAvatarState()` del lado del cliente (I7).
2. **Regla de disparo real para `hug`** si aparece una señal distinguible de "esto amerita consuelo" en un motor futuro.
3. **Decisión de producto sobre `features/orb/`**: ¿el ritual de apertura de `/chat` migra a este personaje, o conviven?
4. **`AvatarInteractionSignal` más rico** (ej. reacción a un evento de calendario que empieza AHORA) si la práctica lo pide.
5. **Persistir la última `emotion` mostrada** (mismo patrón que `recentlyNarratedThreadIds` en Narrative) si se necesita evitar una transición brusca entre dos renders muy seguidos con mood distinto.
