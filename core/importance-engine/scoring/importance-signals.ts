/**
 * Entrada neutral para calcular importancia -- quien la ensambla (la
 * capa de aplicación, o los propios servicios de consolidación de cada
 * engine) decide cómo contar evidencia/conexiones para su tipo de
 * entidad; esta estrategia solo sabe combinar números, nunca conoce el
 * tipo real de la entidad.
 */
export interface ImportanceSignals {
  /** Cuántas piezas de evidencia distintas respaldan esta entidad. */
  evidenceCount: number;
  /** 0-100, si la entidad misma tiene una confianza propia (Insight/Belief). */
  confidence?: number;
  /** Relaciones/conexiones hacia otras entidades del grafo. */
  connectionCount?: number;
  /** Días desde el último refuerzo/actividad -- más reciente pesa más. */
  recencyDays?: number;
  /** Si participa en una contradicción abierta -- una tensión viva merece atención, no se penaliza. */
  involvedInOpenContradiction?: boolean;
}
