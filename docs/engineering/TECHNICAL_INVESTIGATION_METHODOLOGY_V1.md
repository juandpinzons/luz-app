# Technical Investigation Methodology v1

Version: 1.0\
Status: Adopted (Founder, 2026-08-02)\
Propósito: definir cómo LUZ investiga sospechas de cuello de botella,
sesgo, varianza o fallo arquitectónico en su propio sistema —
método científico, no intuición. Este documento no contiene ningún
hallazgo técnico ni ninguna decisión de arquitectura — contiene
únicamente las reglas del proceso de investigación. Describe cómo
investigamos, no qué encontramos.\
Related: `docs/research/RESEARCH_METHODOLOGY_V1.md` (metodología
hermana, para investigación de comportamiento humano — dominio
distinto, mismo espíritu de rigor), `docs/adr/` (destino de una
recomendación aceptada), `docs/legal/AI_DEVELOPMENT_POLICY.md`
(gobernanza de cómo la IA participa en ingeniería).

**Por qué existe un documento aparte de `RESEARCH_METHODOLOGY_V1.md`**:
esa metodología gobierna evidencia sobre *comportamiento humano*
(testimonios, patrones de vida, niveles de madurez Nivel 1-4). Esta
gobierna evidencia sobre *comportamiento del sistema* — código, datos
de producción, métricas medibles. Los dominios no se mezclan: un
hallazgo sobre por qué el Knowledge Engine no procesa memorias no es
un patrón de comportamiento humano, y un patrón de comportamiento
humano no se valida con precision/recall. Si algún día ambos
documentos entran en conflicto de principios generales (no de
contenido — cada uno gobierna su propio dominio sin excepción), esta
metodología no tiene autoridad sobre la de investigación humana ni
viceversa; se resuelve explícitamente, nunca por inferencia.

---

## Cuándo aplica

Toda investigación que pueda terminar recomendando un cambio a:
arquitectura, un algoritmo determinista existente, un umbral o
constante de calibración, o un componente que otros componentes ya
dependen de él en producción. **No aplica** a bugs triviales de una
línea con causa obvia y verificable en segundos (ver
`docs/engineering/claude` para el flujo normal de esos). La señal para
decidir: si la corrección propuesta se pudiera equivocar de forma
costosa — optimizar el componente equivocado, romper una invariante
que otro código asume, introducir un sesgo nuevo mientras se corrige
uno viejo — esto aplica.

## Las siete secciones, en orden estricto

Ninguna sección se salta, ninguna se adelanta. Una recomendación
escrita antes de tener resultados no es una recomendación informada,
es la misma intuición que este método existe para reemplazar.

### 1. Observaciones

Hechos observables únicamente. Cero interpretación, cero conclusión.
Cada observación cita su evidencia medible exacta — la consulta, el
archivo y línea, o el comando que la produjo, de forma que cualquiera
pueda repetirla. "El sistema parece lento" no es una observación;
"el endpoint X tardó 1400ms en la traza Y, timestamp Z" sí lo es.

### 2. Mediciones

Cuantificar, nunca calificar con adjetivos. Solo se reportan aquí las
métricas ya computables a partir de datos existentes (distribuciones,
conteos, porcentajes). Las métricas que requieren una comparación
contra una verdad de referencia que todavía no existe (recall,
precision, falsos negativos) **no se inventan aquí** — se declaran
como preguntas abiertas que la Sección 4 debe responder. Reportar un
número sin el experimento que lo produce es exactamente el tipo de
"solución basada en intuición" que este método prohíbe.

### 3. Hipótesis

Una o más hipótesis, cada una **falsable**: debe existir un
experimento posible cuyo resultado pueda mostrar que la hipótesis es
falsa. Formular explícitamente alternativas, no solo la hipótesis
favorita — como mínimo: una hipótesis de calibración (umbral/peso mal
ajustado), una hipótesis de otra etapa limitante, una hipótesis de
alcance limitado (el problema no generaliza), y una hipótesis nula
(no hay problema real, el comportamiento observado es correcto por
diseño). No asumir causalidad únicamente porque exista correlación
temporal o narrativa.

### 4. Experimentos

Un experimento por hipótesis relevante, cada uno con:

- **Objetivo** — qué hipótesis específica confirma o refuta.
- **Metodología** — pasos reproducibles.
- **Variables** — qué se mide, qué se mantiene fijo.
- **Métricas** — el número exacto que el experimento produce.
- **Criterio de éxito** — qué resultado confirmaría la hipótesis.
- **Criterio de fracaso** — qué resultado la refutaría. Debe existir
  siempre; un experimento sin forma de fallar no es un experimento.

