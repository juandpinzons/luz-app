# LUZ — Arquitectura Fundacional

Este documento registra las decisiones de arquitectura aprobadas por el CTO
y el estado de su implementación. Sirve como fuente de verdad para
cualquier sesión de desarrollo (humana o agente) que continúe este
proyecto sin el contexto de la conversación original.

## Roles

- El **CTO** decide la arquitectura.
- El **Lead Full Stack Engineer** (rol que sigue este documento) implementa
  las especificaciones de la forma más limpia y escalable posible, sin
  tomar decisiones de arquitectura por su cuenta. Si detecta un problema
  de diseño, lo propone con ventajas/desventajas antes de implementar.

Ver `AGENTS.md` / `CLAUDE.md` en la raíz del repo para las normas de
código (TypeScript estricto, sin `any`, componentes pequeños, etc.).

## Visión del producto

LUZ no es una app de chat con historial. Es una plataforma que construye
la **vida digital del usuario** alrededor de 4 conceptos: conversaciones,
diario, memoria y conocimiento derivado. El objetivo final es un
**Knowledge Graph Personal**: personas, proyectos, hábitos, objetivos,
eventos, documentos e insights conectados entre sí, que evoluciona con el
tiempo.

## Decisiones aprobadas (CTO Review)

1. **Estructura de carpetas** — feature-based.
   `app` → solo rutas y Route Handlers. `features` → lógica de producto.
   `core` → motores de dominio. `ai` → proveedores de IA. `components` →
   Design System. `worker` → procesos asíncronos. Las rutas nunca
   contienen lógica de negocio.

2. **`core/` es el dominio puro.** No depende de Next.js, React, Route
   Handlers ni componentes UI. Debe ser reutilizable desde Web, Mobile,
   CLI, Workers o APIs futuras. Solo usa `process.env` y librerías
   agnósticas de framework (Zod, Drizzle, `postgres`).

3. **AI Provider.** `ai/provider.ts` es únicamente la interfaz
   (`AIProvider`). Implementación inicial: `OpenAIProvider`. Todo el
   sistema depende solo de la interfaz — cambiar de proveedor implica
   editar únicamente `ai/index.ts`.

4. **Memory Engine.** Separación entre Structured Memory (hechos
   permanentes: nombre, objetivos, hábitos, preferencias, relaciones,
   trabajo — materializados en tablas tipadas, nunca EAV) y Semantic
   Memory (conversaciones, diario, documentos y notas indexados por
   significado vía embeddings + pgvector). El Memory Engine decide cuál
   consultar; nunca la UI ni las rutas.

5. **Knowledge Engine.** Pipeline explícito y en este orden exacto:
   `Extract → Classify → Relate → Generate → Validate → Persist`.
   `Validate` es una etapa explícita, no implícita dentro de `Generate`.
   El LLM propone (`Generate`); el Knowledge Engine valida y asigna
   confianza (`Validate`); solo entonces se persiste (`Persist`). El LLM
   nunca escribe directamente en memoria.

6. **Worker independiente.** Proceso completamente separado del servidor
   web. Ninguna ruta HTTP espera el procesamiento del Knowledge Engine.
   Mecanismo: cola de trabajos en PostgreSQL (`knowledge_jobs`) + worker
   dedicado que hace polling (sin Redis/BullMQ).

7. **Base de datos — esquema.** Modelo híbrido: tablas tipadas para
   entidades conocidas (`users`, `conversations`, `conversation_messages`,
   `journal_entries`, `documents`, `projects`, `goals`, `habits`,
   `people`, `insights`) + tablas transversales que dan forma al grafo
   (`entity_relations`, `evidence`, `memory_embeddings`,
   `knowledge_jobs`). Prohibido Entity-Attribute-Value. JSONB únicamente
   para `metadata`.

8. **ORM: Drizzle.** Por tipado TypeScript, SQL cercano al nativo, mejor
   integración con PostgreSQL/pgvector y menor complejidad de runtime
   frente a alternativas como Prisma.

9. **Autenticación: pendiente, no propia.** Se usará un proveedor
   estándar (Auth.js o equivalente) con PostgreSQL como almacenamiento.
   No se invertirá tiempo en reinventar auth — no es ventaja competitiva
   de LUZ. **Todavía no implementado** (ver "Pendientes" abajo).

10. **Base de datos: PostgreSQL.** Extensiones previstas: `pgvector`,
    UUID nativo (`gen_random_uuid()`, disponible desde PG13 sin
    extensión adicional), e índices adecuados. Nada dependiente de
    Neo4j ni de un motor de grafos dedicado.

11. **Principio de dependencias, estricto:**
    `UI → Features → Core → Infrastructure`. Nunca en sentido contrario.

