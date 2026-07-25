# Observability Plan

Status: Partially implemented\
Owner: Founder\
Last verified: 2026-07-24

**Implemented (2026-07-24)**, everything that needed no open decision:
`events.route` on `message_sent` (so success rate / stream completion
are one query, no new table), `firstTokenMs` in its metadata, both
background tasks (`generate-title.ts`, `life-capture-service.ts`) now
`recordEvent` their failures instead of `console.error`/bare
`logger.log`, and `npm run obs:report` (`observability/report.ts`)
printing all of it as text. Verified against real production traffic —
see the commits for the exact before/after. **Not built**: a visual
panel, active alerts, fixed thresholds — all three still blocked on
the open decisions below.

Scope first, same discipline as `SMOKE_TEST_PLAN.md`: it's easy to
start emitting metrics and end up with data nobody looks at. Every
metric below answers a real operational question, has a threshold, an
owner, and a next action — a metric that doesn't clear that bar isn't
in this plan.

**Owner, for all of it, today**: the Founder — this is a team of one
plus Claude as copilot. "Owner" columns below aren't a formality; they
name who actually looks at it and does the next action, which matters
once this grows past one person.

## Three principles (Founder, 2026-07-24)

1. **Every metric answers a question.** If it doesn't change an
   operational decision, it doesn't belong on the panel.
2. **Every metric has an owner** — a concrete answer to "if this
   crosses its threshold, who looks, and at what first."
3. **Every alert is actionable.** Never "something looks off" — always
   the symptom plus where to look next. An alert that fires for a
   *known, already-accepted* condition (see Knowledge Engine below) is
   noise, not signal, and undermines trust in the rest.

## What already exists vs. what's new

Grounded against the real codebase, not assumed — this determines how
much of this plan is "wire up a query" vs. "add instrumentation":

| Already captured today | Where |
|---|---|
| Total message duration (request → finalize) | `events` (`type='message_sent'`, `metadata->>'durationMs'`) — written by `finalizeReply` in `send-message.ts` |
| Errors, tagged by route | `events` (`type='error'`, `route`, `message`) — written by `recordEvent` in `app/api/chat/route.ts`, `app/api/conversations/[id]/route.ts` |
| **Time to first streamed token** *(built 2026-07-24)* | `events` (`message_sent.metadata->>'firstTokenMs'`) — timestamped in `generate()` in `send-message.ts`, streaming path only |
| **`message_sent` tagged with `route`** *(built 2026-07-24)* | Was always `null` before — now `"POST /api/chat"`, so success rate and completed-vs-aborted are one query against `message_sent` + `error` on the same route, no new table |
| **Title / Life Capture failures** *(built 2026-07-24)* | `events` (`type='error'`, `route='background.title'` / `'background.life_capture'`) — both now call `recordEvent`; before, one used plain `console.error`, the other a console-only `logger.log`, neither queryable |
| Knowledge job status/failure | `knowledge_jobs.status`, `.lastError` — written by `worker/index.ts` |
| Migration drift | `drizzle.__drizzle_migrations` vs. the journal committed at `HEAD` (see `DEPLOY_RUNBOOK.md`) — now auto-applied on every deploy, so this should always read zero pending |
| Structured request-lifecycle logs | `core/observability/logger.ts` → Vercel stdout/stderr, e.g. `openai.response`, `api.request_completed`, `dashboard.*_failed` |
| **A text report over all of the above** *(built 2026-07-24)* | `npm run obs:report` (`observability/report.ts`) |

| Still needs building | Why |
|---|---|
| DB query latency | Not instrumented in app code — recommendation stands: use Neon's own Monitoring tab instead of building this |
| Visual panel | Blocked on the `/admin` publish decision, open below |
| Active alerts | No alert channel exists yet (Slack/email/webhook) |
| Fixed thresholds | Need a week of real traffic first — `obs:report`'s first production run (2026-07-24) already showed *why*: it correctly flagged a 57% success rate, but that was residual pre-fix errors from earlier the same day still inside the 24h window, not a live incident. A threshold set from one run would have been noise |

## Metrics

### Disponibilidad

| Métrica | Fuente | Objetivo | Umbral | Acción |
|---|---|---|---|---|
| Requests a `/api/chat` | ✅ Construido: `npm run obs:report` (`message_sent` + `error` count, `route='POST /api/chat'`) | Volumen real de uso | Informativo — no alerta | — |
| Tasa de éxito | ✅ Construido: `npm run obs:report` (`message_sent` / (`message_sent` + `error`) en la ventana) | Detectar respuestas fallidas | < 99% en 15 min | Consultar `events.message` agrupado — el incidente de hoy (25 errores, 1 causa) se habría visto acá de inmediato |
| Errores 5xx por ruta | `events` (`type='error'`, `group by route`) | Aislar qué endpoint se degrada | Incremento sostenido vs. la hora anterior | Revisar el `message` agrupado antes de asumir causa (regla ya aprendida hoy: nunca asumir, siempre leer el error real) |

### Experiencia

