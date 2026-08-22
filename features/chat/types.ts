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

/**
 * Techo del lado del servidor sobre la data URI completa (imagen ya
 * comprimida del lado del cliente antes de codificarse a base64, ver
 * `app/chat/page.tsx`) -- defensa en profundidad, mismo criterio que
 * `MAX_MESSAGE_LENGTH`: el cliente ya apunta a mucho menos, esto solo
 * acota el peor caso. Base64 pesa ~33% más que los bytes crudos --
 * 8MB de string cubre una imagen cruda de ~6MB con margen.
 */
const MAX_IMAGE_DATA_URI_LENGTH = 8 * 1024 * 1024;

export const sendMessageRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z.string().max(MAX_MESSAGE_LENGTH, `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`),
    /** Data URI completa (`data:image/...;base64,...`) -- nunca solo el base64 crudo, ver `AIMessage.imageDataUri`. */
    image: z
      .string()
      .max(MAX_IMAGE_DATA_URI_LENGTH, "La imagen es demasiado grande.")
      .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "Formato de imagen no soportado.")
      .optional(),
  })
  // Un mensaje solo-imagen (sin texto) es un caso real -- "vacío" solo
  // cuando NINGUNO de los dos llegó.
  .refine((data) => data.message.trim() !== "" || data.image !== undefined, {
    message: "El mensaje no puede estar vacío.",
    path: ["message"],
  });

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export interface GetLatestConversationResponse {
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string; imageData: string | null }[];
  /** ISO string -- `null` si la conversación no tiene ningún mensaje. Ver `LatestConversation.lastMessageAt`. */
  lastMessageAt: string | null;
}

/** Forma de todo error que `/api/chat` devuelve (400/401/429/500) — ver app/api/chat/route.ts. */
export interface SendMessageErrorResponse {
  error: string;
}
