import OpenAI from "openai";
import { env } from "../../core/config/env";
import type { AIMessage, AIProvider } from "../provider";

/**
 * Implementación de AIProvider sobre la API de OpenAI. Es la única pieza
 * del sistema que conoce el SDK `openai` — todo lo demás depende de la
 * interfaz `AIProvider`.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string = env.OPENAI_API_KEY, model: string = env.OPENAI_MODEL) {
    this.client = new OpenAI({ apiKey });
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
      throw new Error(
        "OpenAIProvider: la respuesta del modelo no contiene contenido.",
      );
    }

    return reply;
  }
}
