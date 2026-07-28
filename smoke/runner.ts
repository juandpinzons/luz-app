import { db } from "../core/db/client";
import { resetTestAccount } from "./utils/test-account";
import { isProductionTarget, smokeBaseUrl } from "./utils/http";
import { loginFlow } from "./login.test";
import { firstMessageFlow } from "./first-message.test";
import { dashboardFlow } from "./dashboard.test";
import { conversationStrategyFlow } from "./conversation-strategy.test";
import { reasoningEngineFlow } from "./reasoning-engine.test";
import { contradictionEngineFlow } from "./contradiction-engine.test";
import { curiosityEngineFlow } from "./curiosity-engine.test";
import { beliefEngineFlow } from "./belief-engine.test";
import { conceptGraphFlow } from "./concept-graph.test";
import { predictiveEngineFlow } from "./predictive-engine.test";
import { aiProviderRegistryFlow } from "./ai-provider-registry.test";
import type { SmokeFlow, SmokeResult } from "./types";

/**
 * Registro explícito, no auto-discovery de archivos -- con 3-10 flujos
 * un array es más simple y más fácil de leer que un glob. Agregar un
 * flujo nuevo es un archivo `<nombre>.test.ts` que exporte un
 * `SmokeFlow` + una línea acá, nunca reestructurar esto.
 */
const ALL_FLOWS: SmokeFlow[] = [
  loginFlow,
  firstMessageFlow,
  dashboardFlow,
  conversationStrategyFlow,
  reasoningEngineFlow,
  contradictionEngineFlow,
  curiosityEngineFlow,
  beliefEngineFlow,
  conceptGraphFlow,
  predictiveEngineFlow,
  aiProviderRegistryFlow,
];

function parseFlowArg(argv: string[]): string | undefined {
  const idx = argv.indexOf("--flow");
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

async function main() {
  const requestedFlow = parseFlowArg(process.argv.slice(2));
  const flowsToRun = requestedFlow
    ? ALL_FLOWS.filter((f) => f.name === requestedFlow)
    : ALL_FLOWS;

  if (requestedFlow && flowsToRun.length === 0) {
    console.error(
      `No existe el flujo "${requestedFlow}". Disponibles: ${ALL_FLOWS.map((f) => f.name).join(", ")}`,
    );
    process.exit(1);
  }

  const target = isProductionTarget()
    ? `${smokeBaseUrl()} ⚠️  PRODUCCIÓN`
    : smokeBaseUrl();
  console.log(`Smoke test -- ${flowsToRun.length} flujo(s) contra ${target}\n`);

  const account = await resetTestAccount(db);
  const results: SmokeResult[] = [];

  for (const flow of flowsToRun) {
    const startedAt = Date.now();
    process.stdout.write(`▸ ${flow.name} ... `);
    try {
      await flow.run({
        baseUrl: smokeBaseUrl(),
        sessionCookie: account.sessionCookie,
        userId: account.userId,
        lifeGraphContext: account.lifeGraphContext,
      });
      const durationMs = Date.now() - startedAt;
      results.push({ name: flow.name, status: "pass", durationMs });
      console.log(`PASS (${durationMs}ms)`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name: flow.name, status: "fail", durationMs, error: message });
      console.log(`FAIL (${durationMs}ms)`);
      console.log(`    ${message}`);
    }
  }

  console.log("\nResumen:");
  for (const result of results) {
    const icon = result.status === "pass" ? "✅" : "❌";
    const suffix = result.error ? ` -- ${result.error}` : "";
    console.log(`  ${icon} ${result.name} (${result.durationMs}ms)${suffix}`);
  }

  const failedCount = results.filter((r) => r.status === "fail").length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
