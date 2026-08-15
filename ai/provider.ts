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
  /**
   * Data URI completa de una imagen adjunta a ESTE mensaje (`data:image/jpeg;base64,...`)
   * -- opcional y aditivo, `undefined` en el camino normal de texto.
   * Nunca reemplaza `content`: un mensaje con imagen sigue teniendo su
   * texto normal (la pregunta/comentario de la persona, o vacío), la
   * imagen viaja aparte. Cada implementación de `AIProvider` decide
   * cómo construir la llamada multimodal a su proveedor real; el
   * contrato solo promete que, si el proveedor soporta visión, la
   * imagen efectivamente se envía.
   */
  imageDataUri?: string;
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

  /**
   * Como `generateReply`, pero entrega el texto en fragmentos a medida
   * que el modelo los genera, en vez de esperar la respuesta completa.
   * ADR-0017: aditivo — `generateReply`/`generateStructured` intactos,
   * ningún llamador existente se ve afectado. El contrato solo exige
   * que los fragmentos, concatenados en orden, formen el mismo texto
   * que `generateReply` habría devuelto — cada implementación decide
   * cómo lo logra (streaming nativo del SDK, o simular un solo
   * fragmento si su proveedor no soporta streaming).
   */
  generateReplyStream(messages: AIMessage[]): AsyncIterable<string>;

  /**
   * Genera una imagen a partir de una descripción en texto -- capacidad
   * distinta de conversar (nunca toma `AIMessage[]`, no hay "contexto
   * de conversación" que un generador de imágenes entienda). Devuelve
   * una data URI completa (`data:image/...;base64,...`), la misma
   * forma que `AIMessage.imageDataUri` y `conversation_messages.image_data`
   * ya usan -- un solo formato de imagen en todo el sistema, nunca dos.
   */
  generateImage(prompt: string): Promise<string>;

  /**
   * Vector de embedding para un texto -- capacidad distinta de conversar,
   * mismo criterio que `generateImage` (nunca toma `AIMessage[]`, no hay
   * "contexto de conversación" para un embedding). Longitud fija en
   * `EMBEDDING_DIMENSIONS` (`core/db/schema/memory.ts`, hoy 1536) --
   * cada implementación es responsable de que su modelo produzca
   * exactamente esa dimensión; un proveedor que no pueda debe lanzar,
   * nunca devolver un vector de otro tamaño en silencio.
   */
  embed(text: string): Promise<number[]>;
}
