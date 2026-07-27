CREATE TYPE "public"."belief_status" AS ENUM('active', 'expired', 'retracted');--> statement-breakpoint
CREATE TYPE "public"."contradiction_status" AS ENUM('open', 'acknowledged', 'resolved', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'message_attempted' BEFORE 'message_sent';--> statement-breakpoint
CREATE TABLE "life_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"type" text NOT NULL,
	"priority" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"insight_id" uuid,
	"memory_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"from_concept_id" uuid NOT NULL,
	"to_concept_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"strength" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_relations_strength_range" CHECK ("concept_relations"."strength" IS NULL OR ("concept_relations"."strength" >= 0 AND "concept_relations"."strength" <= 100))
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "belief_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"belief_id" uuid NOT NULL,
	"insight_id" uuid,
	"memory_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "belief_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"belief_id" uuid NOT NULL,
	"previous_confidence" integer,
	"new_confidence" integer NOT NULL,
	"change_reason" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "belief_history_new_confidence_range" CHECK ("belief_history"."new_confidence" >= 0 AND "belief_history"."new_confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "beliefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"subject_person_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"domain" text,
	"status" "belief_status" DEFAULT 'active' NOT NULL,
	"confidence_score" integer NOT NULL,
	"confidence_assigned_at" timestamp with time zone NOT NULL,
	"first_observed_at" timestamp with time zone NOT NULL,
	"last_reinforced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beliefs_confidence_score_range" CHECK ("beliefs"."confidence_score" >= 0 AND "beliefs"."confidence_score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "contradictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"left_ref_type" text NOT NULL,
	"left_ref_id" uuid NOT NULL,
	"right_ref_type" text NOT NULL,
	"right_ref_id" uuid NOT NULL,
	"description" text NOT NULL,
	"domain" text,
	"status" "contradiction_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importance_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"reason" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "importance_scores_score_range" CHECK ("importance_scores"."score" >= 0 AND "importance_scores"."score" <= 100)
);
--> statement-breakpoint
ALTER TABLE "life_domains" ADD CONSTRAINT "life_domains_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relations" ADD CONSTRAINT "concept_relations_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relations" ADD CONSTRAINT "concept_relations_from_concept_id_concepts_id_fk" FOREIGN KEY ("from_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relations" ADD CONSTRAINT "concept_relations_to_concept_id_concepts_id_fk" FOREIGN KEY ("to_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "belief_evidence" ADD CONSTRAINT "belief_evidence_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "belief_evidence" ADD CONSTRAINT "belief_evidence_belief_id_beliefs_id_fk" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "belief_history" ADD CONSTRAINT "belief_history_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "belief_history" ADD CONSTRAINT "belief_history_belief_id_beliefs_id_fk" FOREIGN KEY ("belief_id") REFERENCES "public"."beliefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beliefs" ADD CONSTRAINT "beliefs_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importance_scores" ADD CONSTRAINT "importance_scores_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_domains_life_graph_id_idx" ON "life_domains" USING btree ("life_graph_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_domains_life_graph_id_type_idx" ON "life_domains" USING btree ("life_graph_id","type");--> statement-breakpoint
CREATE INDEX "concept_evidence_life_graph_id_idx" ON "concept_evidence" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "concept_evidence_concept_id_idx" ON "concept_evidence" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "concept_relations_life_graph_id_idx" ON "concept_relations" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "concept_relations_from_concept_id_idx" ON "concept_relations" USING btree ("from_concept_id");--> statement-breakpoint
CREATE INDEX "concept_relations_to_concept_id_idx" ON "concept_relations" USING btree ("to_concept_id");--> statement-breakpoint
CREATE INDEX "concepts_life_graph_id_idx" ON "concepts" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "concepts_life_graph_id_label_idx" ON "concepts" USING btree ("life_graph_id","label");--> statement-breakpoint
CREATE INDEX "belief_evidence_life_graph_id_idx" ON "belief_evidence" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "belief_evidence_belief_id_idx" ON "belief_evidence" USING btree ("belief_id");--> statement-breakpoint
CREATE INDEX "belief_history_life_graph_id_idx" ON "belief_history" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "belief_history_belief_id_idx" ON "belief_history" USING btree ("belief_id");--> statement-breakpoint
CREATE INDEX "beliefs_life_graph_id_idx" ON "beliefs" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "beliefs_life_graph_id_status_idx" ON "beliefs" USING btree ("life_graph_id","status");--> statement-breakpoint
CREATE INDEX "contradictions_life_graph_id_idx" ON "contradictions" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "contradictions_life_graph_id_status_idx" ON "contradictions" USING btree ("life_graph_id","status");--> statement-breakpoint
CREATE INDEX "contradictions_left_ref_idx" ON "contradictions" USING btree ("left_ref_type","left_ref_id");--> statement-breakpoint
CREATE INDEX "contradictions_right_ref_idx" ON "contradictions" USING btree ("right_ref_type","right_ref_id");--> statement-breakpoint
CREATE INDEX "importance_scores_life_graph_id_idx" ON "importance_scores" USING btree ("life_graph_id");--> statement-breakpoint
CREATE UNIQUE INDEX "importance_scores_entity_idx" ON "importance_scores" USING btree ("life_graph_id","entity_type","entity_id");