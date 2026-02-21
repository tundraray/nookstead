CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"key" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"walkable" boolean DEFAULT true NOT NULL,
	"speed_modifier" real DEFAULT 1 NOT NULL,
	"swim_required" boolean DEFAULT false NOT NULL,
	"damaging" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_name_unique" UNIQUE("name"),
	CONSTRAINT "materials_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tilesets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"key" varchar(100) NOT NULL,
	"s3_key" text NOT NULL,
	"s3_url" text NOT NULL,
	"width" integer DEFAULT 192 NOT NULL,
	"height" integer DEFAULT 64 NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"from_material_id" uuid,
	"to_material_id" uuid,
	"inverse_tileset_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tilesets_key_unique" UNIQUE("key"),
	CONSTRAINT "tilesets_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
CREATE TABLE "tileset_tags" (
	"tileset_id" uuid NOT NULL,
	"tag" varchar(50) NOT NULL,
	CONSTRAINT "tileset_tags_tileset_id_tag_pk" PRIMARY KEY("tileset_id","tag")
);
--> statement-breakpoint
ALTER TABLE "tilesets" ADD CONSTRAINT "tilesets_from_material_id_materials_id_fk" FOREIGN KEY ("from_material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tilesets" ADD CONSTRAINT "tilesets_to_material_id_materials_id_fk" FOREIGN KEY ("to_material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tilesets" ADD CONSTRAINT "tilesets_inverse_tileset_id_tilesets_id_fk" FOREIGN KEY ("inverse_tileset_id") REFERENCES "public"."tilesets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tileset_tags" ADD CONSTRAINT "tileset_tags_tileset_id_tilesets_id_fk" FOREIGN KEY ("tileset_id") REFERENCES "public"."tilesets"("id") ON DELETE cascade ON UPDATE no action;