import { z } from "zod";

export const sendMessageRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1, "El mensaje no puede estar vacío."),
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export interface SendMessageResponse {
  conversationId: string;
  reply: string;
}
