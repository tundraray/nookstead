CREATE TABLE "npc_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"skin" varchar(32) NOT NULL,
	"world_x" real DEFAULT 0 NOT NULL,
	"world_y" real DEFAULT 0 NOT NULL,
	"direction" varchar(8) DEFAULT 'down' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npc_bots" ADD CONSTRAINT "npc_bots_map_id_maps_user_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("user_id") ON DELETE cascade ON UPDATE no action;