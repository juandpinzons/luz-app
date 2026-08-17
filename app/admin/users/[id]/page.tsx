import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { accountIdentities } from "@/auth/schema";
import {
  adminAccessLog,
  conversationMessages,
  conversations,
  feedbackResponses,
  users,
} from "@/core/db/schema";
import { createEntityId } from "@/core/life/value-objects/entity-id";
import type { LifeGraphContext } from "@/core/life/life-graph-context";
import { DrizzleMemoryRepository } from "@/core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "@/core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { DrizzleBeliefRepository } from "@/core/belief-engine";
import { DrizzleConceptRepository } from "@/core/concept-graph";
import { DrizzleContradictionRepository } from "@/core/contradiction-engine";
import { DrizzleInsightRepository, DrizzleReasoningRepository } from "@/core/knowledge-engine";
import { decryptContentOrNull } from "@/core/security/content-cipher";
import { isAdmin } from "../../is-admin";
import { requireAdminMfa } from "../../require-mfa";

const userIdSchema = z.string().uuid();

const RECENT_MEMORY_LIMIT = 50;
const RECENT_CONVERSATION_LIMIT = 20;

/**
 * "Qué sabe, recuerda y cómo ha interactuado LUZ con esta persona" --
 * pedido directo del Founder (2026-08-06): quien pregunte ya no debería
 * necesitar interrogar a LUZ en el chat para averiguarlo (LUZ misma no
 * tiene ni panel ni forma de mostrar esto -- ver conversación real
 * adjunta ese mismo día). Lee directo de cada repositorio Drizzle real
 * (mismos que arma `assembleRealitySnapshot` para el chat en vivo) --
 * nunca reimplementa su lógica, solo la muestra completa en vez de
 * recortada a los 5 ítems que el chat puede permitirse por turno.
 *
 * Solo lectura. Mismo gate `isAdmin` que el resto de `/admin/*`.
 *
 * Break-glass (ADR-0024, Decisión 3): sin `?justification=` en la URL,
 * esta página NO corre ninguna de las consultas de contenido de abajo
 * -- solo confirma que el usuario objetivo existe y muestra el
 * formulario. Con justificación presente, registra el acceso en
 * `admin_access_log` (bitácora inmutable, nunca tocada por el cascade
 * de borrado de cuenta) ANTES de mostrar cualquier contenido
 * descifrado, nunca después -- si el insert de la bitácora falla, la
 * página falla con él, no hay lectura de contenido sin registro.
 */
