CREATE TABLE "account_identities" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;