CREATE TABLE "player_positions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"world_x" real DEFAULT 32 NOT NULL,
	"world_y" real DEFAULT 32 NOT NULL,
	"chunk_id" varchar(100) DEFAULT 'city:capital' NOT NULL,
	"direction" varchar(10) DEFAULT 'down' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_positions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "player_positions" ADD CONSTRAINT "player_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;