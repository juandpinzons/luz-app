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

Ninguno abierto al cierre de este sprint (2026-07-18). Todos los P0
reales encontrados durante el pilotaje (auth intermitente, conversación
perdida al recargar, input inaccesible en conversaciones largas) fueron
arreglados el mismo día que se detectaron — ver "Resueltos" abajo.

---

## P1 — Alto

### P1-1. Knowledge Engine desconectado
**Descripción**: `core/knowledge/` (conectado al worker y a la cola
`knowledge_jobs`) son etapas stub que fallan a propósito.
`core/knowledge-engine/` (M3, real) tiene 4/6 etapas construidas pero
le faltan Extract y Generate (ambas requieren IA), y no está conectado
a nada. La cola crece sin procesar con cada mensaje.
**Impacto**: LUZ no "sigue pensando" en segundo plano como se pidió —
ninguna funcionalidad visible rota hoy, pero es una promesa de producto
sin cumplir, y la tabla `knowledge_jobs` crece indefinidamente.
**Prioridad**: P1.
**Solución sugerida**: construir Extract + Generate con `AIProvider`,
ensamblar el `KnowledgeEngine` real de M3, conectarlo vía un cron de
Vercel (no un worker persistente — la plataforma no lo soporta).
**Complejidad estimada**: Media-Alta (un sprint completo).

### P1-2. Sin rate limiting en `/api/chat`
**Descripción**: cualquier usuario autenticado (o cuenta comprometida)
puede enviar mensajes sin límite, cada uno con costo real de OpenAI.
**Impacto**: riesgo financiero directo si el tráfico crece o alguien
abusa — sin ningún control de costo por usuario.
**Prioridad**: P1.
**Solución sugerida**: límite simple por usuario (ej. N mensajes por
minuto) en `/api/chat`, sin librería externa — un chequeo contra
`conversation_messages` o `events` recientes es suficiente al tamaño
actual.
**Complejidad estimada**: Baja.

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

### P1-4. Ranking de memoria con frases-gatillo muy angostas
**Descripción**: `DeterministicMemoryRankingStrategy` no reconoció "me
fue infiel" como señal de comprensión en una conversación real
(majo1502) — la lista de frases-gatillo es más angosta que el lenguaje
real de la gente.
**Impacto**: memorias genuinamente importantes pueden rankear igual que
un simple "hola", perdiendo prioridad en Context Builder / Morning
Brief.
**Prioridad**: P1.
**Solución sugerida**: ampliar la lista de frases-gatillo con casos
reales encontrados en el pilotaje — requiere aprobación del Founder
por tocar una pieza ya aprobada de M2.
**Complejidad estimada**: Baja (una vez aprobado el alcance).

---

## P2 — Mejoras

### P2-1. Sin streaming de respuestas de IA
**Descripción**: `AIProvider.generateReply()` espera la respuesta
completa antes de devolver nada — el usuario ve "LUZ está
escribiendo…" fijo durante toda la generación.
**Impacto**: latencia percibida más alta de lo necesario, incluso
después del fix de brevedad.
**Prioridad**: P2.
**Solución sugerida**: extender (no romper) `AIProvider` con streaming
opcional, mostrar texto progresivo en el cliente.
**Complejidad estimada**: Media (toca un contrato deliberadamente
estable desde B2 — requiere aprobación explícita antes de tocarlo).

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

### P3-2. Sistema de feedback dentro de la app
Parte del Alpha-4 original (onboarding, estados vacíos, feedback
in-app) — no construido, no urgente mientras el pilotaje es pequeño y
directo con el Founder.

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
