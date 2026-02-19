CREATE TABLE "editor_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"map_type" varchar(50) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"seed" integer,
	"grid" jsonb NOT NULL,
	"layers" jsonb NOT NULL,
	"walkable" jsonb NOT NULL,
	"metadata" jsonb,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"map_type" varchar(50) NOT NULL,
	"base_width" integer NOT NULL,
	"base_height" integer NOT NULL,
	"parameters" jsonb,
	"constraints" jsonb,
	"grid" jsonb NOT NULL,
	"layers" jsonb NOT NULL,
	"zones" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"zone_type" varchar(50) NOT NULL,
	"shape" varchar(20) NOT NULL,
	"bounds" jsonb,
	"vertices" jsonb,
	"properties" jsonb,
	"z_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_zones" ADD CONSTRAINT "map_zones_map_id_editor_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."editor_maps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_editor_maps_map_type" ON "editor_maps"("map_type");
--> statement-breakpoint
CREATE INDEX "idx_map_templates_published" ON "map_templates"("is_published") WHERE "is_published" = true;
--> statement-breakpoint
CREATE INDEX "idx_map_zones_map_id" ON "map_zones"("map_id");