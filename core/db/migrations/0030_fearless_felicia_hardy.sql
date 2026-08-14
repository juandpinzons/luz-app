CREATE TABLE "wearable_daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"steps" integer,
	"resting_heart_rate_bpm" integer,
	"average_stress_level" integer,
	"sleep_total_minutes" integer,
	"sleep_deep_minutes" integer,
	"sleep_light_minutes" integer,
	"sleep_rem_minutes" integer,
	"sleep_awake_minutes" integer,
	"sleep_quality_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wearable_daily_metrics" ADD CONSTRAINT "wearable_daily_metrics_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_daily_metrics_life_graph_provider_date_idx" ON "wearable_daily_metrics" USING btree ("life_graph_id","provider","date");--> statement-breakpoint
CREATE INDEX "wearable_daily_metrics_life_graph_date_idx" ON "wearable_daily_metrics" USING btree ("life_graph_id","date");