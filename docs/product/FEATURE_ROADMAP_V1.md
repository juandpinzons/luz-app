# LUZ — Especificación de Capacidades y Roadmap de Producto (Alpha → V1)

**Status:** Proposed — awaiting Founder confirmation
**Versión:** 1.0
**Autor:** Síntesis de Lead Product Engineer, a partir de la documentación y el código existentes — no es una decisión de producto por sí sola.
**Relacionado con:** todo `docs/vision/`, `docs/foundations/`, `docs/concepts/`, `docs/architecture/`, `docs/adr/`, `docs/product/`, `docs/research/`, y el estado real de `core/` y `features/` al momento de escribir esto.

---

## 0. Qué es este documento

Esto no es documentación nueva. Es una **síntesis** de más de sesenta documentos ya existentes (visión, fundamentos, conceptos, arquitectura, 17 ADRs, specs de producto, investigación) contra el **código real** que hoy corre en producción. No inventa filosofía nueva, no inventa arquitectura nueva. Donde encontró conceptos duplicados, los unificó. Donde encontró contradicciones entre lo que el producto dice ser y lo que el código realmente hace, las señala explícitamente — nunca las suaviza ni las esconde.

Responde una sola pregunta, desde la perspectiva de capacidades y no de pantallas: **¿qué puede hacer LUZ?**

Y una segunda, tan importante como la primera: **¿qué de eso es real hoy, y qué es todavía una intención?**

### 0.1 Jerarquía de evidencia

Cuando dos fuentes se contradicen, este documento resuelve el conflicto en este orden, sin excepción:

1. **Código implementado** — lo que corre en producción hoy. Verificado leyendo el código, no asumido desde la documentación.
2. **ADRs Accepted** — decisiones de arquitectura vigentes, aunque su implementación esté pendiente.
3. **Arquitectura aprobada** — la dirección oficial del sistema (specs de engine, diagramas de dominio, manifiestos) cuando no contradice ningún ADR Accepted, incluso si todavía no tiene ADR propio ni implementación.
4. **Visión y Foundations** — los principios del producto. Rigen el *espíritu* de cada decisión, pero no son, por sí solos, una especificación técnica.
5. **Documentos Proposed** — exploraciones y diseños todavía sin decisión del Founder. Se citan como lo que son: propuestas, nunca como capacidades existentes ni como arquitectura vigente.

### 0.2 Los cuatro estados de una capacidad

Cada capacidad mencionada en este documento lleva una de estas cuatro etiquetas. No son sinónimos de prioridad — una capacidad `Future` puede ser más urgente que una `Approved` sin implementar todavía.

| Etiqueta | Significa | Criterio de verificación usado aquí |
|---|---|---|
| **Implemented** | Existe y funciona en el código, hoy — alcanzable desde un flujo real, con un efecto real. | Confirmado leyendo `core/` y `features/` directamente — nunca asumido desde un doc. Un tipo o interfaz sin implementación ni consumidores **no** cuenta como Implemented (ver Sección 0.5, inferencia 1). |
| **Approved** | Forma parte de la arquitectura vigente por una decisión explícita — un ADR `Accepted`, o un documento que declara `Status: Accepted`. | El documento que la define dice explícitamente que está aceptado. |
| **Approved (inferred)** | Forma parte, muy probablemente, de la arquitectura vigente — pero el documento que la define no declara ningún `Status`, así que su vigencia se infiere, no se lee directamente. | Ver la regla de tres condiciones en la Sección 0.4. |
| **Proposed** | Existe como diseño, investigación o exploración, pero todavía no es una decisión de arquitectura ni de producto. Incluye documentos `Draft` (ver Sección 0.4). | El documento que la define se autodeclara Proposed o Draft, o es un hallazgo de investigación por debajo del nivel de evidencia que autoriza un cambio. |
| **Future** | Oportunidad identificada *durante esta auditoría* — no estaba documentada como tal en ningún lugar. | Aparece solo en este documento; no tiene doc fuente previo. |

### 0.3 Qué cambia respecto a los documentos fuente

- **Se propone una taxonomía de dominios distinta** a la lista plana original del brief (Conversación, Memoria, Conocimiento... Life Graph). La razón se explica en la Sección 2.
- **Se unifican dos vocabularios de etapas de relación** que hoy coexisten sin reconciliar (`concepts/RELATIONSHIP_MODEL.md` vs `foundations/HUMAN_RELATIONSHIP_MODEL.md`) — se adopta el segundo como canónico. Ver Sección 0.5 y Sección 8.4.
- **Se reclasifican como Future o Proposed** varias ideas que la documentación anterior podría leerse como si ya fueran parte del producto (Presencia, Life Orchestrator, Human Model, Conectores) — ninguna de ellas tiene una línea de código.
- **Se documentan capacidades reales que no aparecen en ningún doc de producto** (títulos automáticos de conversación, persistencia de borradores, rate limiting, feedback estructurado, el dashboard de `/admin`).

### 0.4 Regla de clasificación documental (gobernanza)

Cuando un documento de arquitectura no declara explícitamente un campo `Status`, este documento **no lo trata como `Proposed` por defecto.** Se clasifica como **Approved (inferred)** únicamente cuando se cumplen, simultáneamente, estas tres condiciones:

1. Pertenece a la arquitectura oficial del repositorio (vive en `docs/architecture/`, o es citado aprobatoriamente por un ADR `Accepted`).
2. No contiene lenguaje que indique que está pendiente de aprobación (`Draft`, `Proposal`, `Awaiting Founder confirmation`, o equivalente).
3. Es consistente con la arquitectura vigente, con ADRs `Accepted` y/o con el código implementado — no la contradice en ningún punto.

`Approved (inferred)` existe como etiqueta separada de `Approved` exactamente para que quien lea este documento sepa, sin ambigüedad, cuándo una capacidad está respaldada por una decisión explícita y cuándo está respaldada por la ausencia de señal en contra — que es evidencia razonable, pero más débil.

**Nota sobre "Draft":** `CONVERSATION_MANUAL_V1.md`, `ALPHA_PROGRAM_SPEC.md` y `LEARNING_PARTNERSHIP_POLICY.md` declaran explícitamente `Status: Draft`. Este documento trata `Draft` como más cercano a `Proposed` que a `Approved` — un borrador fundacional sigue siendo, por definición, una decisión no cerrada. Es una simplificación deliberada (colapsa dos estados de la fuente en uno de los cuatro de este documento), declarada aquí, no aplicada en silencio.

**Recomendación de gobernanza:** todo documento de arquitectura, producto, visión o investigación de LUZ debería declarar explícitamente un campo `Status` — por ejemplo, `Draft | Proposed | Approved | Deprecated | Superseded`. La ausencia de `Status` no debería seguir siendo un estado válido del repositorio: hoy obliga a cualquier lector, este documento incluido, a inferir la vigencia de un documento en vez de leerla directamente.

### 0.5 Inferencias metodológicas de esta auditoría

Todo lo que sigue es una decisión de criterio tomada durante esta síntesis — no un hecho que aparezca, tal cual, en ninguna fuente. Se listan explícitamente para que nada quede oculto dentro del cuerpo del documento. Ninguna es una decisión de producto; son lecturas razonables de evidencia incompleta, y cualquiera de ellas puede corregirse — si se corrige, debe corregirse aquí, no solo en el texto donde se aplica.

1. **Qué cuenta como "Implemented".** Se exige que una capacidad sea alcanzable desde un flujo real y produzca un efecto real — nunca que exista solamente un tipo o una interfaz sin implementación ni consumidores. Por esto, `core/context-engine`, `core/connectors` y buena parte de `core/knowledge-engine` se clasifican como `Approved`, `Approved (inferred)` o `Proposed` a pesar de que existe código real con esos nombres: el código existe, pero no hace nada todavía.
2. **`Approved (inferred)` para documentos de arquitectura sin `Status`.** La regla de la Sección 0.4 es, en sí misma, una inferencia de gobernanza — aplicada de forma consistente en todo el documento, nunca caso por caso.
3. **`Draft` tratado como más cercano a `Proposed` que a `Approved`.** Afecta directamente a `CONVERSATION_MANUAL_V1.md`: sus reglas ya implementadas en código (`context-builder`) se mantienen `Implemented`; sus reglas *no* implementadas (el orden estricto de descubrimiento, el seguimiento proactivo) se clasifican como `Proposed`, nunca `Approved`, por este criterio.
4. **`HUMAN_MODEL_V1.md` (12 dominios) tratado como el sucesor de `PERSON_MODEL.md` (10 dimensiones) y `LIFE_MODEL.md` (12 capas).** Ningún documento declara esta sucesión explícitamente. Se infiere de que `HUMAN_MODEL_V1.md` se autodenomina "v2.0, consolida v1.0 y v1.1" y es, con diferencia, el más desarrollado de los tres. Recomendación: declarar esta sucesión formalmente, no dejarla solo en este roadmap.
5. **El modelo de 8 etapas de `HUMAN_RELATIONSHIP_MODEL.md` tratado como canónico sobre el de 6 etapas de `concepts/RELATIONSHIP_MODEL.md`.** Mismo criterio que el punto anterior — más desarrollado, mejor evidenciado, directamente trazable a las palabras del Founder — pero ningún documento fuente declara al segundo superado.
6. **El listado de seis motores de `ENGINE_MANIFESTO.md` tratado como autoritativo sobre el listado de siete de `SYSTEM_ARCHITECTURE.md`** (que agrega un "Identity Engine" que no aparece en ningún otro lugar del corpus). Se prefirió `ENGINE_MANIFESTO.md` porque ADR-0011 (`Accepted`) lo cita directamente; `SYSTEM_ARCHITECTURE.md` no tiene ese respaldo. Ver Sección 8.2.
7. **Los documentos de una sola línea en `docs/architecture/`** (`TOOL_ENGINE_SPEC.md`, `MEMORY_ENGINE_SPEC.md`, y similares) se trataron como arquitectura oficial completa, no como notas incompletas — también una inferencia: son extremadamente breves, y es razonable preguntarse si capturan toda la decisión arquitectónica o si son solo un titular pendiente de desarrollar.
8. **`Approved (inferred)` nunca se aplicó a documentos de `docs/vision/` o `docs/foundations/`**, aunque algunos (`PRESENCE_PRINCIPLES.md`, `HUMAN_RELATIONSHIP_MODEL.md`) tengan tanto o más detalle que muchos documentos de `docs/architecture/`. La regla de la Sección 0.4 exige explícitamente que el documento pertenezca a la arquitectura oficial o sea citado por nombre por un ADR Accepted — ninguno de los dos aplica a Visión/Foundations por diseño. El resultado, señalado explícitamente donde ocurre (Sección 5.4 Presencia, Sección 4.3 Relaciones): capacidades con un desarrollo conceptual muy alto pueden quedar etiquetadas `Proposed` en vez de `Approved (inferred)`, simplemente porque nadie las elevó todavía de Visión a Arquitectura — eso es, en sí mismo, un hallazgo de la auditoría, no un defecto del método.
9. **`HUMAN_RELATIONSHIP_MODEL.md` es, en la práctica, el documento más elaborado y mejor evidenciado de todo el corpus — y aun así queda clasificado `Proposed` por esta regla**, mientras un documento de una sola línea como `TOOL_ENGINE_SPEC.md` (Sección 5.6) recibe `Approved (inferred)` solo por vivir en la carpeta correcta. Es una consecuencia directa, y algo incómoda, de clasificar por ubicación y `Status` en vez de por profundidad de desarrollo — se deja así, sin corregir por criterio subjetivo, porque el objetivo de este documento es trazabilidad mecánica y consistente, no un juicio caso por caso de "qué tan bueno es este doc". Recomendación de gobernanza: si `HUMAN_RELATIONSHIP_MODEL.md` ya funciona como referencia de facto (se cita en `CONVERSATION_MANUAL_V1.md` y en este mismo roadmap más que casi cualquier otro documento), vale la pena promoverlo formalmente a `docs/architecture/` o darle un ADR propio — no dejar que su autoridad real siga siendo mayor que su estado documental.

### 0.6 Tensiones entre madurez conceptual, ubicación documental y estado de gobernanza

La inferencia 9 de arriba no es un caso aislado — es un patrón. Esta sección lo cataloga completo, a propósito, en vez de dejarlo disperso dentro de cada dominio. Cada fila es un caso donde **qué tan bien pensado está algo**, **dónde vive el documento que lo describe**, y **qué autoridad formal tiene**, no apuntan en la misma dirección. Ninguno se resuelve aquí — se documentan para que la tensión sea visible, tal como se pidió.

