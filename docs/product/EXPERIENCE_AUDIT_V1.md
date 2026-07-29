# EXPERIENCE_AUDIT_V1

**Status:** Draft v1.0\
**Owner:** Product & UX\
**Alcance:** Producto completo, dos personas (usuario nuevo, usuario de 30 días)\
**Última verificación:** 2026-07-28, contra el código real (no documentación aspiracional)

------------------------------------------------------------------------

# Propósito

Auditar toda la experiencia de LUZ — cada pantalla que un humano puede
tocar — buscando los momentos donde la ilusión de "presencia" (no
"chatbot") se rompe. Cada hallazgo se evalúa contra los dos documentos
que ya definen qué es presencia en este producto, no contra intuición:

- **`PRESENCE_MODEL.md`** — qué mide la presencia: Confianza, Timing,
  Continuidad, Seguridad emocional.
- **`PRESENCE_PRINCIPLES.md`** — nueve comportamientos evaluables
  (Escucha activa, Memoria activa, Comprensión antes de respuesta,
  Silencio intencional, Intervención oportuna, Cuidado sin dependencia,
  Evolución compartida, Confianza construida en años, y la lista de lo
  que LUZ nunca debe hacer).

Alcance explícito: **solo producto y UX**. Ningún hallazgo de este
documento propone un motor nuevo, una tabla nueva, ni toca
`ADR-0018` (Architecture V1 Frozen). Donde un hallazgo real solo se
puede resolver con trabajo de motor/arquitectura, se nombra y se deja
fuera de la hoja de ruta de este documento — es del Lead Systems
Engineer.

------------------------------------------------------------------------

# Método

Dos recorridos completos, verificados contra el código real (no contra
lo que la documentación dice que debería pasar):

1. **Usuario nuevo** — desde que llega a `/` hasta que envía su primer
   mensaje real.
2. **Usuario de 30 días** — alguien con historial real, que vuelve con
   distinta frecuencia, y toca cada pantalla del producto (`/dashboard`,
   `/chat`, `/conversations`, `/life`, `/memories`, `/feedback`).

------------------------------------------------------------------------

# Parte 1 — Usuario nuevo (primeros 5 minutos)

## Lo que ya funciona (línea base, no repetir trabajo)

- Landing (`components/Hero.tsx`) usa `LUZ_IDENTITY` como única fuente
  de verdad para el pitch — no puede desviarse de lo que el chat dice
  de sí mismo.
- Login (`app/login/page.tsx`) ya tiene voz de LUZ en ambos casos
  (sesión refrescada / primera vez) — corregido en el bloque anterior
  de este mismo documento de trabajo.
- Dashboard, primera visita (`app/dashboard/page.tsx`), ahora abre con
  el mismo ritual de apertura de `/chat` (esfera, trazo, pulso) — antes
  era la pantalla más plana del recorrido, ya no.
- `/chat`, primera conversación real: bienvenida generada por IA
  (`features/chat/services/generate-welcome.ts`), nunca una pregunta de
  menú, con fallback determinista honesto si la IA falla.

## Hallazgos abiertos

