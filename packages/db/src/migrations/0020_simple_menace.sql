CREATE TYPE "public"."owner_type" AS ENUM('player', 'npc');--> statement-breakpoint
CREATE TABLE "inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"max_slots" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"slot_index" smallint NOT NULL,
	"item_type" varchar(64),
	"quantity" integer DEFAULT 0 NOT NULL,
	"owned_by_type" "owner_type",
	"owned_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_slots" ADD CONSTRAINT "inventory_slots_inventory_id_inventories_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventories_owner_unique" ON "inventories" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_slots_slot_unique" ON "inventory_slots" USING btree ("inventory_id","slot_index");