| Caso | Madurez conceptual / de implementación | Ubicación | Estado de gobernanza | La tensión |
|---|---|---|---|---|
| `HUMAN_RELATIONSHIP_MODEL.md` | Muy alta — 12 secciones, evidenciado con las palabras del Founder, la fuente más citada de este mismo roadmap | `docs/foundations/` | Sin `Status` → `Proposed` (Sección 0.4) | El documento de facto más autoritativo del corpus recibe la clasificación más débil de las cuatro, solo por la carpeta en la que vive. |
| Specs de una sola línea (`TOOL_ENGINE_SPEC.md`, `MEMORY_ENGINE_SPEC.md`, `KNOWLEDGE_ENGINE_SPEC.md`, `LIFE_ORCHESTRATOR_SPEC.md`, `CONTEXT_ENGINE_SPEC.md`) | Mínima — una sola oración cada uno | `docs/architecture/` | Sin `Status` → `Approved (inferred)` | El caso espejo del anterior: la carpeta les da más autoridad formal que la que su propio contenido sostiene. |
| `PRESENCE_PRINCIPLES.md` | Muy alta — 9 comportamientos evaluables, cada uno con su propia pregunta de verificación | `docs/vision/` | Sin `Status` → `Proposed` | El diferenciador de producto más citado de todo el proyecto queda en el mismo nivel de gobernanza que una exploración de investigación con dos casos de evidencia. |
| ADR-0014 (Knowledge Engine Consolidation) | Alta — mapping detallado, fases, riesgos nombrados uno por uno | `docs/adr/` | `Status: Proposed` en su encabezado, pero autoriza explícitamente su propia Fase B en el cuerpo del texto | El documento se contradice a sí mismo: el encabezado dice "no decidido todavía", el cuerpo dice "esto ya se puede ejecutar". Ver también Sección 8.3. |
| ADR-0015 (Connector Architecture) vs. `core/connectors/connector.ts` | Implementación ya existe en código (una interfaz real) | `docs/adr/` (la decisión) / `core/` (el código) | `Status: Proposed` | La construcción, aunque mínima, corrió más rápido que la aprobación formal de la decisión que se supone la autoriza. Ver también Sección 8.3. |
| Hallazgo de investigación `PR1` (proteger el ritual relacional diario) | Muy alta *dentro de su propio sistema de gobernanza* — Nivel 3, con *cross-evidence* real, sin contraejemplos: el techo que `RESEARCH_METHODOLOGY_V1.md` permite alcanzar con la evidencia actual | `docs/research/` | `Proposed` frente al producto — no cruzó el portón explícito hacia `CONVERSATION_MANUAL_V1.md` (Sección 10 de la metodología de investigación) | Dos sistemas de gobernanza distintos (investigación vs. arquitectura de producto) no se traducen automáticamente el uno al otro. Es así por diseño — pero vale la pena que la fricción real quede visible, no solo la regla abstracta que la explica. |
| `core/knowledge-engine` (el motor nuevo de Conocimiento) | Media-alta — repositorio Drizzle real, clasificación determinística real, tablas ya migradas | `core/` | `Proposed` (ADR-0014) | Impacto real en producción hoy: **cero**, sin consumidores. Tres ejes, tres respuestas distintas — el caso más completo de desalineación de todo este documento. |
| `core/knowledge` (el pipeline legado de Conocimiento) | Baja — es la versión que ya se decidió reemplazar | `core/` | Sin elevación formal, simplemente "lo que ya había" | Impacto real en producción hoy: el más alto de los dos motores — es el que de verdad corre en cada mensaje, aunque falle. Lo que está cableado a producción y lo que está arquitectónicamente bien construido son, hoy, dos cosas distintas. |

**Observación de gobernanza:** la ubicación de un documento y su `Status` predicen su autoridad formal dentro del proyecto, pero no necesariamente su nivel de desarrollo conceptual, su grado de implementación, o su impacto en el producto. Durante esta auditoría se identificaron varios casos donde esos ejes evolucionaron a ritmos distintos — la tabla de arriba es el registro de esos casos, no una afirmación general sobre la calidad de ningún documento. La recomendación de la Sección 0.4 (campo `Status` obligatorio en todo documento) ataca la mitad del problema; la otra mitad —que la ubicación de un documento no siempre refleja su desarrollo o su impacto real— no tiene una solución mecánica, y se deja aquí como observación para el Founder, no como una decisión que este documento pueda tomar por sí solo.

---

## 1. Qué es LUZ, en una frase

> LUZ es un sistema de inteligencia personal que acompaña la vida de una persona a través del tiempo; no un chatbot que responde mensajes. La conversación es una de sus interfaces, la memoria es permanente, el contexto orienta su comportamiento y su propósito es ayudar a la persona a comprender mejor su vida, tomar mejores decisiones y desarrollar mayor autonomía con el tiempo, no maximizar el tiempo de uso.

*(Aprobada por el Founder — versión final tras revisión de §1–3.)*

Esta frase sintetiza, sin contradecirlas: `VISION.md` ("Human First, Context Before Answers, Long-Term Memory, Presence without Pressure"), `docs/foundations/FOUNDER_INTENT.md` ("para que ninguna persona tenga que sentirse sola y sin dirección... queremos la mejor versión de ti"), y `docs/vision/PRESENCE_PRINCIPLES.md` Principio 6 ("Care Without Dependency" — si la persona necesita LUZ *menos* con el tiempo, eso es éxito, no una métrica que bajó).

El objetivo declarado a largo plazo, en palabras del propio `VISION.md`: **"I live with LUZ."** No "uso LUZ". Convivo con LUZ.

---

## 2. Taxonomía propuesta — y por qué se reorganiza

El brief original lista dominios en un solo nivel: Conversación, Memoria, Conocimiento, Contexto, Proyectos, Personas, Objetivos, Hábitos, Rutinas, Calendario, Documentos, Herramientas, Presencia, Dashboard, Life Graph. Esa lista mezcla, sin decirlo, tres cosas de naturaleza distinta:

- **Cosas que existen en la vida de una persona** (Personas, Objetivos, Proyectos, Hábitos, Rutinas) — datos, no comportamiento.
- **Motores que interpretan esos datos** (Memoria, Conocimiento, Contexto, Presencia) — comportamiento, no datos propios.
- **Formas en que la persona interactúa** (Conversación, Dashboard) — interfaz, no dominio de negocio.

Esto no es una preferencia estética — es exactamente la distinción que la propia arquitectura de LUZ ya adoptó. La frase exacta **"no engine owns another engine"** viene de `ENGINE_MANIFESTO.md`, que no declara `Status` (`Approved (inferred)` por la Sección 0.4) — pero la sustancia de la regla sí está en documentos genuinamente `Accepted`: `ARCHITECTURE_DIAGRAM_V1.md` ("Memory, Knowledge and Context are independent engines... they are never members of the LifeGraph aggregate") y `DOMAIN_MODEL_V1.md` ("Memory, Knowledge and Context are not on this chain... they are never contained by the LifeGraph aggregate"), y es además la justificación explícita de una decisión `Accepted` real (ADR-0011, que se apoya en ella para no incluir Memoria/Conocimiento/Contexto dentro del agregado `LifeGraph`). El `LifeGraph` es el único agregado con límite de consistencia (`ARCHITECTURE_DIAGRAM_V1.md`, Accepted); Memoria, Conocimiento y Contexto son motores independientes que solo *leen* por `lifeGraphId`, nunca miembros del agregado. Tratar "Objetivos" y "Memoria" como dominios del mismo nivel, como hacía la lista original, oscurece esa distinción arquitectónica ya decidida.

**Taxonomía adoptada — tres niveles, más un corte transversal:**

- **Nivel 1 — La vida de la persona** (entidades que pertenece al `LifeGraph`): Life Graph (el contenedor), Persona, Relaciones, Objetivos y Proyectos, Hábitos y Rutinas, Eventos y Dominios de Vida.
- **Nivel 2 — Motores de inteligencia** (interpretan el Nivel 1 y la Conversación, nunca se poseen entre sí): Memoria, Conocimiento, Contexto, Presencia, Life Orchestrator, Herramientas y Conectores.
- **Nivel 3 — Interfaz** (cómo la persona realmente interactúa): Conversación, Dashboard / Morning Brief.
- **Transversal** (no son dominios con capacidades propias, son criterios de evaluación aplicados a todos los demás): Confianza, Identidad/Cuenta (infraestructura, deliberadamente fuera del dominio de negocio).

**Calendario y Documentos no son dominios de primer nivel** en esta propuesta — son categorías de *Herramientas y Conectores* (`TOOL_ENGINE_SPEC.md`, `Approved (inferred)`, los nombra literalmente así: "Calendar, Email, Documents, Search"). Tratarlos como dominios separados fragmentaría una abstracción de adaptador único que la arquitectura ya usa consistentemente para agruparlos — aunque vale precisar que el contrato específico de esa abstracción (`Connector`, ADR-0015) es todavía **Proposed**, no una decisión cerrada. Es decir: que Calendario/Email/Documentos deban agruparse bajo un mismo concepto de "herramienta externa" está bien establecido; la forma exacta de ese contrato, no.

**Hábito y Rutina se mantienen separados**, aunque a primera vista parezcan duplicados — no lo son. `DOMAIN_MODEL_V1.md` (Accepted) traza la distinción explícitamente: Hábito es comportamiento recurrente *declarado* por la persona; Rutina es un patrón recurrente *detectado por el sistema*. Fusionarlos perdería esa distinción a propósito.

### 2.1 Mapa de dominios (vista compacta)

Antes de entrar al detalle de cada dominio (Sección 4 en adelante), esta tabla responde una sola pregunta: **¿la división en 14 dominios es la correcta?** Cada fila lleva solo lo esencial — propósito, capacidades principales, madurez, de qué depende, y su relación con el resto del mapa.

| # | Dominio | Nivel | Propósito | Capacidades principales | Madurez | Depende de | Relación clave con otros dominios |
|---|---|---|---|---|---|---|---|
| 1 | Life Graph | 1 | Límite de tenencia — el contenedor | Bootstrap automático; (futuro) multi-miembro | Implemented (bootstrap) / Approved (compartido) | Nada — es la raíz | Contiene a todo el Nivel 1; Nivel 2 lo referencia por `lifeGraphId`, nunca lo posee |
| 2 | Persona | 1 | Modela seres humanos, no usuarios | Identidad básica; (futuro) Human Model evolutivo | Implemented (básico) / Proposed (Human Model) | Life Graph | Sujeto de Relaciones/Objetivos/Hábitos; el Human Model se alimentaría de Conocimiento |
| 3 | Relaciones | 1 | Vínculo Persona↔Persona y Persona↔LUZ | Entidad `Relationship`; 8 etapas de evolución; humor/celebración calibrados | Approved (entidad) / Proposed (modelo evolutivo, docs/foundations) | Persona | Las reglas de humor/celebración son, en la práctica, reglas de Conversación |
| 4 | Objetivos y Proyectos | 1 | Hacia dónde se mueve la persona | CRUD de Goal/Project; (futuro) representación de arco | Approved, sin persistencia | Life Graph | Bloquea, en cascada, Contexto/Dashboard/Life Orchestrator; genera Hábitos |
| 5 | Hábitos y Rutinas | 1 | Comportamiento recurrente: declarado vs. detectado | CRUD de Habit; detección automática de Routine | Approved, sin persistencia ni mecanismo de detección | Objetivos (parcial) + Conocimiento (para Rutinas) | Alimentaría Contexto (`life`) |
| 6 | Eventos y Dominios de Vida | 1 | Momentos puntuales + áreas continuas de vida | Registrar LifeEvent; seguimiento por LifeDomain | Approved, sin persistencia | Life Graph | Alimentaría Memoria y Contexto |
| 7 | Memoria | 2 | Evidencia — "qué pasó" | Captura, rank, connect, retrieval estructurado; (futuro) semántico | **Implemented** (la mayoría) | Conversación | Alimenta Contexto y Conocimiento — nunca al revés |
| 8 | Conocimiento | 2 | Significado — "qué significa" | Interpretar memoria en Insights validados | Approved (inferred) la responsabilidad; **roto en producción** el pipeline conectado; Proposed el motor nuevo | Memoria + Reality Snapshot | Alimentaría el Human Model; detectaría Rutinas |
| 9 | Contexto | 2 | Qué es más relevante ahora | 6 reglas conversacionales deterministas; Reality Snapshot | **Implemented**, simplificado (2/3 de Reality Snapshot vacío) | Memoria (real) + Objetivos/Hábitos (para enriquecerse) | Input directo y único de Presencia |
| 10 | Presencia | 2 | Cuándo hablar, cuándo callar | Silencio intencional; intervención oportuna | Approved (que exista) / Proposed (cada comportamiento, docs/vision) | Contexto enriquecido + Conocimiento | El motor más dependiente de todos los demás — no se puede construir primero |
| 11 | Life Orchestrator | 2 | Coordinar acciones hacia intenciones | Recomendaciones, planes, acciones | Approved (inferred), cero código, ni scaffold | Objetivos/Proyectos + Contexto + Conocimiento | Ejecuta a través de Herramientas |
| 12 | Herramientas y Conectores | 2 | Adaptadores hacia sistemas externos | Contrato `Connector`; Gmail/Calendar/Documentos (ninguno implementado) | Approved (inferred) el concepto / Proposed el contrato / Future cada conector | Nada técnicamente | Alimenta `RealitySnapshot.signals` — nunca se acopla directo a otro engine |
| 13 | Conversación | 3 | Dar voz — la interfaz, no la fuente de verdad | Streaming, historial, títulos automáticos, borradores, rate limiting | **Implemented**, mayormente, y pulido | Memoria + Contexto | Genera Memoria en cada mensaje — el punto de entrada de casi todo el sistema |
| 14 | Dashboard / Morning Brief | 3 | Punto de entrada tras el login | Resumen de actividad; línea de continuidad real | **Implemented**, parcial (life line siempre vacía) | Memoria + Reality Snapshot | Consume casi todo lo demás; no genera nada nuevo él mismo |

*(Confianza e Identidad/Cuenta no aparecen aquí — son transversales, sin capacidades propias, ver Sección 7.)*

### 2.2 Acoplamiento — ¿algo debería fusionarse?

Evalué los tres pares que propusiste, y busqué otros por mi cuenta. Conclusión corta: **no encontré ningún par que deba fusionarse como dominio de producto** — pero dos de los tres casos revelan una relación que hoy está subespecificada, y vale la pena resolver eso en vez de fusionar.

