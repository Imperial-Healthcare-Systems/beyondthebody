CREATE TYPE "public"."variant_status" AS ENUM('active', 'hidden', 'sold_out', 'discontinued');--> statement-breakpoint
CREATE TABLE "price_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"old_price_minor" integer,
	"new_price_minor" integer,
	"changed_by" uuid,
	"changed_by_email" text,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"sku" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"size_label" text NOT NULL,
	"size_ml" integer NOT NULL,
	"price_minor" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "variant_status" DEFAULT 'active' NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"stock_tracked" boolean DEFAULT false NOT NULL,
	"hsn_code" text,
	"weight_grams" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE INDEX "price_change_sku_idx" ON "price_change" USING btree ("sku","changed_at");--> statement-breakpoint
CREATE INDEX "product_variant_slug_idx" ON "product_variant" USING btree ("product_slug");