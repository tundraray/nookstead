-- Migration: Map Entity Model Refactor
-- Maps become independent entities with UUID id, map_type, optional user_id
-- Wraps all steps in a transaction for atomic rollback on failure.

BEGIN;

-- Step 1: Rename old maps table to preserve data
ALTER TABLE "maps" RENAME TO "maps_old";

-- Step 2: Create new maps table with UUID PK schema
CREATE TABLE "maps" (
  "id"          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        VARCHAR(255),
  "map_type"    VARCHAR(50)     NOT NULL,
  "user_id"     UUID            REFERENCES "users"("id") ON DELETE CASCADE,
  "seed"        INTEGER,
  "width"       INTEGER         NOT NULL DEFAULT 64,
  "height"      INTEGER         NOT NULL DEFAULT 64,
  "grid"        JSONB           NOT NULL,
  "layers"      JSONB           NOT NULL,
  "walkable"    JSONB           NOT NULL,
  "metadata"    JSONB,
  "created_at"  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE INDEX "idx_maps_user_id"  ON "maps" ("user_id");
CREATE INDEX "idx_maps_map_type" ON "maps" ("map_type");

-- Step 4: Migrate data from maps_old
-- Generate UUID for each row, set map_type='homestead', copy data, map userId to user_id FK
INSERT INTO "maps" ("id", "name", "map_type", "user_id", "seed", "width", "height", "grid", "layers", "walkable", "metadata", "created_at", "updated_at")
SELECT
  gen_random_uuid()           AS "id",
  NULL                        AS "name",
  'homestead'                 AS "map_type",
  mo."user_id"                AS "user_id",
  mo."seed"                   AS "seed",
  mo."width"                  AS "width",
  mo."height"                 AS "height",
  mo."grid"                   AS "grid",
  mo."layers"                 AS "layers",
  mo."walkable"               AS "walkable",
  NULL                        AS "metadata",
  NOW()                       AS "created_at",
  mo."updated_at"             AS "updated_at"
FROM "maps_old" mo;

-- Step 5: Migrate player_positions.chunk_id from 'player:{userId}' to 'map:{mapId}'
-- Join on user_id to resolve the new mapId
UPDATE "player_positions" pp
SET "chunk_id" = 'map:' || m."id"::text
FROM "maps" m
WHERE pp."chunk_id" = 'player:' || m."user_id"::text
  AND m."user_id" IS NOT NULL;

-- Step 6: Standardize map_type values in sibling tables
-- player_homestead -> homestead
UPDATE "editor_maps" SET "map_type" = 'homestead' WHERE "map_type" = 'player_homestead';
UPDATE "map_templates" SET "map_type" = 'homestead' WHERE "map_type" = 'player_homestead';
-- town_district -> city
UPDATE "editor_maps" SET "map_type" = 'city' WHERE "map_type" = 'town_district';
UPDATE "map_templates" SET "map_type" = 'city' WHERE "map_type" = 'town_district';

-- Step 6b: Migrate npc_bots FK from maps_old(user_id) to new maps(id)
-- Drop old FK constraint (references maps_old.user_id after rename)
ALTER TABLE "npc_bots" DROP CONSTRAINT IF EXISTS "npc_bots_map_id_maps_user_id_fk";

-- Update npc_bots.map_id: resolve old user_id values to new UUID map ids
UPDATE "npc_bots" nb
SET "map_id" = m."id"
FROM "maps" m
WHERE nb."map_id" = m."user_id";

-- Add new FK constraint referencing maps(id)
ALTER TABLE "npc_bots" ADD CONSTRAINT "npc_bots_map_id_maps_id_fk"
  FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE;

-- Step 7: Drop the old maps table
DROP TABLE "maps_old";

-- Step 8: Reset any remaining orphaned player_positions rows
-- (rows that still have player: prefix because their userId had no map)
UPDATE "player_positions"
SET "chunk_id" = 'city:capital'
WHERE "chunk_id" LIKE 'player:%';

COMMIT;
