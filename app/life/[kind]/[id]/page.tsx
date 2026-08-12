import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { DrizzleBeliefRepository, deriveBeliefTrend } from "@/core/belief-engine";
import { DrizzleConceptRepository } from "@/core/concept-graph";
import { DrizzleContradictionRepository } from "@/core/contradiction-engine";
import { db } from "@/core/db/client";
import { DrizzleImportanceRepository } from "@/core/importance-engine";
import {
  createEntityId,
  type EntityId,
  type LifeGraphContext,
  DrizzleGoalRepository,
  DrizzleHabitRepository,
  DrizzleProjectRepository,
  DrizzleRelationshipRepository,
  DrizzlePersonRepository,
  LIFE_DOMAIN_LABEL,
} from "@/core/life";
import { DrizzleMemoryRepository, type Memory } from "@/core/memory-engine";
import { findMemoriesMentioning } from "@/features/life/services/find-memories-mentioning";
import {
  BELIEF_TREND_LABELS,
  GOAL_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/features/life/labels";

const KINDS = ["goals", "projects", "habits", "relationships", "beliefs", "concepts"] as const;
type Kind = (typeof KINDS)[number];

const BELIEF_STATUS_LABELS: Record<string, string> = {
  active: "activa",
  expired: "expirada",
  retracted: "retractada",
};

const paramsSchema = z.object({
  kind: z.enum(KINDS),
  id: z.string().uuid(),
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

function formatRelativeTime(date: Date): string {
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 30) return `hace ${diffDays} días`;
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
}

/**
 * Detalle de una entidad de Life, solo lectura (Sprint 3, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §3.2/4.2) — sin formularios de edición,
 * eso es explícitamente V1. `kind` en la URL (no cuatro rutas
 * separadas) porque las cuatro comparten exactamente la misma forma:
 * cargar la entidad, mostrar sus campos, mostrar memorias que
 * mencionan su título literalmente (§3.2.1).
 */
export default async function LifeDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }
  const { kind, id } = parsedParams.data;

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    console.error("[life detail] no se pudo resolver LifeGraphContext:", error);
  }

  if (!lifeGraphContext) {
    notFound();
  }

  const entity = await loadEntity(kind, lifeGraphContext, createEntityId(id));
  if (!entity) {
    notFound();
  }

  let relatedMemories: Memory[] = [];
  try {
    // Beliefs/Concepts citan evidencia real y precisa (`belief_evidence`/
    // `concept_evidence`) -- nunca la búsqueda difusa por texto que sí
    // hace falta para Goal/Project/Habit/Relationship (que no llevan
    // evidencia propia todavía). Mostrar la evidencia real siempre que
    // exista es más fiel a Principio 3 (explicabilidad) que aproximarla.
    if (entity.evidenceMemoryIds) {
      const memoryRepository = new DrizzleMemoryRepository(db);
      const fetched = await Promise.all(
        entity.evidenceMemoryIds.map((memoryId) =>
          memoryRepository.getById(lifeGraphContext, memoryId),
        ),
      );
      relatedMemories = fetched.filter((memory): memory is Memory => memory !== null);
    } else {
      relatedMemories = await findMemoriesMentioning(db, lifeGraphContext, {
        title: entity.searchTerm,
      });
    }
  } catch (error) {
    console.error("[life detail] no se pudieron buscar memorias:", error);
  }

  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            href="/life"
            className="rounded text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            ← Vida
          </Link>
        </div>

        <div className="animate-fade-in">
          <h1 className="mt-4 text-2xl font-light text-white">
            {entity.title}
          </h1>
          {entity.statusLabel && (
            <p className="mt-1 text-sm text-zinc-400">{entity.statusLabel}</p>
          )}

          <dl className="mt-6 space-y-2 text-sm">
            {entity.fields.map((field) => (
              <div key={field.label} className="flex gap-2">
                <dt className="text-zinc-500">{field.label}:</dt>
                <dd className="text-zinc-300">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className="animate-fade-in mt-10" style={{ animationDelay: "80ms" }}>
          <h2 className="text-sm font-medium text-zinc-400">
            {entity.evidenceMemoryIds
              ? "Evidencia"
              : <>Momentos donde hablamos de &ldquo;{entity.searchTerm}&rdquo;</>}
          </h2>
          {relatedMemories.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {relatedMemories.map((memory, index) => (
                <li
                  key={memory.id}
                  className="animate-fade-in rounded-lg border border-zinc-800 px-4 py-3 text-sm"
                  style={{ animationDelay: `${120 + Math.min(index, 10) * 30}ms` }}
                >
                  <p className="text-zinc-300">&ldquo;{memory.content}&rdquo;</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatRelativeTime(memory.occurredAt ?? memory.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Todavía no hay nada aquí — se va a ir llenando a medida que
              hablemos de esto.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

interface DetailField {
  label: string;
  value: string;
}

interface LoadedEntity {
  title: string;
  statusLabel: string | null;
  /** Término literal para buscar memorias relacionadas — el título para Goal/Project/Habit, el nombre de la otra persona para Relationship. Ignorado si `evidenceMemoryIds` está presente. */
  searchTerm: string;
  fields: DetailField[];
  /** Evidencia real y precisa (Belief/Concept) -- cuando está presente, la página la usa en vez de `searchTerm` (ver docblock más arriba). */
  evidenceMemoryIds?: EntityId[];
}

async function loadEntity(
  kind: Kind,
  context: LifeGraphContext,
  id: EntityId,
): Promise<LoadedEntity | null> {
  if (kind === "goals") {
    const goal = await new DrizzleGoalRepository(db).getById(context, id);
    if (!goal) return null;
    const fields: DetailField[] = [];
    if (goal.targetDate) {
      fields.push({ label: "Fecha objetivo", value: DATE_FORMAT.format(goal.targetDate) });
    }
    if (goal.description) {
      fields.push({ label: "Descripción", value: goal.description });
    }
    return {
      title: goal.title,
      statusLabel: GOAL_STATUS_LABELS[goal.status],
      searchTerm: goal.title,
      fields,
    };
  }

  if (kind === "projects") {
    const project = await new DrizzleProjectRepository(db).getById(context, id);
    if (!project) return null;
    const fields: DetailField[] = [];
    if (project.dueDate) {
      fields.push({ label: "Fecha de entrega", value: DATE_FORMAT.format(project.dueDate) });
    }
    if (project.description) {
      fields.push({ label: "Descripción", value: project.description });
    }
    return {
      title: project.title,
      statusLabel: PROJECT_STATUS_LABELS[project.status],
      searchTerm: project.title,
      fields,
    };
  }

  if (kind === "habits") {
    const habit = await new DrizzleHabitRepository(db).getById(context, id);
    if (!habit) return null;
    const fields: DetailField[] = [];
    if (habit.description) {
      fields.push({ label: "Descripción", value: habit.description });
    }
    return {
      title: habit.title,
      statusLabel: habit.active ? "activo" : "pausado",
      searchTerm: habit.title,
      fields,
    };
  }

  if (kind === "beliefs") {
    const beliefRepository = new DrizzleBeliefRepository(db);
    const belief = await beliefRepository.getById(context, id);
    if (!belief) return null;

    const [evidence, history, importance, contradictions] = await Promise.all([
      beliefRepository.getEvidence(context, id),
      beliefRepository.getHistory(context, id),
      new DrizzleImportanceRepository(db).getByEntity(context, "belief", id),
      new DrizzleContradictionRepository(db).listByRef(context, { refType: "belief", refId: id }),
    ]);

    const fields: DetailField[] = [
      { label: "Confianza", value: `${belief.confidence.score}/100` },
      { label: "Tendencia", value: BELIEF_TREND_LABELS[deriveBeliefTrend(history)] },
    ];
    if (belief.domain) {
      fields.push({ label: "Área de vida", value: LIFE_DOMAIN_LABEL[belief.domain] });
    }
    fields.push({ label: "Primera vez observada", value: DATE_FORMAT.format(belief.firstObservedAt) });
    fields.push({ label: "Último refuerzo", value: DATE_FORMAT.format(belief.lastReinforcedAt) });
    fields.push({ label: "Evidencia", value: `${evidence.length} memoria(s)` });
    if (importance) {
      fields.push({ label: "Importancia", value: `${importance.score}/100 — ${importance.reason}` });
    }
    for (const contradiction of contradictions) {
      if (contradiction.status !== "open" && contradiction.status !== "acknowledged") continue;
      fields.push({ label: "Contradicción abierta", value: contradiction.description });
    }

    const evidenceMemoryIds = [
      ...new Set(evidence.map((item) => item.memoryId).filter((id): id is EntityId => Boolean(id))),
    ];

    return {
      title: belief.statement,
      statusLabel: BELIEF_STATUS_LABELS[belief.status] ?? belief.status,
      searchTerm: belief.statement,
      fields,
      evidenceMemoryIds,
    };
  }

  if (kind === "concepts") {
    const conceptRepository = new DrizzleConceptRepository(db);
    const concept = await conceptRepository.getById(context, id);
    if (!concept) return null;

    const [evidence, relations, importance] = await Promise.all([
      conceptRepository.listEvidence(context, id),
      conceptRepository.listRelations(context, id),
      new DrizzleImportanceRepository(db).getByEntity(context, "concept", id),
    ]);

    const fields: DetailField[] = [];
    if (concept.domain) {
      fields.push({ label: "Área de vida", value: LIFE_DOMAIN_LABEL[concept.domain] });
    }
    if (concept.description) {
      fields.push({ label: "Descripción", value: concept.description });
    }
    fields.push({ label: "Evidencia", value: `${evidence.length} memoria(s)` });
    if (importance) {
      fields.push({ label: "Importancia", value: `${importance.score}/100 — ${importance.reason}` });
    }

    for (const relation of relations) {
      const otherId = relation.fromConceptId === id ? relation.toConceptId : relation.fromConceptId;
      const other = await conceptRepository.getById(context, otherId);
      if (!other) continue;
      const arrow = relation.fromConceptId === id ? "→" : "←";
      fields.push({
        label: "Relación",
        value: `${arrow} ${relation.relationType} ${arrow} ${other.label}`,
      });
    }

    const evidenceMemoryIds = [...new Set(evidence.map((item) => item.memoryId))];

    return {
      title: concept.label,
      statusLabel: null,
      searchTerm: concept.label,
      fields,
      evidenceMemoryIds,
    };
  }

  const relationship = await new DrizzleRelationshipRepository(db).getById(context, id);
  if (!relationship) return null;

  const otherPersonId =
    relationship.fromPersonId === context.personId
      ? relationship.toPersonId
      : relationship.fromPersonId;
  const otherPerson = await new DrizzlePersonRepository(db).getById(
    context,
    otherPersonId,
  );
  const displayName = otherPerson?.name ?? "Alguien";

  const fields: DetailField[] = [];
  if (relationship.closeness !== undefined) {
    fields.push({ label: "Cercanía", value: `${relationship.closeness}/100` });
  }
  if (relationship.since) {
    fields.push({ label: "Desde", value: DATE_FORMAT.format(relationship.since) });
  }
  if (relationship.notes) {
    fields.push({ label: "Notas", value: relationship.notes });
  }

  return {
    title: displayName,
    statusLabel: RELATIONSHIP_TYPE_LABELS[relationship.type],
    searchTerm: displayName,
    fields,
  };
}
