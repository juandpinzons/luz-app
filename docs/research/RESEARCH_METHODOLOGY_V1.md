# Research Methodology v1

Version: 1.0\
Status: Proposed — awaiting Founder confirmation\
Propósito: definir cómo LUZ aprende del comportamiento humano. Este
documento no contiene ningún patrón, ningún hallazgo y ninguna regla
de conversación — contiene únicamente las reglas de investigación.
Describe cómo pensamos, no qué pensamos.\
Related: `docs/research/RESEARCH_BACKLOG_V1.md`,
`docs/research/HUMAN_BEHAVIOR_PATTERNS.md`,
`docs/product/CONVERSATION_MANUAL_V1.md`,
`docs/product/HUMAN_EXPERIENCE_DATASET_V1.md`,
`docs/architecture/HUMAN_MODEL_V1.md`

Este documento está escrito para que alguien que nunca haya
participado en esta investigación — dentro de cinco años, o de diez —
pueda continuarla con exactamente el mismo rigor, sin tener que
inferir el método a partir de ejemplos pasados.

---

## Las cuatro capas

El conocimiento humano de LUZ vive en cuatro capas separadas, cada una
con su propia responsabilidad:

```
RESEARCH_METHODOLOGY_V1.md   →  cómo investigamos
        ↓ (gobierna)
RESEARCH_BACKLOG_V1.md       →  qué preguntas dirigen la investigación
        ↓ (orienta, nunca predetermina el resultado)
HUMAN_BEHAVIOR_PATTERNS.md   →  qué descubrimos
        ↓ (propone, nunca aplica automáticamente)
CONVERSATION_MANUAL_V1.md    →  cómo eso cambia el comportamiento de LUZ
```

Ninguna capa se salta. Un hallazgo nunca pasa directamente de un
testimonio al Conversation Manual — siempre atraviesa las reglas de
esta capa primero, se conecta explícitamente a una pregunta del
backlog cuando corresponde, y siempre queda registrado en la capa de
hallazgos antes de proponerse como cambio de producto. La Sección 10
formaliza exactamente qué tiene que cumplir para cruzar de la capa 3 a
la capa 4.

El backlog **orienta, no predetermina.** Un testimonio puede revelar
algo valioso que no responde ninguna pregunta existente — eso no lo
descalifica como evidencia, pero si ocurre con frecuencia es una señal
de que el backlog necesita una pregunta nueva (Sección 3a), no de que
el testimonio no importa.

### 3a. El flujo de trabajo ante cada testimonio nuevo

Regla permanente, no un procedimiento de una sola vez:

1. **Analizarlo con esta metodología** — "Las cuatro preguntas"
   (arriba) contra cada patrón existente, no solo el más obvio.
2. **Determinar qué preguntas de `RESEARCH_BACKLOG_V1.md` ayuda a
   responder** — citarlas por nombre (ej. "R2", "C3").
3. **Actualizar el nivel de evidencia** de los patrones
   correspondientes en `HUMAN_BEHAVIOR_PATTERNS.md` — subir de nivel,
   debilitar, dividir, o registrar como confirmación adicional, según
   corresponda (Sección 4 y 6).
4. **Evaluar si algún patrón alcanza Nivel 3** y, de ser así, si debe
   proponerse formalmente contra el Conversation Manual (Sección 10)
   — nunca aplicarlo directamente.
5. **Si el testimonio revela una pregunta genuinamente nueva**,
   proponer su incorporación a `RESEARCH_BACKLOG_V1.md` con la
   justificación completa que ese documento exige — nunca agregarla
   sin ella, aunque parezca obviamente relevante.

Este flujo existe específicamente para que la investigación deje de
ser reactiva — el objetivo no es acumular testimonios, es reducir la
incertidumbre de preguntas ya identificadas como estratégicas, y
ampliar esa lista deliberadamente cuando algo genuinamente nuevo
aparece.

### Las cuatro preguntas

El paso 1 del flujo anterior, y el mecanismo central de todo el
método: cada patrón existente en `HUMAN_BEHAVIOR_PATTERNS.md` se
somete a estas cuatro preguntas frente a cada testimonio nuevo, no
solo frente al patrón que parece más obviamente relacionado:

1. ¿Confirma el patrón?
2. ¿Lo debilita?
3. ¿Lo contradice?
4. ¿Obliga a dividirlo en dos patrones distintos?

