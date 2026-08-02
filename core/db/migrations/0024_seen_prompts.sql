CREATE TYPE "public"."seen_prompt_status" AS ENUM('seen', 'accepted', 'edited', 'dismissed');--> statement-breakpoint
CREATE TABLE "seen_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" "seen_prompt_status" DEFAULT 'seen' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "seen_prompts" ADD CONSTRAINT "seen_prompts_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seen_prompts_life_graph_id_idx" ON "seen_prompts" USING btree ("life_graph_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seen_prompts_subject_idx" ON "seen_prompts" USING btree ("life_graph_id","subject_type","subject_id");