DELETE FROM "dialogue_messages";--> statement-breakpoint
DELETE FROM "dialogue_sessions";--> statement-breakpoint
ALTER TABLE "dialogue_sessions" DROP CONSTRAINT "dialogue_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "dialogue_sessions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dialogue_sessions" ADD CONSTRAINT "dialogue_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_sessions" DROP COLUMN "player_id";