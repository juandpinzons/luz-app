import { z } from "zod";

export const sendMessageRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1, "El mensaje no puede estar vacío."),
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
