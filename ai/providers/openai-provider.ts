import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { env } from "../../core/config/env";
import type { AIMessage, AIProvider, StructuredOutputRequest } from "../provider";

/**
 * Implementación de AIProvider sobre la API de OpenAI. Es la única pieza
 * del sistema que conoce el SDK `openai` — todo lo demás depende de la
 * interfaz `AIProvider`.
 */
/**
 * LUZ responde corto por diseño ("como un mensaje de texto real", ver
 * `render-context.ts`, `voice.maxLines`) -- este techo nunca debería
 * tocar una respuesta real, solo acotar el peor caso (costo/latencia de
 * una generación que por lo que sea no termina de forma natural).
 * Auditoría de seguridad, 2026-08-14: ninguna llamada a OpenAI tenía
 * límite de tokens de salida ni timeout explícito.
 */
const MAX_COMPLETION_TOKENS = 1500;
/** Bastante por debajo del `maxDuration = 60` de `/api/chat` (Vercel Hobby) -- falla limpio con un error claro en vez de esperar siempre el kill duro de la función. */
const REQUEST_TIMEOUT_MS = 30_000;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string = env.OPENAI_API_KEY, model: string = env.OPENAI_MODEL) {
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    this.model = model;
  }

  async generateReply(messages: AIMessage[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      throw new Error(
        "OpenAIProvider: la respuesta del modelo no contiene contenido.",
      );
    }

    return reply;
  }

  /**
   * Implementa `AIProvider.generateStructured` (ADR-0016) con el modo
   * de salida estructurada nativo de OpenAI: `chat.completions.parse`
   * + `zodResponseFormat`, que valida contra `request.schema` en modo
   * estricto y ya deserializa el JSON. Este método sigue siendo el
   * único lugar del sistema que conoce el SDK `openai` — nada de esto
   * se filtra al contrato `AIProvider`.
   */
  async generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T> {
    const completion = await this.client.chat.completions.parse({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      response_format: zodResponseFormat(request.schema, request.name),
    });

    const message = completion.choices[0]?.message;

    if (message?.refusal) {
      throw new Error(
        `OpenAIProvider: el modelo rechazó generar "${request.name}": ${message.refusal}`,
      );
    }

    if (!message || message.parsed === null || message.parsed === undefined) {
      throw new Error(
        `OpenAIProvider: la respuesta estructurada para "${request.name}" no pudo parsearse.`,
      );
    }

    return message.parsed;
  }

  /**
   * Implementa `AIProvider.generateReplyStream` (ADR-0017) con el modo
   * de streaming nativo de OpenAI (`stream: true`) — el SDK devuelve un
   * `Stream<ChatCompletionChunk>` iterable de forma asíncrona. Cada
   * fragmento no vacío de `delta.content` se entrega tal cual, en
   * orden; concatenados forman el mismo texto que `generateReply`
   * habría devuelto. Sigue siendo el único método de esta clase que
   * conoce la forma exacta de los chunks del SDK `openai`.
   */
  async *generateReplyStream(messages: AIMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}
