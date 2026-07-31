import type { HomeState } from "../../home/domain/home-state";
import type { ExperienceState, RealityFingerprint } from "../domain/experience-state";
import { applyRotation } from "../services/apply-rotation";
import { collectExperienceCandidates } from "../services/collect-candidates";
import { deriveTone } from "../services/derive-tone";
import { buildRealityFingerprint, detectWhatChanged } from "../services/detect-what-changed";
import { computeCalendarLoad, scoreCandidates } from "../services/score-candidates";

/**
 * Punto de entrada público de "Experience Intelligence V1". Consume
 * `HomeState` (que ya compone Presence + Calendar Foundation + Life
 * Graph, ver `features/home/`) más el historial reciente de qué
 * tarjeta ganó `primary` en visitas anteriores (`getRecentPrimaryKeys`,
 * `services/experience-signal-log.ts`) -- ninguna consulta nueva de
 * dominio, ningún repositorio propio, ninguna IA ni aleatoriedad aquí
 * mismo. Determinístico de punta a punta: mismas entradas siempre
 * producen el mismo `ExperienceState`.
 *
 * `memoriesStored`/`previousFingerprint` alimentan `whatChanged`
 * ("¿qué cambió desde tu última visita?", ver
 * `services/detect-what-changed.ts`) -- el único dato que `HomeState`
 * no cubre es `memoriesStored` (vive en `DashboardSummary`), así que se
 * recibe aparte en vez de ensanchar `HomeState` solo para esto.
 */
export function buildExperienceState(
  homeState: HomeState,
  recentPrimaryKeys: readonly string[],
  memoriesStored = 0,
  previousFingerprint: RealityFingerprint | null = null,
): ExperienceState {
  const candidates = collectExperienceCandidates(homeState);
  const load = computeCalendarLoad(homeState.calendar);
  const scored = scoreCandidates(candidates, load);
  const { primary, secondary, postponed, isNewPrimary } = applyRotation(scored, recentPrimaryKeys);
  const fingerprint = buildRealityFingerprint(homeState, memoriesStored);

  return {
    asOf: homeState.asOf,
    primary,
    secondary,
    postponed,
    tone: deriveTone(primary),
    isNewPrimary,
    whatChanged: detectWhatChanged(fingerprint, previousFingerprint),
    fingerprint,
  };
}
