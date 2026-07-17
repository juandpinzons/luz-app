CREATE TYPE "public"."memory_source" AS ENUM('conversation', 'journal', 'document', 'calendar', 'email', 'sensor', 'manual');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('active', 'archived', 'forgotten');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('fact', 'pattern', 'ritual', 'preference', 'relationship', 'goal', 'event', 'intention');--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"person_id" uuid,
	"type" "memory_type" NOT NULL,
	"content" text NOT NULL,
	"source" "memory_source" NOT NULL,
	"source_id" text,
	"status" "memory_status" DEFAULT 'active' NOT NULL,
	"rank_score" integer,
	"ranked_at" timestamp with time zone,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memories_rank_score_range" CHECK ("memories"."rank_score" IS NULL OR ("memories"."rank_score" >= 0 AND "memories"."rank_score" <= 100)),
	CONSTRAINT "memories_rank_pair" CHECK (("memories"."rank_score" IS NULL AND "memories"."ranked_at" IS NULL) OR ("memories"."rank_score" IS NOT NULL AND "memories"."ranked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "memory_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"from_memory_id" uuid NOT NULL,
	"to_memory_id" uuid NOT NULL,
	"strength" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_connections_strength_range" CHECK ("memory_connections"."strength" IS NULL OR ("memory_connections"."strength" >= 0 AND "memory_connections"."strength" <= 100))
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_connections" ADD CONSTRAINT "memory_connections_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_connections" ADD CONSTRAINT "memory_connections_from_memory_id_memories_id_fk" FOREIGN KEY ("from_memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_connections" ADD CONSTRAINT "memory_connections_to_memory_id_memories_id_fk" FOREIGN KEY ("to_memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_life_graph_id_idx" ON "memories" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "memories_person_id_idx" ON "memories" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "memories_status_idx" ON "memories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memory_connections_life_graph_id_idx" ON "memory_connections" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "memory_connections_from_memory_id_idx" ON "memory_connections" USING btree ("from_memory_id");--> statement-breakpoint
CREATE INDEX "memory_connections_to_memory_id_idx" ON "memory_connections" USING btree ("to_memory_id");