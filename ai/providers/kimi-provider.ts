import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { env } from "../../core/config/env";
import type { AIMessage, AIProvider, StructuredOutputRequest } from "../provider";

/**
 * Implementación de AIProvider sobre Kimi K3 (Moonshot AI) -- API
 * compatible con el formato de OpenAI (mismo request/response, distinto
 * `baseURL`), así que reutiliza el SDK `openai` ya instalado en vez de
 * agregar uno nuevo. Es la única pieza del sistema que conoce que Kimi
 * existe -- todo lo demás depende de la interfaz `AIProvider`.
 *
 * `apiKey` no tiene default de `env.KIMI_API_KEY` en la firma (a
 * diferencia de `OpenAIProvider`) porque `KIMI_API_KEY` es opcional a
 * nivel de esquema -- construir esta clase sin una key real es un error
 * del llamador, no un estado válido que deba degradarse en silencio.
 */
export class KimiProvider implements AIProvider {
  readonly name = "kimi";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    apiKey: string | undefined = env.KIMI_API_KEY,
    model: string = env.KIMI_MODEL,
    baseURL: string = env.KIMI_BASE_URL,
  ) {
    if (!apiKey) {
      throw new Error(
        "KimiProvider: KIMI_API_KEY no está configurado -- agrégalo a .env antes de instanciar este proveedor.",
      );
    }
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  async generateReply(messages: AIMessage[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      throw new Error("KimiProvider: la respuesta del modelo no contiene contenido.");
    }

    return reply;
  }

  /**
   * A diferencia de `OpenAIProvider`, no usa el helper `.parse()` del
   * SDK (una capa cliente pensada específicamente para la API de
   * OpenAI) -- arma `response_format` con el mismo `zodResponseFormat`
   * (función pura, sin acoplarse a un backend concreto) y valida la
   * respuesta a mano. Kimi K3 sí soporta `json_schema`/`strict: true`
   * (confirmado en su documentación), pero apoyarse en el parseo
   * interno de `.parse()` contra un backend no-OpenAI no está
   * garantizado -- este camino es el que sí se puede verificar por
   * construcción. Lee únicamente `message.content`, nunca
   * `message.reasoning_content` (K3 siempre razona antes de responder,
   * ver docs -- el contenido estructurado vive solo en `content`).
   */
  async generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      response_format: zodResponseFormat(request.schema, request.name),
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error(
        `KimiProvider: la respuesta estructurada para "${request.name}" llegó vacía.`,
      );
    }

    return request.schema.parse(JSON.parse(content));
  }

  /**
   * Streaming nativo, mismo criterio que `OpenAIProvider`. Kimi K3
   * entrega `delta.reasoning_content` (traza de razonamiento) separado
   * de `delta.content` (respuesta final) -- este bucle solo lee
   * `delta.content`, así que la traza de razonamiento nunca se filtra
   * al contrato `AIProvider` (que exige que los fragmentos
   * concatenados formen el mismo texto que `generateReply`).
   */
  async *generateReplyStream(messages: AIMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
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

  /**
   * Kimi K3 es un modelo de texto/razonamiento -- Moonshot AI no
   * documenta un endpoint de generación de imágenes compatible con la
   * API de OpenAI. Lanza explícito en vez de fingir soporte: mismo
   * criterio que el constructor (un estado no válido nunca se degrada
   * en silencio). Sin consumidor real hoy (`ai/index.ts` no enruta a
   * este proveedor), así que esto nunca corre en producción todavía.
   */
  async generateImage(): Promise<string> {
    throw new Error("KimiProvider: generación de imágenes no soportada -- Kimi K3 no expone ese endpoint.");
  }
}
