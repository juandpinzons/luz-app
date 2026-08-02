# Continuity System -- capa `features/`

Adaptadores para fuentes que viven en `features/` (Calendar/Gmail Foundation vía `features/reality/`, `FollowUpRecommendation` vía `features/dashboard/`) más los contratos de integración de producto (Experience/Presence/Daily Reflection/Morning Brief/Dashboard/Notification).

El dominio completo, el ciclo de vida, la persistencia y las reglas de apertura/cierre de fuentes `core/` (Memory/Goal/Project/Relationship/Curiosity) viven en **`core/continuity-engine/README.md`** -- léelo primero, este archivo solo documenta el porqué de la separación en dos módulos y qué vive aquí específicamente:

- `detection/`: `detectFromCalendarEvent`/`detectFromEmailSnapshot`/`detectFromRecommendation` + `detectAllContinuityLoops` (el orquestador completo -- envuelve el de `core/continuity-engine` y le suma estas tres fuentes).
- `resolution/`: `detectCalendarEventClosure`/`detectEmailClosure` + `evaluateAllLoopClosure` (mismo criterio, envuelve las reglas `core/` y agrega Calendar/Gmail, con `timeout_exceeded` siempre como último recurso).
- `integrations/`: los seis contratos de producto pedidos por la misión -- ninguno se llama hoy desde Experience/Presence/Dashboard/etc. (verificado, cero import cruzado en ese sentido).
