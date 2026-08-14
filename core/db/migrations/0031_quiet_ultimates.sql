ALTER TABLE "calendar_connections" ALTER COLUMN "encrypted_credentials" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_connections" ALTER COLUMN "encrypted_credentials" DROP NOT NULL;