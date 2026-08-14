import { z } from "zod";

/**
 * Auditoría de seguridad, 2026-08-14: el rate limit (`check-rate-limit.ts`)
 * acota CUÁNTOS mensajes por minuto, nunca QUÉ TAN GRANDE puede ser uno
 * -- sin este techo, un solo mensaje de una persona ya autenticada
 * podía disparar costo/latencia/fallos previsibles (más contexto para
 * el modelo, más tokens de salida esperables) sin siquiera acercarse al
 * límite de tasa. 8000 caracteres es generoso frente al uso real
 * (LUZ responde corto, "como un mensaje de texto real" -- ver
 * `render-context.ts`, `voice.maxLines` -- y nada en el producto pide
 * mensajes de usuario largos), acota el peor caso sin tocar a nadie
 * real.
 */
const MAX_MESSAGE_LENGTH = 8000;

export const sendMessageRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z
    .string()
    .min(1, "El mensaje no puede estar vacío.")
    .max(MAX_MESSAGE_LENGTH, `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export interface GetLatestConversationResponse {
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** Forma de todo error que `/api/chat` devuelve (400/401/429/500) — ver app/api/chat/route.ts. */
export interface SendMessageErrorResponse {
  error: string;
}
