import { getAIProvider } from "../ai";
import { env } from "../core/config/env";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Cubre el registro de proveedores (`ai/index.ts`) y `LoggingAIProvider`
 * (`ai/providers/logging-ai-provider.ts`) -- sin red, sin DB: prueba el
 * contrato del registro en sí (identidad cacheada, fallo temprano
 * cuando falta configuración), no una llamada real a ningún modelo. Las
 * tres formas de llamada (`generateReply`/`generateStructured`/
 * `generateReplyStream`) ya se verifican contra la API real de OpenAI
 * en `first-message.test.ts`/`conversation-strategy.test.ts` a través
 * de `send-message.ts` -- este flujo no duplica eso.
 */
export const aiProviderRegistryFlow: SmokeFlow = {
  name: "ai-provider-registry",
  async run() {
    const noArgs = getAIProvider();
    const explicitOpenai = getAIProvider("openai");
    assert(
      noArgs === explicitOpenai,
      "getAIProvider() y getAIProvider('openai') deben devolver la misma instancia cacheada",
    );
    assert(noArgs.name === "openai", "el proveedor por defecto debe seguir siendo 'openai'");

    const again = getAIProvider();
    assert(
      again === noArgs,
      "llamadas repetidas sin argumento deben reutilizar el mismo singleton, nunca reconstruirlo",
    );

    // Condicional a propósito -- KIMI_API_KEY es opcional (Nivel 1: sin
    // consumidor real todavía), así que este entorno puede o no
    // tenerla configurada. El invariante real no es "siempre debe
    // fallar", es "debe fallar temprano y con claridad exactamente
    // cuando falta la key, y nunca en otro caso" -- probar solo la
    // rama sin key (asumiendo que nunca habrá una) haría que este
    // mismo flujo empezara a fallar en cuanto alguien agregue una key
    // real, por una razón que no tiene nada que ver con una regresión.
    if (env.KIMI_API_KEY) {
      const kimi = getAIProvider("kimi");
      assert(kimi.name === "kimi", "con KIMI_API_KEY configurado, getAIProvider('kimi') debe construir un proveedor real");
    } else {
      let threw = false;
      try {
        getAIProvider("kimi");
      } catch (error) {
        threw = true;
        const message = error instanceof Error ? error.message : String(error);
        assert(
          message.includes("KIMI_API_KEY"),
          `getAIProvider('kimi') sin KIMI_API_KEY debe fallar con un mensaje claro sobre la key faltante (fue: "${message}")`,
        );
      }
      assert(
        threw,
        "getAIProvider('kimi') debe lanzar cuando KIMI_API_KEY no está configurado -- fallo temprano, nunca un proveedor a medio construir",
      );
    }
  },
};