- **Objetivos + Hábitos — no fusionar.** Responden preguntas distintas: Objetivos es "¿hacia dónde vas?", Hábitos es "¿qué haces repetidamente?". `DOMAIN_MODEL_V1.md` (Accepted) ya los modela como cuatro entidades distintas (Goal, Project, Habit, Routine), no dos. Lo que sí vale la pena hacer explícito: la relación "un Objetivo puede generar un Hábito" existe en el texto de este documento pero no en ningún esquema — hoy es una intención de producto, no una relación modelada.
- **Proyectos + Documentos — no fusionar, y en realidad ni siquiera son comparables en el mismo nivel.** Documentos no es un dominio en esta taxonomía — es una categoría de Herramientas/Conectores (Nivel 2, adaptador), mientras Proyectos es una entidad de Life Graph (Nivel 1, dato). Fusionarlos mezclaría una entidad con un adaptador de infraestructura. Lo que sí tiene sentido: que un Proyecto pueda *referenciar* Documentos ingeridos — una relación explícita, no una fusión de dominios.
- **Presencia + Contexto — no fusionar, es el caso más cercano a tener razón, pero por una razón distinta a la que parece.** `ENGINE_MANIFESTO.md` les asigna responsabilidades deliberadamente distintas y no solapadas: Contexto responde "¿qué es cierto ahora?", Presencia responde "¿debo decir algo, y cuándo?" — la primera reporta, la segunda decide. Fusionarlas perdería esa separación de responsabilidad (la misma regla de "un engine, una responsabilidad" que ya justifica toda la Sección 2). **Lo que sí es cierto, y es probablemente la intuición real detrás de tu pregunta:** hoy, en la práctica, son *el mismo problema visto desde dos ángulos de madurez* — Contexto está parcialmente implementado, Presencia no tiene nada, y Presencia no puede avanzar sin que Contexto madure primero. Esto es una relación de **secuencia**, no de **identidad** — ver 2.3.

No encontré, buscando por mi cuenta, ningún otro par con una razón real para fusionarse. El candidato más cercano que consideré y descarté: Memoria + Conocimiento — pero esa es, con diferencia, la distinción mejor evidenciada y más defendida de todo el corpus (`KNOWLEDGE_MODEL.md`, ADR-0012, ADR-0014, dos migration plans completos) — fusionarlas iría directamente en contra de trabajo arquitectónico ya decidido.

### 2.3 Dependencias — ¿hay ciclos, o solo una fila de dominós?

**No encontré ninguna dependencia circular real** (ningún dominio A que necesite a B para existir, mientras B necesita a A). Lo que sí encontré es más importante para secuenciar el roadmap que un ciclo lo sería — y vale la pena decirlo con la misma precisión con la que se identificó:

> **El cuello de botella no está en Memoria ni en IA. Está en que la vida del usuario todavía no está persistida.** Mientras Objetivos, Proyectos y Hábitos no existan como datos reales, muchos dominios superiores solo pueden operar con conversaciones.

Es, probablemente, el hallazgo estructural más importante de todo este documento — explica *por qué* varias capacidades no pueden desplegar su potencial todavía, no solo *que* no lo hacen. En términos del mapa: **un único cuello de botella del que dependen, directa o indirectamente, seis de los otros trece dominios.**

```
Life Graph (raíz, ya real)
   ↓
Objetivos/Proyectos/Hábitos — SIN PERSISTENCIA HOY
   ↓                                    ↓
Contexto (life vacío)          Dashboard (life line vacía)
   ↓                                    
Conocimiento (interpreta mejor con vida real)
   ↓
Presencia · Life Orchestrator — no pueden construirse con sentido antes de esto
```

Objetivos/Proyectos/Hábitos no depende técnicamente de ningún otro dominio para existir (es CRUD simple sobre entidades ya modeladas) — pero es la dependencia silenciosa detrás de Contexto enriquecido, Dashboard con contenido real, Conocimiento con mejor materia prima, y — más adelante — Life Orchestrator y Presencia. Esto confirma, desde un ángulo distinto, la misma prioridad P0/Beta que ya tenía en la Sección 12: no es solo "la feature más pedida", es **el desbloqueo de mayor apalancamiento estructural de todo el mapa de dominios.**

El único caso de **retroalimentación real** (no confundir con ciclo de dependencia de construcción) es el que ya describe la Sección 9: Conversación → Memoria → Contexto → Presencia → (mensaje proactivo) → Conversación. Es un ciclo de *operación en producción*, deliberado y sano — no un ciclo de *orden de construcción*. Los dos no deben confundirse: el primero bloquearía el roadmap, el segundo es exactamente cómo se supone que el sistema respire una vez que todas las piezas existen.

### 2.4 Capacidad diferenciadora vs. tabla stakes

| Diferenciador real de LUZ | Por qué |
|---|---|
| **Presencia** | Casi ningún asistente de IA decide activamente *cuándo callar* — la mayoría solo decide qué responder. Es el diferenciador declarado desde ADR-0005 y el que menos existe hoy. |
| **Memoria con ranking relacional** | Ya verificado en código: el tipo de memoria no determina su valor, la relación sí. La mayoría de la competencia rankea por recencia o coincidencia semántica simple. |
| **Relaciones (el modelo de 8 etapas, humor calibrado, celebración de arcos)** | Casi nadie modela la relación persona↔IA como algo que madura de verdad — la mayoría trata cada sesión como si empezara de cero, o simula cercanía sin ganársela. |
| **Objetivos/Proyectos como arco, no como tracker** | La mayoría de los asistentes de productividad trackean tareas. Reconocer el *cierre de un arco* (un maratón, una búsqueda de empleo) como el momento de mayor valor es una apuesta de producto específica de LUZ, con origen directo en las palabras del Founder. |
| **Conocimiento explicable, basado en evidencia** | *Si funcionara* (hoy no funciona) — un Insight siempre trazable a su evidencia es diferente de la mayoría de sistemas de "memoria con IA" que no pueden explicar por qué creen algo. |
| **La vida como fuente de verdad, no la conversación** | La arquitectura completa (Life Graph, Reality Snapshot) apuesta por modelar la vida real de la persona, no solo el historial de chat — la mayoría de la competencia sí modela solo el historial de chat. |

| Esperado en cualquier asistente moderno (tabla stakes) | Por qué |
|---|---|
| **Conversación** (streaming, historial, búsqueda) | Estándar de la industria desde hace tiempo — necesario, pero no diferenciador por sí solo. |
| **Dashboard** | Cualquier producto SaaS tiene un punto de entrada con resumen. |
| **Herramientas y Conectores** (Gmail, Calendar) | La mayoría de los asistentes de IA ya integran correo y calendario — la ejecución importa, pero la idea en sí no diferencia. |
| **Hábitos/Rutinas, capacidad base** | Existen decenas de apps de seguimiento de hábitos — la parte diferenciadora no es trackear el hábito, es lo que LUZ hace con esa información dentro del modelo relacional. |

**Zona ambigua, vale la pena decidir con intención:** Life Orchestrator y Contexto. Coordinar tareas/planes existe en muchos productos (Notion AI y similares) — lo que sería diferenciador es la promesa específica de "optimizar intenciones, no tareas" (`INTENT_MODEL.md`), no la coordinación en sí. Contexto es, hoy, más infraestructura que producto visible — pero su profundidad futura (vida + memoria + señales externas fusionadas) podría convertirse en diferenciador si nadie más lo hace tan bien.

### 2.5 Segunda dimensión: rol funcional dentro del sistema

Los niveles (Sección 2, arriba) responden **"¿en qué capa vive este dominio?"**. Esta dimensión, ortogonal a esa, responde **"¿qué papel cumple?"** — cuatro roles: **Fuente** (representa la realidad de la persona, existiría aunque LUZ no estuviera), **Comprensión** (transforma esa realidad en entendimiento), **Interacción** (usa esa comprensión para que la persona la experimente — nunca genera verdad nueva) e **Integración** (conecta con el mundo exterior). No reemplaza los niveles — los complementa, y al aplicarla encontré tres cosas que la vista de niveles por sí sola no dejaba ver.

| Dominio | Nivel | Rol funcional |
|---|---|---|
| Life Graph | 1 | **Ninguno de los cuatro** — ver nota |
| Persona | 1 | Fuente |
| Relaciones | 1 | Fuente **+** Comprensión — dominio dividido, ver nota |
| Objetivos y Proyectos | 1 | Fuente |
| Hábitos y Rutinas | 1 | Fuente (Hábito) **+** Comprensión (Rutina) — dominio dividido, ver nota |
| Eventos y Dominios de Vida | 1 | Fuente |
| Memoria | 2 | Comprensión |
| Conocimiento | 2 | Comprensión |
| Contexto | 2 | Comprensión |
| Presencia | 2 | Interacción |
| Life Orchestrator | 2 | Interacción |
| Herramientas y Conectores | 2 | Integración — con una nota sobre Documentos, ver abajo |
| Conversación | 3 | Interacción |
| Dashboard / Morning Brief | 3 | Interacción |

**Tres hallazgos que esta dimensión saca a la luz, que la vista de niveles no mostraba:**

1. **Relaciones es, en realidad, dos cosas distintas bajo un mismo nombre.** La entidad `Relationship` (quién está conectado con quién) es pura Fuente — un dato que existiría aunque LUZ no estuviera. Pero el modelo evolutivo Persona↔LUZ (las 8 etapas, el humor calibrado, la confianza que se gana y se pierde) no es un dato — es una construcción de comprensión, del mismo tipo que el Human Model. Están en la misma sección (4.3) por conveniencia narrativa, no porque sean el mismo tipo de cosa. No se dividen en dos dominios separados todavía — no existe implementación suficiente para justificarlo, dado que ninguna de las dos mitades tiene código — pero queda registrada como **nota metodológica**, no solo como observación de paso: **el término "Relationship" es hoy polisémico dentro del corpus de LUZ.** En futuras iteraciones, cuando cualquiera de las dos mitades empiece a tener implementación real, conviene evaluar explícitamente si deben separarse en dos dominios — no es un problema hoy, es una deuda conceptual identificada.
2. **Hábito y Rutina no solo se declaran distinto (Sección 4.5) — representan dos direcciones opuestas del flujo de conocimiento**, y esta es, probablemente, una de las decisiones conceptuales más importantes que este documento hace explícita. Hábito es la persona **declarando o registrando** un comportamiento — entra al sistema desde afuera. Rutina es LUZ **infiriendo un patrón a partir de evidencia acumulada** — sale del sistema hacia adentro. Rutina, por lo tanto, no es un dato primario: **es conocimiento emergente**, funcionalmente un producto de Conocimiento, del mismo tipo de cosa que un `Insight` (Sección 5.2), no un registro que alguien declaró. Esto tiene una consecuencia real para el motor de Conocimiento: cuando `core/knowledge-engine` empiece a producir resultados de verdad, "detectar una Rutina" debería diseñarse como una forma más de lo que Conocimiento ya hace (interpretar evidencia en significado validado), no como un mecanismo aparte. Se deja anotado también en la Sección 5.2.
3. **Documentos no es, en el fondo, un problema de "no tener un lugar limpio" dentro de Integración — es un dominio en potencia que hoy no tiene entidad propia.** El dominio real no es Google Drive, ni un PDF, ni el mecanismo que lo trae — es **el conocimiento documental persistido de la vida de la persona**: sus notas, sus archivos, lo que escribió. Un Conector (Google Drive, un uploader) es únicamente el mecanismo para incorporar ese contenido, del mismo modo que Gmail es el mecanismo para incorporar señales de correo, nunca el dominio en sí. Cuando ese dominio madure, lo más probable es que **conviva junto a Integración, no dentro de ella** — como un dominio de Nivel 1 (Fuente) propio, alimentado por un Conector, igual que Objetivos/Hábitos son Fuente aunque en el futuro se enriquezcan vía Conectores externos. No se cambia nada de la taxonomía ahora — la tabla `documents` sigue completamente dormida (Sección 8.7) — pero se deja explícitamente abierta esa posibilidad, en vez de asumir que Documentos pertenece funcionalmente a Integración.

**Lo que esta dimensión no encuentra:** ningún caso donde Nivel y Rol se contradigan de forma que obligue a reorganizar la Sección 2 — los 14 dominios y los 3 niveles se mantienen. Por eso esta sección se agrega como una lente adicional (2.5), no como un reemplazo de la Sección 2.1.

**Sobre `Life Graph`:** no encaja en ninguno de los cuatro roles, y no lo fuerzo a encajar. No es Fuente (no contiene hechos sobre la vida de la persona, es el límite que los contiene), no es Comprensión, Interacción ni Integración. Es **infraestructura de dominio** — no un dominio funcional más, sino el sustrato sobre el que existen todos los demás. Intentar clasificarlo junto a Objetivos, Memoria o Conversación haría el modelo menos claro, no más — es el único de los catorce sin contraparte en esta segunda dimensión, porque su función es distinta en naturaleza a la de los otros trece: existir para que los demás puedan existir de forma aislada y segura por persona.

---

## 3. Principios rectores (síntesis, no repetición)

Estos ocho principios gobiernan cada decisión de este roadmap. No se repiten los documentos fuente completos — están citados para quien necesite el detalle.

