ALTER TABLE "order" ADD COLUMN "courier" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "delivered_at" timestamp with time zone;