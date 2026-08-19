CREATE TYPE "public"."subscriber_status" AS ENUM('pending', 'confirmed', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TABLE "subscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" "subscriber_status" DEFAULT 'pending' NOT NULL,
	"confirm_token_hash" text,
	"confirm_expires_at" timestamp with time zone,
	"confirm_sent_at" timestamp with time zone,
	"unsub_token" text,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"source" text DEFAULT 'footer' NOT NULL,
	"consent_text" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriber_email_idx" ON "subscriber" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriber_confirm_token_idx" ON "subscriber" USING btree ("confirm_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriber_unsub_token_idx" ON "subscriber" USING btree ("unsub_token");--> statement-breakpoint
CREATE INDEX "subscriber_status_idx" ON "subscriber" USING btree ("status");