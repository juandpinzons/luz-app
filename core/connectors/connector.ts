import type { LifeGraphContext } from "../life/life-graph-context";
import type {
  ExternalSignal,
  ExternalSignalSource,
} from "../reality/external-signal-snapshot";
import type { ConnectorCredentials } from "./connector-credentials";

/**
 * Contrato único que cualquier integración externa (Gmail, Calendar,
 * Garmin, WhatsApp, Photos...) implementa (ADR-0015). Cada conector es
 * una clase más, intercambiable, igual que `AIProvider` (ADR-0003):
 * ningún engine importa un SDK de terceros directamente, ni siquiera
 * indirectamente — solo conoce esta interfaz.
 *
 * `source` reutiliza `ExternalSignalSource` (`core/reality`) tal cual,
 * sin vocabulario nuevo — un conector no inventa su propia noción de
 * "tipo de fuente", usa la que `RealitySnapshot` ya espera. Devuelve
 * `ExternalSignal[]`, la misma forma neutral que `ExternalSignalSnapshot`
 * consume — un futuro ensamblador solo concatena lo que cada conector
 * habilitado devuelve, sin traducir nada más.
 *
 * No conoce `RealitySnapshot` completo, no conoce otros conectores, no
 * conoce ningún engine — su única responsabilidad es "dada una
 * credencial, trae las señales de esta fuente desde este momento."
 */
export interface Connector {
  readonly source: ExternalSignalSource;

  fetchSignals(
    credentials: ConnectorCredentials,
    context: LifeGraphContext,
    since?: Date,
  ): Promise<ExternalSignal[]>;
}
