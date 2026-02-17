CREATE TABLE "maps" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"seed" integer NOT NULL,
	"grid" jsonb NOT NULL,
	"layers" jsonb NOT NULL,
	"walkable" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;