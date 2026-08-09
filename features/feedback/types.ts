import { z } from "zod";

export const submitFeedbackRequestSchema = z.object({
  helpfulness: z.number().int().min(1).max(5),
  remembersMe: z.enum(["yes", "no", "unsure"]),
  responseLength: z.enum(["too_long", "just_right", "too_short"]).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export type SubmitFeedbackRequest = z.infer<typeof submitFeedbackRequestSchema>;

export interface SubmitFeedbackResponse {
  id: string;
}
