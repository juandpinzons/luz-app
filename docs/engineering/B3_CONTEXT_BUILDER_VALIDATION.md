# Sprint B3 — Context Builder: Informe de Validación

Excepción de documentación explícitamente autorizada por el Founder para
este sprint ("un breve informe de validación"). No es una nueva pieza de
arquitectura — documenta evidencia de comportamiento observado.

## Qué se construyó

`features/chat/context-builder/` — el puente explícito entre Conversation,
Memory (vía Reality Snapshot), Reality Snapshot y Conversation Manual.
Ninguna fuente de información nueva: reutiliza `assembleRealitySnapshot`
(Sprint B2) como única vía hacia memorias relevantes.

- `context.ts` — el tipo `Context` (`conversation`, `memories`,
  `realitySnapshot`, `conversationRules`, `responseIntent`).
- `conversation-rules/` — 4 reglas del Conversation Manual expresadas como
  comportamiento (`ConversationRule`, con `applies()`/`directive()`):
  `prioritize-understanding`, `avoid-unnecessary-questions` (incondicionales),
  `favor-continuity`, `avoid-repeating-known-info` (condicionadas a que
  existan memorias relevantes).
- `build-context.ts` — ensambla el `Context`; determina `responseIntent`
  (`first_contact` / `continue_conversation` / `reconnect_with_memory`) de
  forma determinista, sin IA.
- `render-context.ts` — única función que traduce `Context` a
  `AIMessage[]`; `AIProvider.generateReply()` no cambió.

`features/chat/services/send-message.ts` fue reescrito para usar el
Context Builder en vez del `toSystemMessage()` ad-hoc de Sprint B2.
Degrada de forma segura: si `lifeGraphContext` es `null` o la construcción
del Context falla, el chat sigue funcionando con el historial simple, sin
reglas ni memoria — mismo criterio de tolerancia a fallos ya establecido
en Sprint B1.

## Verificación estática

- `npx tsc --noEmit` — limpio, sin errores en todo el proyecto.
- `npx eslint .` — limpio, exit 0.

## Validación real (base de datos + IA reales)

Siguiendo el estándar de verificación establecido desde Sprint B1
("verificar contra la base de datos real, no solo lectura de código"), se
ejecutó un script (`buildContext` + `renderContextToMessages` +
`AIProvider.generateReply` reales, contra Postgres real vía Docker) que
crea un `LifeGraph` de prueba dedicado — para poder controlar con
precisión las tres condiciones pedidas sin depender de cuentas reales vía
login de Google. El `LifeGraph`, `Person` y `Memory` de prueba fueron
eliminados de la base de datos al finalizar; no queda ningún dato de
prueba residente.

### Caso A — Sin memoria relevante

Conversación nueva, sin memoria capturada aún.

```
responseIntent: first_contact
memories.length: 0
conversationRules: [prioritize-understanding, avoid-unnecessary-questions]
```

Respuesta de la IA:
> "Hola, encantado de hablar contigo. ¿En qué te gustaría que te ayude
> hoy? Puedes contarme tu situación o lo que necesitas..."

Genérica, sin ninguna referencia a información que LUZ no tiene — consistente
con que solo aplican las 2 reglas incondicionales.

### Caso B — Con memoria relevante, misma conversación

Se capturó una memoria real ("le gusta el café en las mañanas") y se
continuó la misma conversación con una pregunta relacionada.

```
responseIntent: reconnect_with_memory
memories.length: 1  → ["le gusta el café en las mañanas"]
conversationRules: [prioritize-understanding, avoid-unnecessary-questions,
                     favor-continuity, avoid-repeating-known-info]
```

Respuesta de la IA (fragmento):
> "2. **Tu café, pero con intención** — Ya que te gusta el café en las
> mañanas, tómalo sin prisas si puedes..."

La IA usa la memoria como dato ya conocido ("ya que te gusta") en vez de
preguntar qué le gusta tomar — comportamiento directamente atribuible a
`avoid-repeating-known-info` y `favor-continuity`, visibles en el Context
antes de llamar a la IA.

### Caso C — Conversación nueva, memoria de una conversación anterior

Conversación completamente nueva (un solo turno, sin historial previo en
*esta* conversación), mismo `LifeGraph` que ya tiene la memoria del Caso B.

```
responseIntent: first_contact
memories.length: 1  → ["le gusta el café en las mañanas"]
conversationRules: [prioritize-understanding, avoid-unnecessary-questions,
                     favor-continuity, avoid-repeating-known-info]
```

Respuesta de la IA:
> "Hola, qué bueno volver a leerte 😊 ¿Café ya en mano o todavía no toca?"

Aunque es el primer turno de esta conversación específica, la memoria
persiste a nivel de `LifeGraph` (no de conversación) y las mismas reglas
de continuidad aplican — la IA saluda como quien ya conoce a la persona y
referencia el café sin que nadie se lo haya mencionado en este hilo. Esto
es exactamente la diferencia que Memory Engine + Context Builder existen
para producir: LUZ no trata cada conversación nueva como un desconocido
nuevo.

## Hallazgo a señalar (no corregido en este sprint)

`responseIntent` se calcula únicamente a partir de `conversation.length`
antes de mirar `memories` (`build-context.ts`, `determineResponseIntent`).
Esto produce una etiqueta engañosa en el Caso C: el campo dice
`first_contact` aunque el comportamiento real —reglas aplicadas y
respuesta generada— es de reconexión con memoria. El campo es preciso
solo en el sentido literal ("primer turno de *esta* conversación"), no en
el sentido que su nombre sugiere ("LUZ no conoce a esta persona"). No lo
corregí porque:

1. No estaba roto para el propósito de este sprint — `conversationRules`
   y `memories`, que es lo que efectivamente moldea la respuesta, ya
   reflejan la continuidad correctamente en los tres casos.
2. Es una decisión de diseño (¿qué significa "first contact"? ¿por
   conversación o por persona?), no un bug objetivo — prefiero que el
   Founder decida el criterio antes de tocarlo.

Queda pendiente de tu decisión: ¿debería `responseIntent` reflejar
"primera vez que hablamos con esta persona" en vez de "primer turno de
esta conversación"? Si es así, lo ajusto en un PR pequeño y aislado.

## Resultado

Los tres casos muestran diferencias de respuesta explicables directamente
observando el `Context` construido (memorias presentes, reglas aplicadas)
antes de llegar a la IA — no hay ninguna diferencia que no se pueda
rastrear al Context. LUZ ya no responde únicamente al último mensaje.
