CREATE TABLE "admin_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"admin_email" text NOT NULL,
	"viewed_user_id" uuid NOT NULL,
	"justification" text NOT NULL,
	"route" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_access_log_viewed_user_id_idx" ON "admin_access_log" USING btree ("viewed_user_id");--> statement-breakpoint
CREATE INDEX "admin_access_log_admin_user_id_idx" ON "admin_access_log" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_access_log_accessed_at_idx" ON "admin_access_log" USING btree ("accessed_at");