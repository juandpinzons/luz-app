-- ADR-0024, Decisión 4: rol de Postgres de mínimo privilegio para
-- consultas ad hoc de operación/debug -- la situación exacta de esta
-- sesión (una cadena de conexión compartida pegada en un chat, usada
-- para un `SELECT` de conteos). `neondb_owner` (o el rol propietario
-- que sea) deja de ser la credencial de uso diario para eso; se vuelve
-- break-glass en sí misma.
--
-- NO es una migración de Drizzle a propósito -- no vive en
-- `core/db/migrations/`, nunca corre automáticamente vía
-- `drizzle-kit migrate`/`db:migrate`. Es una acción de infraestructura
-- deliberada, ejecutada una vez, a mano, contra Neon (consola SQL o
-- `psql`) por alguien con el rol propietario -- exactamente el tipo de
-- cambio que este ADR dice que no debe aplicarse solo porque el código
-- ya está listo.
--
-- Estrategia: allow-list por columna (GRANT SELECT explícito columna
-- por columna), no un REVOKE sobre las columnas cifradas -- un
-- allow-list es seguro por default ante una columna nueva que alguien
-- agregue después sin acordarse de revocarla; un deny-list no lo es.
-- Este rol nunca recibe INSERT/UPDATE/DELETE en ninguna tabla: es
-- estrictamente de lectura, para diagnóstico, nunca para reparar datos
-- a mano (eso pasa por una migración o un script propio, revisado).

-- Ajustar la contraseña antes de correr esto -- no se genera aquí a
-- propósito, para que nadie copie/pegue un valor de ejemplo a
-- producción sin pensarlo.
CREATE ROLE luz_ops_readonly WITH LOGIN PASSWORD '<reemplazar-antes-de-correr>';

GRANT CONNECT ON DATABASE neondb TO luz_ops_readonly;
GRANT USAGE ON SCHEMA public TO luz_ops_readonly;

-- Identidad de cuenta -- no es "contenido" en el sentido de ADR-0024,
-- necesario para diagnóstico normal (buscar una cuenta por email).
GRANT SELECT (id, email, name, image, email_verified, created_at, updated_at)
  ON users TO luz_ops_readonly;

-- Conversaciones: metadatos sí, `content`/`image_data` NUNCA.
GRANT SELECT (id, user_id, title, category, created_at, updated_at)
  ON conversations TO luz_ops_readonly;
GRANT SELECT (id, conversation_id, user_id, role, created_at)
  ON conversation_messages TO luz_ops_readonly;

-- Memoria: todo salvo `content`.
GRANT SELECT (id, life_graph_id, person_id, type, source, source_id,
              status, suppressed, rank_score, ranked_at, occurred_at,
              created_at, updated_at)
  ON memories TO luz_ops_readonly;

-- Derivados de Knowledge Engine: todo salvo el campo de texto libre de cada uno.
GRANT SELECT (id, life_graph_id, subject_person_id, domain, category,
              status, confidence_score, confidence_assigned_at,
              first_observed_at, last_reinforced_at, created_at, updated_at)
  ON beliefs TO luz_ops_readonly;
GRANT SELECT (id, life_graph_id, type, confidence_score,
              confidence_assigned_at, status, created_at, updated_at, validated_at)
  ON knowledge_engine_insights TO luz_ops_readonly;
GRANT SELECT (id, life_graph_id, domain, created_at, updated_at)
  ON concepts TO luz_ops_readonly;
GRANT SELECT (id, life_graph_id, kind, left_ref_type, left_ref_id,
              right_ref_type, right_ref_id, domain, status,
              detected_at, resolved_at, created_at, updated_at)
  ON contradictions TO luz_ops_readonly;
GRANT SELECT (id, life_graph_id, confidence_score, confidence_assigned_at,
              status, created_at, updated_at)
  ON knowledge_engine_reasoning_conclusions TO luz_ops_readonly;

-- Terceros mencionados por el usuario: nombre y notas son justo el
-- dato de identidad sin consentimiento -- ninguno de los dos, para
-- este rol.
GRANT SELECT (id, life_graph_id, created_at, updated_at)
  ON persons TO luz_ops_readonly;
GRANT SELECT (id, life_graph_id, from_person_id, to_person_id, type,
              closeness, since, created_at, updated_at)
  ON life_relationships TO luz_ops_readonly;

-- Embeddings: el vector es opaco por diseño (no es el texto), pero
-- `content` es la copia en texto plano -- tampoco para este rol.
GRANT SELECT (id, life_graph_id, source_type, source_id, embedding, created_at)
  ON memory_embeddings TO luz_ops_readonly;

-- Feedback: todo salvo `comment`.
GRANT SELECT (id, user_id, helpfulness, remembers_me, response_length, created_at)
  ON feedback_responses TO luz_ops_readonly;

-- Credenciales de conector y tokens de Auth.js: nunca, bajo ningún
-- alcance de columna -- ya son secretos/cifrados, este rol no necesita
-- verlos ni cifrados para ninguna tarea de diagnóstico legítima.
-- (Sin GRANT alguno sobre `accounts`, `email_connections`,
-- `calendar_connections`, `sessions`.)

-- events / admin_access_log: operacionales, sin contenido de usuario
-- por diseño (ver docblock de `core/db/schema/events.ts` y
-- `core/db/schema/admin-access-log.ts`) -- SELECT completo es seguro.
GRANT SELECT ON events TO luz_ops_readonly;
GRANT SELECT ON admin_access_log TO luz_ops_readonly;

-- Revisar antes de correr: cualquier tabla nueva agregada después de
-- este script necesita su propia decisión explícita -- este rol NO
-- hereda acceso a tablas futuras por defecto (sin `ALTER DEFAULT
-- PRIVILEGES` a propósito, para forzar esa revisión cada vez).
