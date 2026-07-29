# Life Dashboard Snapshot — v1 (backend, sin UI todavía)

**Status:** Implementado, sin conectar a ninguna página\
**Alcance:** `features/dashboard/services/build-life-dashboard-snapshot.ts`\
**Fecha:** 2026-07-29

## Qué es esto, y qué NO es

Responde una sola pregunta: *"¿cuál es el estado actual de la vida de
esta persona?"* — para el Dashboard actual, con datos que ya existen
en `core/life` (Goal/Project/Habit/Relationship).

**No es** una capa canónica de agregación para subsistemas futuros
(Daily Reflection, Weekly Review, Presence Engine v2, Future Planning,
Conversation Intelligence). Esa versión — un contrato de dominio nuevo,
al nivel de `RealitySnapshot` — se propuso primero y se descartó
deliberadamente: habría sido exactamente el tipo de "nuevo engine" que
`ADR-0018` congeló, construido para features que todavía no existen ni
tienen validación real de usuarios. El Founder confirmó explícitamente
la versión acotada (Dashboard únicamente) tras esa objeción.

Este archivo es el punto de partida para un futuro bloque de UI — no
está en producción, no lo consume ninguna página todavía.

## Por qué vive en `features/dashboard/`, no en `core/`

Mismo rol que `build-dashboard-summary.ts` (con el que convive, nunca
lo reemplaza): un agregador de solo lectura sobre repositorios de
`core/life` que ya existen. `core/life` no es uno de los engines
protegidos (Memory/Knowledge/Context/Reasoning) — es el dominio de
Goal/Project/Habit/Relationship, y este archivo solo lee de ahí, con
los mismos métodos `.list(context)` que ya usan `listActiveGoals`,
`listActiveProjects`, etc.

Cero tabla nueva, cero migración, cero contrato de motor tocado.

## Qué contiene

- **`domains`** — una entrada por cada una de las ocho áreas de vida
  (Wheel of Life), con conteos de Goals/Projects/Habits activos. Los
  dominios sin ninguna actividad quedan en la lista con todo en 0 —
  nunca se omiten (misma disciplina de "la ausencia real se representa
  como ausencia" que ya rige `RealitySnapshot`).
- **`overdue`** / **`upcoming`** — Goals/Projects activos cuya fecha ya
  pasó, o cae dentro de los próximos 14 días (mismo umbral que ya usa
  `app/dashboard/page.tsx`). Nunca incluye algo completado o cancelado.
- **`stalled`** — Goals/Projects/Habits activos sin actualizar en más
  de 30 días. `updatedAt` es un hecho de la fila, no una
  interpretación — el umbral es generoso a propósito.
- **`relationships`** — conteo total y por tipo.
- **`totals`** — Goals por status (incluye `paused`/`abandoned`, no
  solo activos) y Projects por status, más hábitos activos/inactivos.

Ningún campo es un puntaje inventado ni una interpretación — todo es
un conteo o una fecha trazable directamente a una fila real.

## Diseño: una sola consulta por entidad

`buildLifeDashboardSnapshot` trae Goals/Projects/Habits/Relationships
con una sola llamada a `repository.list(context)` cada uno —
`domains`/`overdue`/`upcoming`/`stalled`/`totals` se derivan todos de
esos mismos cuatro resultados, nunca de una segunda consulta filtrada.
Evita a propósito el antipatrón de "triple fetch" que esta misma
auditoría (War Room) encontró en `app/dashboard/page.tsx` para
Goals/Projects.

## Validación

Typecheck, lint, build de producción: limpios. Sin smoke tests reales
posibles en este entorno (sin Postgres) — se verificó la lógica de
derivación (activos vs. inactivos, vencidos vs. próximos, estancados,
cobertura por dominio, conteos por status) con un script standalone y
datos sintéticos que ejercitan los casos borde reales: un Goal
`paused` (cuenta como activo, mismo criterio que `listActiveGoals`),
un Project `on_hold` (cuenta como activo), un Goal `completed` con
fecha vencida (nunca aparece en `overdue`), un dominio sin ninguna
actividad (aparece en `domains` con todo en 0, no se omite).

Sin cambio a ninguna página — no observable en el navegador, por
diseño (mandato explícito: "solo el snapshot de backend, no la feature
todavía").