export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ justification?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    redirect("/login");
  }
  const adminUserId = session.user.id;
  const adminEmail = session.user.email;
  await requireAdminMfa(adminUserId);

  const { id } = await params;
  const parsedId = userIdSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }
  const userId = parsedId.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    notFound();
  }

  const { justification } = await searchParams;
  const trimmedJustification = justification?.trim();

  if (!trimmedJustification) {
    return (
      <main className="min-h-screen bg-black px-8 py-10 text-white">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-light">
            Acceso administrativo a {user.name ?? user.email}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Vas a ver memorias, creencias, insights, conceptos, contradicciones y
            feedback de esta persona en texto plano. Este acceso queda registrado
            de forma permanente -- quién, cuándo, y por qué (ADR-0024).
          </p>
          <form method="GET" className="mt-6 space-y-3">
            <textarea
              name="justification"
              required
              minLength={10}
              rows={3}
              placeholder="Motivo del acceso (ej.: 'ticket de soporte #123', 'investigando el bug reportado por el usuario')"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-white hover:border-zinc-500"
            >
              Continuar y registrar el acceso
            </button>
          </form>
        </div>
      </main>
    );
  }

  await db.insert(adminAccessLog).values({
    adminUserId,
    adminEmail,
    viewedUserId: userId,
    justification: trimmedJustification,
    route: `/admin/users/${userId}`,
  });

  const [identity] = await db
    .select()
    .from(accountIdentities)
    .where(eq(accountIdentities.accountId, userId))
    .limit(1);

  const conversationRows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      category: conversations.category,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`count(${conversationMessages.id})`,
    })
    .from(conversations)
    .leftJoin(conversationMessages, eq(conversationMessages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt))
    .limit(RECENT_CONVERSATION_LIMIT);

  const [messageStats] = await db
    .select({
      total: sql<number>`count(*)`,
      first: sql<string | null>`min(${conversationMessages.createdAt})`,
      last: sql<string | null>`max(${conversationMessages.createdAt})`,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId));

  const userFeedbackRows = await db
    .select()
    .from(feedbackResponses)
    .where(eq(feedbackResponses.userId, userId))
    .orderBy(desc(feedbackResponses.createdAt));

  const userFeedback = userFeedbackRows.map((row) => ({
    ...row,
    comment: decryptContentOrNull(row.comment),
  }));

  // Sin LifeGraph todavía (cuenta creada pero nunca mandó un primer
  // mensaje -- ver DrizzleAccountIdentityResolver, el bootstrap solo
  // corre al resolver la sesión): memoria/conocimiento quedan vacíos a
  // propósito, mismo criterio de "ausencia real" que el resto del
  // dominio -- no un error, no un 404 (la Account sí existe).
  const context: LifeGraphContext | null = identity
    ? {
        lifeGraphId: createEntityId(identity.lifeGraphId),
        personId: createEntityId(identity.personId),
      }
    : null;

  const [memories, beliefs, concepts, contradictions, insights, reasoningConclusions] = context
    ? await Promise.all([
        new DrizzleMemoryRepository(db).listActive(context),
        new DrizzleBeliefRepository(db).list(context),
        new DrizzleConceptRepository(db).list(context),
        new DrizzleContradictionRepository(db).list(context),
        new DrizzleInsightRepository(db).list(context),
        new DrizzleReasoningRepository(db).list(context),
      ])
    : [[], [], [], [], [], []];

  const sortedMemories = [...memories].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const memoriesByType = countBy(memories, (m) => m.type);
  const belowSignalCount = memories.filter(
    (m) => (m.rank?.score ?? 0) < MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
  ).length;
  const scores = memories.map((m) => m.rank?.score ?? 0);
  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;

  const validatedInsights = insights.filter((i) => i.status === "validated");
  const activeBeliefs = beliefs.filter((b) => b.status === "active");
  const openContradictions = contradictions.filter(
    (c) => c.status === "open" || c.status === "acknowledged",
  );
  const validatedReasoning = reasoningConclusions.filter((r) => r.status === "validated");

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">{user.name ?? "Sin nombre"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {user.email} · usuario desde {user.createdAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white"
        >
          ← Todos los usuarios
        </Link>
      </div>

      {!context && (
        <p className="mt-8 rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-500">
          Esta cuenta todavía no tiene LifeGraph — nunca completó su primera sesión con LUZ.
          No hay memoria ni conocimiento que mostrar todavía.
        </p>
      )}

      {/* Interacción */}
      <Section title="Interacción">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Conversaciones" value={conversationRows.length} />
          <Stat label="Mensajes totales" value={messageStats?.total ?? 0} />
          <Stat
            label="Primer mensaje"
            value={messageStats?.first ? fmtDate(messageStats.first) : "—"}
          />
          <Stat
            label="Último mensaje"
            value={messageStats?.last ? fmtDate(messageStats.last) : "—"}
          />
        </div>
        <div className="mt-4 space-y-2">
          {conversationRows.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-zinc-900 px-4 py-2 text-sm"
            >
              <div>
                <span className="text-white">{c.title ?? "Sin título"}</span>
                {c.category && (
                  <span className="ml-2 text-zinc-500">· {c.category}</span>
                )}
              </div>
              <div className="text-zinc-500">
                {c.messageCount} mensajes · {fmtDate(c.updatedAt.toISOString())}
              </div>
            </div>
          ))}
          {conversationRows.length === 0 && (
            <p className="text-sm text-zinc-600">Sin conversaciones todavía.</p>
          )}
        </div>
      </Section>

      {/* Memoria */}
      <Section title="Memoria — qué recuerda LUZ, textualmente">
        {memories.some((m) => m.hiddenFromUser) && (
          <p className="mb-3 rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-2 text-xs text-amber-500">
            Esta lista incluye memorias que la persona ocultó de su propia
            vista (marcadas abajo). Ocultar es un control de vista personal,
            no de acceso — este panel muestra el entendimiento completo de
            LUZ a propósito (auditoría de privacidad, 2026-08-17).
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Memorias activas" value={memories.length} />
          <Stat label="Rank score promedio" value={avgScore} />
          <Stat
            label={`Bajo señal de comprensión (<${MIN_SCORE_WITH_UNDERSTANDING_SIGNAL})`}
            value={`${belowSignalCount} (${memories.length ? Math.round((belowSignalCount / memories.length) * 100) : 0}%)`}
          />
          <Stat label="Tipos distintos" value={Object.keys(memoriesByType).length} />
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Por tipo:{" "}
          {Object.entries(memoriesByType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, n]) => `${type} (${n})`)
            .join(" · ") || "—"}
        </p>
        <div className="mt-4 space-y-1.5">
          {sortedMemories.slice(0, RECENT_MEMORY_LIMIT).map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-zinc-900 px-4 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-zinc-100">{m.content}</span>
                <span
                  className={`shrink-0 text-xs ${(m.rank?.score ?? 0) < MIN_SCORE_WITH_UNDERSTANDING_SIGNAL ? "text-amber-500" : "text-zinc-500"}`}
                >
                  rank {m.rank?.score ?? "—"}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {m.type} · {m.source} · {fmtDate((m.occurredAt ?? m.createdAt).toISOString())}
                {m.hiddenFromUser && (
                  <span className="ml-2 rounded border border-amber-900 px-1.5 py-0.5 text-amber-500">
                    oculta de su vista
                  </span>
                )}
              </div>
            </div>
          ))}
          {memories.length === 0 && (
            <p className="text-sm text-zinc-600">Sin memorias activas todavía.</p>
          )}
          {memories.length > RECENT_MEMORY_LIMIT && (
            <p className="text-xs text-zinc-600">
              +{memories.length - RECENT_MEMORY_LIMIT} memorias más, no mostradas.
            </p>
          )}
        </div>
      </Section>

      {/* Conocimiento derivado */}
      <Section title="Conocimiento — qué entiende LUZ, interpretado">
        <SubSection label={`Creencias activas (${activeBeliefs.length})`}>
          {activeBeliefs.map((b) => (
            <ListRow
              key={b.id}
              primary={b.statement}
              secondary={`${b.category}${b.domain ? ` · ${b.domain}` : ""} · confianza ${b.confidence.score}`}
            />
          ))}
          {activeBeliefs.length === 0 && <Empty />}
        </SubSection>

        <SubSection label={`Insights validados (${validatedInsights.length})`}>
          {validatedInsights.map((i) => (
            <ListRow
              key={i.id}
              primary={i.description}
              secondary={`${i.type} · confianza ${i.confidence.score}`}
            />
          ))}
          {validatedInsights.length === 0 && <Empty />}
        </SubSection>

        <SubSection label={`Conclusiones de razonamiento (${validatedReasoning.length})`}>
          {validatedReasoning.map((r) => (
            <ListRow
              key={r.id}
              primary={r.statement}
              secondary={`confianza ${r.confidence.score}`}
            />
          ))}
          {validatedReasoning.length === 0 && <Empty />}
        </SubSection>

        <SubSection label={`Conceptos (${concepts.length})`}>
          {concepts.map((c) => (
            <ListRow key={c.id} primary={c.label} secondary={c.domain} />
          ))}
          {concepts.length === 0 && <Empty />}
        </SubSection>

        <SubSection label={`Contradicciones abiertas (${openContradictions.length})`}>
          {openContradictions.map((c) => (
            <ListRow key={c.id} primary={c.description} secondary={c.domain} />
          ))}
          {openContradictions.length === 0 && <Empty />}
        </SubSection>
      </Section>

      {/* Feedback */}
      {userFeedback.length > 0 && (
        <Section title="Feedback dado por este usuario">
          {userFeedback.map((f) => (
            <ListRow
              key={f.id}
              primary={f.comment ?? "(sin comentario)"}
              secondary={`Utilidad ${f.helpfulness}/5 · recuerda con el tiempo: ${REMEMBERS_ME_LABEL[f.remembersMe]}${f.responseLength ? ` · extensión: ${RESPONSE_LENGTH_LABEL[f.responseLength]}` : ""} · ${fmtDate(f.createdAt.toISOString())}`}
            />
          ))}
        </Section>
      )}
    </main>
  );
}

const REMEMBERS_ME_LABEL: Record<"yes" | "no" | "unsure", string> = {
  yes: "Sí",
  no: "No",
  unsure: "Aún no sé",
};

const RESPONSE_LENGTH_LABEL: Record<"too_long" | "just_right" | "too_short", string> = {
  too_long: "muy larga",
  just_right: "justa",
  too_short: "muy corta",
};

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-light">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-sm text-zinc-500">{label}</h3>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function ListRow({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="rounded-lg border border-zinc-900 px-4 py-2.5 text-sm">
      <div className="text-zinc-100">{primary}</div>
      {secondary && <div className="mt-1 text-xs text-zinc-500">{secondary}</div>}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-zinc-600">Nada todavía.</p>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="text-2xl font-light">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