Cuando la hipótesis involucra clasificación (¿esto debería o no
debería disparar X?), el experimento preferido es un benchmark contra
datos reales con una clasificación independiente — idealmente humana.
Si no hay un humano disponible en el momento de la investigación, se
permite una clasificación propia como sustituto, **siempre declarado
explícitamente como sustituto, nunca presentado como validación
humana** — y la clasificación debe hacerse ciega al resultado del
sistema bajo evaluación (nunca mirar el veredicto actual antes de
juzgar el caso) para no contaminar el experimento con el propio sesgo
que se está midiendo.

### 5. Resultados

Solo lo que los experimentos realmente produjeron. Ninguna
interpretación todavía, ni siquiera una frase de transición que insinúe
una conclusión — los números, las tablas, los casos citados, nada más.

### 6. Conclusiones

Solo después de tener resultados. Cada conclusión declara:

- Qué evidencia exacta la respalda (cita a la Sección 5).
- Qué hipótesis de la Sección 3 confirma.
- Qué hipótesis descarta, y con qué evidencia.
- Nivel de confianza, justificado — no un número inventado.

**Si la evidencia contradice la hipótesis inicial, la evidencia
gobierna**, sin excepción y sin necesidad de justificar por qué se
abandona la hipótesis favorita. Si durante la investigación aparece
una hipótesis mejor que ninguna de las originales, se documenta y se
evalúa con el mismo rigor — este método nunca se cierra en las
hipótesis con las que empezó.

### 7. Recomendaciones

Solo al final. Cada opción propuesta — nunca una sola, salvo que
genuinamente no exista alternativa razonable — incluye:

- Impacto esperado.
- Riesgos.
- Costo.
- Complejidad.
- Compatibilidad con Architecture V1 (`docs/adr/ADR-0018_ARCHITECTURE_V1_FROZEN.md`
  — ¿esto es una nueva capacidad dentro de un módulo existente, o
  exige un `core/*-engine` nuevo? esa pregunta se responde aquí,
  explícitamente).
- Impacto sobre Responsible AI (`docs/legal/AI_DEVELOPMENT_POLICY.md`
  — quién decide, qué trazabilidad queda).
- Impacto sobre sesgo — ¿la opción propuesta introduce un sesgo nuevo
  mientras corrige el que se investigó?
- Impacto sobre varianza — ¿hace el comportamiento del sistema más o
  menos predecible?
- Impacto sobre evaluabilidad futura — ¿deja el sistema más fácil o
  más difícil de medir la próxima vez que alguien necesite repetir
  este mismo tipo de investigación?

Una recomendación nunca es una implementación. Cruzar de recomendación
a código es una decisión del Founder, igual que cualquier cambio de
arquitectura en este proyecto.

---

## Restricciones, permanentes, sin excepción

1. **No modificar código de producción hasta terminar toda la
   investigación.** Consultas de solo lectura contra producción,
   scripts de análisis, y benchmarks son parte legítima de investigar
   — no son "modificar código."
2. **No asumir causalidad únicamente porque exista correlación.** Dos
   eventos ocurriendo cerca en el tiempo son una observación, no una
   conclusión.
3. **No optimizar ningún componente sin haber demostrado, con un
   experimento, que es realmente el cuello de botella** — no el que
   parece más sospechoso, no el que es más fácil de arreglar.
4. **Si aparece una hipótesis mejor durante la investigación,
   documentarla y evaluarla** con el mismo estándar que las
   originales, en vez de forzar el hallazgo dentro de la hipótesis con
   la que se empezó.
5. **Si la evidencia contradice la hipótesis inicial, la evidencia
   gobierna.** Ninguna conclusión se ajusta para proteger una hipótesis
   favorita.

## Qué no es este documento

- No contiene ningún hallazgo técnico — esos viven en investigaciones
  individuales, cada una su propio documento (ver
  `docs/engineering/investigations/`).
- No autoriza ningún cambio de código o arquitectura por sí mismo —
  define el proceso por el cual esos cambios se proponen, nunca los
  aplica.
- No reemplaza `docs/research/RESEARCH_METHODOLOGY_V1.md` — dominios
  distintos, ambos vigentes.
- No es definitivo. Si esta metodología necesita corregirse, se
  corrige con la misma honestidad que le exige a cualquier
  investigación — explícitamente, con la razón documentada.
