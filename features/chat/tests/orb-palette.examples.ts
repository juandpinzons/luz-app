import { ORB_PALETTE_NAMES, deriveOrbPalette } from "../services/orb-palette";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/chat/tests/orb-palette.examples.ts` -- mismo
 * criterio que el resto de las carpetas tests/ dentro de features/ en
 * este repo. Prueba `deriveOrbPalette`, pura y sin dependencias (ver
 * docblock de `orb-palette.ts` para por qué está separada de
 * `generate-welcome.ts`).
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

let hasFailure = false;

function runScenario(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS  ${name}`);
  } catch (error) {
    hasFailure = true;
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

runScenario("misma persona -- siempre la misma paleta", () => {
  const personId = "person-juan-abc123";
  const first = deriveOrbPalette(personId);
  const second = deriveOrbPalette(personId);
  const third = deriveOrbPalette(personId);

  assert(first === second && second === third, "la misma persona debía obtener siempre la misma paleta");
});

runScenario("siempre un nombre válido de la paleta", () => {
  const sampleIds = ["a", "person-1", "550e8400-e29b-41d4-a716-446655440000", ""];
  for (const id of sampleIds) {
    const palette = deriveOrbPalette(id);
    assert(
      (ORB_PALETTE_NAMES as readonly string[]).includes(palette),
      `"${palette}" (de personId "${id}") debía ser uno de los ${ORB_PALETTE_NAMES.length} nombres válidos`,
    );
  }
});

runScenario('"quiero ver ya una luz diferente" -- personas reales distintas obtienen paletas distintas', () => {
  // IDs sintéticos (nunca los reales) representando el caso concreto que motivó
  // esta misión: varias personas usando la misma cuenta familiar de LUZ.
  const juan = deriveOrbPalette("person-juan");
  const veronica = deriveOrbPalette("person-veronica");
  const alejandro = deriveOrbPalette("person-alejandro");
  const juanFelipe = deriveOrbPalette("person-juan-felipe");

  const distinctPalettes = new Set([juan, veronica, alejandro, juanFelipe]);
  assert(
    distinctPalettes.size > 1,
    `4 personas distintas no debían colapsar todas a la misma paleta (obtenidas: ${[...distinctPalettes].join(", ")})`,
  );
});

runScenario("distribución razonable -- una muestra amplia de personas no colapsa a 1-2 paletas", () => {
  const sample = Array.from({ length: 60 }, (_, index) => deriveOrbPalette(`person-${index}`));
  const distinctPalettes = new Set(sample);

  assert(
    distinctPalettes.size >= ORB_PALETTE_NAMES.length - 1,
    `60 personas distintas debían cubrir casi todas las ${ORB_PALETTE_NAMES.length} paletas, solo se vieron ${distinctPalettes.size}`,
  );
});

if (hasFailure) {
  process.exit(1);
}