Una contradicción tiene exactamente el mismo valor que una
confirmación — ambas son información. Ninguna se esconde, ninguna se
suaviza antes de tiempo (Sección 6 desarrolla el protocolo completo
para cuando la respuesta es "contradice" o "divide").

---

## 1. Qué constituye evidencia

Evidencia es un testimonio real, completo, atribuible a una persona o
caso específico — nunca una impresión, nunca un recuerdo de "algo
parecido que ya vimos," nunca una extrapolación presentada como si
fuera un hecho observado.

**Cuenta como evidencia:**
- Un testimonio directo (pegado en conversación, o en un documento
  fuente localizable) con contenido real de una persona real.
- Una declaración explícita dentro de ese testimonio (lo que la
  persona dice) y también su estructura (lo que la forma de su rutina
  revela sin que lo diga — ver `HUMAN_BEHAVIOR_PATTERNS.md` para
  ejemplos ya documentados de ambos
  tipos).

**No cuenta como evidencia:**
- La intuición del equipo, por razonable que parezca.
- El "sentido común" sin un caso citable detrás.
- Una **Proyección** (perfil hipotético construido para cubrir un
  hueco del corpus, como los 30 perfiles de Grupo B/C/D en
  `HUMAN_BEHAVIOR_PATTERNS.md`). Las proyecciones son útiles para
  planear qué preguntar después — nunca para sostener un patrón. Esta
  distinción es absoluta y no admite excepciones por conveniencia.
- Un testimonio del que solo se recuerda "el resumen" sin poder volver
  al texto original.

**Regla de trazabilidad:** todo patrón, sin excepción, cita el caso o
casos exactos que lo sostienen, por nombre. "Varios testimonios
sugieren..." no es una cita válida. "Juan David y Sam, de forma
independiente..." sí lo es.

---

## 2. Observación vs. principio

Una **observación** describe lo que ocurrió en un caso. Un
**principio** describe un comportamiento que se repite lo suficiente
como para que valga la pena esperar que se repita en un caso todavía
no visto.

La línea entre ambos nunca se cruza por convicción — se cruza
únicamente por repetición verificada, con los casos citados. Ver la
comida completa en la Sección 4.

Un corolario importante: **una observación de un solo caso, por
llamativa que sea, sigue siendo una observación.** El hallazgo de
Juan David y Verónica (Sección 5) fue especialmente valioso, pero no
alcanzó Nivel 3 por ser llamativo — lo alcanzó porque además había
otros dos casos independientes del mismo fenómeno general. La
elocuencia de un testimonio nunca sustituye la repetición.

---

## 3. Sesgo de confirmación — cómo se evita

El riesgo más serio de este método no es la falta de evidencia — es
encontrar exactamente la evidencia que ya se esperaba encontrar y
dejar de buscar lo contrario. Mecanismos concretos, no aspiracionales:

1. **Las cuatro preguntas se aplican contra cada patrón existente, no
   solo contra el más obvio.** Un testimonio nuevo se revisa completo
   contra toda la lista de patrones — confirma, debilita, contradice,
   o divide. Revisar solo el patrón que "parece" relevante es la forma
   más común en que un sesgo se cuela sin ser notado.
2. **Los no-hallazgos se registran tanto como los hallazgos.** Si un
   testimonio no confirma ni contradice nada, eso también es
   información — evita que el conteo de "casos observados" quede
   sesgado hacia los patrones que, por casualidad, siempre están
   presentes en lo que se decide analizar primero.
3. **La diversidad de perfil pesa tanto como la cantidad de casos**
   para subir de nivel. Tres testimonios de personas casi idénticas
   confirman menos que dos testimonios de personas en contextos
   claramente distintos. Ningún patrón sube de Nivel 1 a Nivel 2 solo
   por acumular repeticiones del mismo tipo de persona.
4. **Ninguna Proyección cuenta como evidencia, nunca**, ni siquiera
   cuando "encaja perfecto" con un patrón ya sospechado — la
   tentación de usar una proyección bien razonada como si fuera
   evidencia real es precisamente el tipo de sesgo que este método
   existe para prevenir.