**H1 — El input de `/chat` no reduce la ansiedad de "la página en
blanco."** `app/chat/page.tsx:634`, placeholder genérico
`"Escribe un mensaje..."`. Para alguien que nunca ha hablado con una IA
así, no hay ninguna pista de qué escribir primero. Ya documentado en
`docs/engineering/ONBOARDING_PLAN.md` (Hallazgo #2), sigue sin
resolverse. Riesgo bajo de romper Principio 9 ("nunca genérico") si se
resuelve mal — un placeholder tipo "prueba con esto" puede sentirse a
plantilla; la solución correcta es tono, no una lista de sugerencias.

**H2 — Ningún dato pre-auth se instrumenta.** Confirmado en
`ONBOARDING_PLAN.md` — no hay forma de saber hoy cuánta gente llega a
`/` y nunca hace clic en nada. No es un problema de experiencia en sí,
pero significa que cualquier priorización sobre el funnel de los
primeros 5 minutos, incluida la de este documento, se apoya en lectura
de código, nunca en datos reales de abandono. Flagueado, no resuelto
aquí (instrumentación es decisión de Observabilidad, no de este
documento).

------------------------------------------------------------------------

# Parte 2 — Usuario de 30 días

## Lo que ya funciona

- `/life/identity` (`app/life/identity/page.tsx`) es la prueba más
  fuerte de "sí me conoce" que existe en el producto hoy: coberturas,
  evolución de los últimos días, creencias con su nivel de confianza,
  conexiones razonadas, tensiones detectadas — todo con lenguaje propio
  de LUZ, no una tabla de datos.
- `/memories` agrupa por tiempo (Hoy/Esta semana/Este mes/Más atrás),
  encadena memorias relacionadas, y traduce insights del Knowledge
  Engine a lenguaje humano ("Lo he notado N veces...") en vez de
  contadores crudos.
- `/feedback` le pregunta directamente a la persona por la dimensión de
  Continuidad ("¿Sientes que te recuerdo con el tiempo?") — coherencia
  real entre lo que el producto dice medir y lo que le pregunta a la
  gente.
- El resumen de actividad del Dashboard (`dashboard-activity-summary.tsx`)
  ya se corrigió de un panel de analítica fría a una sola frase con voz
  ("Nos conocemos desde... Hemos hablado N veces... Guardo N momentos
  tuyos que no quiero olvidar") — documentado en su propio código como
  una corrección deliberada.

## Hallazgos abiertos, priorizados por impacto

### H3 — Continuidad indescubrible (el más grave)

No existe ningún camino visible, desde `/chat`, hacia el historial de
conversaciones. `components/app-shell.tsx:13-22` tiene exactamente
cuatro secciones (Hoy/Vida/Recuerdos/Conversación) — ninguna es
`/conversations`. El único acceso es una card en el Dashboard, limitada
a 5 conversaciones (`build-dashboard-summary.ts:81`, `.limit(5)`), que
además desaparece por completo si no hay actividad reciente.

Esto viola `PRESENCE_MODEL.md` en su propia definición de Continuidad:
*"si volver a LUZ se siente como volver a alguien que ya estaba ahí, no
empezar de cero."* Hoy, técnicamente sí se recuerda todo — pero la
persona no tiene manera de *volver* a lo que ya vivió con LUZ sin saber
la URL de memoria. Es el hallazgo más antiguo de esta auditoría (lo vi
por primera vez antes de este documento) y el más confirmado — dos
pasadas independientes por el código llegan a la misma conclusión.

**Impacto:** alto. **Esfuerzo:** bajo. **Riesgo:** ninguno — es
navegación, cero arquitectura.

### H4 — El crecimiento de la relación es invisible fuera de `/chat`

`deriveOrbSignature` (`generate-welcome.ts:110-141`) ya calcula, con
datos 100% reales (mensajes totales, creencias en formación, pregunta
de curiosidad pendiente, deadlines próximos), si la relación está en
etapa `spark`, `steady` o `radiant`. Es exactamente el concepto de
"esto ha ido creciendo contigo" — pero solo se pinta dentro del ritual
de `/chat`. El `PresenceDot` que sí vive en cada pantalla
(`components/ui/presence-dot.tsx`) es un punto estático, idéntico byte
por byte para alguien del día 1 y alguien del día 30.

Esto no llega a violar ningún principio (no hay nada inventado, no se
está fingiendo nada) pero es la brecha más grande contra el Principio 7
(Evolución compartida) y contra la intuición de "tamagotchi inverso":
hoy, la única señal ambiental de que la relación maduró está enterrada
a un clic, dentro de `/chat`, y solo dura los ~2 segundos del ritual de
apertura.

**Impacto:** alto (es la prueba visual más directa de "esto no es un
chatbot"). **Esfuerzo:** medio — requiere exponer `deriveOrbSignature`
fuera de `generate-welcome.ts` y decidir dónde mostrarlo sin volverlo
ruido visual en una pantalla de datos como el Dashboard. **Riesgo:**
bajo, pero merece su propio bloque de diseño (no es "pequeño" en el
sentido que pediste para hacerlo ahora mismo) — queda priorizado para
el siguiente bloque, no implementado en este documento.

### H5 — `buildReturningLine` se repite, palabra por palabra

`app/dashboard/page.tsx:48-53`: exactamente dos strings posibles, sin
ninguna variación, a diferencia de `generate-welcome.ts` (línea 63),
que instruye explícitamente "varía el tono, el largo y el ritmo cada
vez." Se activa solo cuando `continuityLine` (IA) no tuvo nada
estratégico que decir Y la ausencia fue de 3 a 14 días
(`RETURNING_GAP_DAYS`, línea 34) — quien vuelve cada pocos días de
forma irregular, con poca señal de Vida/Creencias, es quien más
probablemente vea la misma frase exacta dos veces. Rompe, en un caso
específico pero real, la sensación de que LUZ "nota" cada regreso de
forma distinta.

**Impacto:** medio (afecta un patrón de uso específico, no a todos).
**Esfuerzo:** trivial — es una función que devuelve un string.
**Riesgo:** ninguno.

### H6 — "Creencia en formación" vs "ya asentada" no se distingue en la UI

`/life/identity` (`build-identity-model.ts:167-173`) muestra las
creencias con más confianza sin importar su categoría — una creencia
todavía "en formación" (banda de confianza 30-54, la misma que usa
`growingBeliefs`) puede aparecer junto a una ya asentada, con solo un
número de confianza (`life/identity/page.tsx:195-197`) para
diferenciarlas. El prompt de IA sí tiene esta distinción (nunca afirma
una creencia en formación como hecho) — la interfaz no la hereda.
Riesgo directo contra el Principio 7 (Evolución compartida: la persona
debe reconocerse en lo que LUZ refleja, no que se le presente una
conclusión con más seguridad de la que realmente tiene).

**Impacto:** medio. **Esfuerzo:** bajo (es copy/etiqueta condicional
sobre un dato que ya existe). **Riesgo:** ninguno.

### H7 — `/conversations` sin paginación

`features/conversations/services/list-conversations.ts:117-132` no
tiene `.limit()`. A los 30 días probablemente no es un problema real
todavía; a los 90-180 podría serlo. Flagueado para Beta, no urgente.

------------------------------------------------------------------------

# Hoja de ruta

Ordenada según la misma prioridad que ya fija `ADR-0018` (producto y
UX antes que más arquitectura) y el ciclo de vida de
`ALPHA_PROGRAM_SPEC.md` (Alpha-0 → Validación de motores → Beta).

## Alpha (ahora — antes de que haya más usuarios)

1. **H3 — hacer descubrible el historial desde `/chat`.** Implementado
   en este mismo bloque de trabajo (ver más abajo) — es exactamente el
   caso que autorizaste: pequeño, alto impacto, sin tocar arquitectura.
2. **H5 — variar `buildReturningLine`.** Trivial, seguro, listo para
   el próximo bloque.
3. **H1 — placeholder de `/chat` con más intención.** Requiere cuidado
   de tono (no convertirlo en una lista de sugerencias tipo plantilla),
   por eso no entra en el fix inmediato.

## Beta (cuando haya señal real de uso, no solo lectura de código)

4. **H4 — crecimiento de la relación visible fuera de `/chat`.** El de
   mayor impacto simbólico, pero merece su propio diseño (dónde vive,
   cómo evita volverse ruido) antes de implementarse.
5. **H6 — distinguir "en formación" de "asentada" en `/life/identity`.**
6. **H7 — paginación de `/conversations`.**
7. Cualquier instrumentación pre-auth necesaria para reemplazar lectura
   de código por datos reales de abandono (fuera de este documento —
   Observabilidad).

------------------------------------------------------------------------

# Lo que este documento no cubre

Encontré, pero no incluyo aquí porque no es producto/UX:

- Presencia genuina mientras el usuario está ausente ("LUZ te esperó")
  — ya documentado como pedido formal al Lead Systems Engineer en la
  sesión anterior; sigue sin resolverse, sigue sin ser mío.
- Los P0 de `docs/product/FEATURE_ROADMAP_V1.md` §12 (pipeline de
  Knowledge roto, persistencia de Goal/Project/Habit) — motor, no
  producto.
