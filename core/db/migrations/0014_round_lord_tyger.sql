CREATE TYPE "public"."knowledge_engine_reasoning_evidence_role" AS ENUM('supporting', 'contradicting');--> statement-breakpoint
CREATE TYPE "public"."knowledge_engine_reasoning_status" AS ENUM('validated', 'invalidated');--> statement-breakpoint
CREATE TABLE "knowledge_engine_reasoning_conclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"confidence_score" integer NOT NULL,
	"confidence_assigned_at" timestamp with time zone NOT NULL,
	"status" "knowledge_engine_reasoning_status" NOT NULL,
	"uncertainty_notes" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_engine_reasoning_conclusions_confidence_score_range" CHECK ("knowledge_engine_reasoning_conclusions"."confidence_score" >= 0 AND "knowledge_engine_reasoning_conclusions"."confidence_score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "knowledge_engine_reasoning_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"conclusion_id" uuid NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"role" "knowledge_engine_reasoning_evidence_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_engine_reasoning_conclusions" ADD CONSTRAINT "knowledge_engine_reasoning_conclusions_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_reasoning_evidence" ADD CONSTRAINT "knowledge_engine_reasoning_evidence_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_engine_reasoning_evidence" ADD CONSTRAINT "knowledge_engine_reasoning_evidence_conclusion_id_knowledge_engine_reasoning_conclusions_id_fk" FOREIGN KEY ("conclusion_id") REFERENCES "public"."knowledge_engine_reasoning_conclusions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_engine_reasoning_conclusions_life_graph_id_idx" ON "knowledge_engine_reasoning_conclusions" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_reasoning_conclusions_status_idx" ON "knowledge_engine_reasoning_conclusions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_engine_reasoning_evidence_conclusion_id_idx" ON "knowledge_engine_reasoning_evidence" USING btree ("conclusion_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_reasoning_evidence_life_graph_id_idx" ON "knowledge_engine_reasoning_evidence" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "knowledge_engine_reasoning_evidence_ref_idx" ON "knowledge_engine_reasoning_evidence" USING btree ("ref_type","ref_id");