1. **Presencia, sin presión.** LUZ nunca fabrica urgencia, culpa o FOMO para traer a alguien de vuelta. (`PRESENCE_PRINCIPLES.md` §9, `DESIGN_PHILOSOPHY.md`)
2. **La relación es el producto, no la conversación.** El éxito se mide en años, no en sesiones. (`HUMAN_RELATIONSHIP_MODEL.md`)
3. **La vida es la fuente de verdad, no la conversación.** Las conversaciones son observaciones de la vida, nunca la vida misma. (`LIFE_MODEL.md`, ADR-0008)
4. **La inteligencia de LUZ es propia, nunca prestada de un modelo.** Lo que LUZ sabe de una persona no debe depender de qué proveedor de IA responde en un momento dado — el modelo subyacente puede cambiar sin que cambie quién es LUZ para esa persona. (`INTELLIGENCE_MODEL.md`) — *reformulado respecto a la fuente: "El LLM es reemplazable, el sistema de inteligencia no" describe además una arquitectura concreta (el stack Vision→Presence→Context→Memory→Knowledge→Reasoning→Planning→Execution) que sí podría cambiar en una reescritura futura. Lo que debe seguir siendo verdad dentro de diez años no es esa arquitectura específica, sino que la inteligencia sea de LUZ y no del modelo — eso es lo que queda aquí.*
5. **Cada característica puede cambiar.** Ninguna caracterización sobre una persona es permanente. Una contradicción nunca se resuelve instantáneamente a favor de lo nuevo ni de lo viejo — la incertidumbre genuina debe poder sostenerse hasta que se confirme un cambio real. (`HUMAN_MODEL_V1.md` §5 — Proposed, pero el principio en sí ya es coherente con toda la cadena de visión) — *reformulado: la fuente describe un mecanismo concreto (el estado `Under Revision` de una máquina de estados específica); lo que debe seguir siendo verdad en diez años es el compromiso de no sobrescribir contradicciones a la ligera, no ese mecanismo en particular.*
6. **Cuidado sin dependencia.** Si una función funcionara perfecto y la persona necesitara LUZ *menos* con el tiempo, eso debe verse como éxito dentro del producto — no como una métrica que bajó. (`PRESENCE_PRINCIPLES.md` §6)
7. **La comprensión precede a la clasificación.** Cuando entran en tensión, gana entender a la persona, aunque sea más difícil de construir. (`HUMAN_MODEL_V1.md` §2 — Proposed, mismo criterio que el principio 5: no es una decisión de arquitectura cerrada, pero es coherente con toda la cadena de visión.)
8. **Cada capacidad debe fortalecer la relación entre la persona y LUZ — pero LUZ nunca debe sustituir las relaciones humanas reales de esa persona.** Son dos cosas distintas: fortalecer el vínculo Persona↔LUZ (`RELATIONSHIP_MODEL.md`) no es lo mismo que reemplazar los vínculos humanos que ya tiene (`HUMAN_RELATIONSHIP_MODEL.md` §4 — *"LUZ never tries to replace a person's important relationships"*). La redacción anterior de este principio las mezclaba de forma confusa; se separan aquí.

---

## 4. Dominios — Nivel 1: La vida de la persona

**El Nivel 1 se revisa aquí como un solo sistema, no como seis dominios independientes.** El roadmap completo sigue un recorrido de cuatro pasos — la vida existe, LUZ la modela, LUZ la comprende, LUZ actúa sobre esa comprensión — y ese recorrido coincide, casi exactamente, con los tres niveles de la Sección 2. El Nivel 1 es el primer paso, y sostiene a los otros tres: **LUZ no se construye empezando por la inteligencia. Se construye empezando por representar correctamente la vida de la persona.** Esta idea no se agrega como un noveno principio rector (Sección 3) a propósito — no es una invariante de comportamiento hacia la persona como los otros ocho, es una prioridad de construcción: describe en qué orden se justifica invertir esfuerzo de ingeniería, no cómo debe comportarse LUZ dentro de diez años. Pertenece aquí, como la tesis de esta sección, no allá.

Para cada uno de los seis dominios se responden cuatro preguntas — verdad que representa, quién puede modificarla, quién la consume, y qué queda bloqueado si no existe — y una quinta, más exigente: **¿por qué esta verdad necesita una entidad explícita, en vez de inferirse de las conversaciones cada vez que hace falta?** Si la única respuesta disponible es "está en el modelo de dominio", la entidad todavía no está suficientemente definida — y este documento lo dice cuando ocurre, en vez de callarlo.

| Dominio | Verdad que representa | Quién la modifica | Quién la consume | Qué se bloquea sin él |
|---|---|---|---|---|
| Life Graph | El límite de tenencia — qué pertenece a la misma vida compartida | Solo el sistema (bootstrap automático en el primer login) | Los otros 13 dominios, como clave de scoping (`lifeGraphId`) | Todo — es la raíz; nada más puede existir de forma aislada y segura por persona |
| Persona | Que un ser humano específico existe y es miembro de un `LifeGraph` | El sistema (identidad básica, vía la Cuenta vinculada); en el futuro, solo Conocimiento escribiría el Human Model — nunca la persona directamente, ni siquiera cuando exista | Relaciones, Objetivos, Hábitos, Eventos (todos se atribuyen a una Persona); Memoria y Conocimiento la referencian | Todo lo demás del Nivel 1 — ninguna otra entidad tiene a quién atribuirse |
| Relaciones | Quién está conectado con quién (mitad Fuente) **+** cómo evoluciona el vínculo Persona↔LUZ (mitad Comprensión — ver la nota de polisemia en Sección 2.5) | La persona (mitad Fuente, hoy sin implementar) / únicamente el sistema (mitad Comprensión, es un estado calculado, no declarado) | El Human Model (dominio Relationships); la Conversación (tono, calibración de humor) | Relativamente poco hoy — ver el análisis "¿es fundacional?" más abajo |
| Objetivos y Proyectos | Hacia dónde se dirige intencionalmente la persona — no solo lo que hace, lo que quiere que pase | La persona (declara); el sistema podría, más adelante, sugerir el cierre de un arco | Contexto (`life`), Dashboard, Life Orchestrator, Hábitos (un Objetivo puede generar un Hábito) | Contexto enriquecido, Dashboard con contenido real, Life Orchestrator — el cuello de botella ya confirmado en la Sección 2.3 |
| Hábitos y Rutinas | Comportamiento recurrente declarado (Hábito) **o** inferido (Rutina — ver Sección 2.5) | La persona (Hábito) / únicamente el sistema (Rutina) | Contexto (`life`); Conocimiento (Hábito como posible insumo, Rutina como su propia salida) | Contexto, parcialmente — con menor apalancamiento estructural que Objetivos |
| Eventos y Dominios de Vida | Que algo ocurrió en un momento específico (Evento) / una categoría continua de vida (Dominio) | Ambiguo en ambos casos — ninguna fuente lo especifica, ver análisis abajo | En el diseño, Memoria y Contexto; en la práctica, ningún flujo real las consume hoy | Nada identificable — ver análisis abajo |

**Por qué cada entidad necesita existir explícitamente — dominio por dominio:**

- **Life Graph pasa la prueba con holgura.** No es una entidad "de hechos sobre la vida" como las demás — es un límite de seguridad. No podría inferirse de conversaciones porque su función es precisamente estructural: sin un límite de tenencia explícito no hay forma de garantizar que los datos de una persona nunca se mezclen con los de otra. Es, además, la corrección directa de un problema real que existía antes de ADR-0011 (una sola Persona cargando dos responsabilidades incompatibles a la vez).
- **Persona pasa la prueba.** El punto de `PERSON_MODEL.md` ("LUZ models people, not users") es exactamente esto: una Persona debe poder existir en el dominio de negocio sin depender de cómo alguien inició sesión hoy — Google ahora, quizás otro proveedor después. Sin esa entidad, identidad de negocio e identidad de infraestructura se conflarían de nuevo, el problema que ADR-0009 ya corrigió una vez.
- **Objetivos y Proyectos es, con diferencia, el ejemplo más claro de por qué modelar explícitamente en vez de inferir.** ¿Por qué no simplemente inferir "Juan quiere correr una maratón" de la conversación cada vez que haga falta? Porque el momento de mayor valor que LUZ puede producir, en palabras del propio Founder, es reconocer el **cierre** de un arco — y no se puede cerrar algo que nunca se marcó como abierto. Una inferencia recalculada en cada conversación no tiene memoria de que ese objetivo empezó hace cuatro meses. Hace falta una identidad estable en el tiempo, no una entidad semántica flotante.
- **Hábitos y Rutinas pasa la prueba, pero por dos caminos distintos.** Hábito: la diferencia entre "Juan mencionó una vez que corre" y "Juan tiene declarado el hábito de correr" es la diferencia entre un dato efímero de conversación y algo que LUZ puede usar de forma consistente para notar cuando el patrón **se rompe** — que es, según la investigación ya recolectada (PE1a/PE1b), la señal realmente valiosa. Sin una línea base persistente, no hay contra qué notar el cambio. Rutina invierte la pregunta: ya es una inferencia por definición — lo que hace falta justificar no es "por qué inferirla" sino "por qué persistirla una vez inferida", y la respuesta es la misma que en Memoria: sin persistencia, LUZ tendría que re-detectar el mismo patrón desde cero cada vez, que es lo opuesto exacto de memoria activa (Principio 2, `PRESENCE_PRINCIPLES.md`).
- **Relaciones pasa la prueba, con una condición.** Podría, en teoría, inferirse "Juan está en pareja con Verónica" de las conversaciones sin una entidad explícita — pero el trato que la Sección 4.3 describe (proteger el ritual diario sin comentarlo, calibrar humor por etapa, no ofrecer opiniones no solicitadas en cierta etapa) exige *saber con confianza* que la relación existe y en qué etapa está, de forma consistente durante meses. Una inferencia flotante recalculada en cada conversación no sostiene ese tipo de comportamiento. Pasa la prueba — pero, como muestra la tabla de arriba, hoy casi nada depende de que exista, así que pasar la prueba conceptual no lo vuelve urgente.
- **Eventos de Vida no pasa la prueba con la misma claridad — y hay que decirlo.** ¿Por qué necesita `core/life` una entidad `LifeEvent` separada, si Memoria ya tiene un tipo `Event` entre sus ocho tipos (Sección 5.1) que captura algo muy similar? No encontré, en ninguna fuente revisada, una justificación de por qué ambas deben coexistir como cosas distintas — solo que ambas existen en el modelo de dominio. Es exactamente el caso que se pidió señalar cuando aparezca: **la existencia de `LifeEvent` como entidad separada de `Memory.Event` todavía no está suficientemente justificada.** No se resuelve aquí — se deja nombrado como una pregunta abierta real, no como un hallazgo menor.
- **Dominios de Vida (`LifeDomain`) es, de las ocho y pico entidades del Nivel 1, la que menos puede justificar su existencia hoy.** Es, en la práctica, un enum sin ningún consumidor real, sin ningún caso de uso documentado en ninguna fuente, y sin que ningún documento explique por qué necesita ser una entidad de primer nivel del Life Graph en vez de, por ejemplo, una categoría dentro de Objetivos o Memoria. A diferencia de `LifeEvent` (que al menos compite conceptualmente con `Memory.Event`), `LifeDomain` no tiene ni siquiera un competidor claro — solo no tiene trabajo que hacer todavía. Se mantiene en la taxonomía (Sección 2) porque `DOMAIN_MODEL_V1.md` lo declara Accepted, pero su justificación de producto, no solo su justificación arquitectónica, sigue pendiente.

**¿Cuáles son realmente fundacionales, y cuáles pueden esperar sin afectar al resto?** Solo uno de los seis domina el resto: **Objetivos y Proyectos** es el único bloqueador estructural real (Sección 2.3) — Contexto, Dashboard, Conocimiento (indirectamente) y Life Orchestrator dependen, en cadena, de que exista. **Hábitos** depende parcialmente de lo mismo, pero con menor apalancamiento — Contexto se enriquece con él, pero nada más queda bloqueado si se retrasa. **Life Graph** y **Persona** ya son reales — no son una decisión pendiente. **Relaciones** y **Eventos y Dominios de Vida** pueden posponerse sin ningún efecto medible sobre el resto del roadmap: no son bloqueadores, y en el caso de Eventos/Dominios de Vida, ni siquiera está resuelto todavía qué problema real resuelven que Memoria no resuelva ya.

---

### 4.1 Life Graph

**Propósito.** El límite de consistencia y tenencia del sistema — no es una feature que la persona use directamente, es el contenedor sobre el que todo lo demás se apoya. Resuelve el problema de que una sola Persona no puede ser, a la vez, "un ser humano" y "el límite de propiedad de todo un grafo" — eso se rompe en cuanto un grafo se comparte (familia, organización). (ADR-0011, Accepted)

**Capacidades**
- Bootstrap automático de `LifeGraph` + `Person` propietaria en el primer login, sin que la persona lo perciba como un paso separado. **[Implemented]** — PR-001–006, M1.
- Resolución de identidad: una Cuenta (infraestructura) siempre resuelve a exactamente un `LifeGraph` por sesión. **[Implemented]**
- Invitar a otros miembros a un `LifeGraph` compartido (familia). **[Approved]** — el modelo de dominio ya soporta "member, uno designado owner"; no hay flujo de invitación ni UI.
- Transferencia de propiedad, roles más allá de owner/member. **[Future]** — `ADR-0011` lo nombra explícitamente como fuera de alcance hasta que haga falta.

**Entidades:** `LifeGraph` (id, miembros, owner).

**Relaciones:** contiene a Persona, Objetivo, Proyecto, Hábito, Rutina, Evento de Vida, Dominio de Vida. Memoria, Conocimiento y Contexto lo referencian por `lifeGraphId` pero **nunca son miembros del agregado** — regla dura, repetida en `ENGINE_MANIFESTO.md`, `ARCHITECTURE_DIAGRAM_V1.md` y `ADR-0011`.

**Caso de uso:** Juan se registra con Google. Sin ningún paso adicional visible, ya tiene un `LifeGraph` propio y es su miembro `owner`.

**Prioridad:** Alpha — ya real y es la base de todo lo demás.

---

### 4.2 Persona