5. **El contraejemplo se busca activamente, no se espera pasivamente.**
   Antes de declarar un patrón como Nivel 2 o superior, quien investiga
   debe preguntarse explícitamente: ¿qué tipo de caso rompería esto?
   ¿ya lo busqué, o solo no ha aparecido todavía? Estas dos situaciones
   no son lo mismo y este documento las distingue a propósito.
6. **Separación de roles, como principio a futuro.** Hoy la misma
   persona recolecta, analiza y decide el nivel de cada patrón — una
   limitación real, no ideal. Si el equipo de investigación crece,
   quien decide el nivel de madurez de un patrón no debería ser la
   misma persona que decidió que ese patrón "parecía prometedor"
   al recolectar el testimonio.

---

## 4. Los cuatro niveles de madurez

Formalización completa de lo ya introducido en
`HUMAN_BEHAVIOR_PATTERNS.md` — este documento es ahora la fuente
canónica de esta tabla; si alguna vez difieren, esta versión gobierna.

### Nivel 1 — Observación

- **Entrada:** evidencia en 1 o 2 casos.
- **Autoriza:** solo registro. Nada más.
- **No autoriza:** generar hipótesis formales, ni modificar ningún
  documento fundacional.

### Nivel 2 — Patrón emergente

- **Entrada:** evidencia repetida en perfiles **distintos entre sí**
  (no la misma clase de persona repetida) — mínimo 3 casos
  independientes, en al menos dos contextos de vida claramente
  distintos.
- **Autoriza:** generar hipótesis derivadas; quedar registrado como
  candidato en `HUMAN_BEHAVIOR_PATTERNS.md`.
- **No autoriza:** proponer ningún cambio a Conversation Manual,
  Human Model, principios de memoria o Reality Snapshot todavía.

### Nivel 3 — Principio respaldado

- **Entrada:** evidencia consistente en perfiles diversos, **sin
  contraejemplos sin resolver**, y preferiblemente (no
  obligatoriamente) con Cross-evidence (Sección 5).
- **Autoriza:** proponer — nunca aplicar automáticamente — un cambio a
  un documento fundacional, siguiendo el gate completo de la Sección
  10.
- **No autoriza:** considerarse un principio estable de comportamiento
  humano todavía. Un principio de Nivel 3 sigue activamente buscando
  su contraejemplo.

### Nivel 4 — Principio fundacional

- **Entrada:** evidencia acumulada durante **muchos** casos (no un
  número fijo — un juicio informado, siempre justificado por escrito
  cuando se declare), habiendo sobrevivido **múltiples** contraejemplos
  reales, no solo la ausencia de ellos.
- **Autoriza:** considerarse estable dentro del alcance actual de LUZ.
- **Regla explícita:** estos principios deben ser extremadamente
  pocos. Un documento con muchos principios de Nivel 4 es una señal de
  que el criterio se relajó, no de que la investigación avanzó rápido.

### Los niveles no son unidireccionales

Un patrón puede **retroceder** de nivel si un contraejemplo lo
debilita lo suficiente — de Nivel 3 a Nivel 2, o de Nivel 2 a dividirse
en dos patrones de Nivel 1 (ver Sección 6, y el caso ya documentado de
`PE1a`/`PE1b` en `HUMAN_BEHAVIOR_PATTERNS.md`). El nivel de un patrón
es un estado actual, no un logro permanente.

---

## 5. Cross-evidence

Cross-evidence es un caso especial y particularmente fuerte de
evidencia: **dos personas distintas describen el mismo fenómeno,
desde su propia perspectiva, de forma independiente** — no dos casos
que se parecen, sino dos testigos del mismo hecho.

**Por qué pesa más que dos casos independientes parecidos:** dos
casos parecidos podrían ser, en el peor escenario, la misma tendencia
narrativa apareciendo en dos personas por coincidencia. Cross-evidence
descarta esa posibilidad — si dos personas que no coordinaron su
relato describen el mismo evento compartido de forma consistente, la
probabilidad de que sea artefacto narrativo baja considerablemente.

**Condición estricta:** para calificar como Cross-evidence, las dos
personas deben describir el **mismo hecho compartido**, no
simplemente el mismo *tipo* de comportamiento. El caso de referencia
(`HUMAN_BEHAVIOR_PATTERNS.md`, PR1) es Juan David y Verónica
describiendo, cada uno por su lado, la misma llamada diaria entre
ambos. Tres personas distintas mostrando el mismo patrón general en
sus vidas separadas (por ejemplo, PE2) **no** es Cross-evidence — es
evidencia repetida, una categoría más débil, aunque también válida
para Nivel 2 o 3.

