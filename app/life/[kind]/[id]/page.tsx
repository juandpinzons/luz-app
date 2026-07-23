import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import {
  createEntityId,
  type EntityId,
  type LifeGraphContext,
  DrizzleGoalRepository,
  DrizzleHabitRepository,
  DrizzleProjectRepository,
  DrizzleRelationshipRepository,
  DrizzlePersonRepository,
} from "@/core/life";
import { findMemoriesMentioning } from "@/features/life/services/find-memories-mentioning";
import {
  GOAL_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/features/life/labels";
import type { Memory } from "@/core/memory-engine";

const KINDS = ["goals", "projects", "habits", "relationships"] as const;
type Kind = (typeof KINDS)[number];

const paramsSchema = z.object({
  kind: z.enum(KINDS),
  id: z.string().uuid(),
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
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
    relatedMemories = await findMemoriesMentioning(db, lifeGraphContext, {
      title: entity.searchTerm,
    });
  } catch (error) {
    console.error("[life detail] no se pudieron buscar memorias:", error);
  }

  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            href="/life"
            className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
          >
            ← Life
          </Link>
        </div>

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

        <section className="mt-10">
          <h2 className="text-sm font-medium text-zinc-400">
            Memorias que mencionan &ldquo;{entity.searchTerm}&rdquo;
            literalmente
          </h2>
          {relatedMemories.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {relatedMemories.map((memory) => (
                <li
                  key={memory.id}
                  className="rounded-lg border border-zinc-800 px-4 py-3 text-sm"
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
              Ninguna memoria usa esta palabra exacta todavía — búsqueda
              por texto, no por significado (ver diseño §3.2.1).
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
  /** Término literal para buscar memorias relacionadas — el título para Goal/Project/Habit, el nombre de la otra persona para Relationship. */
  searchTerm: string;
  fields: DetailField[];
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