**Propósito.** Modelar seres humanos, no usuarios de software. *"LUZ models people, not users"* (`PERSON_MODEL.md`). La autenticación pertenece a infraestructura; la Persona pertenece al dominio de negocio.

**Capacidades**
- Identidad básica (nombre, email vía la Cuenta vinculada, membresía en un `LifeGraph`). **[Implemented]**
- Comprensión evolutiva de quién es la persona — el "Human Model": doce dominios de caracterización (Identidad, Comunicación, Valores, Historia de vida, Relaciones, Salud, Trabajo, Hábitos, Objetivos, Patrones emocionales, Preferencias, Crecimiento), cada característica con confianza gradual, evidencia trazable y estado de revisión (`Unformed → Emerging → Established → Reinforced → Under Revision → Superseded`). **[Proposed]** — `HUMAN_MODEL_V1.md` se autodeclara explícitamente "no autoriza su propia implementación."

**Entidades:** `Person` (real, persistida); *Human Model characterization* (propuesta, no persistida — no confundir con `Person`: la Persona es la entidad, el Human Model es la comprensión evolutiva *sobre* esa entidad, y nunca debe duplicar lo que Memoria o Conocimiento ya guardan).

**Relaciones:** miembro de un `LifeGraph`; sujeto de Relaciones, Objetivos, Hábitos; el Human Model (si se construye) se alimentaría de Conocimiento — nunca directamente de Memoria ni de la Conversación, bajo la alternativa de diseño que el propio documento deja como default sin decidir formalmente.

**Caso de uso hoy:** "Persona" es, en la práctica, solo el nombre y el email de quien inició sesión. No existe todavía ninguna característica aprendida sobre quién es esa persona más allá de eso.

**Prioridad:** Alpha (entidad base) / V1 (Human Model, sujeto a que el Founder decida autorizar su implementación).

---

### 4.3 Relaciones

**Propósito.** Doble: (a) el vínculo entre dos miembros de un `LifeGraph`, y (b) — el uso más desarrollado en la documentación — el vínculo entre la Persona y LUZ misma.

**Capacidades**
- Persistir una `Relationship` entre dos `Person` dentro de un `LifeGraph`. **[Approved]** — la entidad existe en el dominio (`DOMAIN_MODEL_V1.md`, Accepted) pero no tiene repositorio Drizzle; no puede crearse ni consultarse hoy.
- Reconocer y proteger, sin comentarlo, un ritual relacional diario (p. ej. una llamada diaria con una pareja) — nunca mencionar su ausencia salvo que la persona lo mencione primero. **[Proposed]** — hallazgo de investigación de Nivel 3 (`PR1`, con *cross-evidence* real de dos testimonios independientes), redactado como propuesta formal a `CONVERSATION_MANUAL_V1.md`, **pendiente de decisión del Founder, no aplicado.**
- Ocho etapas de evolución de la relación Persona↔LUZ (`Strangers → First Encounter → Acquaintance → Trust → Companionship → Presence → Shared History → Life Accompaniment`), cada una con qué siente la persona, qué sabe LUZ, qué NO debe hacer todavía, y cómo se sabe que puede avanzar. **[Proposed]** — `foundations/HUMAN_RELATIONSHIP_MODEL.md` no declara `Status` y vive en `docs/foundations/`, no en `docs/architecture/`, así que **no cumple la condición 1 de la Sección 0.4** y no recibe `Approved (inferred)` — mismo criterio que Presencia (Sección 5.4, inferencia 8 de la Sección 0.5), aplicado con consistencia aunque este documento sea, con diferencia, el más elaborado y evidenciado de todo el corpus. Cero código lo implementa todavía.
- Humor calibrado por etapa de la relación — nunca un "modo" que se activa, sino una respuesta ganada por entender a alguien lo suficiente. **[Proposed]** (mismo documento, mismo criterio) — con una brecha nombrada explícitamente: `PERSONALITY_SPEC.md` (el doc "oficial" de personalidad) no menciona el humor en absoluto.
- Celebrar el crecimiento humano detrás de un logro, no la tarea completada — proporcional, nunca genérica. **[Proposed]** (mismo documento, mismo criterio)
- "Journey" como la unidad emocional real de la relación (dejar una adicción, entrenar una maratón, buscar trabajo) — con inicio, arco, retrocesos y cierre — por encima de un Objetivo o Proyecto individual. **[Proposed]** — el propio documento fuente dice explícitamente: *"esto no propone cómo debería representarse, rastrearse o construirse — es una pregunta de arquitectura para después."*

**Entidades:** `Relationship` (entre dos `Person`); *Journey* (propuesta, sin modelar).

**Relaciones:** pertenece al `LifeGraph`; alimentaría al Human Model (dominio Relationships); las reglas de honestidad/humor/celebración son, en última instancia, reglas de Conversación.

**Caso de uso (aspiracional):** LUZ nunca comenta que Juan David no mencionó su llamada diaria con Verónica esta semana — hasta que, si alguna vez lo hace, decide con cuidado si vale la pena decir algo.

**Prioridad:** Future (entidad `Relationship` entre Personas — nadie la está pidiendo activamente en Alpha) / V1-Future (el modelo evolutivo Persona↔LUZ — documentado en profundidad, sin ninguna decisión de arquitectura tomada todavía).

---

### 4.4 Objetivos y Proyectos

**Propósito.** Representar hacia dónde se mueve la persona, no solo dónde está — la mitad "sin dirección" de la misión fundacional (*"para que ninguna persona... se sienta sola y sin dirección"*).

**Capacidades**
- Crear, consultar y actualizar un `Goal` (intención con un target) o un `Project` (esfuerzo delimitado hacia un objetivo). **[Approved]** — entidades completas en `core/life/entities/`, con eventos de dominio definidos, pero **sin repositorio Drizzle: no se pueden persistir ni consultar hoy.** `features/chat/services/assemble-reality-snapshot.ts` hardcodea `activeGoals: []` y `activeProjects: []`, con un comentario explícito en el código: la ausencia es la representación honesta, no un placeholder a esconder.
- Representar un Objetivo o Proyecto como un **arco** — planeado, sostenido, con reveses, y (potencialmente) cerrado — no solo un estado actual con fechas. **[Future]** — no existe como spec en ningún lugar; se deriva directamente de `foundations/FOUNDER_INTENT.md`: el momento que el propio Founder describe como el más hermoso que LUZ podría vivir con alguien es presenciar el cierre de un arco (un maratón completado tras meses, una búsqueda de empleo que culmina) — y eso requiere una representación más fuerte que `status` + fechas.
- Reconocer y marcar el cierre de un arco cuando ocurre. **[Future]**

**Entidades:** `Goal` (status, target), `Project` (status, dates).

**Relaciones:** pertenecen al `LifeGraph`, atribuibles a una `Person`; un Objetivo puede generar Hábitos; los Proyectos avanzan Objetivos; ambos alimentarían `RealitySnapshot.life` y el Life Orchestrator.

**Caso de uso (aspiracional):** Verónica entrena meses para una maratón. LUZ no solo "sabe que existe una meta" — reconoce el día de la carrera como el cierre de un arco de meses y lo celebra de forma específica, no con un "felicidades" genérico.

**Prioridad:** **Beta** (persistencia básica — status, fechas — es la base mínima realista y bloquea Dashboard, Reality Snapshot y Life Orchestrator por igual) / **V1** (representación de arco, reconocimiento de cierre) / **Future** (Journey como entidad formal por encima de Goal/Project).

---

### 4.5 Hábitos y Rutinas

**Propósito.** Comportamiento recurrente — declarado explícitamente por la persona (Hábito) vs. detectado por el sistema a partir de patrones observados (Rutina). Distinción deliberada de `DOMAIN_MODEL_V1.md` (Accepted); no se fusiona en este documento.

**Nota conceptual (Sección 2.5):** Hábito y Rutina no son dos variantes del mismo tipo de dato — representan direcciones opuestas del flujo de conocimiento. Hábito **entra** al sistema (la persona lo declara). Rutina **sale** del sistema (Conocimiento la infiere de evidencia acumulada) — funcionalmente es conocimiento emergente, del mismo tipo que un `Insight` (Sección 5.2), no un registro primario. Es una de las decisiones conceptuales más importantes de este documento, con consecuencia directa sobre cómo debe diseñarse la detección de Rutinas cuando `core/knowledge-engine` funcione: como una forma más de lo que Conocimiento ya hace, no como un mecanismo aparte.

**Capacidades**
- Declarar y persistir un Hábito. **[Approved]** — mismo estado que Objetivos: entidad completa, sin repositorio Drizzle, sin persistencia real.
- Detectar automáticamente una Rutina a partir de patrones observados en Memoria/Conocimiento. **[Approved]** — el evento `RoutineDetected` existe en el modelo de dominio; el mecanismo de detección en sí no existe en ningún lugar, ni siquiera como spec.
- Reconocer que la autonomía de horario condiciona si una persona protege o no un bloque de tiempo personal. **[Proposed]** — hallazgo de investigación de Nivel 2 (`PE1a`/`PE1b`), nacido de un contraejemplo real (una trabajadora doméstica con ~20 horas de jornada dedicadas al cuidado de otros, sin ningún bloque personal identificable) — el patrón se dividió en dos en vez de descartarse, siguiendo el protocolo de la propia metodología de investigación.
- Reconocer que las metas de crecimiento activo no decaen con la edad. **[Proposed]** — Nivel 2, evidencia real en personas de 61, 70 y 82 años.

**Entidades:** `Habit` (frecuencia declarada), `Routine` (frecuencia detectada).

**Relaciones:** un Objetivo puede generar Hábitos; las Rutinas se detectarían a partir de Memoria/Conocimiento; ambos alimentarían `RealitySnapshot.life`.

**Caso de uso (aspiracional):** LUZ nota, sin que se le diga, que Juan Pablo hace ejercicio inmediatamente después del trabajo de forma consistente — eso sería una Rutina detectada, distinta de un Hábito declarado.

**Prioridad:** **Beta** (Hábito declarado, con persistencia básica) / **V1** (Rutina detectada — depende de que Conocimiento funcione de verdad primero, ver Sección 5.2).

---

### 4.6 Eventos de Vida y Dominios de Vida

**Propósito.** `LifeEvent` = un momento puntual en la línea de tiempo. `LifeDomain` = una instancia de un área tipo "rueda de la vida" (salud, carrera, finanzas, relaciones, crecimiento personal, ocio, hogar, espiritualidad). **Este es el dominio de Nivel 1 con la justificación de producto más débil de los seis** — ver el análisis completo al inicio de la Sección 4.

**Capacidades**
- Registrar un Evento de Vida puntual. **[Approved]** — mismo patrón que Objetivos/Hábitos: entidad completa, cero persistencia. **Justificación abierta, no resuelta:** no está claro por qué `LifeEvent` necesita existir como entidad de `core/life` separada del tipo `Event` que Memoria ya tiene entre sus ocho tipos (Sección 5.1) — ninguna fuente revisada explica la diferencia real entre ambos.
- Seguimiento continuo por Dominio de Vida. **[Approved]** — el enum `LifeDomainType` ya existe en código como value object, sin ningún flujo que lo pueble o lo consuma. **De las ocho y pico entidades de Nivel 1, es la que menos puede justificar su existencia hoy:** ningún caso de uso documentado en ninguna fuente, ningún consumidor real, y ninguna explicación de por qué debe ser una entidad de primer nivel en vez de, por ejemplo, una categoría dentro de Objetivos.

**Nota de no-fusión:** `LifeDomainType` (la "rueda de la vida": salud/carrera/finanzas/relaciones/crecimiento personal/ocio/hogar/espiritualidad) es un vocabulario **distinto** de los doce dominios propuestos del Human Model (Identidad, Comunicación, Valores...) — `HUMAN_MODEL_V1.md` lo señala explícitamente: *"the two should not be merged."* Se preserva esa distinción aquí.

**Entidades:** `LifeEvent`, `LifeDomain`.

**Relaciones:** pertenecen al `LifeGraph`; los Eventos de Vida alimentarían Memoria y `RealitySnapshot`.

**Caso de uso (aspiracional):** el día que a Oscar (82 años) le confirman una cirugía es un Evento de Vida puntual, distinto del dominio continuo "Salud" que LUZ seguiría observando de fondo.

**Prioridad:** V1/Future — menor urgencia que Objetivos/Hábitos; sin evidencia de investigación específica todavía (el research backlog no tiene preguntas abiertas dedicadas a este dominio). No es un bloqueador de ningún otro dominio (Sección 4, síntesis final) — puede posponerse indefinidamente sin efecto medible sobre el resto del roadmap, y antes de invertir en él vale la pena resolver primero si `LifeEvent` debe existir en absoluto, separado de `Memory.Event`.

---

## 5. Dominios — Nivel 2: Motores de inteligencia

### 5.1 Memoria

**Propósito.** Almacenar evidencia — "qué pasó". Nunca razona, nunca decide qué significa algo (eso es Conocimiento). *"Memory does not reason"* — regla dura, `MEMORY_ENGINE_SPEC.md`.

