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

`services/resolve-avatar-state.ts`, jerarquía estricta de interrupción:

| Prioridad | Condición real | `animation` | Nota |
|---|---|---|---|
| 1 | `interaction.reducedMotion` | `idle` | Nunca un gesto, sin importar todo lo demás -- accesibilidad primero |
| 2 | `interaction.isAiResponding` | `think` | `emotion`/`gaze`/`focusRef` de fondo se conservan -- la cara sigue mostrando el mood real mientras el cuerpo "piensa". Interrumpe un gesto en curso sin esperar a que termine |
| 3 | `interaction.isUserTyping` | `listen` | `gaze` siempre `"user"`. Misma prioridad de interrupción que 2 |
| 4 | Silencio real (≥5 min) en horas de la noche (0-5h local) **Y `mood.emotion !== "attentive"`** | `sleep` | `emotion` se relaja a `calm` -- pero NUNCA cuando hay una urgencia real pendiente (ver "Qué nunca debe ocurrir") |
| 5 | Ninguna de las anteriores, Y `interaction.previousEmotion !== mood.emotion` (la emoción ACABA de cambiar) | `jump` (celebrating) / `nod` (attentive) / `idle` (el resto) | El gesto de entrada, UNA SOLA VEZ |
| -- | Ninguna de las anteriores | `idle` | La emoción se sostiene, el gesto ya se disparó antes -- nunca se repite |

`breathe`/`blink` (del boceto original) no son estados que este backend elija -- son micro-loops involuntarios, ver más abajo.

## Seis preguntas de diseño, respondidas

### ¿Cuánto dura una sonrisa?

Dos respuestas distintas para dos cosas distintas:

- **`emotion` (la cara)** dura exactamente lo que dura la evidencia real detrás -- sin temporizador propio, nunca un "muéstrala 5 segundos y luego apágala" artificial (eso sería fabricar un límite que la evidencia no tiene, Principio 1 del motor). Mientras `narrative.celebrationCandidates` siga teniendo algo real, la cara sigue celebrando.
- **`animation` de tipo gesto (`jump`/`nod`/`wave`/`hug`)** SÍ tiene una duración corta y acotada (`AVATAR_GESTURE_DURATION_MS`, advisoria) -- un gesto es un momento de énfasis, no el estado de reposo. Después de reproducirse, el cuerpo vuelve a `idle` mientras la cara sigue mostrando la emoción real.

### ¿Cuándo termina?

La emoción termina en el próximo recálculo real (`buildPresenceAvatarState` vuelto a llamar con datos frescos) en el que la evidencia ya no la respalde -- nunca en un fundido por reloj. El gesto termina siempre después de su propia duración corta, sin importar si la emoción de fondo sigue vigente (no se salta en el sitio para siempre mientras dure la celebración).

### ¿Cuándo no debe animarse?

Dos casos reales, ambos con señal real detrás (nunca "porque la conversación se siente seria" -- este módulo no lee contenido de conversación, no tiene esa señal, y fingir que la tiene violaría el mismo principio de nunca inferir estado emocional de un texto):

1. `interaction.reducedMotion` -- accesibilidad, gana sobre cualquier otra regla.
2. Cualquier gesto (`wave`/`jump`/`hug`/`nod`) se suprime automáticamente en cuanto hay una interacción real en curso (`think`/`listen`) -- nunca coexisten un gesto expresivo y una interacción real.

### ¿Qué pasa si el usuario escribe durante una celebración?

La cara SIGUE celebrando (`emotion` no cambia -- Presence Avatar no le apaga la alegría a alguien por escribir), pero el cuerpo cambia inmediatamente a `listen` y la mirada se fija en `"user"`, sin importar si un gesto (`jump`) estaba a mitad de reproducirse. Verificado en "la persona escribiendo interrumpe un gesto en curso, sin esperar a que termine" (`tests/`).

### ¿Qué interrumpe qué?

Orden estricto, de mayor a menor: `reducedMotion` > `think` (IA respondiendo) > `listen` (persona escribiendo) > `sleep` (silencio real de noche, salvo `attentive`) > gesto de entrada > `idle` sostenido. Cualquier nivel superior interrumpe inmediatamente a los inferiores, incluyendo un gesto a mitad de reproducirse -- nunca hay cola, nunca se espera a que algo termine.

### ¿Qué nunca debe ocurrir?

1. Nunca más de una `emotion` a la vez (el modelo es un enum único, no una mezcla).
2. Nunca un gesto se repite en cada render mientras la emoción no cambia -- se dispara UNA VEZ, en la transición (`interaction.previousEmotion`).
3. Nunca un gesto expresivo coexiste con `think`/`listen` -- la interacción real siempre gana, sin excepción.
4. Nunca `sleep` deja "dormida" a LUZ sobre una urgencia crítica real (`mood.emotion === "attentive"` la suprime).
5. Nunca se fabrica un `focusRef` sin evidencia real detrás.
6. Nunca `intensity` sale de `[0, 1]`.
7. Nunca este módulo infiere contenido o sentimiento de una conversación real -- todo `emotion` viene de hechos que Presence/Experience/Narrative/Identity ya decidieron, nunca de texto interpretado aquí.
8. Nunca `reducedMotion` se ignora -- ninguna regla de gesto se evalúa siquiera si está activo.

