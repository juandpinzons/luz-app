import { KimiProvider } from "./providers/kimi-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import type { AIProvider } from "./provider";

/**
 * Proveedores registrados -- agregar uno nuevo es un archivo nuevo en
 * `ai/providers/` más una línea aquí, nunca tocar `AIProvider` ni a
 * quien lo consume (mismo patrón que `CONVERSATION_STRATEGY_RULES`).
 */
export const AI_PROVIDER_NAMES = ["openai", "kimi"] as const;
export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

const factories: Record<AIProviderName, () => AIProvider> = {
  openai: () => new OpenAIProvider(),
  kimi: () => new KimiProvider(),
};

const cache = new Map<AIProviderName, AIProvider>();

/**
 * Punto único de acceso a un proveedor de IA. Sin argumento, sigue
 * devolviendo exactamente el mismo `OpenAIProvider` cacheado que antes
 * de que existiera este registro -- ningún llamador existente (los 11
 * call sites reales de `getAIProvider()`, todos sin argumentos) cambia
 * de comportamiento. `kimi` queda registrado y disponible por nombre,
 * sin ningún consumidor real todavía (decisión explícita del Founder,
 * 2026-07-28): construirlo -- y por lo tanto exigir `KIMI_API_KEY` --
 * solo ocurre si alguien lo pide explícitamente por nombre, nunca en el
 * arranque normal de la app.
 */
export function getAIProvider(name: AIProviderName = "openai"): AIProvider {
  let provider = cache.get(name);
  if (!provider) {
    provider = factories[name]();
    cache.set(name, provider);
  }
  return provider;
}

export type { AIMessage, AIMessageRole, AIProvider } from "./provider";
