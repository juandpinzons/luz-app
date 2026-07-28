CREATE TYPE "public"."curiosity_question_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "curiosity_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"question" text NOT NULL,
	"rationale" text NOT NULL,
	"status" "curiosity_question_status" DEFAULT 'pending' NOT NULL,
	"coverage_score_at_creation" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "curiosity_questions_coverage_score_range" CHECK ("curiosity_questions"."coverage_score_at_creation" >= 0 AND "curiosity_questions"."coverage_score_at_creation" <= 100)
);
--> statement-breakpoint
ALTER TABLE "curiosity_questions" ADD CONSTRAINT "curiosity_questions_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "curiosity_questions_life_graph_id_idx" ON "curiosity_questions" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "curiosity_questions_life_graph_id_status_idx" ON "curiosity_questions" USING btree ("life_graph_id","status");