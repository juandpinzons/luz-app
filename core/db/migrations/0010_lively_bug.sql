CREATE TYPE "public"."feedback_remembers_me" AS ENUM('yes', 'no', 'unsure');--> statement-breakpoint
CREATE TABLE "feedback_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"helpfulness" integer NOT NULL,
	"remembers_me" "feedback_remembers_me" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_responses_user_id_idx" ON "feedback_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_responses_created_at_idx" ON "feedback_responses" USING btree ("created_at");