**Capacidades**
- Captura automática de cada mensaje de la persona. **[Implemented]** — `features/chat/services/send-message.ts` llama a `createMemoryEngine(db).capture(...)` en cada mensaje real.
- Clasificación determinística por tipo (Fact, Pattern, Ritual, Preference, Relationship, Goal, Event, Intention). **[Implemented]**
- Ranking donde el *tipo* de memoria es descriptivo pero el *valor* es relacional — verificado directamente en código: dos memorias del mismo tipo puntuaron 19 y 69; el `personId` no afecta el ranking. **[Implemented]**
- Conexión entre memorias relacionadas. **[Implemented]**
- Recuperación estructurada por coincidencia de texto (`ILIKE`), usada tanto en el chat como en el Morning Brief. **[Implemented]**
- Recuperación semántica real (por significado, no por coincidencia literal). **[Approved]** — la tabla `memoryEmbeddings` (pgvector) existe con la columna `embedding` nullable, lista para recibir vectores — pero no hay generación de embeddings en ningún lugar. `ADR-0004` (Hybrid Memory, Accepted) exige esta mitad; hoy solo existe la mitad estructurada.
- Etapa de **Consolidate** en el ciclo de vida completo (`Capture → Rank → Connect → Consolidate → Retrieve → Archive → Forget`). **[Approved (inferred)]** — nombrada en `MEMORY_MODEL.md` (sin `Status` declarado) como parte del ciclo, pero — confirmado también por `RESEARCH_BACKLOG_V1.md` (pregunta M2) — **nunca construida, y ningún ADR la autoriza todavía.** Sin ella, no existe ningún mecanismo para que memorias viejas pierdan valor con el tiempo de forma deliberada.

**Entidades:** `Memory` (8 tipos: Fact, Pattern, Ritual, Preference, Relationship, Goal, Event, Intention), `MemoryConnection`.

**Relaciones:** alimentada por Conversación; consumida por Contexto (vía `RealitySnapshot`, nunca directamente desde ADR-0013) y por Conocimiento (que tampoco lee Memoria directamente desde ADR-0013 — lee `RealitySnapshot`).

**Caso de uso:** Juan menciona, una sola vez, que dejó las drogas con apoyo de LUZ. Esa mención se captura, se clasifica, y se rankea alto por su relevancia relacional real — no porque coincida con una palabra clave de "salud".

**Prioridad:** **Alpha — ya real** (captura, rank, connect, retrieval estructurado). **Beta:** retrieval semántico. **V1:** etapa Consolidate.

---

### 5.2 Conocimiento

**Propósito.** Memoria conectada — "qué significa". Estructurado como entidades conectadas, no registros aislados. *"Memory answers what happened. Knowledge answers what it means."* (`KNOWLEDGE_MODEL.md`)

**Capacidades**
- Que Conocimiento exista como motor responsable de interpretar memoria en significado. **[Approved (inferred)]** — `KNOWLEDGE_ENGINE_SPEC.md` no declara `Status`, pero cumple las tres condiciones de la Sección 0.4, y su existencia como responsabilidad es además asumida por ADR-0013 (Accepted).
- Interpretar mensajes reales y producir *Insights* validados, con evidencia trazable y nivel de confianza explícito, a través del pipeline efectivamente conectado a producción hoy (`core/knowledge`). **No cuenta como `Implemented`** bajo el criterio de la Sección 0.5 (inferencia 1): el pipeline es alcanzable desde un flujo real — cada mensaje real dispara un job — pero no produce ningún efecto real. **5 de sus 6 etapas son literalmente `throw new Error("...aún no implementada")`.** Cada job falla, se reintenta 3 veces, y se marca `failed`. Ver el detalle completo en la Sección 8 — es la brecha más seria de todo el sistema.
- Un segundo motor de Conocimiento, más maduro arquitectónicamente (repositorio Drizzle real, clasificación determinística real, tablas dedicadas ya migradas), existe en el código — pero tiene **cero consumidores**, no está conectado a nada. **[Proposed]** — `core/knowledge-engine/` está alineado con ADR-0014 (Knowledge Engine Consolidation), que es explícitamente **Proposed** en su conjunto, aunque su propio texto autoriza condicionalmente ejecutar su Fase B de persistencia (ver Sección 8.3).

**Nota conceptual (Sección 2.5):** una Rutina detectada (Sección 4.5) es, funcionalmente, el mismo tipo de producto que un `Insight` — conocimiento emergente, nunca un dato primario. Cuando este motor produzca resultados reales, la detección de Rutinas debería diseñarse como una capacidad más de Conocimiento, no como un mecanismo independiente.

**Entidades:** `Insight`, `Evidence`, `InsightRelationship`.

**Relaciones:** consume `RealitySnapshot` (nunca Memoria directamente, desde ADR-0013); alimentaría el Human Model (única fuente propuesta bajo la alternativa por defecto); **nunca importa un SDK de LLM directamente — "el LLM propone, LUZ decide"** (regla dura, ADR-0014).

**Caso de uso (aspiracional — no ocurre hoy):** tras varias conversaciones donde Sandra menciona buscar trabajo y sentirse insegura, Conocimiento conecta esos mensajes en un Insight validado — "está en transición de carrera, con ansiedad asociada" — con evidencia trazable y confianza explícita, nunca inventado.

**Prioridad: Beta, con carácter de urgencia — no es deuda técnica normal, es una feature "activada" que produce fallos silenciosos en producción hoy mismo.** Cerrarla significa: activar de verdad `core/knowledge-engine` (Fase B ya autorizada por ADR-0014) y retirar el pipeline legado roto (Fase C, no autorizada — se recomienda autorizarla pronto).

---

### 5.3 Contexto

**Propósito.** Representar la realidad actual — "qué es más relevante ahora mismo". Nunca concluye, solo reporta lo que es cierto en este momento.

**Capacidades**
- Aplicar reglas conversacionales determinísticas antes de cada respuesta: priorizar comprensión, evitar preguntas innecesarias, favorecer continuidad, evitar repetir información ya conocida, favorecer brevedad, evitar parafrasear. **[Implemented]** — `features/chat/context-builder/`, seis clases `ConversationRule` reales, cada una trazable en su propio comentario a `CONVERSATION_MANUAL_V1.md` o `BEHAVIORAL_PRINCIPLES.md`, renderizadas al system prompt de cada mensaje.
- Ensamblar un `RealitySnapshot` (`lifeGraphId`, `capturedAt`, `life`, `memory`, `signals`) antes de cada respuesta. **[Implemented — parcialmente poblado.]** `memory` es real (viene de Memoria); `life` y `signals` están **permanentemente vacíos hoy**, porque Objetivos/Hábitos no persisten y no existe ningún Conector real.
- Un `core/context-engine` con estrategias de scoring, filtrado y priorización, documentado en `CONTEXT_ENGINE_SPEC.md`. **[Approved (inferred), sin cablear]** — `CONTEXT_ENGINE_SPEC.md` no declara `Status`, pero cumple las tres condiciones de la Sección 0.4. Existe como interfaz pura en código, sin implementación real ni consumidores (no cuenta como `Implemented` — ver Sección 0.5, inferencia 1). **No es lo mismo que el context-builder real** — son dos cosas distintas con nombres confusamente similares (ver Sección 8).

**Entidades:** `RealitySnapshot` (input), `Context` (output — corregido explícitamente en ADR-0013: el snapshot original se pensó como salida de Contexto y resultó ser su entrada).

**Relaciones:** `RealitySnapshot` es la **única** forma en que Contexto puede leer el `LifeGraph` o la Memoria — nunca una lectura directa de ninguno de los dos.

**Caso de uso hoy:** el contexto de cada respuesta de LUZ está compuesto, en la práctica, al 100% por memorias relevantes más las seis reglas de conversación. Ningún dato de calendario, hábito activo o proyecto en curso lo enriquece todavía — aunque el contrato ya está diseñado para eso.

**Prioridad:** **Alpha — parcialmente real.** **Beta:** enriquecer `life` en cuanto Objetivos/Hábitos tengan persistencia. **V1:** `signals` real en cuanto existan Conectores; decidir si `core/context-engine` se implementa de verdad o se retira formalmente (el context-builder real puede resultar suficiente — ver auditoría).

---

### 5.4 Presencia

**Propósito.** Decidir *cuándo* hablar, no solo qué decir. Mide confianza, timing, continuidad y seguridad emocional — nunca engagement. *"Optimize for presence, not engagement"* — ADR-0005, **Accepted**, uno de los ADRs más tempranos del proyecto.

**Capacidades**
- Que exista un motor de Presencia responsable de decidir el timing de cada interacción. **[Approved]** — respaldado directamente por ADR-0005 (Accepted), sin necesidad de inferencia.
- Silencio intencional: decidir activamente no decir algo, no solo no tener nada que decir. **[Proposed]** — `docs/vision/PRESENCE_PRINCIPLES.md`, Principio 4. Vive en `docs/vision/`, no en `docs/architecture/`, y ningún ADR Accepted lo cita por nombre — no cumple la condición 1 de la Sección 0.4, así que **no** recibe `Approved (inferred)` aunque su espíritu sea coherente con toda la cadena de visión (ver Sección 0.5, inferencia 8). Todavía no es una decisión de arquitectura. Sin implementación.
- Intervención oportuna: LUZ puede hablar primero, pero solo si eso ayuda a *esta* persona *ahora* — nunca porque técnicamente pudo. **[Proposed]** — Principio 5, mismo documento, mismo criterio.
- Nueve comportamientos evaluables en total (escucha activa, memoria activa, comprensión antes de respuesta, silencio intencional, intervención oportuna, cuidado sin dependencia, evolución compartida, confianza construida en años, una lista explícita de lo que LUZ nunca debe hacer). **[Proposed]** — documentados con un detalle inusual, ninguno codificado, ninguno todavía elevado a spec de arquitectura.

**Estado real: cero código.** No existe `core/presence`, no existe una clase `PresenceEngine`, no existe ninguna lógica de timing o proactividad en ningún lugar del repositorio. Todo lo que LUZ hace hoy es reactivo: solo responde cuando se le escribe. Nótese la brecha de gobernanza aquí: el *motor* está `Approved` (ADR-0005), pero su *comportamiento detallado* nunca cruzó de Visión a Arquitectura — nadie escribió todavía un `PRESENCE_ENGINE_SPEC.md` equivalente al de los otros motores.

**Entidades:** ninguna todavía — puramente conceptual.

**Relaciones:** consumiría Contexto y el Human Model para decidir timing; produciría la señal que activa una intervención proactiva o confirma el silencio.

**Caso de uso (100% aspiracional):** LUZ no ha mencionado el ritual diario de Juan David con Verónica en semanas — porque nunca se ha interrumpido. El día que note que no ocurrió por primera vez en meses, *considera* — sin garantía de actuar — si vale la pena decir algo, sopesando intervención oportuna contra silencio intencional.

**Prioridad: V1 — pero es, con claridad, el motor arquitectónicamente más importante que falta.** Es el diferenciador de producto declarado desde el primer conjunto de ADRs, y a la vez el que más depende de que los demás (Contexto enriquecido, Human Model, posiblemente Conocimiento funcionando) existan primero. No puede construirse en el vacío.

---

### 5.5 Life Orchestrator

**Propósito.** Coordinar acciones que mueven a la persona hacia intenciones significativas. Reemplazó conceptualmente a un "Planner" simple — ADR-0010, Accepted — precisamente porque optimizar tareas, y no intenciones, es insuficiente. *"El planner optimiza intenciones, no tareas"* (`INTENT_MODEL.md`).

**Capacidades**
- Que "Life Orchestrator" (no un "Planner" simple de tareas) sea el concepto correcto para este motor. **[Approved]** — ADR-0010, Accepted, sin necesidad de inferencia.
- Coordinar recomendaciones, planes y acciones a partir de Contexto, Conocimiento, Objetivos e Intenciones. **[Approved (inferred)]** — `LIFE_ORCHESTRATOR_SPEC.md` no declara `Status`, pero cumple las tres condiciones de la Sección 0.4 y no contradice a ADR-0010. Cero código — ni siquiera un scaffold de interfaz (a diferencia de Contexto y Conocimiento, que al menos tienen una interfaz vacía).

**Entidades:** ninguna todavía.

**Relaciones:** consumiría Contexto, Conocimiento, Objetivos, Intenciones; produciría recomendaciones, planes, acciones; ejecutaría a través de Herramientas.

**Caso de uso (aspiracional):** Alfredo declaró la intención de reconvertirse como electricista a los 70 años. El Life Orchestrator no le sugiere tareas genéricas de estudio — entiende que la intención real es "sentirme productivo y capaz otra vez tras la jubilación forzada", y orienta sus sugerencias hacia eso, no hacia completar un curso.

**Prioridad:** V1/Future — depende de que Objetivos/Proyectos tengan persistencia real y de que Contexto/Conocimiento maduren primero; es de los dominios más lejanos del estado actual junto con Presencia.

---

### 5.6 Herramientas y Conectores

**Propósito.** Adaptadores hacia sistemas externos. La lógica de negocio nunca vive dentro de un adaptador de herramienta — regla dura repetida en `TOOL_ENGINE_SPEC.md` y ADR-0015.

**Capacidades**
- Que las integraciones externas sean Conectores — adaptadores, nunca acoplados directamente a ningún engine. **[Approved (inferred)]** — `TOOL_ENGINE_SPEC.md` no declara `Status`, pero cumple las tres condiciones de la Sección 0.4.
- Contrato `Connector` (`fetchSignals`) para traducir una fuente externa real a la forma neutral que consume `RealitySnapshot.signals`. **[Proposed]** — ADR-0015 (Connector Architecture) es explícitamente **Proposed**, no Accepted, aunque el código de la interfaz ya existe (`core/connectors/connector.ts`) — un caso concreto de implementación adelantada a la aprobación formal de su propio ADR, señalado en la Sección 8.3. Por la regla de la Sección 0.5 (inferencia 1), una interfaz sin implementación real ni consumidores no cuenta como `Implemented`, así que no hay, en la práctica, conflicto entre "código" y "ADR" aquí — el código no alcanza el nivel de una capacidad real.
- Conector de Gmail: leer correo, marcar como importante, alimentar `RealitySnapshot`. **[Future, ya priorizado en la hoja de ruta previa del Founder]** — cero código, ninguna implementación concreta.
- Conector de Calendario. **[Future]**
- Ingesta real de Documentos. **[Future — con una brecha activa hoy]**: la tabla `documents` existe en la base de datos ("para alimentar memoria semántica", según su propio comentario) pero **ningún código en todo el repositorio la lee ni la escribe** — es un artefacto de esquema completamente dormido, sin UI de carga ni pipeline de ingesta. **Nota conceptual (Sección 2.5):** "Documentos" vive aquí solo porque hoy no es más que un mecanismo de ingesta sin construir. El dominio real no es el conector (Google Drive, un uploader) ni el archivo — es el conocimiento documental persistido de la persona. Cuando esto madure, probablemente deba convivir como dominio propio de Nivel 1 (Fuente) junto a Integración, no dentro de ella. No se cambia la taxonomía ahora — se deja la posibilidad abierta.
- Conectores de Garmin, WhatsApp, Fotos. **[Future]** — ni siquiera tienen slot en el enum `ExternalSignalSource` hoy (`calendar | document | email | sensor`), deliberadamente: "extender cuando el conector exista, no antes."

