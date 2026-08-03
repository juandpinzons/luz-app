import { RADIANT_THRESHOLD, STEADY_THRESHOLD } from "@/features/orb/services/derive-maturity";
import type { OrbMaturityStage } from "@/features/orb/domain/orb-state";
import { PresenceOrb, type PresenceOrbSignature } from "@/components/ui/presence-orb";
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

/**
 * Auditoría de Experiencia V1 (hallazgo H4): `deriveOrbSignature`
 * (`generate-welcome.ts`) ya calcula, con datos reales, si la relación
 * está en etapa "spark"/"steady"/"radiant" -- pero solo se pinta dentro
 * del ritual de `/chat`. El Dashboard es la pantalla que alguien ve en
 * *cada* visita, no solo la primera vez que abre el chat -- ahí es
 * donde el crecimiento necesita ser visible para que se sienta continuo,
 * no descubierto por accidente.
 *
 * Deliberadamente NO se llama a `deriveOrbSignature` directo: esa
 * función necesita un `RealitySnapshot` completo
 * (`assembleRealitySnapshot`), que el Dashboard no calcula hoy (solo
 * `buildMorningBrief` lo hace, para `continuityLine`) -- pedirlo aquí
 * también sería una consulta nueva pagada solo para un matiz menor de
 * calidez. En cambio, esta versión usa exactamente los mismos umbrales
 * (`STEADY_THRESHOLD`/`RADIANT_THRESHOLD`, nunca un segundo número
 * inventado) sobre datos que `DashboardSummary` YA trae sin costo
 * adicional: `messagesSent` (equivalente directo a `totalMessageCount`)
 * y `memoriesStored` (mismo espíritu que el `understandingWarmth` de
 * `deriveOrbSignature` -- "LUZ ya guardó algo real de vos" es una señal
 * de comprensión tan legítima como el estilo de comunicación, solo que
 * esta ya está en memoria en vez de requerir una segunda consulta).
 * `hasUpcomingDeadline` llega desde `upcomingDeadlines`, que
 * `app/dashboard/page.tsx` ya trae para la sección "Lo que se acerca" --
 * cero consulta nueva tampoco ahí.
 */
function deriveRelationshipOrb(
  summary: DashboardSummary,
  hasUpcomingDeadline: boolean,
): PresenceOrbSignature {
  const maturityStage: OrbMaturityStage =
    summary.messagesSent >= RADIANT_THRESHOLD
      ? "radiant"
      : summary.messagesSent >= STEADY_THRESHOLD
        ? "steady"
        : "spark";

  const messageWarmth = Math.min(summary.messagesSent / RADIANT_THRESHOLD, 1);
  const memoryWarmth = summary.memoriesStored > 0 ? 0.15 : 0;
  const warmth = Math.min(0.25 + messageWarmth * 0.6 + memoryWarmth, 1);

  return {
    maturityStage,
    warmth,
    rhythmMs: hasUpcomingDeadline ? 3200 : 4200,
  };
}

interface DashboardActivitySummaryProps {
  user: { name?: string | null; email?: string | null };
  summary: DashboardSummary | null;
  /** `upcomingDeadlines.length > 0`, ya calculado por `app/dashboard/page.tsx` -- ver docblock de `deriveRelationshipOrb`. */
  hasUpcomingDeadline: boolean;
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
  hasUpcomingDeadline,
}: DashboardActivitySummaryProps) {
  return (
    <div className="mt-10 space-y-10">
      {/*
       * Beta-critical polish (feedback directo de Juan, 2026-08-03): el
       * historial de conversaciones recientes se retira de Dashboard --
       * era la única forma de llegar a `/conversations` cuando esa
       * auditoría se escribió (`EXPERIENCE_AUDIT_V1.md`, H3), pero
       * `/chat` ya tiene un link "Historial" siempre visible, así que
       * este segundo camino (tope de 5, invisible si no hay actividad
       * reciente) quedó duplicando lo que la navegación ya resuelve
       * mejor -- uno de los "reguero de información" que Juan señaló.
       */}
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
          <div className="flex items-center gap-3">
            <PresenceOrb signature={deriveRelationshipOrb(summary, hasUpcomingDeadline)} />
            <p className="text-zinc-300">{buildRelationshipSummary(summary)}</p>
          </div>
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
