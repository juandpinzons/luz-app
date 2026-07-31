import type {
  DashboardActionKind,
  DashboardEntityReference,
} from "../../dashboard/services/build-follow-up-recommendations";

/**
 * Traduce el vocabulario de `DashboardEntityReference.kind` (dominio de
 * Life Graph: goal/project/habit/person/relationship/domain) al
 * vocabulario PLURAL que ya usa la ruta real de detalle
 * (`app/life/[kind]/[id]/page.tsx`, `KINDS`) -- dos vocabularios
 * distintos que convivían sin traducirse entre sí, así que ninguna
 * tarjeta enlazaba a nada todavía. `person` no tiene ruta propia hoy
 * (no existe `/life/people/`) -- `null` en ese caso y en `domain`
 * (que no tiene `id`), nunca un enlace roto.
 */
const ENTITY_ROUTE_KIND: Partial<Record<DashboardEntityReference["kind"], string>> = {
  goal: "goals",
  project: "projects",
  habit: "habits",
  relationship: "relationships",
};

/**
 * `acknowledge` (celebraciones, `NO_ACTION`) no tiene nada que abrir --
 * "reconocer" no es una navegación, es solo ver el mensaje ya mostrado
 * en la propia tarjeta. Enlazar ahí sería un botón que no lleva a
 * ningún lado nuevo.
 */
const LINKABLE_ACTION_KINDS = new Set<DashboardActionKind>(["open_entity", "update_status", "schedule_check_in"]);

export const ACTION_LABEL: Record<DashboardActionKind, string> = {
  open_entity: "Ver detalle",
  update_status: "Actualizar estado",
  schedule_check_in: "Agendar seguimiento",
  acknowledge: "Entendido",
};

/**
 * URL de detalle real para la entidad de una `DashboardAction`, o
 * `null` cuando no hay a dónde enlazar (kind sin ruta, sin entidad, o
 * una acción de solo-reconocer). Nunca fabrica una ruta que no exista.
 */
export function actionHref(
  action: { kind: DashboardActionKind; targetEntity?: DashboardEntityReference } | undefined,
): string | null {
  if (!action || !LINKABLE_ACTION_KINDS.has(action.kind)) return null;
  const entity = action.targetEntity;
  if (!entity || entity.kind === "domain") return null;

  const routeKind = ENTITY_ROUTE_KIND[entity.kind];
  return routeKind ? `/life/${routeKind}/${entity.id}` : null;
}
