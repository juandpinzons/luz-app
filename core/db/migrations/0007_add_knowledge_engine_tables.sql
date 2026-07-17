CREATE TYPE "public"."knowledge_engine_insight_status" AS ENUM('proposed', 'validated', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."knowledge_engine_insight_type" AS ENUM('pattern', 'preference', 'fact', 'risk', 'recommendation');--> statement-breakpoint
CREATE TABLE "knowledge_engine_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"memory_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_engine_insight_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"from_insight_id" uuid NOT NULL,
	"to_insight_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"strength" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_engine_insight_relationships_strength_range" CHECK ("knowledge_engine_insight_relationships"."strength" IS NULL OR ("knowledge_engine_insight_relationships"."strength" >= 0 AND "knowledge_engine_insight_relationships"."strength" <= 100))
);
--> statement-breakpoint
CREATE TABLE "knowledge_engine_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"type" "knowledge_engine_insight_type" NOT NULL,
	"description" text NOT NULL,
	"confidence_score" integer NOT NULL,
	"confidence_assigned_at" timestamp with time zone NOT NULL,
	"status" "knowledge_engine_insight_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validated_at" timestamp with time zone,
	CONSTRAINT "knowledge_engine_insights_confidence_score_range" CHECK ("knowledge_engine_insights"."confidence_score" >= 0 AND "knowledge_engine_insights"."confidence_score" <= 100)
);
--> statement-breakpoint
ALTER TABLE "knowledge_engine_evidence" ADD CONSTRAINT "knowledge_engine_evidence_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_evidence" ADD CONSTRAINT "knowledge_engine_evidence_insight_id_knowledge_engine_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."knowledge_engine_insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_insight_relationships" ADD CONSTRAINT "knowledge_engine_insight_relationships_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_insight_relationships" ADD CONSTRAINT "knowledge_engine_insight_relationships_from_insight_id_knowledge_engine_insights_id_fk" FOREIGN KEY ("from_insight_id") REFERENCES "public"."knowledge_engine_insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_insight_relationships" ADD CONSTRAINT "knowledge_engine_insight_relationships_to_insight_id_knowledge_engine_insights_id_fk" FOREIGN KEY ("to_insight_id") REFERENCES "public"."knowledge_engine_insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_insights" ADD CONSTRAINT "knowledge_engine_insights_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_engine_evidence_insight_id_idx" ON "knowledge_engine_evidence" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_evidence_life_graph_id_idx" ON "knowledge_engine_evidence" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_insight_relationships_life_graph_id_idx" ON "knowledge_engine_insight_relationships" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_insight_relationships_from_insight_id_idx" ON "knowledge_engine_insight_relationships" USING btree ("from_insight_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_insight_relationships_to_insight_id_idx" ON "knowledge_engine_insight_relationships" USING btree ("to_insight_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_insights_life_graph_id_idx" ON "knowledge_engine_insights" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_insights_status_idx" ON "knowledge_engine_insights" USING btree ("status");