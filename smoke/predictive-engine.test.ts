import { detectDomainCoMovement, type DomainMovement } from "../core/predictive-engine";
import { createEntityId } from "../core/life";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = new Date("2026-01-01T00:00:00.000Z").getTime();

function daysFromBase(days: number): Date {
  return new Date(BASE + days * DAY_MS);
}

function movement(
  domain: DomainMovement["domain"],
  direction: DomainMovement["direction"],
  dayOffset: number,
): DomainMovement {
  return {
    beliefId: createEntityId(crypto.randomUUID()),
    domain,
    direction,
    changedAt: daysFromBase(dayOffset),
  };
}

/**
 * Pura, sin IO, sin DB -- `detectDomainCoMovement` no depende de
 * `LifeGraphContext` ni de ningún repositorio (mismo criterio de
 * "prueba lo determinista sin fabricar infraestructura" que ya aplica
 * `conversation-strategy.test.ts` a las reglas de estrategia). Fechas
 * ancladas a una base fija, nunca `Date.now()`, para que el resultado
 * sea 100% reproducible sin importar cuándo corra la suite.
 */
export const predictiveEngineFlow: SmokeFlow = {
  name: "predictive-engine",
  async run() {
    // Fixture 1: el mismo par (career→strengthening, health→weakening)
    // ocurre dos veces (MIN_OCCURRENCES), cada vez dentro de la
    // ventana de 21 días -- debe producir exactamente 1 candidato.
    const episode1: DomainMovement[] = [
      movement("career", "strengthening", 0),
      movement("health", "weakening", 2),
      movement("career", "strengthening", 10),
      movement("health", "weakening", 12),
    ];
    const realPattern = detectDomainCoMovement(episode1);
    assert(realPattern.length === 1, `se esperaba 1 patrón real, se obtuvieron ${realPattern.length}`);
    const pattern = realPattern[0];
    assert(pattern?.fromDomain === "career" && pattern.fromDirection === "strengthening", "fromDomain/fromDirection incorrectos");
    assert(pattern?.toDomain === "health" && pattern.toDirection === "weakening", "toDomain/toDirection incorrectos");
    assert(pattern?.occurrences === 2, `occurrences incorrecto: ${pattern?.occurrences}`);

    // Fixture 2: una sola coincidencia (nunca un patrón a partir de
    // una sola ocurrencia) -- no debe aparecer en el resultado.
    const singleOccurrence: DomainMovement[] = [
      movement("finances", "strengthening", 100),
      movement("leisure", "weakening", 101),
    ];
    const onlyOnce = detectDomainCoMovement(singleOccurrence);
    assert(onlyOnce.length === 0, `una sola coincidencia nunca debería producir un patrón, se obtuvieron ${onlyOnce.length}`);

    // Fixture 3: mismo dominio en ambos extremos -- nunca cuenta como
    // co-movimiento entre dominios distintos, sin importar cuántas
    // veces se repita.
    const sameDomain: DomainMovement[] = [
      movement("home", "strengthening", 200),
      movement("home", "weakening", 201),
      movement("home", "strengthening", 210),
      movement("home", "weakening", 211),
    ];
    const sameDomainResult = detectDomainCoMovement(sameDomain);
    assert(sameDomainResult.length === 0, `movimientos del mismo dominio nunca deberían producir un patrón, se obtuvieron ${sameDomainResult.length}`);

    // Fixture 4: fuera de la ventana de 21 días -- no cuenta, aunque
    // se repita dos veces.
    const outsideWindow: DomainMovement[] = [
      movement("personal_growth", "strengthening", 300),
      movement("spirituality", "weakening", 300 + 25), // 25 días después, fuera de la ventana
      movement("personal_growth", "strengthening", 340),
      movement("spirituality", "weakening", 340 + 25),
    ];
    const outsideWindowResult = detectDomainCoMovement(outsideWindow);
    assert(
      outsideWindowResult.length === 0,
      `movimientos fuera de la ventana de ${21} días nunca deberían producir un patrón, se obtuvieron ${outsideWindowResult.length}`,
    );

    // Fixture 5: MAX_CANDIDATES (3) -- cuatro patrones reales y
    // distintos con occurrences descendentes (5,4,3,2); solo los tres
    // con más ocurrencias deben sobrevivir, en ese orden. Episodios
    // separados por >21 días entre sí para que ningún par cruzado
    // entre patrones distintos se cuente por accidente.
    function buildPattern(
      fromDomain: DomainMovement["domain"],
      toDomain: DomainMovement["domain"],
      occurrences: number,
      startDay: number,
    ): DomainMovement[] {
      const result: DomainMovement[] = [];
      for (let i = 0; i < occurrences; i += 1) {
        const episodeStart = startDay + i * 40; // 40 días entre episodios, bien fuera de la ventana de 21.
        result.push(movement(fromDomain, "strengthening", episodeStart));
        result.push(movement(toDomain, "weakening", episodeStart + 1));
      }
      return result;
    }

    const capMovements: DomainMovement[] = [
      ...buildPattern("career", "health", 5, 1000),
      ...buildPattern("finances", "leisure", 4, 3000),
      ...buildPattern("home", "relationships", 3, 5000),
      ...buildPattern("personal_growth", "spirituality", 2, 7000),
    ];
    const capped = detectDomainCoMovement(capMovements);
    assert(capped.length === 3, `MAX_CANDIDATES debería recortar a 3, se obtuvieron ${capped.length}`);
    assert(
      capped.map((c) => c.occurrences).join(",") === "5,4,3",
      `se esperaban los tres patrones con más ocurrencias, en orden descendente (5,4,3) -- se obtuvo ${capped.map((c) => c.occurrences).join(",")}`,
    );
    assert(
      !capped.some((c) => c.fromDomain === "personal_growth"),
      "el patrón con menos ocurrencias (2) debería quedar fuera del recorte",
    );
  },
};
