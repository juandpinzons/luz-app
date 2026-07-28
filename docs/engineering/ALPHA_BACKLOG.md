# Alpha Backlog

Backlog vivo del Alpha de LUZ (Sprint de Observabilidad y Operación,
2026-07-18). Se actualiza en cada sesión de trabajo — no es un
documento de arquitectura, es una lista de tickets reales derivados de
evidencia (logs, base de datos de producción, reportes de usuarios
reales), nunca de suposición.

Prioridades: **P0** bloquea el uso (se arregla de inmediato) · **P1**
duele pero es usable · **P2** mejora de UX/performance/DX · **P3** ideas
futuras.

---

## P0 — Crítico

Ninguno abierto al cierre de este sprint (2026-07-24, War Room). Dos P0
reales, ambos encontrados y cerrados el mismo día contra evidencia real
de producción (logs de `events`, y las funciones de `core/life`
ejecutadas directo contra los 13 usuarios reales) — ver "Resueltos"
abajo y ADR-0017 (amendment 2026-07-24).

---

## P1 — Alto

### P1-1. Knowledge Engine desconectado — ✅ Resuelto (2026-07-25)
**Descripción original**: `core/knowledge/` (conectado al worker y a
la cola `knowledge_jobs`) eran etapas stub que fallaban a propósito.
`core/knowledge-engine/` (M3, real) tenía 4/6 etapas construidas pero
le faltaban Extract y Generate (ambas requieren IA), y no estaba
conectado a nada. La cola crecía sin procesar con cada mensaje.
**Hecho**: las seis etapas están construidas y ensambladas en
`DefaultKnowledgeEngine` (`core/knowledge-engine/engine/default-knowledge-engine.ts`)
— `DefaultExtractStage` real, `AIInsightGenerationStrategy` llamando
`generateStructured()` de verdad. Conectado vía un cron real de Vercel
(`app/api/cron/knowledge-worker/route.ts`, `0 5 * * *`, límite de plan
Hobby) que drena `knowledge_jobs` con `SELECT ... FOR UPDATE SKIP
LOCKED` — antes de esto, 146 jobs pendientes, 0 insights generados,
siempre. Además, un **Reasoning Engine** distinto
(`core/knowledge-engine/reasoning/`) corre en la misma pasada del
worker (`enrichKnowledgeGraph`), produce `ReasoningConclusion[]`
persistidas, y `ReflectStrategyRule` en
`core/conversation-strategy-engine` las consume para que la
conversación reaccione a patrones ya razonados (no solo a memorias
sueltas). Todo el pipeline de chat (Context → Conversation Strategy →
Reasoning → Presence → Voice → LLM) quedó cableado end-to-end el mismo
sprint (commit `e426771`). Verificado leyendo cada stage real (sin
TODOs/stubs en el camino), pendiente de una verificación contra
producción en vivo (cron corrió por primera vez el 2026-07-25 según el
docblock de la ruta).
**Complejidad restante**: Ninguna — cerrado. Ver ADR-0018 (Architecture
V1 Frozen): no se agregan más engines a partir de acá sin validación
de usuario real.

### P1-2. Sin rate limiting en `/api/chat` — ✅ Resuelto (2026-07-19)
**Descripción**: cualquier usuario autenticado (o cuenta comprometida)
podía enviar mensajes sin límite, cada uno con costo real de OpenAI.
**Impacto**: riesgo financiero directo si el tráfico crece o alguien
abusa — sin ningún control de costo por usuario.
**Hecho**: `features/chat/services/check-rate-limit.ts` — 20
mensajes/5 min por usuario, contra la tabla `events` (`message_sent`)
ya existente, sin librería ni tabla nueva. Llamado en
`app/api/chat/route.ts` justo después de resolver la identidad, antes
de cualquier trabajo real (DB, LifeGraphContext, OpenAI) — responde
`429` con `Retry-After` si se excede. Verificado con datos reales en
la base de datos local (no solo lectura de código): 19 mensajes
permite, el 20º bloquea, `retryAfterSeconds` correcto, y el estado
vuelve a `allowed: true` tras limpiar la ventana.
**Límite ajustable**: vive como constante en el archivo, sin
migración — 20/5min es un punto de partida conservador para el
tamaño actual del pilotaje, no un valor final.

### P1-3. Plan Hobby de Vercel
**Descripción**: el proyecto vive en un plan que técnicamente no
permite uso comercial, con límites de función/ancho de banda bajos.
**Impacto**: con más usuarios reales, esto se vuelve un bloqueo real,
no solo un tecnicismo — el servicio podría caerse por límites de plan
antes que por un bug.
**Prioridad**: P1.
**Solución sugerida**: evaluar upgrade a Pro antes de invitar más
gente o compartir el link más ampliamente.
**Complejidad estimada**: Baja (decisión + pago, no código).

