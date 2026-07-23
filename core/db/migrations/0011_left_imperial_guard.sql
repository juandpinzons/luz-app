CREATE TABLE "life_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"domain" text,
	"target_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"domain" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'planning' NOT NULL,
	"domain" text,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"from_person_id" uuid NOT NULL,
	"to_person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"closeness" integer,
	"since" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"life_graph_id" uuid NOT NULL,
	"habit_id" uuid,
	"title" text NOT NULL,
	"frequency" text NOT NULL,
	"domain" text,
	"detected_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "life_goals" ADD CONSTRAINT "life_goals_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_habits" ADD CONSTRAINT "life_habits_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_habits" ADD CONSTRAINT "life_habits_goal_id_life_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."life_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_projects" ADD CONSTRAINT "life_projects_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_projects" ADD CONSTRAINT "life_projects_goal_id_life_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."life_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_relationships" ADD CONSTRAINT "life_relationships_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_relationships" ADD CONSTRAINT "life_relationships_from_person_id_persons_id_fk" FOREIGN KEY ("from_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_relationships" ADD CONSTRAINT "life_relationships_to_person_id_persons_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_routines" ADD CONSTRAINT "life_routines_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_routines" ADD CONSTRAINT "life_routines_habit_id_life_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."life_habits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_goals_life_graph_id_idx" ON "life_goals" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "life_habits_life_graph_id_idx" ON "life_habits" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "life_habits_goal_id_idx" ON "life_habits" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "life_projects_life_graph_id_idx" ON "life_projects" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "life_projects_goal_id_idx" ON "life_projects" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "life_relationships_life_graph_id_idx" ON "life_relationships" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "life_relationships_from_to_idx" ON "life_relationships" USING btree ("from_person_id","to_person_id");--> statement-breakpoint
CREATE INDEX "life_routines_life_graph_id_idx" ON "life_routines" USING btree ("life_graph_id");--> statement-breakpoint
CREATE INDEX "life_routines_habit_id_idx" ON "life_routines" USING btree ("habit_id");