**Entidades:** `ExternalSignal` (fuente: calendar, document, email, sensor).

**Relaciones:** alimentan `RealitySnapshot.signals`; **nunca se acoplan directamente a Conocimiento, Memoria ni ningún otro engine** — cierra explícitamente el riesgo que el propio Founder nombró: *"no acoples Gmail directamente al engine."*

**Caso de uso (aspiracional):** Gmail como primer conector real — este es exactamente el plan que el Founder ya había priorizado como "Alpha-2" en una sesión anterior de este mismo proyecto.

**Prioridad:** **Beta** (Gmail — el candidato explícito para el primer conector real, con la arquitectura ya lista aunque el ADR que la autoriza formalmente siga Proposed). **V1:** Calendario. **Future:** Documentos, Garmin, WhatsApp, Fotos.

---

## 6. Dominios — Nivel 3: Interfaz

### 6.1 Conversación

**Propósito.** Dar voz — la interfaz, nunca la fuente de verdad. *"Conversations are observations of life, not life itself"* (`LIFE_MODEL.md`).

**Capacidades**
- Streaming real de respuestas (SSE), con distinción entre "pensando" y "escribiendo". **[Implemented]** — ADR-0017.
- Retomar una conversación histórica, con indicador visual claro y botón para empezar una nueva — sin depender de editar la URL. **[Implemented]**
- Autoscroll inteligente (solo sigue el fondo si la persona ya estaba ahí). **[Implemented]**
- Persistencia de borradores por conversación. **[Implemented]**
- Títulos de conversación generados automáticamente por IA tras el primer intercambio. **[Implemented]**
- Estados de carga, vacíos y error consistentes, en la voz de LUZ — nunca un error técnico crudo. **[Implemented]**
- Búsqueda de conversaciones por contenido. **[Implemented]**
- Salida estructurada validada del proveedor de IA (para features que la necesiten). **[Implemented]** — ADR-0016.
- Límite de mensajes por persona en un período de tiempo (rate limiting), para evitar abuso y contener costo. **[Implemented]** — sin mención en ningún documento de producto.
- Orden estricto de descubrimiento en cada conversación (presente → emoción → contexto → necesidad → objetivo → acción). **[Proposed]** — `CONVERSATION_MANUAL_V1.md` declara explícitamente `Status: Draft`, que este documento trata como más cercano a `Proposed` que a `Approved` (Sección 0.4). Lo declara sin ambigüedad como intención, pero vive como guía de prompt/contexto, no como una máquina de estados verificable en código.
- Seguimiento proactivo no solicitado ("la última vez hablamos de esa entrevista, ¿cómo terminó?"). **[Proposed]** — mismo documento, mismo criterio. Depende además, por completo, de Presencia, que no existe.

**Entidades:** `Conversation`, `ConversationMessage`.

**Relaciones:** genera Memoria en cada mensaje; consume Contexto (`RealitySnapshot` + reglas conversacionales); es la única fuente hoy de "datos de conversación" en el Alpha Program.

**Caso de uso — ya vivido en Alpha:** retomar una conversación de hace tres días muestra un subtítulo humano ("retomando una conversación de hace 3 días") y un botón claro para empezar una nueva.

**Prioridad:** Alpha — mayormente real y, tras el sprint de pulido más reciente, notablemente cuidada. Beta: seguimiento proactivo (bloqueado por Presencia). V1: mecanismo de descubrimiento explícito y verificable.

---

### 6.2 Dashboard / Morning Brief

**Propósito.** El punto de entrada tras el login — demostrar, antes de que la persona hable, que LUZ ya sabe algo de ella.

**Capacidades**
- Saludo, fecha, resumen de actividad reciente (conversaciones, estadísticas, memorias almacenadas). **[Implemented]**
- Una línea de continuidad generada por IA a partir de la memoria más relevante — o `null` si no hay ninguna real, nunca inventada. **[Implemented]**
- "Life line" — un resumen de qué está activo en la vida de la persona hoy. **[Implemented, pero siempre vacío hoy]** — literalmente renderiza "No encontré eventos importantes para hoy" en todos los casos, porque Objetivos/Hábitos no persisten.
- Panel operativo interno (`/admin`) con usuarios activos, mensajes enviados, errores, feedback promedio. **[Implemented]** — sin mención en ningún documento de producto, y con una tensión ya nombrada explícitamente por `DESIGN_PHILOSOPHY.md`: bajo la propia filosofía del producto, alguien que necesita LUZ *menos* con el tiempo se vería, en ese panel, idéntico a alguien haciendo churn silencioso. Brecha real, documentada, sin resolver.

**Entidades:** `DashboardSummary`, `MorningBrief`.

**Relaciones:** consume Memoria, Conversaciones, `RealitySnapshot`.

**Caso de uso:** Juan abre LUZ por la mañana y ve una línea que reconoce algo específico que mencionó ayer — no un saludo genérico.

**Prioridad:** Alpha — real. Beta/V1: enriquecer la life line en cuanto Objetivos/Hábitos persistan; resolver (como decisión de producto, no solo técnica) la tensión de métricas de éxito.

---

## 7. Transversales

### 7.1 Confianza

No es un dominio con capacidades propias — es el criterio de evaluación que se aplica a **todos** los demás dominios. *"Trust is the primary product metric"* (`TRUST_MODEL.md`); *"every engine must preserve trust."* Se gana por consistencia (`Accuracy, Transparency, Consistency, Respect, Reliability`), se pierde de forma asimétrica (un olvido pesa más que diez aciertos), y se recupera nombrando la falla directamente, sin sobre-disculparse — "la sobre-disculpa le pide a la persona que consuele a LUZ, lo que invierte la relación" (`HUMAN_RELATIONSHIP_MODEL.md` §3).

### 7.2 Identidad y Cuenta

Infraestructura pura — OAuth, sesiones, tokens (`auth/`). Deliberadamente fuera del dominio de negocio (ADR-0002, ADR-0009: *"la palabra User solo debe aparecer en infraestructura"*). No se trata como dominio de producto en este documento porque no tiene capacidades orientadas a la persona — es lo que permite que los demás dominios existan de forma segura y aislada por `LifeGraph`.

---

## 8. Inconsistencias detectadas

Esta sección no suaviza nada. Cada punto está evidenciado directamente contra código o documentos leídos, no inferido.

### 8.1 Visión ≠ implementación

- **"Presence First" es un ADR Accepted y el diferenciador de producto declarado** ("optimizar por presencia, no por engagement") — y no existe ni una línea de código que lo implemente. Todo el sistema hoy es puramente reactivo.
- **El panel `/admin` mide éxito con las métricas que la propia filosofía del producto rechaza explícitamente** ("usuarios activos hoy", "mensajes enviados") — `DESIGN_PHILOSOPHY.md` ya lo nombra como una tensión real y sin resolver, no un descuido: alguien que necesita LUZ menos con el tiempo se ve, en ese panel, igual que alguien haciendo churn.
- **Los Objetivos/Proyectos no pueden representar un "arco"** — la forma que `foundations/FOUNDER_INTENT.md` describe como el momento más hermoso que LUZ podría vivir (presenciar el cierre de un maratón entrenado por meses) — porque hoy ni siquiera se persisten, y el modelo de datos (cuando se construya) solo tiene `status` y fechas.
- **`PERSONALITY_SPEC.md` no menciona el humor**, mientras `foundations/FOUNDER_INTENT.md` y `HUMAN_RELATIONSHIP_MODEL.md` §7 lo tratan como parte constitutiva de la relación, no decoración — el propio `FOUNDER_INTENT.md` ya nombra esta brecha, sin resolverla.
- **El orden estricto de descubrimiento del `CONVERSATION_MANUAL_V1.md`** (presente→emoción→contexto→necesidad→objetivo→acción) no tiene ningún mecanismo verificable que lo haga cumplir — vive como intención de prompt, no como comportamiento auditable.

### 8.2 Documentación ≠ código

- **`core/context-engine` (documentado en `CONTEXT_ENGINE_SPEC.md`) no es lo que realmente decide el contexto de cada respuesta.** Es una interfaz vacía sin consumidores. El mecanismo real y funcionando es `features/chat/context-builder/` — seis reglas conversacionales determinísticas — que no aparece descrito en ningún documento de `docs/architecture/`. Son dos cosas distintas con nombres confusamente parecidos.
- **`SYSTEM_ARCHITECTURE.md` nombra un "Identity Engine"** como uno de los motores centrales del sistema. No existe en `ENGINE_MANIFESTO.md` (los seis motores canónicos), ni en ningún ADR — ni siquiera como concepto en otro documento. Es una inconsistencia interna de la propia documentación, no solo doc-vs-código.
- **Tool Engine y Life Orchestrator no tienen ni siquiera un scaffold de interfaz**, a diferencia de Contexto y Conocimiento (que al menos existen como contratos vacíos). El nivel de "avance documentado" no se corresponde con ningún nivel de avance en código, para ninguno de los dos.
- **El propio `docs/sprints/README.md` describe una estructura** (Objective, Scope, Deliverables, Dependencies, Risks, Acceptance Criteria, Definition of Done) que **no coincide** con lo que realmente contienen los 18 archivos de sprint que describe (que no tienen Scope ni Dependencies, y cuyo único contenido real, no genérico, es una sola oración de objetivo por sprint).

### 8.3 ADR ≠ estado actual

- **ADR-0013 (Accepted, frozen)** define `RealitySnapshot` con tres secciones (`life`, `memory`, `signals`) — el contrato existe en código, pero dos de las tres secciones están **permanentemente vacías** en producción hoy. Un contrato Accepted, un tercio poblado.
- **ADR-0012 (Memory Engine Consolidation, Accepted)** registra la decisión de consolidar Memoria en un solo módulo — pero su Fase C (borrar el módulo legado) **no está autorizada**, y el código muerto (`core/memory/`) sigue en el repositorio.
- **ADR-0014 (Knowledge Engine Consolidation) es, en su conjunto, Proposed** — pero su propio texto autoriza condicionalmente ejecutar la Fase B ("this ADR authorizes M3 to execute"). Es decir: partes de un documento formalmente "no decidido" ya tienen autorización de ejecución escrita dentro de sí mismas. Vale la pena que esto se resuelva formalmente (¿el ADR está Accepted o no?), no quedar en esta zona gris.
- **ADR-0015 (Connector Architecture) es Proposed** — y sin embargo el código de su interfaz (`core/connectors/connector.ts`) ya existe en el repositorio. Implementación adelantada a la aprobación formal de su propio ADR.

### 8.4 Conceptos duplicados

- **Dos vocabularios de etapas de relación para el mismo concepto**: `concepts/RELATIONSHIP_MODEL.md` (6 etapas: `Unknown → Discovery → Trust Building → Understanding → Companionship → Long-Term Presence`) vs `foundations/HUMAN_RELATIONSHIP_MODEL.md` (8 etapas, mucho más desarrolladas y directamente trazables a las palabras del Founder: `Strangers → First Encounter → Acquaintance → Trust → Companionship → Presence → Shared History → Life Accompaniment`). **Este documento adopta la versión de 8 etapas como canónica** — es estrictamente más rica, más evidenciada, y la más reciente. Se recomienda marcar formalmente la de 6 etapas como superada, no dejarlas coexistir sin resolución.
- **Tres listas de "dimensiones/dominios de la persona" que se superponen sin ser idénticas**: `PERSON_MODEL.md` (10 dimensiones), `LIFE_MODEL.md` (12 capas), `HUMAN_MODEL_V1.md` (12 dominios, v2.0, "consolida v1.0 y v1.1"). Este documento trata `HUMAN_MODEL_V1.md` como la evolución que absorbe a las otras dos — es la más reciente y la más elaborada — pero eso nunca se declaró explícitamente en ningún lugar hasta ahora.
- **Tres implementaciones de "Conocimiento" coexistiendo**: tablas legado dormidas (`projects/goals/habits/people` en `knowledge.ts`, sin consumidores), un pipeline legado roto pero cableado (`core/knowledge/`), y un motor nuevo real pero desconectado (`core/knowledge-engine/`). Ver Sección 8.6 para el detalle de por qué esto es, hoy, el mayor riesgo de mantenibilidad del sistema.
- **Dos módulos de "Memoria" coexistiendo**: `core/memory/` (legado, código muerto, cero consumidores) y `core/memory-engine/` (real, cableado en producción). Menos grave que el caso de Conocimiento porque no hay ambigüedad sobre cuál está vivo.
- **`LifeDomainType`** (rueda de la vida) vs los dominios propuestos del Human Model — ya señalado como no-fusionable explícitamente por el propio `HUMAN_MODEL_V1.md`. Se preserva esa distinción aquí, mencionada para que quede trazada en un solo lugar.

