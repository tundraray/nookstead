CREATE TABLE "npc_player_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(32) NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "mood" varchar(32);--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "mood_intensity" smallint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "mood_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "npc_player_statuses" ADD CONSTRAINT "npc_player_statuses_bot_id_npc_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."npc_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_player_statuses" ADD CONSTRAINT "npc_player_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "npc_player_statuses_bot_user_status_idx" ON "npc_player_statuses" USING btree ("bot_id","user_id","status");