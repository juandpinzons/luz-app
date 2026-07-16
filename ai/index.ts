import { OpenAIProvider } from "./providers/openai-provider";
import type { AIProvider } from "./provider";

let cachedProvider: AIProvider | undefined;

/**
 * Punto único de acceso al proveedor de IA activo. Implementación
 * inicial: OpenAIProvider (decisión CTO #3). Para soportar múltiples
 * proveedores o fallback en el futuro, este es el único archivo que
 * debe cambiar.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new OpenAIProvider();
  }

  return cachedProvider;
}

export type { AIMessage, AIMessageRole, AIProvider } from "./provider";