### P1-4. Ranking de memoria con frases-gatillo muy angostas — ✅ Resuelto, alcance mínimo (2026-07-19)
**Descripción**: `DeterministicMemoryRankingStrategy` no reconoció "me
fue infiel" como señal de comprensión en una conversación real
(majo1502) — la lista de frases-gatillo es más angosta que el lenguaje
real de la gente.
**Impacto**: memorias genuinamente importantes pueden rankear igual que
un simple "hola", perdiendo prioridad en Context Builder / Morning
Brief.
**Hecho**: agregadas "me fue infiel"/"me engañó"/"me traicionó" (y sus
equivalentes en inglés) a la categoría `relationship_change` de
`UNDERSTANDING_SIGNALS` — mismo mecanismo determinista de keyword
matching que ya existía, sin lógica nueva. Alcance deliberadamente
mínimo por decisión explícita del Founder: solo el caso real
documentado, sin inventar una lista más amplia sin un segundo caso real
— ninguna capacidad de detección semántica agregada, ningún cambio de
comportamiento fuera de esta lista.
**Complejidad real**: Baja, como se estimó.

### P1-5. Sin rate limiting en `/api/chat` (duplicado de P1-2, reconfirmado)
Ver P1-2. Revisión de seguridad inicial (2026-07-19) lo reconfirma como
el hallazgo de mayor impacto: sin límite por usuario, un abuso o una
cuenta comprometida genera gasto ilimitado de OpenAI sin ninguna
alarma — no hay una segunda entrada aquí, se consolida en P1-2.

---

## Seguridad y privacidad (línea secundaria, iniciada 2026-07-19)

Primer pase real, no una auditoría exhaustiva — evidencia concreta,
sin inventar riesgos hipotéticos.

**Verificado, sin hallazgo**: ningún secreto (`sk-`, `GOCSPX-`, cadenas
de conexión) ha sido commiteado al historial de git nunca.
`conversation_messages`/`memories` ya filtran correctamente por
`userId` en cada consulta — sin fuga entre usuarios (confirmado antes,
reconfirmado aquí). Cookies de sesión de Auth.js usan `httpOnly`,
`secure`, `sameSite: lax` por defecto — configuración correcta, no
tocada por nosotros.

### SEC-1. Sin headers de seguridad explícitos — ✅ Resuelto parcialmente (2026-07-19)
**Descripción**: `next.config.ts` no definía ningún header de
seguridad.
**Hecho**: agregados `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` —
verificados en local (headers reales presentes, sin errores en el
servidor).
**Pendiente, a propósito**: una Content-Security-Policy estricta queda
fuera de este cambio — necesita probarse con cuidado contra el flujo
real de login de Google antes de desplegarse (un CSP mal configurado
puede romper el redirect de OAuth), no se improvisa en el mismo
commit que lo demás.
**Prioridad restante**: P2.
**Complejidad estimada (CSP)**: Media — requiere verificación real
contra el login antes de aplicar.

### SEC-2. Sin rate limiting a nivel de autenticación
**Descripción**: `/api/auth/*` (manejado por Auth.js) no tiene límite
de intentos propio nuestro.
**Impacto**: bajo hoy (OAuth con Google, no hay contraseña que fuerza
bruta pueda romper), pero vale la pena revisar si se agregan más
proveedores de login en el futuro.
**Prioridad**: P3 — no urgente mientras el único proveedor sea Google.
**Solución sugerida**: ninguna todavía, solo observación.
**Complejidad estimada**: N/A.

---

## P2 — Mejoras

### P2-1. Sin streaming de respuestas de IA — ✅ Resuelto
**Descripción original**: `AIProvider.generateReply()` esperaba la
respuesta completa antes de devolver nada.
**Hecho**: `AIProvider.generateReplyStream()` real
(`ai/providers/openai-provider.ts`), consumido por `sendMessageStream`
(`features/chat/services/send-message.ts:494`) y expuesto vía SSE en
`app/api/chat/route.ts` (`handleStreamRequest`, activado por
`?stream=1` o el header equivalente que use el cliente). Verificado
leyendo el código real, no solo el commit — sin TODOs en el camino.

### P2-2. `DefaultConnectStage.connect()` no escala por persona
**Descripción**: trae TODAS las memorias del LifeGraph en cada mensaje
nuevo para buscar conexiones estructurales.
**Impacto**: ninguno hoy (pocos mensajes por persona); se degrada con
el tiempo para usuarios de uso intensivo y sostenido.
**Prioridad**: P2.
**Solución sugerida**: paginar o limitar candidatos por recencia/rank
antes de comparar.
**Complejidad estimada**: Media.

### P2-3. Dominio propio sin configurar
**Descripción**: la app sigue en `*.vercel.app`; se mencionó un dominio
comprado en Porkbun, nunca se conectó.
**Impacto**: cosmético/percepción de producto, no funcional.
**Prioridad**: P2.
**Solución sugerida**: agregar el dominio en Vercel → Settings →
Domains, apuntar DNS en Porkbun.
**Complejidad estimada**: Baja.

