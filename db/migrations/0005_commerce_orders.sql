CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed', 'expired', 'rto_returned');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('prepaid', 'cod');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"order_id" uuid,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "order_status" NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"shipping_minor" integer DEFAULT 0 NOT NULL,
	"cod_fee_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"tax_inclusive" boolean DEFAULT true NOT NULL,
	"tax_breakup" jsonb,
	"place_of_supply" text,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb,
	"notes" text,
	"access_token" text NOT NULL,
	"idempotency_key" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"product_slug" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"size_snapshot" text NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"qty" integer NOT NULL,
	"line_total_minor" integer NOT NULL,
	"hsn_snapshot" text,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_movement_sku_idx" ON "inventory_movement" USING btree ("sku","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movement_order_idx" ON "inventory_movement" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_number_idx" ON "order" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "order_access_token_idx" ON "order" USING btree ("access_token");--> statement-breakpoint
CREATE UNIQUE INDEX "order_idempotency_idx" ON "order" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "order_email_idx" ON "order" USING btree ("email","placed_at");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX "order_phone_idx" ON "order" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");