| Métrica | Fuente | Objetivo | Umbral | Acción |
|---|---|---|---|---|
| Latencia al primer token (P50/P95) | ✅ Construido: `message_sent.metadata.firstTokenMs`, `npm run obs:report` | Medir lo que ADR-0017 existe para mejorar — percepción de respuesta rápida, no la generación completa | P95 a definir contra datos reales de esta semana antes de fijar un número (evitar un umbral inventado) | Revisar proveedor de IA (latencia de OpenAI) vs. tiempo previo (Context Builder, Memory Engine) en el mismo request |
| Duración total del stream | Ya existe: `message_sent.metadata.durationMs` | Detectar generaciones anómalamente largas | P95 muy por encima de lo típico (ver `maxDuration = 60` en `route.ts` — el techo real de la plataforma) | Revisar si el mensaje era inusualmente largo o el proveedor estuvo lento |
| Streams completados vs. abortados | ✅ Construido: `npm run obs:report` (`message_sent` vs `error` en `POST /api/chat`, sin tabla nueva) | Detectar streams que se cortan a mitad de camino | < 99% completados | Revisar `events.message` para esa ventana |

### Sistema

| Métrica | Fuente | Objetivo | Umbral | Acción |
|---|---|---|---|---|
| Latencia de base de datos | **Recomendado: el dashboard de Neon** (Monitoring, ya lo tiene gratis — visto en la sesión de hoy), no instrumentación propia | Detectar degradación de Neon/pooler | Lo que Neon ya marque como anómalo | Revisar el dashboard de Neon directamente antes de construir nada propio — instrumentar esto a mano sería reconstruir algo que el proveedor ya da |
| Duración de background jobs (título, Life Capture) | **Todavía no construido**: falta timing propio en `generate-title.ts` / `life-capture-service.ts` (distinto de que ya se detecten sus fallos, abajo) | Detectar que estas tareas de fondo (que arreglamos hoy con el fix de `after()`) sigan siendo rápidas | Sin dato histórico aún — fijar umbral tras la primera semana | Revisar `events` una vez instrumentado |
| Fallos de título / Life Capture | ✅ Construido: ambos llaman `recordEvent(type:'error', route:'background.title'/'background.life_capture')`, `npm run obs:report` los agrupa | Detectar pérdida silenciosa de estas dos capacidades | Cualquier fallo repetido (>1 en 15 min) | Revisar el mensaje de error real, mismo criterio que el resto |
| Fallos de `knowledge_jobs` | `knowledge_jobs.status='failed'` (ya existe) | — **deliberadamente sin alerta todavía** | N/A | Ninguna: P1-1 (`ALPHA_BACKLOG.md`) ya documenta que el Knowledge Engine es un stub que falla a propósito hoy — alertar sobre esto ahora mismo sería ruido conocido, no señal (viola el principio 3). Revisar cuando P1-1 se resuelva, no antes |
| Migraciones pendientes | ✅ Construido: `npm run obs:report` (`drizzle.__drizzle_migrations` vs. journal en `git HEAD`, no en disco — ver `DEPLOY_RUNBOOK.md`) | Confirmar que el build-time gate de hoy sigue funcionando | Cualquier valor > 0 | Revisar el log de build del último deploy — si esto no es cero, el gate falló silenciosamente, investigar de inmediato |

## Instrumentation — naming convention

Para logs estructurados nuevos (capa de depuración, vía
`core/observability/logger.ts`, no la capa de métricas de arriba):
namespace punteado y consistente, en vez de nombres de evento libres
como hoy (`openai.response`, `dashboard.summary_failed` — inconsistentes
entre sí). Convención a partir de ahora:

```
chat.request.started
chat.request.completed
chat.request.failed
stream.started
stream.completed
stream.aborted
background.title.completed
background.title.failed
background.life_capture.completed
background.life_capture.failed
background.job.failed        -- knowledge_jobs, cuando P1-1 se resuelva
db.query.slow
```

Los eventos existentes (`api.request_completed`, `openai.response`,
etc.) no se renombran retroactivamente en este cambio — la convención
aplica a instrumentación nueva; migrar los nombres existentes es su
propio cambio, separado, si alguna vez vale la pena el churn.

## Decisiones abiertas (antes de escribir código)

1. **¿Dónde vive el panel?** `/admin` ya existe en código local, sin
   commitear (`app/admin/page.tsx`, junto con el feature de feedback
   in-app -- ver P3-2 en `ALPHA_BACKLOG.md`), con parte de esto ya
   resuelto (usuarios, conversaciones, error count). Extenderlo es la
   ruta obvia -- pero publicarlo es una decisión aparte que el Founder
   no ha confirmado todavía. Este plan no asume que se publica.
2. **¿Alertas activas o panel de consulta?** Hoy no existe ningún canal
   de alertas (sin Slack/email/webhook integrado). Mientras eso no
   exista, "alerta" en la tabla de arriba significa "algo que se
   revisa al abrir el panel", no un push automático -- si se quiere lo
   segundo, es una pieza de infraestructura nueva y separada.
3. **Umbrales de latencia**: los marcados como "a definir contra datos
   reales" arriba deberían fijarse después de una semana normal de
   uso, no inventados hoy -- un umbral sin datos reales detrás es
   exactamente el tipo de alerta no accionable que el principio 3
   quiere evitar.
