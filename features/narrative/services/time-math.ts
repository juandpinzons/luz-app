/**
 * Aritmética de tiempo compartida por todo `features/narrative/` --
 * mismo criterio que `daysBetween` en
 * `features/dashboard/services/build-life-dashboard-snapshot.ts`
 * (exportada ahí para que `build-life-observations.ts` reuse la misma
 * función en vez de redefinirla): un solo lugar, nunca dos copias que
 * puedan divergir por un redondeo distinto.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / HOUR_MS;
}
