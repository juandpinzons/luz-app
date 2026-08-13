CREATE TABLE "email_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"provider_kind" text NOT NULL,
	"external_account_id" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_connections_life_graph_provider_idx" ON "email_connections" USING btree ("life_graph_id","provider_kind");