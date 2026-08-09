#!/usr/bin/env node
// Convierte editorial/*/phrases.yaml a editorial/generated/phrases.ts.
// Parser deliberadamente angosto (no una dependencia de YAML general):
// el formato es fijo y simple (ver README) -- una lista plana de
// bloques `- id: ...` con siempre las mismas siete claves, nunca
// anidado. Correr de nuevo cada vez que se agregue una ronda de
// frases (README: "trabajo futuro, ronda a ronda") -- nunca editar
// phrases.ts a mano.
//
// Por qué un archivo generado y no leer el YAML en runtime: Next.js/
// Vercel no garantiza que archivos fuera del grafo de imports normal
// (fs.readFileSync sobre editorial/*.yaml) lleguen al bundle de la
// función serverless -- funcionaría en `next dev` local y fallaría en
// producción de forma que un smoke test local nunca vería. Un módulo
// TS generado es código normal, Next.js lo empaqueta como cualquier
// otro import.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

function parsePhrasesYaml(raw) {
  const lines = raw.split("\n");
  const phrases = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed === "[]") continue;

    const idMatch = trimmed.match(/^- id:\s*(\S+)/);
    if (idMatch) {
      if (current) phrases.push(current);
      current = { id: idMatch[1] };
      continue;
    }
    if (!current) continue;

    const kv = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = rawValue.replace(/^"(.*)"$/, "$1");
    current[key] = value;
  }
  if (current) phrases.push(current);
  return phrases;
}

const editorialDir = ROOT;
const categories = readdirSync(editorialDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "generated")
  .map((entry) => entry.name)
  .sort();

const byCategory = {};
for (const category of categories) {
  const yamlPath = join(editorialDir, category, "phrases.yaml");
  const raw = readFileSync(yamlPath, "utf8");
  byCategory[category] = parsePhrasesYaml(raw);
}

const totalCount = Object.values(byCategory).reduce((sum, list) => sum + list.length, 0);

const header = `/**
 * GENERADO por editorial/build-phrases.mjs -- no editar a mano.
 * Fuente real: editorial/<categoria>/phrases.yaml (ver editorial/README.md).
 * Volver a correr \`node editorial/build-phrases.mjs\` después de
 * cualquier cambio a los YAML -- este archivo no se regenera solo.
 * ${totalCount} frases totales, ${categories.length} categorías.
 */
export type EditorialCategory = ${categories.map((c) => `"${c}"`).join(" | ")};

export interface EditorialPhrase {
  id: string;
  text: string;
  category: EditorialCategory;
  tone: string;
  energy: string;
  length: string;
  repeatAfterDays: number;
}

`;

const arrays = categories
  .map((category) => {
    const items = byCategory[category]
      .map((p) => {
        const repeatMatch = /(\d+)/.exec(p.repeat_after ?? "30");
        const repeatAfterDays = repeatMatch ? Number(repeatMatch[1]) : 30;
        return `  { id: ${JSON.stringify(p.id)}, text: ${JSON.stringify(p.text)}, category: ${JSON.stringify(category)}, tone: ${JSON.stringify(p.tone)}, energy: ${JSON.stringify(p.energy)}, length: ${JSON.stringify(p.length)}, repeatAfterDays: ${repeatAfterDays} },`;
      })
      .join("\n");
    return `export const ${category.toUpperCase()}_PHRASES: EditorialPhrase[] = [\n${items}\n];`;
  })
  .join("\n\n");

const allExport = `\nexport const ALL_EDITORIAL_PHRASES: EditorialPhrase[] = [\n${categories.map((c) => `  ...${c.toUpperCase()}_PHRASES,`).join("\n")}\n];\n`;

writeFileSync(join(editorialDir, "generated", "phrases.ts"), header + arrays + "\n" + allExport);

console.log(`Generado editorial/generated/phrases.ts -- ${totalCount} frases, ${categories.length} categorías:`);
for (const category of categories) {
  console.log(`  ${category}: ${byCategory[category].length}`);
}
