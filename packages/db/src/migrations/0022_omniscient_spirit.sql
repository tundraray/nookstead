DROP TABLE "fence_types" CASCADE;--> statement-breakpoint
ALTER TABLE "memory_stream_config" ADD COLUMN "semantic_weight" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "npc_memory_overrides" ADD COLUMN "semantic_weight" real;