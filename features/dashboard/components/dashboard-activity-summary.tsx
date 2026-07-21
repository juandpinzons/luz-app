import Link from "next/link";
import type { DashboardSummary } from "../services/build-dashboard-summary";

const WEEKDAY_DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(date: Date): string {
  return WEEKDAY_DATE_FORMAT.format(date);
}

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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="text-2xl font-light text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

interface DashboardActivitySummaryProps {
  user: { name?: string | null; email?: string | null };
  summary: DashboardSummary | null;
}

/**
 * Secciones de actividad real del Dashboard (Sprint Alpha-1a) — nunca
 * placeholders: cada sección se oculta si su dato no existe todavía
 * (`summary` completo en null, o un campo puntual como
 * `lastMessageAt`/`recentConversations`/`memoriesStored`). Componente
 * puramente presentacional: toda la obtención de datos vive en
 * `app/dashboard/page.tsx` (Server Component), igual que ya hacía
 * `buildMorningBrief`.
 */
export function DashboardActivitySummary({
  user,
  summary,
}: DashboardActivitySummaryProps) {
  return (
    <div className="mt-12 space-y-10 border-t border-zinc-900 pt-10">
      <section>
        <h2 className="text-sm font-medium text-zinc-400">Tu cuenta</h2>
        <div className="mt-3 space-y-1 text-sm">
          {user.name && <p className="text-zinc-300">{user.name}</p>}
          <p className="text-zinc-500">{user.email}</p>
          {summary && (
            <p className="text-zinc-500">
              Miembro desde {formatDate(summary.memberSince)}
            </p>
          )}
        </div>
      </section>

      {summary && summary.lastMessageAt && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">
            Actividad reciente
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Última actividad: {formatRelativeTime(summary.lastMessageAt)}
          </p>
        </section>
      )}

      {summary && summary.recentConversations.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">
              Conversaciones recientes
            </h2>
            <Link
              href="/conversations"
              className="text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
            >
              Ver historial
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.recentConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="block rounded-lg border border-zinc-800 px-4 py-3 text-sm transition hover:border-zinc-600"
              >
                <p className="text-zinc-300">
                  {formatDate(conversation.startedAt)}
                </p>
                <p className="mt-1 text-zinc-500">
                  {conversation.messageCount}{" "}
                  {conversation.messageCount === 1 ? "mensaje" : "mensajes"}
                  {conversation.lastMessageAt &&
                    ` · última actividad ${formatRelativeTime(conversation.lastMessageAt)}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {summary && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Estadísticas</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Conversaciones iniciadas"
              value={summary.conversationsStarted}
            />
            <Stat label="Mensajes enviados" value={summary.messagesSent} />
            {summary.memoriesStored > 0 && (
              <Stat
                label="Memorias almacenadas"
                value={summary.memoriesStored}
              />
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-zinc-400">
          Estado del sistema
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          {summary
            ? "● Operativo"
            : "● No se pudo cargar tu actividad ahora mismo"}
        </p>
      </section>
    </div>
  );
}
