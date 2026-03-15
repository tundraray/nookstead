CREATE TABLE IF NOT EXISTS "npc_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) DEFAULT 'interaction' NOT NULL,
	"content" text NOT NULL,
	"importance" smallint NOT NULL,
	"dialogue_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_stream_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"top_k" smallint DEFAULT 10 NOT NULL,
	"half_life_hours" real DEFAULT 48 NOT NULL,
	"recency_weight" real DEFAULT 1 NOT NULL,
	"importance_weight" real DEFAULT 1 NOT NULL,
	"max_memories_per_npc" smallint DEFAULT 1000 NOT NULL,
	"token_budget" smallint DEFAULT 400 NOT NULL,
	"importance_first_meeting" smallint DEFAULT 7 NOT NULL,
	"importance_normal_dialogue" smallint DEFAULT 4 NOT NULL,
	"importance_emotional_dialogue" smallint DEFAULT 6 NOT NULL,
	"importance_gift_received" smallint DEFAULT 7 NOT NULL,
	"importance_quest_related" smallint DEFAULT 8 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "npc_memory_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"top_k" smallint,
	"half_life_hours" real,
	"recency_weight" real,
	"importance_weight" real,
	"max_memories_per_npc" smallint,
	"token_budget" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "npc_memory_overrides_bot_id_unique" UNIQUE("bot_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "npc_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"social_type" varchar(32) DEFAULT 'stranger' NOT NULL,
	"is_worker" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"hired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_nr_bot_user" UNIQUE("bot_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_memories" ADD CONSTRAINT "npc_memories_bot_id_npc_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."npc_bots"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_memories" ADD CONSTRAINT "npc_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_memories" ADD CONSTRAINT "npc_memories_dialogue_session_id_dialogue_sessions_id_fk" FOREIGN KEY ("dialogue_session_id") REFERENCES "public"."dialogue_sessions"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_memory_overrides" ADD CONSTRAINT "npc_memory_overrides_bot_id_npc_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."npc_bots"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_relationships" ADD CONSTRAINT "npc_relationships_bot_id_npc_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."npc_bots"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "npc_relationships" ADD CONSTRAINT "npc_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nm_bot_user" ON "npc_memories" USING btree ("bot_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nm_bot_created" ON "npc_memories" USING btree ("bot_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nm_bot_importance" ON "npc_memories" USING btree ("bot_id","importance");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nr_bot_user" ON "npc_relationships" USING btree ("bot_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nr_bot_social" ON "npc_relationships" USING btree ("bot_id","social_type");
