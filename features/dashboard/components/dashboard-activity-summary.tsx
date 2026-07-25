import Link from "next/link";
import type { DashboardSummary } from "../services/build-dashboard-summary";

const WEEKDAY_DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
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

/**
 * Antes esto era una grilla de tres números decorativos ("Conversaciones
 * iniciadas: 12", "Memorias almacenadas: 8") -- exactamente el tipo de
 * panel de analítica genérico que el propio comentario de más abajo ya
 * decía querer evitar ("§2 del diseño: ningún número decorativo"),
 * pero nunca lo resolvía de verdad. Una frase continua, en la voz de
 * LUZ, dice lo mismo sin volverlo una estadística de producto.
 */
function buildRelationshipSummary(summary: DashboardSummary): string {
  const parts: string[] = [`Nos conocemos desde el ${formatDate(summary.memberSince)}.`];

  if (summary.conversationsStarted > 0) {
    const times = summary.conversationsStarted === 1 ? "vez" : "veces";
    parts.push(`Hemos hablado ${summary.conversationsStarted} ${times}.`);
  }

  if (summary.memoriesStored > 0) {
    const moments = summary.memoriesStored === 1 ? "momento" : "momentos";
    parts.push(`Guardo ${summary.memoriesStored} ${moments} tuyos que no quiero olvidar.`);
  }

  return parts.join(" ");
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
    <div className="mt-10 space-y-10">
      {/*
       * Promovida fuera del bloque de actividad/cuenta (Sprint 2,
       * docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §3.1(f)) — responde
       * "¿qué conversaciones requieren continuidad?", no una estadística
       * de uso, así que ya no vive detrás del mismo separador que
       * "Estadísticas".
       */}
      {summary && summary.recentConversations.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">
              Conversaciones recientes
            </h2>
            <Link
              href="/conversations"
              className="rounded text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
            >
              Ver conversaciones
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {summary.recentConversations.map((conversation, index) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="animate-fade-in block rounded-lg border border-zinc-800 px-4 py-3 text-sm transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
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

      {/*
       * Antes tres secciones separadas ("Tu cuenta"/"Actividad
       * reciente"/"Estadísticas"), cada una con su propio encabezado
       * frío y, en el caso de "Estadísticas", una grilla de números
       * sueltos — el patrón más "panel de administración" que le
       * quedaba al Dashboard. Una sola frase continua, en la voz de
       * LUZ, dice lo mismo (desde cuándo, cuánto hemos hablado, qué
       * guardo) sin que se sienta como analítica de producto.
       */}
      <div className="animate-fade-in space-y-3 border-t border-zinc-900 pt-10 text-sm">
        {summary ? (
          <p className="text-zinc-300">{buildRelationshipSummary(summary)}</p>
        ) : (
          <p className="text-zinc-500">
            No pude traer lo que recuerdo de nuestra historia. Intenta de
            nuevo en un momento.
          </p>
        )}
        <p className="text-xs text-zinc-600">
          {user.name ? `${user.name} · ${user.email}` : user.email}
        </p>
      </div>
    </div>
  );
}
