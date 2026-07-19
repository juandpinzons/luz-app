import type { z } from "zod";

/**
 * Contrato único del que depende todo el sistema para hablar con un
 * modelo de lenguaje. Ninguna capa (features, core/knowledge) debe
 * importar un SDK de IA directamente — siempre a través de `AIProvider`.
 * Cambiar de proveedor es editar `ai/index.ts`, nunca el código que lo
 * consume.
 */
export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

/**
 * Describe la salida esperada de `generateStructured` con Zod — el
 * mismo lenguaje de schema que ya usa el resto del sistema
 * (`core/config/env.ts`, `features/chat/types.ts`), no un formato
 * propio de OpenAI. `name` identifica el schema ante el proveedor
 * (telemetría, function/tool name según la implementación) — nunca
 * contenido de cara al usuario.
 */
export interface StructuredOutputRequest<T> {
  name: string;
  schema: z.ZodType<T>;
}

export interface AIProvider {
  /** Identificador del proveedor, útil para logs/telemetría. */
  readonly name: string;

  /**
   * Genera la respuesta del asistente para una conversación completa.
   * Devuelve solo el texto: los detalles de streaming, tool-calling o
   * function-calling son responsabilidad de cada implementación y no
   * se filtran a través de este contrato mientras no se necesiten.
   */
  generateReply(messages: AIMessage[]): Promise<string>;

  /**
   * Como `generateReply`, pero exige que la respuesta cumpla
   * `request.schema` — valida antes de devolver, nunca texto crudo
   * para que el llamador lo parsee. ADR-0016: abstracción de largo
   * plazo, no un helper específico de OpenAI — cada implementación de
   * `AIProvider` decide CÓMO logra la salida estructurada (JSON mode,
   * function calling, lo que su SDK ofrezca); el contrato solo exige
   * el resultado ya validado contra `T`. Primeros consumidores:
   * `ExtractStage` e `InsightGenerationStrategy` del Knowledge Engine
   * (Beta 1 Roadmap, Sprint B2).
   */
  generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T>;
}
