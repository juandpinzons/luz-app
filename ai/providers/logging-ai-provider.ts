import { logger } from "../../core/observability/logger";
import type { AIMessage, AIProvider, StructuredOutputRequest } from "../provider";

/**
 * Decorador de `AIProvider` (Composition over Coupling) -- añade
 * observabilidad uniforme a CUALQUIER proveedor sin que ninguna
 * implementación concreta (`OpenAIProvider`, `KimiProvider`, futuras)
 * tenga que loguear por su cuenta, y sin tocar ninguno de los 10+ call
 * sites reales (Belief/Concept/Contradiction/Curiosity/Reasoning/
 * Insight/Life Capture/Morning Brief) que hoy no loguean nada -- solo
 * dependen de un catch genérico varios niveles arriba
 * (`enrichKnowledgeGraph`) que ni dice cuál llamada falló, ni cuánto
 * tardó, ni con qué proveedor. Se envuelve una sola vez, en
 * `ai/index.ts` -- todo proveedor nuevo hereda esto gratis, sin volver
 * a escribir esta clase.
 *
 * Deliberadamente sin `requestId`/`conversationId`: `AIProvider` no
 * conoce el concepto de "request" (`ai/provider.ts` solo recibe
 * mensajes), así que ese contexto queda fuera de este decorador a
 * propósito -- añadirlo exigiría cambiar el contrato compartido por
 * los 12 call sites reales por un beneficio marginal. Los dos call
 * sites que sí necesitan esa correlación (`send-message.ts`) ya la
 * loguean por su cuenta con más detalle (`openai.request_failed`/
 * `openai.response`); este decorador cubre la base para todos, ellos
 * la extienden con su propio contexto.
 */
export class LoggingAIProvider implements AIProvider {
  readonly name: string;

  constructor(private readonly inner: AIProvider) {
    this.name = inner.name;
  }

  async generateReply(messages: AIMessage[]): Promise<string> {
    const startedAt = Date.now();
    try {
      const reply = await this.inner.generateReply(messages);
      logger.log({
        event: "ai_provider.call_completed",
        provider: this.name,
        method: "generateReply",
        durationMs: Date.now() - startedAt,
      });
      return reply;
    } catch (error) {
      logger.log({
        event: "ai_provider.call_failed",
        severity: "error",
        provider: this.name,
        method: "generateReply",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await this.inner.generateStructured(messages, request);
      logger.log({
        event: "ai_provider.call_completed",
        provider: this.name,
        method: "generateStructured",
        requestName: request.name,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      logger.log({
        event: "ai_provider.call_failed",
        severity: "error",
        provider: this.name,
        method: "generateStructured",
        requestName: request.name,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * `chunkCount` en vez de la longitud del texto acumulado: este
   * decorador nunca reconstruye ni retiene el contenido de la
   * respuesta (no es su responsabilidad, y hacerlo costaría memoria
   * sin necesidad en cada fragmento) -- cuántos fragmentos entregó el
   * proveedor ya es una señal real de progreso/tamaño de la respuesta.
   */
  async *generateReplyStream(messages: AIMessage[]): AsyncIterable<string> {
    const startedAt = Date.now();
    let chunkCount = 0;
    try {
      for await (const chunk of this.inner.generateReplyStream(messages)) {
        chunkCount += 1;
        yield chunk;
      }
      logger.log({
        event: "ai_provider.call_completed",
        provider: this.name,
        method: "generateReplyStream",
        chunkCount,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      logger.log({
        event: "ai_provider.call_failed",
        severity: "error",
        provider: this.name,
        method: "generateReplyStream",
        chunkCount,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async generateImage(prompt: string): Promise<string> {
    const startedAt = Date.now();
    try {
      const image = await this.inner.generateImage(prompt);
      logger.log({
        event: "ai_provider.call_completed",
        provider: this.name,
        method: "generateImage",
        durationMs: Date.now() - startedAt,
      });
      return image;
    } catch (error) {
      logger.log({
        event: "ai_provider.call_failed",
        severity: "error",
        provider: this.name,
        method: "generateImage",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
