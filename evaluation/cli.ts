import type { AIProviderName } from "../ai";
import { MockAIProvider } from "./ai-provider-mock";
import { buildIdentityInConversationExperiment } from "./experiments/identity-in-conversation";
import { printConsoleReport, writeMarkdownReport } from "./report";
import { runExperiment } from "./run-experiment";
import type { Experiment, EvaluationProvider } from "./types";

/**
 * Registro de experimentos disponibles -- agregar uno nuevo es un
 * archivo en `experiments/` más una línea aquí, mismo patrón que
 * `CONVERSATION_RULES`/`AI_PROVIDER_NAMES`: nunca tocar el arnés
 * (`run-experiment.ts`) para agregar un experimento.
 */
const EXPERIMENTS: Record<string, () => Experiment> = {
  "identity-in-conversation": buildIdentityInConversationExperiment,
};

interface CliOptions {
  experimentName: string;
  dryRun: boolean;
  repetitions: number;
  useJudge: boolean;
  providerName: AIProviderName;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    experimentName: "identity-in-conversation",
    dryRun: false,
    repetitions: 3,
    useJudge: true,
    providerName: "openai",
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-judge") {
      options.useJudge = false;
    } else if (arg.startsWith("--experiment=")) {
      options.experimentName = arg.slice("--experiment=".length);
    } else if (arg.startsWith("--repetitions=")) {
      const parsed = Number.parseInt(arg.slice("--repetitions=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) options.repetitions = parsed;
    } else if (arg.startsWith("--provider=")) {
      options.providerName = arg.slice("--provider=".length) as AIProviderName;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const buildExperiment = EXPERIMENTS[options.experimentName];
  if (!buildExperiment) {
    console.error(
      `Experimento desconocido: "${options.experimentName}". Disponibles: ${Object.keys(EXPERIMENTS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  // Import dinámico, no estático: `ai/index.ts` carga ambos proveedores
  // (`OpenAIProvider`/`KimiProvider`) al importarse, y cada uno valida
  // el entorno real (`OPENAI_API_KEY`, etc.) a nivel de módulo -- un
  // `import` estático rompería `--dry-run` exactamente en el escenario
  // que existe para cubrir: sin credenciales reales disponibles.
  const provider: EvaluationProvider = options.dryRun
    ? new MockAIProvider()
    : (await import("../ai")).getAIProvider(options.providerName);

  if (options.dryRun) {
    console.log("⚠ Modo --dry-run: respuestas simuladas, ninguna llamada real. Esto valida la herramienta, no a LUZ.\n");
  } else if (options.useJudge) {
    console.log(
      `Corriendo con el proveedor real (${provider.name}), juez de IA activado: cada repetición hace 1 llamada de respuesta + 1 de evaluación por variante.\n`,
    );
  }

  const experiment = buildExperiment();
  const result = await runExperiment(experiment, {
    provider,
    repetitions: options.repetitions,
    dryRun: options.dryRun,
    useJudge: options.useJudge,
  });

  printConsoleReport(result);
  const filePath = writeMarkdownReport(result);
  console.log(`Reporte completo guardado en: ${filePath}`);
}

main().catch((error) => {
  console.error("Error corriendo el experimento:", error);
  process.exitCode = 1;
});