---

## 6. El papel de los contraejemplos

Los contraejemplos tienen **exactamente el mismo valor** que las
confirmaciones. Un método que solo cuenta confirmaciones no es
investigación, es una colección de anécdotas favorables.

**Protocolo obligatorio, siempre en este orden:**

1. **Registrar el contraejemplo tal cual, sin suavizarlo ni
   explicarlo todavía.** No se busca inmediatamente una razón por la
   que "en realidad no cuenta."
2. **Dejar que el patrón pierda confianza de inmediato**, antes de
   decidir nada. Si el patrón decía "sin excepción," esa cualidad
   queda formalmente refutada en el momento en que aparece el
   contraejemplo — no después de analizarlo.
3. **Solo entonces, decidir** entre cuatro resultados, nunca elegidos
   por default:
   - **Sigue siendo válido** — el contraejemplo resulta, tras
     revisión, ser un caso del mismo patrón con una variable que ya
     estaba prevista (poco común; debe justificarse explícitamente por
     qué no cambia nada).
   - **Necesita condiciones** — el patrón sigue siendo cierto, pero
     solo bajo una condición que antes no estaba declarada.
   - **Debe dividirse** — el contraejemplo revela una subpoblación
     genuinamente distinta, no una excepción. El caso de referencia:
     Ilda dividió "tiempo personal protegido" en `PE1a` (personas con
     autonomía horaria) y `PE1b` (personas cuyo tiempo lo estructuran
     las necesidades de otros) — ninguna de las dos mitades existía
     como patrón formal antes del contraejemplo.
   - **Debe eliminarse** — el contraejemplo revela que la evidencia
     original nunca fue sobre el comportamiento humano que se
     pensaba, sino sobre un artefacto del método de recolección. Caso
     de referencia: el patrón original "los registros de rutina nunca
     contienen reflexión emocional explícita" fue eliminado
     directamente al aparecer a Juan David, Verónica y Sam
     contradiciéndolo — no se dividió, porque no había una
     subpoblación real que lo sostuviera, solo una generalización
     apresurada sobre el formato.

Ningún contraejemplo se descarta por ser "un caso raro." Un caso raro
sigue siendo un caso real.

---

## 7. Cuándo una hipótesis (o patrón) debe dividirse en dos

Señal principal: la evidencia de apoyo deja de ser homogénea — dos
subconjuntos de casos muestran comportamientos **opuestos**, no solo
variados, bajo la misma etiqueta. Cuando eso ocurre, mantener una sola
etiqueta oculta información en vez de resumirla.

División correcta ≠ agregar una excepción con nota al pie. División
correcta significa que ambas mitades se convierten en patrones
propios, cada una con su propio nivel de madurez, su propia evidencia
y su propio camino hacia Nivel 3 — como ocurrió con `PE1a`/`PE1b`.

---

## 8. Cuándo un patrón debe desaparecer

Un patrón se retira completamente (no se divide) cuando la revisión
revela que nunca describió comportamiento humano real — describía una
característica del método de recolección, del formato del testimonio,
o un artefacto de cómo se pidió la información. La señal distintiva
frente a "debe dividirse": no hay ninguna subpoblación real que el
patrón describa correctamente después de la revisión — la premisa
completa estaba mal formulada, no solo incompleta.

Un patrón retirado no se borra del documento — queda anotado como
retirado, con la razón, para que nadie lo redescubra sin saber que ya
se intentó y se abandonó por una razón concreta.

---

## 9. Los tres pasos antes de aceptar cualquier hallazgo

Antes de registrar cualquier conclusión, sin excepción:

1. ¿Está citado el caso exacto? (Sección 1)
2. ¿Se aplicaron "Las cuatro preguntas" contra los patrones
   existentes, no solo contra el que parecía relevante?
3. ¿El nivel de madurez asignado corresponde honestamente a los
   criterios de la Sección 4, o se está redondeando hacia arriba
   porque el hallazgo "se siente" importante?

---

## 10. Cuándo un hallazgo puede modificar el producto

