ALTER TABLE "game_objects" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "game_objects" ADD COLUMN "object_type" varchar(100);--> statement-breakpoint
ALTER TABLE "game_objects" ADD COLUMN "collision_zones" jsonb DEFAULT '[]'::jsonb;