## Validación

```bash
npx tsx features/avatar/tests/build-presence-avatar-state.examples.ts
```

22 escenarios, todos pasando: las cinco reglas de mood individualmente, dos de conflicto de prioridad explícito (urgencia crítica vs. celebración; celebración vs. urgencia alta), las cuatro reglas de interacción en vivo (`think`/`listen`/`sleep`/`reducedMotion`), el ciclo completo de un gesto (se dispara en la transición, nunca se repite sostenido, un cambio real dispara uno nuevo), interrupción de un gesto en curso, el invariante "nunca duerme sobre una urgencia crítica", y determinismo (misma entrada -> mismo JSON byte a byte). `tsc --noEmit` y `eslint features/avatar` limpios.

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
    previousEmotion: lastAvatarState?.emotion, // OBLIGATORIO guardar esto entre renders -- ver más abajo
    reducedMotion: prefersReducedMotion,
  },
});
```

`presence`/`experience`/`narrative` ya se calculan hoy en el pipeline de `/dashboard`; `identity` es una capacidad nueva (`features/identity-evolution/`, esta misma sesión) sin consumidor real todavía -- **esta es la primera vez que tendría uno**. Un hook cliente (`usePresenceAvatarState()`) que recalcule `interaction` en cada tick/evento y vuelva a llamar `buildPresenceAvatarState` con el mismo `mood` (cacheado, recalculado solo cuando cambian los cuatro estados de fondo) es razonable -- separar "recalcular mood" (caro, una vez por carga de página) de "resolver interacción" (barato, en cada cambio de `isTyping`/`isAiResponding`) evita rehacer el trabajo agregado en cada tecla.

**Responsabilidad obligatoria de I7: `previousEmotion`.** Este backend es puro -- no recuerda nada entre llamadas. Sin `previousEmotion`, no hay forma honesta de saber si un gesto (`jump`/`nod`) ya se mostró o no, y CADA render repetiría el gesto (el bug concreto que "¿cuánto dura una sonrisa?" expone). El patrón correcto: guardar `avatarState.emotion` en una `ref`/estado local después de cada resolución, y pasarlo de vuelta como `previousEmotion` en la siguiente llamada -- mismo patrón ya establecido en este repo para "¿esto es nuevo?" (`ExperienceState.isNewPrimary`, `recentlyNarratedThreadIds` de Narrative).

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
| `idle` | Postura de reposo | Ambiente -- sin interacción real, y también DESPUÉS de que un gesto ya se disparó (la emoción se sostiene, el cuerpo descansa) |
| `wave` | "Hello!" | Sugerido para el PRIMER render de una sesión (equivalente al ritual de bienvenida que hoy cubre `features/orb/` en `/chat`) -- no lo decide este backend, es un trigger de entrada del lado del cliente |
| `jump` | "Yay!" | `emotion` ACABA de cambiar a `celebrating` (`previousEmotion !== "celebrating"`), sin interacción real encima. Un solo disparo -- nunca se repite mientras `celebrating` se sostiene |
| `hug` | (no está en el boceto de poses -- libre para I7) | Disponible para un momento de consuelo/cierre real, sin regla de disparo automática todavía (ver "Extensiones futuras") |
| `nod` | "You got this!" | `emotion` ACABA de cambiar a `attentive`, sin interacción real encima. Mismo criterio de un solo disparo que `jump` |
| `listen` | -- | `interaction.isUserTyping` -- interrumpe cualquier gesto en curso |
| `think` | "Thinking..." | `interaction.isAiResponding` -- máxima prioridad, interrumpe todo lo demás |
| `sleep` | -- | Silencio real + noche, EXCEPTO si `emotion === "attentive"` (nunca duerme sobre una urgencia real) |

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
- **Constantes de primera iteración** (`SLEEP_INACTIVITY_MS`, umbrales de intensidad, `AVATAR_GESTURE_DURATION_MS`) -- razonadas, no verificadas contra uso real todavía, mismo criterio que `features/identity-evolution/`.
- **`previousEmotion` depende de que I7 lo maneje correctamente.** Este backend no puede hacer cumplir que el cliente guarde y reenvíe `emotion` entre renders -- si se olvida, el efecto es benigno pero real (un gesto podría repetirse en cada recálculo, el mismo bug que este diseño evita cuando se usa bien). Documentado explícitamente en la guía de integración, no una garantía del tipo en sí.

## Extensiones futuras (máximo 5)

1. **Wiring real** en home/chat/dashboard -- un hook `usePresenceAvatarState()` del lado del cliente (I7).
2. **Regla de disparo real para `hug`** si aparece una señal distinguible de "esto amerita consuelo" en un motor futuro.
3. **Decisión de producto sobre `features/orb/`**: ¿el ritual de apertura de `/chat` migra a este personaje, o conviven?
4. **`AvatarInteractionSignal` más rico** (ej. reacción a un evento de calendario que empieza AHORA) si la práctica lo pide.
5. **Gesto de entrada propio para `curious`/`happy`** (hoy se asientan directo en `idle` sin un gesto de transición) si en la práctica se siente demasiado plano.
