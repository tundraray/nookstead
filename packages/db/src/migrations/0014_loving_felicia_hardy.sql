CREATE TABLE "dialogue_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"player_id" varchar(255) NOT NULL,
	"user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dialogue_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "personality" text;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "role" varchar(64);--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "speech_style" text;--> statement-breakpoint
ALTER TABLE "dialogue_sessions" ADD CONSTRAINT "dialogue_sessions_bot_id_npc_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."npc_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_sessions" ADD CONSTRAINT "dialogue_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_messages" ADD CONSTRAINT "dialogue_messages_session_id_dialogue_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dialogue_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ds_bot_user" ON "dialogue_sessions" USING btree ("bot_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_ds_ended_at" ON "dialogue_sessions" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "idx_dm_session_id" ON "dialogue_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_dm_created_at" ON "dialogue_messages" USING btree ("created_at");