Ningún principio entra a `docs/product/CONVERSATION_MANUAL_V1.md`
únicamente por existir en `docs/research/HUMAN_BEHAVIOR_PATTERNS.md`.
Debe cumplir, todo a la vez, sin excepciones:

1. **Nivel 3 o superior**, formalmente asignado, no informal.
2. **Justificación explícita** — por qué este hallazgo, específicamente,
   debería cambiar el comportamiento de LUZ, no solo que existe.
3. **Evidencia citada** — los casos exactos, nombrados, no "varios
   testimonios."
4. **Contraejemplos revisados** — declarar explícitamente que se buscó
   un contraejemplo y qué se encontró (incluso si fue "ninguno
   todavía," eso se declara, no se omite).
5. **Revisión del posible impacto en la conversación** — cómo cambiaría
   el comportamiento de LUZ en la práctica, y si ese cambio podría
   entrar en tensión con un principio ya existente del Conversation
   Manual (como ya ocurrió entre `PE2` y la regla anti-productividad
   del Manual — esa tensión fue exactamente la razón para **no**
   proponer `PE2` todavía, pese a tener evidencia real).

El resultado de cumplir estos cinco puntos es siempre una **propuesta**
— nunca una edición directa del Conversation Manual. La decisión de
incorporarla pertenece al Founder.

---

## 11. Cuándo un hallazgo puede modificar la arquitectura

Mismo estándar de madurez que el producto (Nivel 3 o superior), más
una pregunta previa obligatoria que el producto no requiere:

> **¿Puede resolverse con la arquitectura actual?**

Si la respuesta es sí — como ha ocurrido con cada implicación
arquitectónica identificada hasta ahora en `HUMAN_BEHAVIOR_PATTERNS.md`
— el hallazgo se registra como confirmación de una prioridad ya
existente, no como una propuesta nueva. Solo si la respuesta es
**claramente no**, se redacta una propuesta de evolución, y esa
propuesta sigue las mismas reglas de cualquier cambio arquitectónico
en este proyecto: no se implementa directamente, se presenta con
alternativas y trade-offs (mismo criterio ya establecido para
`core/knowledge-engine`, `core/connectors`, y el propio Human Model).

Cruzar un invariante arquitectónico ya establecido (por ejemplo, el
aislamiento de privacidad entre `LifeGraph`s) nunca se propone desde
este proceso de investigación solo — exige una justificación
sustancialmente más fuerte que la que la investigación de
comportamiento, por sí sola, puede ofrecer.

---

## 12. Continuidad — para quien retome esto en el futuro

- **Ningún documento de esta capa se reescribe destructivamente.**
  Cuando un patrón cambia de nivel, se divide, o se retira, la razón
  queda escrita en el propio documento — no se asume que el historial
  de conversación (que puede no sobrevivir) sea la única fuente de esa
  decisión.
- **Todo patrón es trazable a casos nombrados**, indefinidamente — si
  algún día un caso resulta estar mal registrado (nombre equivocado,
  testimonio mal atribuido), se corrige explícitamente, nunca se
  elimina en silencio.
- **Este documento gobierna sobre `HUMAN_BEHAVIOR_PATTERNS.md` en caso
  de conflicto de método** — si algún día ese documento contradice una
  regla de aquí, esta versión es la autoritativa hasta que se decida
  actualizar ambas deliberadamente.
- **La calidad de este proceso se mide por cuántos patrones fueron
  refutados o divididos, no por cuántos sobrevivieron intactos.** Un
  historial de investigación sin contraejemplos registrados es una
  señal de alarma, no de éxito.

---

## Qué no es este documento

- No contiene ningún patrón de comportamiento humano — esos viven
  exclusivamente en `docs/research/HUMAN_BEHAVIOR_PATTERNS.md`.
- No contiene ninguna regla de conversación — esas viven
  exclusivamente en `docs/product/CONVERSATION_MANUAL_V1.md`, y solo
  llegan ahí a través del gate de la Sección 10.
- No autoriza ningún cambio de producto o arquitectura por sí mismo —
  define el proceso por el cual esos cambios se proponen, nunca los
  aplica.
- No es definitivo. Si esta metodología misma necesita corregirse, se
  corrige con la misma honestidad que le exige a cualquier patrón —
  explícitamente, con la razón documentada, nunca en silencio.
