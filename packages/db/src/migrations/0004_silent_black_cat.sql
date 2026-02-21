CREATE TABLE "atlas_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprite_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"frame_x" integer NOT NULL,
	"frame_y" integer NOT NULL,
	"frame_w" integer NOT NULL,
	"frame_h" integer NOT NULL,
	"rotated" boolean DEFAULT false NOT NULL,
	"trimmed" boolean DEFAULT false NOT NULL,
	"sprite_source_size_x" integer DEFAULT 0 NOT NULL,
	"sprite_source_size_y" integer DEFAULT 0 NOT NULL,
	"sprite_source_size_w" integer,
	"sprite_source_size_h" integer,
	"source_size_w" integer,
	"source_size_h" integer,
	"pivot_x" real DEFAULT 0.5 NOT NULL,
	"pivot_y" real DEFAULT 0.5 NOT NULL,
	"custom_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atlas_frames_sprite_filename_unique" UNIQUE("sprite_id","filename")
);
--> statement-breakpoint
DROP TABLE "tile_map_groups" CASCADE;--> statement-breakpoint
DROP TABLE "tile_maps" CASCADE;--> statement-breakpoint
ALTER TABLE "game_objects" ADD COLUMN "layers" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "atlas_frames" ADD CONSTRAINT "atlas_frames_sprite_id_sprites_id_fk" FOREIGN KEY ("sprite_id") REFERENCES "public"."sprites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_objects" DROP COLUMN "width_tiles";--> statement-breakpoint
ALTER TABLE "game_objects" DROP COLUMN "height_tiles";--> statement-breakpoint
ALTER TABLE "game_objects" DROP COLUMN "tiles";