CREATE TABLE "continuity_loop_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"loop_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"evidence_kind" text NOT NULL,
	"evidence_description" text NOT NULL,
	"evidence_source_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "continuity_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"reason" text NOT NULL,
	"trigger_source_id" text NOT NULL,
	"trigger_summary" text NOT NULL,
	"trigger_detected_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"related_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_follow_up_at" timestamp with time zone,
	"follow_up_attempts" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_evidence_kind" text,
	"resolution_evidence_description" text,
	"resolution_evidence_source_id" text,
	"outcome_kind" text,
	"outcome_summary" text,
	"transformed_into_loop_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "continuity_loops_follow_up_attempts_range" CHECK ("continuity_loops"."follow_up_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "continuity_loop_history" ADD CONSTRAINT "continuity_loop_history_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuity_loop_history" ADD CONSTRAINT "continuity_loop_history_loop_id_continuity_loops_id_fk" FOREIGN KEY ("loop_id") REFERENCES "public"."continuity_loops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuity_loops" ADD CONSTRAINT "continuity_loops_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "continuity_loop_history_life_graph_id_idx" ON "continuity_loop_history" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "continuity_loop_history_loop_id_idx" ON "continuity_loop_history" USING btree ("loop_id","occurred_at");--> statement-breakpoint
CREATE INDEX "continuity_loops_life_graph_id_idx" ON "continuity_loops" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "continuity_loops_life_graph_id_state_idx" ON "continuity_loops" USING btree ("life_graph_id","state");--> statement-breakpoint
CREATE INDEX "continuity_loops_life_graph_id_next_follow_up_idx" ON "continuity_loops" USING btree ("life_graph_id","next_follow_up_at");