### P2-4. Comportamiento de navegadores integrados (WhatsApp, etc.)
**Descripción**: al menos un usuario (Verónica) entró desde el
navegador integrado de WhatsApp — funcionó, pero esos navegadores
manejan cookies de sesión distinto a uno completo.
**Impacto**: ninguno confirmado — señal a vigilar, no un bug activo.
**Prioridad**: P2 (vigilancia, no arreglo).
**Solución sugerida**: ninguna todavía — solo observar si aparece un
patrón de deslogueo inesperado.
**Complejidad estimada**: N/A.

---

## P3 — Futuro

### P3-1. Alpha-2 (Gmail)
Pausado explícitamente por el Founder hasta que el Founder Acceptance
Test se sienta sólido. Ver `docs/engineering/BETA_ROADMAP_V1.md`.

### P3-2. Sistema de feedback dentro de la app — ✅ Resuelto
Desplegado (commit `0969afc`): `/feedback`, `/api/feedback`,
`features/feedback/`, tabla `feedback_responses` (migración
`0010_lively_bug.sql`, aplicada en cada deploy vía `drizzle-kit
migrate` en `package.json`'s `build`). `/admin` la consume.

### P3-3. Analítica más profunda (tracing distribuido, latencia por
etapa de DB individual)
Deliberadamente fuera de alcance del Sprint de Observabilidad — la
tabla `events` + logs estructurados ya responden las preguntas reales
que se necesitan al tamaño actual (8-10 usuarios). Construir más que
esto ahora sería sobre-ingeniería.

---

## Resueltos (2026-07-17 → 2026-07-18)

Todos verificados contra datos/logs reales de producción, no solo
código:

1. Sin indicador de carga en el chat → agregado.
2. Historial de conversación no persistía al recargar → `GET /api/chat`
   + carga en mount.
3. Condición de carrera entre historial cargado y mensaje en curso →
   corregida (nunca sobreescribe una conversación ya iniciada).
4. Input empujado fuera de pantalla en conversaciones largas → scroll
   interno + auto-scroll.
5. Respuestas de 20-32s por falta de instrucción de brevedad →
   `FavorBrevityRule`, ahora ~2-3s.
6. Conexión directa de Neon (antipatrón serverless) → pooled +
   `prepare:false`, causa probable de logins intermitentes — confirmado
   con Juan Pablo (una sola sesión, conversación fluida post-fix).
7. Proyecto duplicado en Vercel (`luz-app-duia`) → eliminado.
8. Bug real encontrado y corregido durante este mismo sprint: fecha mal
   serializada en un `sql` crudo de `/admin` (`events.createdAt >=
   today` fallaba con `ERR_INVALID_ARG_TYPE`) → reemplazado por
   helpers de Drizzle (`and`, `gte`), verificado contra datos reales.

## Resueltos (2026-07-24, War Room)

Ambos verificados contra datos/runtime reales de producción, no solo
lectura de código — ver ADR-0017 (amendment) y `DEPLOY_RUNBOOK.md`:

9. **25 errores de producción, 100% en `POST /api/chat`** (`` `after`
   was called outside a request scope ``): `finalizeReply` llamaba
   `after()` desde dentro del generador que alimenta el streaming —
   ahí Next.js ya perdió el scope de la petición. Corregido moviendo el
   registro de `after()` al route handler (scope válido, antes de
   devolver el stream); `sendMessageStream` expone
   `backgroundTasksReady` para que el handler espere el resultado.
   Verificado con streaming real contra la base local (título generado
   correctamente, cero errores nuevos). Commit `212b248`, desplegado.
10. **Dashboard/Life vacío para los 13 usuarios reales**: migración
    `0011_left_imperial_guard` (tablas `life_goals`/`life_projects`/
    `life_habits`/`life_routines`/`life_relationships`) estaba
    commiteada desde hace días pero nunca se corrió contra producción —
    nada en el pipeline de Vercel ejecutaba `drizzle-kit migrate`
    automáticamente. Confirmado corriendo `listActiveGoals`,
    `listActiveProjects`, `getUpcomingDeadlines`, `buildMorningBrief`
    directo contra los 13 usuarios reales: 100% fallaban con `relation
    "life_goals" does not exist`. Corregido aplicando la migración
    contra producción; re-verificado después: 0/13 fallos. Prevención
    permanente: `package.json`'s `build` ahora es `drizzle-kit migrate
    && next build` — cada deploy aplica migraciones pendientes antes de
    construir, y falla ruidosamente si `drizzle-kit migrate` no puede
    aplicarlas, en vez de desplegar código que espera tablas que no
    existen (ver `DEPLOY_RUNBOOK.md`).
