# Capa de Presencia

Servicio de backend determinístico. Consume `LifeDashboardSnapshot`,
`LifeObservation[]` y `FollowUpRecommendation[]` (los tres, ya
calculados por `features/dashboard/`) y produce un `PresenceState`:
"¿qué debería reconocer LUZ primero al abrir el día?".

Sin IA, sin repositorios, sin base de datos, sin motor nuevo. Vive en
`features/`, no en `core/` -- mismo criterio que `features/dashboard/`
(ver ADR-0018 y `docs/engineering/LIFE_DASHBOARD_SNAPSHOT_V1.md`: una
"Capa de Presencia canónica" al nivel de `RealitySnapshot` se propuso y
se descartó deliberadamente para no violar el freeze de arquitectura;
esto es un agregador de solo lectura sobre datos que otro módulo ya
calculó, igual que el propio Dashboard).

No confundir con `core/presence-engine/` (`PresenceStance`/`PresenceMode`):
ese motor decide *cómo* está presente LUZ dentro de una respuesta de
chat (tono relacional). Esto decide *qué* mostrar al abrir el día. Dos
responsabilidades distintas que comparten nombre por coincidencia de
dominio, no de implementación.

## Estructura

```
presence/
  domain/        PresenceState y sus tipos (el contrato)
  services/       funciones puras de un solo propósito
  application/    buildPresenceState -- el único punto de entrada público
  tests/          fixtures.ts + script standalone con datos sintéticos
```

## `PresenceState`

| Campo | Tipo | De dónde sale |
|---|---|---|
| `asOf` | `Date` | `snapshot.generatedAt` -- único timestamp del objeto completo |
| `greeting` | `string` | hora del día en Bogotá, nunca el nombre de la persona (Presence no recibe datos de identidad) |
| `primaryFocus` / `secondaryFocus` | `PresenceFocusItem \| null` | las 1-2 `LifeObservation` de mayor prioridad, proyectadas (ver abajo) |
| `attentionNeeded` | `FollowUpRecommendation[]` | hasta 3, nunca `CELEBRATE_PROGRESS` ni `NO_ACTION` |
| `recentProgress` | `FollowUpRecommendation[]` | hasta 3, solo `CELEBRATE_PROGRESS` |
| `encouragement` | `string \| null` | derivado 1:1 de `recentProgress` -- `null` si está vacío, nunca una frase de relleno |
| `urgency` | `PresenceUrgencyLevel` | máxima prioridad dentro de las recomendaciones accionables (sin recortar a 3) -- las celebraciones nunca cuentan |

`PresenceFocusItem` es una proyección de `LifeObservation` sin
`evidence` (blob de depuración de tipos mixtos) ni `generatedAt`
(redundante con `asOf`). `FollowUpRecommendation` se reusa tal cual --
ya es el "modelo" público documentado de `features/dashboard/`, no
tenía sentido inventar una segunda forma de nombrar lo mismo.

## Qué cambió en esta revisión (Misión "Presence Integration")

La Tarea 1 pedía revisar la V1 buscando problemas reales, no inventar
mejoras. Se encontraron y corrigieron cuatro:

1. **Lógica duplicada.** `buildEncouragement` y `computeUrgency`
   filtraban el mismo arreglo de recomendaciones por criterios
   parecidos pero no idénticos (`CELEBRATE_PROGRESS` en un lado,
   `CELEBRATE_PROGRESS` + `NO_ACTION` en el otro). Ahora
   `partition-recommendations.ts` decide una sola vez qué es
   "accionable" vs "para celebrar"; ambas funciones reciben ya la
   lista que les corresponde.
2. **Inconsistencia.** `encouragement` se calculaba sobre el arreglo
   completo de recomendaciones, pero `PresenceState.recommendations`
   (ahora `attentionNeeded`) mostraba solo el top-3 mezclado por tipo.
   Podía mencionar una celebración que no aparecía en ningún lado del
   objeto. Ahora `encouragement` deriva siempre de `recentProgress`
   (ya recortado), así que todo lo que menciona el texto está también
   en la lista.
3. **Inconsistencia de orden.** `rank-observations.ts` ya se defendía
   explícitamente de confiar en que `buildLifeObservations` entrega su
   arreglo ordenado; `select-recommendations.ts` (ahora
   `rank-recommendations.ts` + `cap-recommendations.ts`) no aplicaba el
   mismo criterio y confiaba en el orden de `buildFollowUpRecommendations`
   sin reordenar. Ahora ambas rutas son igual de defensivas.
4. **Caso límite.** `NO_ACTION` (definido en la unión de tipos pero
   nunca construido hoy por `buildFollowUpRecommendations`) no se
   excluía de la lista de recomendaciones mostradas, solo de la
   urgencia. Si esa función alguna vez lo construyera, se habría
   mostrado como una "recomendación" con título "Sin acción necesaria".
   Ahora se descarta en el mismo lugar que decide accionable/celebración.

Ningún cambio toca el algoritmo de ranking/prioridad en sí (mismos
criterios de `priority`/`confidence`, mismo umbral de 3 por sección) --
son consolidaciones de dónde vive cada decisión, no una redefinición
de qué decide.

## Escenarios sintéticos

`tests/fixtures.ts` define 7 escenarios (busy work day, calm productive
day, recovery day, relationship day, goal crisis, celebration day,
empty account) reusados por `features/home/tests/` -- un solo lugar,
nunca datos duplicados entre las dos capas. Correr:

```bash
npx tsx features/presence/tests/build-presence-state.examples.ts
```

## Ver también

[`features/home/README.md`](../home/README.md) -- cómo Home consume
este contrato sin volver a decidir nada.
