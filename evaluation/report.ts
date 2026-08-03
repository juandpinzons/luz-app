import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExperimentResult, HeuristicScores, JudgeScores, RepetitionResult } from "./types";

const RESULTS_DIR = join(__dirname, "results");

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function averageHeuristics(repetitions: RepetitionResult[]): HeuristicScores {
  const h = repetitions.map((r) => r.heuristics);
  return {
    characterCount: Math.round(average(h.map((x) => x.characterCount))),
    wordCount: Math.round(average(h.map((x) => x.wordCount))),
    lineCount: Math.round(average(h.map((x) => x.lineCount))),
    withinVoiceLineLimit: h.every((x) => x.withinVoiceLineLimit),
    knownContentTokenMatches: Math.round(average(h.map((x) => x.knownContentTokenMatches))),
  };
}

const JUDGE_DIMENSIONS: (keyof JudgeScores)[] = [
  "personalizacion",
  "usoDeContexto",
  "coherenciaConHistorial",
  "referenciasLargoPlazo",
  "naturalidad",
];

function averageJudgeScores(repetitions: RepetitionResult[]): Record<string, number> | null {
  const scored = repetitions.map((r) => r.judge).filter((j): j is JudgeScores => j !== null);
  if (scored.length === 0) return null;
  const result: Record<string, number> = {};
  for (const dimension of JUDGE_DIMENSIONS) {
    result[dimension] = Math.round(average(scored.map((s) => s[dimension].score)) * 10) / 10;
  }
  return result;
}

export function printConsoleReport(result: ExperimentResult): void {
  const line = "─".repeat(72);
  console.log(`\n${line}`);
  console.log(`EXPERIMENTO: ${result.experiment.name}`);
  console.log(`Pregunta: ${result.experiment.question}`);
  console.log(`Proveedor: ${result.provider}${result.dryRun ? " (DRY RUN -- sin llamadas reales)" : ""}`);
  console.log(`Mensaje: "${result.experiment.userMessage}"`);
  console.log(line);

  for (const variantResult of result.variantResults) {
    console.log(`\n▸ Variante: ${variantResult.variant.name} (${variantResult.variant.factor})`);
    variantResult.repetitions.forEach((rep) => {
      console.log(`\n  [Repetición ${rep.repetitionIndex + 1}] (${rep.durationMs}ms)`);
      console.log(`  "${rep.response}"`);
      console.log(
        `  Heurísticas: ${rep.heuristics.lineCount} líneas (límite Voice: ${rep.heuristics.withinVoiceLineLimit ? "OK" : "EXCEDIDO"}), ${rep.heuristics.wordCount} palabras, ${rep.heuristics.knownContentTokenMatches} coincidencias léxicas con contexto conocido`,
      );
      if (rep.judge) {
        const parts = JUDGE_DIMENSIONS.map((d) => `${d}=${rep.judge![d].score}`);
        console.log(`  Juez: ${parts.join(", ")}`);
      }
    });

    const avgH = averageHeuristics(variantResult.repetitions);
    const avgJ = averageJudgeScores(variantResult.repetitions);
    console.log(`\n  Promedio (${variantResult.repetitions.length} repeticiones):`);
    console.log(`  - Líneas: ${avgH.lineCount} · Palabras: ${avgH.wordCount} · Coincidencias léxicas: ${avgH.knownContentTokenMatches}`);
    if (avgJ) {
      console.log(`  - Juez: ${JUDGE_DIMENSIONS.map((d) => `${d}=${avgJ[d]}`).join(", ")}`);
    }
  }
  console.log(`\n${line}\n`);
}

function markdownTable(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`);
  return [headerRow, separator, ...bodyRows].join("\n");
}

/**
 * Reporte permanente en Markdown -- "lado a lado" real, no descripción
 * de lado a lado: una tabla con una columna por variante. Funciona
 * bien porque Voice ya limita las respuestas a pocas líneas
 * (`VoiceSignature.maxLines`) -- si algún experimento futuro genera
 * texto mucho más largo, esta tabla dejaría de ser legible y valdría
 * la pena una sección por variante en su lugar; no se resuelve aquí
 * antes de que sea un problema real.
 */
export function writeMarkdownReport(result: ExperimentResult): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = result.runAt.toISOString().replace(/[:.]/g, "-");
  const fileName = `${result.experiment.name}-${timestamp}.md`;
  const filePath = join(RESULTS_DIR, fileName);

  const lines: string[] = [];
  lines.push(`# ${result.experiment.name}`);
  lines.push("");
  lines.push(`**Pregunta:** ${result.experiment.question}`);
  lines.push(`**Fecha:** ${result.runAt.toISOString()}`);
  lines.push(`**Proveedor:** ${result.provider}${result.dryRun ? " (dry-run)" : ""}`);
  lines.push(`**Mensaje del usuario:** "${result.experiment.userMessage}"`);
  lines.push("");
  lines.push("Todo lo demás (RealitySnapshot base, Conversation Rules, Voice, modelo, mensaje) se mantuvo idéntico entre variantes -- el único factor que cambia por variante está en la columna.");
  lines.push("");

  const variantNames = result.variantResults.map((v) => v.variant.name);

  lines.push("## Respuestas, lado a lado");
  lines.push("");
  const maxReps = Math.max(...result.variantResults.map((v) => v.repetitions.length));
  for (let i = 0; i < maxReps; i++) {
    lines.push(`### Repetición ${i + 1}`);
    lines.push("");
    lines.push(
      markdownTable(
        variantNames,
        [result.variantResults.map((v) => v.repetitions[i]?.response.replace(/\n/g, "<br>") ?? "(sin datos)")],
      ),
    );
    lines.push("");
  }

  lines.push("## Heurísticas (promedio)");
  lines.push("");
  lines.push(
    markdownTable(
      ["Métrica", ...variantNames],
      [
        ["Líneas", ...result.variantResults.map((v) => String(averageHeuristics(v.repetitions).lineCount))],
        ["Palabras", ...result.variantResults.map((v) => String(averageHeuristics(v.repetitions).wordCount))],
        ["Dentro del límite de Voice", ...result.variantResults.map((v) => (averageHeuristics(v.repetitions).withinVoiceLineLimit ? "sí" : "no, en al menos una repetición"))],
        ["Coincidencias léxicas con contexto conocido", ...result.variantResults.map((v) => String(averageHeuristics(v.repetitions).knownContentTokenMatches))],
      ],
    ),
  );
  lines.push("");

  const anyJudge = result.variantResults.some((v) => averageJudgeScores(v.repetitions) !== null);
  if (anyJudge) {
    lines.push("## Evaluación del juez de IA (promedio, 1-10, evaluación ciega e independiente por respuesta)");
    lines.push("");
    lines.push(
      markdownTable(
        ["Dimensión", ...variantNames],
        JUDGE_DIMENSIONS.map((d) => [
          d,
          ...result.variantResults.map((v) => {
            const avg = averageJudgeScores(v.repetitions);
            return avg ? String(avg[d]) : "—";
          }),
        ]),
      ),
    );
    lines.push("");
  }

  lines.push("## Prompts de sistema completos, por variante");
  lines.push("");
  for (const variantResult of result.variantResults) {
    lines.push(`### ${variantResult.variant.name} (${variantResult.variant.factor})`);
    lines.push("");
    lines.push("```");
    lines.push(variantResult.systemPromptPreview);
    lines.push("```");
    lines.push("");
  }

  writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}
