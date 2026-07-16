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
}
