CREATE TABLE "sprites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"s3_key" text NOT NULL,
	"s3_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprites_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
CREATE TABLE "tile_map_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprite_id" uuid NOT NULL,
	"group_id" uuid,
	"name" varchar(255) NOT NULL,
	"tile_width" integer NOT NULL,
	"tile_height" integer NOT NULL,
	"selected_tiles" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"width_tiles" integer NOT NULL,
	"height_tiles" integer NOT NULL,
	"tiles" jsonb NOT NULL,
	"tags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tile_maps" ADD CONSTRAINT "tile_maps_sprite_id_sprites_id_fk" FOREIGN KEY ("sprite_id") REFERENCES "public"."sprites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_maps" ADD CONSTRAINT "tile_maps_group_id_tile_map_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tile_map_groups"("id") ON DELETE set null ON UPDATE no action;