CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" text,
	"alt" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"num" text,
	"title" text NOT NULL,
	"standfirst" text,
	"body" jsonb NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"hero_image" text,
	"hero_alt" text,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "post_slug_alias" (
	"slug" text PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_slug_alias" ADD CONSTRAINT "post_slug_alias_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_path_idx" ON "media" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "post_slug_idx" ON "post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "post_status_idx" ON "post" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "post_slug_alias_post_idx" ON "post_slug_alias" USING btree ("post_id");