import type { AIMessage } from "../ai";
import type { StructuredOutputRequest } from "../ai/provider";
import type { EvaluationProvider } from "./types";

/**
 * Proveedor falso para `--dry-run` -- nunca llama a un modelo real,
 * nunca cuesta un token. Existe para una sola cosa: verificar que el
 * arnés mismo funciona (aislamiento de variantes, repeticiones,
 * agregación de puntajes, formato del reporte) sin gastar crédito real
 * -- correr esto con éxito NO valida nada sobre si Identidad cambia
 * una respuesta real, solo que la herramienta que lo mediría está bien
 * construida. `generateReply` reporta el largo total de TODOS los
 * mensajes de sistema combinados (no solo el último) para poder
 * confirmar, en la salida del dry-run, que cada variante de verdad
 * recibió un prompt distinto -- prevía solo el último mensaje (Voice)
 * se veía idéntico entre variantes por diseño (Voice nunca depende de
 * identidad/contexto), lo que hacía parecer que el dry-run "no
 * detectaba" un cambio real que sí estaba ahí.
 */
export class MockAIProvider implements EvaluationProvider {
  readonly name = "mock-dry-run";

  async generateReply(messages: AIMessage[]): Promise<string> {
    const systemContent = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const preview = systemContent.slice(0, 60).replace(/\n/g, " ");
    return `[respuesta simulada -- dry-run] Prompt de sistema: ${systemContent.length} caracteres, empieza: "${preview}..." — esto no es una respuesta real del modelo.`;
  }

  async generateStructured<T>(
    _messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T> {
    // Objeto canónico que cubre la forma real que `judge.ts` pide
    // (`RESPONSE_EVALUATION_SCHEMA`) -- validado contra el schema real
    // en vez de un `as T` a ciegas, para que un dry-run detecte de
    // verdad si el schema y el mock se desalinearon.
    const canned = {
      personalizacion: { score: 5, justification: "[dry-run] valor simulado, sin llamada real." },
      usoDeContexto: { score: 5, justification: "[dry-run] valor simulado, sin llamada real." },
      coherenciaConHistorial: { score: 5, justification: "[dry-run] valor simulado, sin llamada real." },
      referenciasLargoPlazo: { score: 5, justification: "[dry-run] valor simulado, sin llamada real." },
      naturalidad: { score: 5, justification: "[dry-run] valor simulado, sin llamada real." },
    };
    return request.schema.parse(canned);
  }
}
