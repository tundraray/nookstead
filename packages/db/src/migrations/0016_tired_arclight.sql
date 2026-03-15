ALTER TABLE "npc_bots" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "age" smallint;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "traits" jsonb;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "goals" jsonb;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "fears" jsonb;--> statement-breakpoint
ALTER TABLE "npc_bots" ADD COLUMN "interests" jsonb;