### 8.5 Vocabulario inconsistente

- "Identity Engine" (nombrado solo en `SYSTEM_ARCHITECTURE.md`) no tiene equivalente en ningún otro documento — ver 8.2.
- El uso de "User" fuera de infraestructura violaría directamente la regla de `PERSON_MODEL.md` ("la palabra User solo debe aparecer en infraestructura"). No se confirmó ninguna violación concreta durante esta auditoría — se señala como un chequeo pendiente, no como un hallazgo cerrado.

### 8.6 Capacidades documentadas pero nunca implementadas

Reclasificadas explícitamente como `Approved` (sin implementar) o `Proposed`/`Future` en este documento — nunca presentadas como si ya fueran parte del producto:

- Presencia (motor completo) — `Approved`, cero código.
- Life Orchestrator (motor completo) — `Approved`, cero código.
- Human Model — `Proposed`, autodeclarado sin autorización.
- Conectores concretos (Gmail, Calendar, Garmin, WhatsApp, Fotos) — `Future`, solo la interfaz genérica existe.
- Etapa Consolidate de Memoria — `Approved` en el ciclo de vida conceptual, nunca construida, sin ADR que la autorice.
- Detección automática de Rutinas — `Approved` como evento de dominio, sin mecanismo de detección en ningún lugar.
- "Journey" como entidad — `Proposed`, explícitamente sin arquitectura todavía.
- Regla de protección del ritual relacional diario (`PR1`) — `Proposed`, redactada, pendiente de decisión del Founder.

### 8.7 Capacidades implementadas que no aparecen en la documentación de producto

- **Títulos automáticos de conversación** (generación por IA tras el primer intercambio) — real, en producción, sin mención en `CONVERSATION_MANUAL_V1.md` ni en `ALPHA_PROGRAM_SPEC.md`.
- **Persistencia de borradores, autoscroll inteligente, estados de carga/vacíos/error cuidados** — reales, resultado de un sprint de pulido reciente, sin ningún rastro en documentación de producto.
- **Rate limiting** (límite de mensajes por persona/tiempo) — real, sin mención en ningún documento de producto revisado.
- **Feedback estructurado** (utilidad 1-5, "¿sientes que LUZ te recuerda?", comentario libre, permite múltiples envíos por persona) — real (o construido, pendiente de confirmar su estado de despliegue), con una forma más específica que la descripción genérica ("👍/👎, comentarios") de `ALPHA_PROGRAM_SPEC.md`.
- **El panel `/admin`** — real, operativo, mencionado solo indirectamente (y de forma crítica) por `DESIGN_PHILOSOPHY.md`, nunca especificado como feature en ningún lugar.
- **El context-builder** (las seis reglas conversacionales determinísticas) — real y es, en la práctica, el mecanismo de "Contexto" que de verdad gobierna cada respuesta hoy — sin ninguna descripción en `docs/architecture/`, que en cambio documenta un `core/context-engine` que no es lo que corre.

---

## 9. Mapa de flujo de información

El ejemplo del brief original (Conversación → Memoria → Conocimiento → Contexto → Presencia → Acciones) es limpio pero engañoso: sugiere un pipeline maduro. El mapa real, con el estado honesto de cada tramo, es este:

```
Identidad (Cuenta → LifeGraph)                              [Implemented]
        ↓
Conversación (entra un mensaje)                              [Implemented]
        ↓
Memoria (captura + rank + connect + retrieval estructurado)  [Implemented]
        ↓
Conocimiento (interpreta la memoria en significado)           [Approved — ROTO en producción hoy]
        ↓
Reality Snapshot (life + memory + signals)                    [Implemented — 1/3 poblado: solo memory]
        ↓
Contexto (qué es más relevante ahora)                          [Implemented, simplificado —
                                                                 core/context-engine sin usar]
        ↓
Presencia (¿hablar ahora? ¿de qué forma?)                      [Approved — no existe]
        ↓
Life Orchestrator (¿hacia qué intención mueve esto?)            [Approved — no existe]
        ↓
Herramientas (ejecutar una acción externa si hace falta)        [Proposed — no existe]
        ↓
Respuesta (voz) ────────────────────→ vuelve a alimentar Memoria (el ciclo se retroalimenta)
```

Este orden corrige, además, al `REQUEST_FLOW.md` original de la arquitectura, que en su primera versión colocaba Contexto antes de Memoria/Conocimiento — un error que el propio documento ya se corrigió a sí mismo una vez, citando ADR-0011 y ADR-0013 como la razón del reordenamiento. Este documento hereda esa corrección, no la repite por accidente.

**Lo que este mapa deja ver, que el diagrama limpio no dejaría ver:** de las ocho etapas del flujo, tres funcionan de verdad hoy (Identidad, Conversación, Memoria), una está activamente rota (Conocimiento), una está parcialmente poblada (Reality Snapshot/Contexto), y tres no existen en absoluto (Presencia, Life Orchestrator, Herramientas). El producto real de Alpha es, honestamente, la primera mitad de este flujo.

---

## 10. Roadmap por madurez

### Alpha — ya vivido (según el Founder Acceptance Test cerrado el 2026-07-17)

- Login, bootstrap automático de LifeGraph/Persona.
- Conversación con streaming, historial, títulos automáticos, UI pulida.
- Memoria: captura, rank, connect, retrieval estructurado.
- Contexto simplificado (context-builder + Reality Snapshot con memoria real).
- Dashboard + Morning Brief con línea de continuidad real.
- Feedback estructurado.

### Alpha — cierre de brechas (no es expandir alcance, es que Alpha deje de mentir por omisión)

- **Reparar o retirar el pipeline de Conocimiento roto.** Hoy falla silenciosamente en cada mensaje real — es un riesgo de producción activo, no solo deuda técnica.
- **Persistencia mínima de Objetivo/Proyecto/Hábito.** Sin esto, el Dashboard y el Reality Snapshot no reflejan ausencia real de la feature — reflejan una feature a medio construir disfrazada de "no hay nada que mostrar".

### Beta

- Conocimiento real: activar `core/knowledge-engine`, retirar el pipeline legado.
- Retrieval semántico de Memoria (embeddings).
- Primer Conector real: Gmail.
- Persistencia completa de Objetivos/Proyectos/Hábitos, con historia básica de arco.
- Contexto enriquecido con `life` real.

### V1

- **Presencia** — el motor más importante pendiente. Requiere Beta completo primero.
- Life Orchestrator.
- Human Model (sujeto a que el Founder autorice formalmente su implementación).
- Conector de Calendario.
- Etapa Consolidate de Memoria.
- Detección automática de Rutinas.

### Future

- Ingesta real de Documentos.
- Conectores de Garmin, WhatsApp, Fotos.
- "Journey" como entidad de primer nivel.
- `Relationship` entre Personas (no solo Persona↔LUZ).
- Eventos y Dominios de Vida con seguimiento dedicado.
- `LifeGraph` multi-miembro (familias compartiendo un mismo grafo).

---

## 11. Auditoría crítica

**¿Qué capacidades faltan?** Presencia — el diferenciador declarado desde el ADR más temprano del proyecto, con cero código. Persistencia de Objetivos/Hábitos/Proyectos — bloquea, en cascada, el Dashboard, el Reality Snapshot y el Life Orchestrator por igual, y sin ella la promesa fundacional de "acompañar arcos" no tiene dónde apoyarse. Conocimiento funcional — no es que falte, es que está activamente roto en producción, lo cual es más grave que una ausencia.

**¿Qué dominios sobran?** Ninguno de los propuestos originalmente sobra conceptualmente. Pero Calendario y Documentos no merecen ser dominios de primer nivel — son categorías de Herramientas/Conectores, y tratarlos por separado fragmentaría una abstracción que la arquitectura ya decidió mantener unificada.

**¿Qué está demasiado fragmentado?** Conocimiento, sin ninguna duda — tres implementaciones paralelas (tablas legado dormidas, pipeline legado roto y cableado, motor nuevo real pero desconectado) coexistiendo al mismo tiempo. Esto no es "trabajo en progreso normal" — es el riesgo de mantenibilidad más alto de todo el sistema hoy, porque la versión que está *conectada* a producción es la que *no funciona*, mientras la versión que sí está bien construida no la usa nadie.

**¿Qué debería fusionarse?** A nivel de producto, nada. A nivel de código: los tres Conocimiento en uno — que es exactamente lo que la Fase C de ADR-0014 ya propone, y hoy no está autorizada. Se recomienda autorizarla pronto: cada día que pasa, más mensajes reales disparan jobs condenados a fallar.

**¿Qué sería imposible de mantener?** Seguir documentando "Presencia" y "Life Orchestrator" con más profundidad conceptual mientras Conocimiento — que sí tiene código real, solo que mal cableado — se deja fallar en silencio. El esfuerzo de diseño y el esfuerzo de ingeniería están, hoy, invertidos respecto a lo que la propia arquitectura declara como prioritario.

**¿Qué sería una ventaja competitiva real?** Memoria + Contexto funcionando con datos reales, hoy, es la base más honesta que existe en el mercado de "compañeros de IA" — la mayoría no tiene ni eso. Pero la ventaja competitiva *articulada* en toda la documentación (saber cuándo callar y cuándo hablar) es precisamente lo que no existe todavía. Cerrar esa brecha específica — no agregar más superficie de producto — es la apuesta de mayor apalancamiento que tiene LUZ en este momento.

---

## 12. Lista priorizada de features

| # | Feature | Problema que resuelve | Valor para el usuario | Dependencias | Complejidad | Impacto | Prioridad |
|---|---|---|---|---|---|---|---|
| 1 | Reparar o retirar el pipeline de Conocimiento roto | Cada mensaje real dispara hoy un job condenado a fallar | Indirecto (estabilidad), pero crítico | Ninguna — ya autorizado en parte por ADR-0014 | Media | Alto (riesgo activo) | **P0** |
| 2 | Persistencia real de Objetivo/Proyecto/Hábito | Dashboard, Reality Snapshot y Life Orchestrator no pueden funcionar sin esto | Alto — LUZ empieza a saber hacia dónde vas, no solo qué dijiste | Ninguna | Media | Alto | **P0/Beta** |
| 3 | Activar `core/knowledge-engine` de verdad (Fase B/C ADR-0014) | Hoy Conocimiento no produce ningún insight real | Alto, indirecto | #1 | Alta | Alto | Beta |
| 4 | Retrieval semántico de Memoria (embeddings) | Recuperación por coincidencia literal se pierde matices y sinónimos | Medio-Alto | Ninguna técnica; sí de costo (embeddings) | Media | Medio | Beta |
| 5 | Conector Gmail | Primera fuente real de contexto fuera de la conversación | Alto | ADR-0015 (Proposed → aprobar) | Alta | Alto | Beta |
| 6 | Reality Snapshot enriquecido con `life` real | Hoy dos tercios del contrato están vacíos | Alto, indirecto | #2 | Baja (una vez #2 existe) | Alto | Beta |
| 7 | Presencia — versión mínima (silencio vs. intervención básica) | Es el diferenciador declarado y hoy no existe en absoluto | Muy alto | #3, #6, idealmente Human Model | Muy alta | Muy alto | V1 |
| 8 | Life Orchestrator — versión mínima | Sin esto, Objetivos/Proyectos son solo datos, no acompañamiento | Alto | #2, #3 | Muy alta | Alto | V1 |
| 9 | Human Model (si el Founder autoriza su implementación) | Hoy no existe ninguna comprensión evolutiva de la persona | Muy alto | #3 | Muy alta | Muy alto | V1 |
| 10 | Etapa Consolidate de Memoria | Sin ella, la memoria nunca pierde valor de forma deliberada | Medio | Ninguna | Media | Medio | V1 |
| 11 | Detección automática de Rutinas | Hoy solo existen Hábitos declarados, nunca detectados | Medio-Alto | #3 | Alta | Medio | V1 |
| 12 | Conector Calendario | Segunda fuente de contexto externo | Medio-Alto | #5 (mismo patrón) | Alta | Medio | V1/Future |
| 13 | "Journey" como entidad de primer nivel | Objetivos/Proyectos individuales no capturan el arco emocional real | Alto, pero sin arquitectura propuesta todavía | #2 | Desconocida — necesita spec primero | Alto | Future |
| 14 | `Relationship` entre Personas + LifeGraph multi-miembro | Hoy LUZ solo modela a una persona sola | Medio (nadie lo pide activamente en Alpha) | Ninguna técnica | Alta | Medio | Future |
| 15 | Ingesta real de Documentos | Tabla dormida sin ningún consumidor hoy | Medio | Ninguna | Media | Bajo-Medio | Future |

---

## 13. Cómo usar este documento

Este documento **no reemplaza** ningún ADR, ninguna spec de arquitectura, ni la investigación en curso — los complementa, dándoles un solo lugar donde se puede ver, de un vistazo, qué es real y qué no. Cuando una decisión tomada aquí (la taxonomía, la unificación de los vocabularios de relación, cualquier prioridad) necesite convertirse en arquitectura vinculante, debe pasar por un ADR propio — este documento no se auto-autoriza, igual que ningún documento Proposed de los que sintetiza.

Se recomienda:
1. Confirmar o corregir la jerarquía de evidencia y la taxonomía de dominios (Secciones 0–2) — es la base de todo lo demás.
2. Decidir explícitamente sobre la Sección 8.3 (autorizar formalmente ADR-0014, y aclarar el estado de ADR-0015 dado que su código ya existe).
3. Usar la Sección 12 como entrada directa para la próxima serie de sprints — empezando por los dos ítems P0, que no son features nuevas sino brechas activas.
