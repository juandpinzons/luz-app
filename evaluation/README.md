# Evaluation — arnés de experimentos A/B para el pipeline de contexto

Herramienta permanente, no un script de una vez. Existe para responder una pregunta concreta cada vez que el pipeline de contexto cambia: **¿esto que agregamos/cambiamos realmente cambia la experiencia, o es contexto que el modelo ignora?**

## Qué hace

1. Toma un `RealitySnapshot` base (fixture, reproducible — nunca datos reales de una cuenta).
2. Para cada variante de un experimento, cambia **exactamente un factor** (ej. `concepts` poblado o vacío) y reconstruye el resto del pipeline real y sin modificar: Context Engine → Conversation Strategy Engine → Presence Engine → Voice Engine → Conversation Rules → `renderContextToMessages`. Todo lo que no es el factor bajo prueba —RealitySnapshot base, Conversation Rules, Voice, modelo, mensaje del usuario— queda idéntico por construcción, no por disciplina manual.
3. Llama al `AIProvider` real (`generateReply`) N veces por variante.
4. Puntúa cada respuesta con heurísticas deterministas (longitud, cumplimiento del límite de líneas de Voice, coincidencia léxica con el contexto conocido) y, opcionalmente, con un juez de IA que evalúa cada respuesta **de forma ciega e independiente** (nunca ve la otra variante, para evitar el sesgo de posición conocido de "LLM como juez") en 5 dimensiones: personalización, uso de contexto, coherencia con el historial, referencias a largo plazo, naturalidad.
5. Imprime un reporte en consola y guarda uno permanente en Markdown (`evaluation/results/`, ignorado por git — son resultados de experimentos, no código fuente).

## Cómo correrlo

```bash
npm run eval -- --experiment=identity-in-conversation
```

Necesita una API key real (`OPENAI_API_KEY` en `.env`) — cada corrida hace llamadas reales y tiene costo real.

**Antes de gastar crédito real, verifica que la herramienta misma funciona:**

```bash
npm run eval -- --dry-run
```

`--dry-run` usa `MockAIProvider` (respuestas simuladas, cero llamadas reales) — confirma que el aislamiento de variantes, las repeticiones, el formato del reporte y el schema del juez están bien construidos. **Un dry-run exitoso no valida nada sobre si Identidad (o cualquier factor) mejora a LUZ — solo que la herramienta que lo mediría está bien construida.**

### Flags

- `--experiment=<nombre>` — cuál experimento correr (`evaluation/experiments/`, registrado en `cli.ts`). Por defecto: `identity-in-conversation`.
- `--dry-run` — sin llamadas reales, ver arriba.
- `--repetitions=<n>` — cuántas veces correr cada variante (por defecto 3). Las respuestas de un LLM son estocásticas; una sola corrida por variante no es suficiente para concluir nada.
- `--no-judge` — desactiva el juez de IA (una llamada menos por repetición). Las heurísticas siempre corren, son gratis.
- `--provider=openai|kimi` — qué `AIProvider` registrado usar (por defecto `openai`).

## Limitaciones conocidas, declaradas a propósito

- **Temperatura:** `AIProvider.generateReply()` (`ai/provider.ts`) no expone un parámetro de temperatura — no hay forma de fijarla a través del contrato existente. Queda igual entre variantes por construcción (misma llamada exacta, mismo código), pero no es configurable a un valor determinista. Agregarlo tocaría un contrato gobernado por ADR (0003/0016/0017) — deliberadamente fuera de alcance de esta herramienta.
- **RealitySnapshot fijo, no de una cuenta real:** por diseño — un experimento controlado necesita un input fijo, no uno que cambie cada vez que alguien más usa la app. Si se quiere probar contra una cuenta real, la función `buildExperimentContext` (`run-experiment.ts`) acepta cualquier `RealitySnapshot`; conectar uno real (vía `assembleRealitySnapshot` + `db`) es una extensión futura, no construida aquí.
- **El juez es un LLM evaluando a otro LLM.** Es una señal más, no una verdad objetiva — por eso corre junto a heurísticas deterministas, nunca solo.

## Agregar un experimento nuevo

Un archivo nuevo en `experiments/`, que construya un `Experiment` (`types.ts`) con 2+ variantes — nunca tocar `run-experiment.ts`. Regístralo en `EXPERIMENTS` (`cli.ts`). Mismo patrón que `CONVERSATION_RULES`/`AI_PROVIDER_NAMES` en el resto del repo.