12. **Orden de implementación del primer entregable** (no todas las
    features de una vez): (1) Configuración, (2) Drizzle + esquema,
    (3) AI Provider, (4) Memory Engine (interfaces), (5) Knowledge Engine
    (interfaces), (6) Worker, (7) Chat integrado con OpenAI. Embeddings
    y generación de insights quedan fuera de este primer entregable —
    solo interfaces y arquitectura preparadas.

## Estado de implementación

| # | Entregable | Estado | Notas |
|---|---|---|---|
| 1 | Configuración (env) | ✅ Hecho | `core/config/env.ts`, valida con Zod, falla explícito si falta una variable. |
| 2 | Drizzle + esquema inicial | ✅ Hecho | 14 tablas en `core/db/schema/*`, migraciones generadas y sin drift. Índices añadidos en columnas `user_id` y de búsqueda (Postgres no indexa FKs automáticamente). `docker-compose.yml` con `pgvector/pgvector` para dev local. |
| 3 | AI Provider | ✅ Hecho | `ai/provider.ts` (interfaz) + `ai/providers/openai-provider.ts` + `ai/index.ts` (factory). |
| 4 | Memory Engine | ✅ Interfaces + Structured real | `core/memory/memory-engine.ts`. Structured tiene CRUD real. Semantic lanza error explícito ("no implementado") hasta que existan embeddings. |
| 5 | Knowledge Engine | ✅ Interfaces + Persist real | `core/knowledge/pipeline/*`. Solo `Persist` tiene lógica real (escritura DB pura). Extract/Classify/Relate/Generate/Validate son stubs que fallan explícitamente. |
| 6 | Worker | ✅ Hecho | `worker/index.ts`, standalone (`npm run worker`), polling con `SELECT ... FOR UPDATE SKIP LOCKED` sobre `knowledge_jobs`. |
| 7 | Chat con OpenAI | ✅ Hecho | `features/chat/services/send-message.ts` persiste conversación/mensajes, llama a `AIProvider`, encola `knowledge_job` sin esperar. `app/api/chat/route.ts` es controlador delgado. |

Verificación realizada: `tsc --noEmit` y `eslint` sin errores en todo el
proyecto. Confirmado por búsqueda de texto que `core/` no importa
`next`/`react` en ningún archivo y que no hay `any` en
`core/ai/features/worker`.

## Pendientes explícitos (no implementados a propósito)

- **Autenticación (decisión #9).** No hay login real. Como el esquema
  exige `user_id` en todo lo que persiste el usuario, existe un puente
  temporal en `core/db/seed.ts`: `DEMO_USER_ID`, un usuario fijo que usa
  `app/api/chat/route.ts` mientras no exista Auth.js. Es un atajo
  explícito y fácil de localizar (`grep -rn DEMO_USER_ID`), no una
  implementación de auth alternativa. **Siguiente paso natural**: Auth.js
  sobre PostgreSQL, reemplazando este puente.

- **Embeddings y búsqueda semántica.** `SemanticMemoryRepository` lanza
  error. Falta: generación de embeddings al guardar mensajes/diario/
  documentos (vía `AIProvider` o un modelo de embeddings dedicado) y la
  consulta por similitud contra `memory_embeddings` (pgvector). También
  falta el índice vectorial (`ivfflat`/`hnsw`) sobre esa columna — no se
  creó porque la tabla todavía no tiene datos.

- **Generación real de insights (Knowledge Engine).** Las etapas
  Extract/Classify/Relate/Generate/Validate son stubs. Falta definir y
  implementar la lógica de negocio de cada una (probablemente con
  llamadas al `AIProvider` en Extract/Classify/Generate, y reglas
  determinísticas en Validate).

- **Índices vectoriales y tuning de rendimiento** una vez haya volumen
  real de datos.

## Cómo continuar en local / Claude Code

El proyecto ya vive en este repo (`/Users/juandavidps/Desktop/AXA/beta1.02/luz`).
No requiere migración: basta con abrir esta carpeta.

Comandos relevantes (`package.json`):

- `npm run dev` — servidor Next.js.
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle Kit.
- `npm run db:seed` — crea el usuario demo temporal (`DEMO_USER_ID`).
- `npm run worker` / `worker:dev` — worker del Knowledge Engine (proceso aparte).
- `docker-compose up -d` — PostgreSQL + pgvector local.

Variables de entorno: copiar `.env.example` a `.env` y completar
`DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.

**Nota de handoff:** el trabajo de este entregable está en el árbol de
trabajo, sin commitear a git (el único commit existente es el scaffold
inicial de `create-next-app`). Revisar `git status` antes de continuar.
