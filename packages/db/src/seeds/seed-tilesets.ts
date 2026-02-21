/**
 * Seed Migration Script: Import hardcoded terrain definitions into the database.
 *
 * Reads the 26 terrain definitions from packages/map-lib/src/core/terrain.ts
 * and the surface properties from terrain-properties.ts, then creates:
 *   - Material records (~21 unique materials)
 *   - Tileset records (26 tilesets with S3-uploaded PNGs)
 *   - Inverse tileset links (bidirectional pairs)
 *   - Tags per collection group (8 groups)
 *
 * Idempotent: safe to run multiple times. Checks for existing records by key
 * before inserting. Running the script twice produces no duplicates.
 *
 * Usage: npx tsx packages/db/src/seeds/seed-tilesets.ts
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable set
 *   - S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY set
 *   - PNG files in apps/genmap/public/tilesets/terrain-01.png through terrain-26.png
 *
 * Complete Material List (derived from TERRAINS relationships + SURFACE_PROPERTIES):
 *
 *   Material Key        | Walkable | Speed | SwimReq | Damaging | Color
 *   --------------------|----------|-------|---------|----------|--------
 *   water               | false    | 0.5   | true    | false    | #3B82F6
 *   grass               | true     | 1.0   | false   | false    | #22C55E
 *   deep_water          | false    | 0.0   | false   | false    | #1E3A8A
 *   dirt                | true     | 0.9   | false   | false    | #92400E
 *   orange_grass        | true     | 0.9   | false   | false    | #F59E0B
 *   light_sand          | true     | 0.9   | false   | false    | #FDE68A
 *   orange_sand         | true     | 0.85  | false   | false    | #D97706
 *   sand                | true     | 0.85  | false   | false    | #EAB308
 *   alpha               | true     | 1.0   | false   | false    | #A3A3A3
 *   pale_sage           | true     | 0.9   | false   | false    | #86EFAC
 *   forest              | true     | 0.8   | false   | false    | #166534
 *   lush_green          | true     | 1.0   | false   | false    | #4ADE80
 *   fenced              | false    | 0.0   | false   | false    | #78716C
 *   ice_blue            | true     | 0.6   | false   | false    | #BAE6FD
 *   light_stone         | true     | 1.0   | false   | false    | #D6D3D1
 *   warm_stone          | true     | 1.0   | false   | false    | #C4B5A0
 *   gray_cobble         | true     | 1.0   | false   | false    | #9CA3AF
 *   slate               | true     | 1.0   | false   | false    | #64748B
 *   dark_brick          | true     | 1.0   | false   | false    | #7C2D12
 *   steel_floor         | true     | 1.0   | false   | false    | #94A3B8
 *   asphalt             | true     | 1.1   | false   | false    | #374151
 *
 * Note: Materials like "clay_ground", "alpha_props_fence" etc. are tileset names
 * (TERRAIN_NAMES), not materials. Materials are the "from"/"to" values in relationships.
 * Tilesets without relationships get null material IDs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDrizzleClient, closeDrizzleClient } from '../core/client';
import type { DrizzleClient } from '../core/client';
import { createMaterial, getMaterialByKey } from '../services/material';
import {
  createTileset,
  setInverseTileset,
} from '../services/tileset';
import { addTag } from '../services/tileset-tag';
import { eq } from 'drizzle-orm';
import { tilesets } from '../schema/tilesets';

// ---------------------------------------------------------------------------
// Step 1: Source data (extracted from terrain.ts and terrain-properties.ts)
// ---------------------------------------------------------------------------

/** Surface properties keyed by material name. */
interface SurfaceProps {
  walkable: boolean;
  speedModifier: number;
  swimRequired: boolean;
  damaging: boolean;
}

/**
 * Surface properties for materials.
 * Derived from SURFACE_PROPERTIES in terrain-properties.ts.
 * Only includes entries that appear as "from" or "to" in relationships.
 */
const MATERIAL_PROPERTIES: Record<string, SurfaceProps> = {
  water: { walkable: false, speedModifier: 0.5, swimRequired: true, damaging: false },
  grass: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  deep_water: { walkable: false, speedModifier: 0, swimRequired: false, damaging: false },
  dirt: { walkable: true, speedModifier: 0.9, swimRequired: false, damaging: false },
  orange_grass: { walkable: true, speedModifier: 0.9, swimRequired: false, damaging: false },
  light_sand: { walkable: true, speedModifier: 0.9, swimRequired: false, damaging: false },
  orange_sand: { walkable: true, speedModifier: 0.85, swimRequired: false, damaging: false },
  sand: { walkable: true, speedModifier: 0.85, swimRequired: false, damaging: false },
  alpha: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  pale_sage: { walkable: true, speedModifier: 0.9, swimRequired: false, damaging: false },
  forest: { walkable: true, speedModifier: 0.8, swimRequired: false, damaging: false },
  lush_green: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  fenced: { walkable: false, speedModifier: 0, swimRequired: false, damaging: false },
  ice_blue: { walkable: true, speedModifier: 0.6, swimRequired: false, damaging: false },
  light_stone: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  warm_stone: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  gray_cobble: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  slate: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  dark_brick: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  steel_floor: { walkable: true, speedModifier: 1.0, swimRequired: false, damaging: false },
  asphalt: { walkable: true, speedModifier: 1.1, swimRequired: false, damaging: false },
};

/** Stable color map for material names. */
const MATERIAL_COLORS: Record<string, string> = {
  water: '#3B82F6',
  grass: '#22C55E',
  deep_water: '#1E3A8A',
  dirt: '#92400E',
  orange_grass: '#F59E0B',
  light_sand: '#FDE68A',
  orange_sand: '#D97706',
  sand: '#EAB308',
  alpha: '#A3A3A3',
  pale_sage: '#86EFAC',
  forest: '#166534',
  lush_green: '#4ADE80',
  fenced: '#78716C',
  ice_blue: '#BAE6FD',
  light_stone: '#D6D3D1',
  warm_stone: '#C4B5A0',
  gray_cobble: '#9CA3AF',
  slate: '#64748B',
  dark_brick: '#7C2D12',
  steel_floor: '#94A3B8',
  asphalt: '#374151',
};

/** Terrain names in order (index 0 = terrain-01, etc.) */
const TERRAIN_NAMES = [
  'dirt_light_grass',       // 01
  'orange_grass',           // 02
  'water_grass',            // 03
  'pale_sage',              // 04
  'forest_edge',            // 05
  'lush_green',             // 06
  'light_sand_grass',       // 07
  'light_sand_water',       // 08
  'orange_sand_light_sand', // 09
  'sand_alpha',             // 10
  'clay_ground',            // 11
  'grass_orange',           // 12
  'grass_alpha',            // 13
  'grass_fenced',           // 14
  'grass_water',            // 15
  'deep_water_water',       // 16
  'alpha_props_fence',      // 17
  'ice_blue',               // 18
  'light_stone',            // 19
  'warm_stone',             // 20
  'gray_cobble',            // 21
  'slate',                  // 22
  'dark_brick',             // 23
  'steel_floor',            // 24
  'asphalt_white_line',     // 25
  'asphalt_yellow_line',    // 26
];

/** Relationship definitions: terrainNum (1-based) -> { from, to, inverseOf? } */
interface Relationship {
  from: string;
  to: string;
  inverseOf?: string;
}

const RELATIONSHIPS: Record<number, Relationship> = {
  1:  { from: 'dirt', to: 'grass' },
  2:  { from: 'orange_grass', to: 'grass' },
  3:  { from: 'water', to: 'grass', inverseOf: 'terrain-15' },
  4:  { from: 'pale_sage', to: 'grass' },
  5:  { from: 'forest', to: 'grass' },
  6:  { from: 'lush_green', to: 'grass' },
  7:  { from: 'light_sand', to: 'grass' },
  8:  { from: 'light_sand', to: 'water' },
  9:  { from: 'orange_sand', to: 'light_sand' },
  10: { from: 'sand', to: 'alpha' },
  12: { from: 'grass', to: 'orange_grass', inverseOf: 'terrain-02' },
  13: { from: 'grass', to: 'alpha' },
  14: { from: 'grass', to: 'fenced' },
  15: { from: 'grass', to: 'water', inverseOf: 'terrain-03' },
  16: { from: 'deep_water', to: 'water' },
};

/** Collection groups (from TILESETS in terrain.ts). */
const TILESET_GROUPS: Record<string, number[]> = {
  grassland: [1, 2, 12, 13, 14],
  water: [3, 15, 16],
  sand: [7, 8, 9, 10],
  forest: [4, 5, 6],
  stone: [18, 19, 20, 21, 22, 23, 24],
  road: [25, 26],
  props: [17],
  misc: [11],
};

// ---------------------------------------------------------------------------
// Helper: get tileset by key (not in the service by default)
// ---------------------------------------------------------------------------
async function getTilesetByKey(db: DrizzleClient, key: string) {
  const [tileset] = await db
    .select()
    .from(tilesets)
    .where(eq(tilesets.key, key));
  return tileset ?? null;
}

// ---------------------------------------------------------------------------
// Helper: build terrain key from 1-based number
// ---------------------------------------------------------------------------
function terrainKey(num: number): string {
  return `terrain-${String(num).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Helper: format display name from snake_case
// ---------------------------------------------------------------------------
function formatDisplayName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// S3 upload helper (uses same S3 config as genmap)
// ---------------------------------------------------------------------------
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

function getS3Client(): { client: S3Client; bucket: string } {
  const endpoint = requireEnv('S3_ENDPOINT');
  const region = requireEnv('S3_REGION');
  const bucket = requireEnv('S3_BUCKET');
  const accessKeyId = requireEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY');

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return { client, bucket };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function uploadToS3(
  s3Key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const { client, bucket } = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: body,
    ContentType: contentType,
    ContentLength: body.length,
  });
  await client.send(command);
}

function buildS3Url(s3Key: string): string {
  const endpoint = requireEnv('S3_ENDPOINT');
  const bucket = requireEnv('S3_BUCKET');
  return `${endpoint}/${bucket}/${s3Key}`;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  console.log('[Seed] Starting tileset seed migration...');

  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = createDrizzleClient(dbUrl);

  try {
    // -----------------------------------------------------------------------
    // Step 2: Create material records
    // -----------------------------------------------------------------------
    console.log('[Seed] Step 2: Creating material records...');

    const materialIds = new Map<string, string>();

    // Extract unique material names from relationships
    const uniqueMaterials = new Set<string>();
    for (const rel of Object.values(RELATIONSHIPS)) {
      uniqueMaterials.add(rel.from);
      uniqueMaterials.add(rel.to);
    }

    // Also add materials from tilesets that don't have relationships
    // but have matching material properties (stone, ice, road types)
    // These are the "from" materials for tilesets 18-26 which have
    // no explicit setRelationship calls but represent distinct surfaces.
    const STANDALONE_MATERIALS = [
      'ice_blue', 'light_stone', 'warm_stone', 'gray_cobble',
      'slate', 'dark_brick', 'steel_floor', 'asphalt',
    ];
    for (const mat of STANDALONE_MATERIALS) {
      uniqueMaterials.add(mat);
    }

    for (const materialName of uniqueMaterials) {
      const materialKey = materialName;
      const existing = await getMaterialByKey(db, materialKey);

      if (existing) {
        console.log(`[Seed] Material already exists: ${materialName} (${existing.id})`);
        materialIds.set(materialName, existing.id);
        continue;
      }

      const props = MATERIAL_PROPERTIES[materialName];
      if (!props) {
        console.warn(`[Seed] No surface properties found for material: ${materialName}, using defaults`);
      }

      const color = MATERIAL_COLORS[materialName] ?? '#808080';
      const surfaceProps = props ?? {
        walkable: true,
        speedModifier: 1.0,
        swimRequired: false,
        damaging: false,
      };

      try {
        const material = await createMaterial(db, {
          name: formatDisplayName(materialName),
          key: materialKey,
          color,
          walkable: surfaceProps.walkable,
          speedModifier: surfaceProps.speedModifier,
          swimRequired: surfaceProps.swimRequired,
          damaging: surfaceProps.damaging,
        });
        materialIds.set(materialName, material.id);
        console.log(`[Seed] Created material: ${materialName} (${material.id})`);
      } catch (err) {
        console.error(`[Seed] Failed to create material: ${materialName}`, err);
        throw err;
      }
    }

    console.log(`[Seed] Step 2 complete: ${materialIds.size} materials available`);

    // -----------------------------------------------------------------------
    // Step 3: Upload PNGs to S3 and create tileset records
    // -----------------------------------------------------------------------
    console.log('[Seed] Step 3: Uploading tilesets...');

    const tilesetDir = path.resolve(
      __dirname,
      '../../../../apps/genmap/public/tilesets'
    );

    const tilesetIds = new Map<string, string>();

    for (let i = 1; i <= 26; i++) {
      const key = terrainKey(i);
      const name = TERRAIN_NAMES[i - 1];

      const existing = await getTilesetByKey(db, key);
      if (existing) {
        console.log(`[Seed] Tileset already exists: ${key} (${existing.id})`);
        tilesetIds.set(key, existing.id);
        continue;
      }

      // Read PNG file
      const pngPath = path.join(tilesetDir, `${key}.png`);
      let pngBuffer: Buffer;
      try {
        pngBuffer = fs.readFileSync(pngPath);
      } catch {
        console.warn(`[Seed] PNG file missing, skipping tileset: ${pngPath}`);
        continue;
      }

      // Upload to S3
      const s3Key = `tilesets/${crypto.randomUUID()}.png`;
      try {
        await uploadToS3(s3Key, pngBuffer, 'image/png');
        console.log(`[Seed] Uploaded tileset: ${key} -> ${s3Key}`);
      } catch (err) {
        console.error(`[Seed] Failed to upload tileset to S3: ${key}`, err);
        throw err;
      }

      const s3Url = buildS3Url(s3Key);

      // Resolve material IDs from the relationship data
      const rel = RELATIONSHIPS[i];
      const fromMaterialId = rel ? (materialIds.get(rel.from) ?? null) : null;
      const toMaterialId = rel ? (materialIds.get(rel.to) ?? null) : null;

      try {
        const tileset = await createTileset(db, {
          name: formatDisplayName(name),
          key,
          s3Key,
          s3Url,
          width: 192,
          height: 64,
          fileSize: pngBuffer.length,
          mimeType: 'image/png',
          fromMaterialId,
          toMaterialId,
          sortOrder: i,
        });
        tilesetIds.set(key, tileset.id);
        console.log(`[Seed] Created tileset: ${key} - ${formatDisplayName(name)} (${tileset.id})`);
      } catch (err) {
        console.error(`[Seed] Failed to create tileset record: ${key}`, err);
        throw err;
      }
    }

    console.log(`[Seed] Step 3 complete: ${tilesetIds.size} tilesets available`);

    // -----------------------------------------------------------------------
    // Step 4: Set inverse links
    // -----------------------------------------------------------------------
    console.log('[Seed] Step 4: Setting inverse links...');

    const processedPairs = new Set<string>();

    for (const [num, rel] of Object.entries(RELATIONSHIPS)) {
      if (!rel.inverseOf) continue;

      const key = terrainKey(Number(num));
      const inverseKey = rel.inverseOf;

      // Avoid processing same pair twice (A->B and B->A)
      const pairKey = [key, inverseKey].sort().join(':');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const tilesetAId = tilesetIds.get(key);
      const tilesetBId = tilesetIds.get(inverseKey);

      if (!tilesetAId || !tilesetBId) {
        console.warn(
          `[Seed] Cannot set inverse link: ${key} <-> ${inverseKey} (missing tileset IDs)`
        );
        continue;
      }

      // Check if already set
      const tilesetA = await getTilesetByKey(db, key);
      if (tilesetA?.inverseTilesetId === tilesetBId) {
        console.log(`[Seed] Inverse link already set: ${key} <-> ${inverseKey}`);
        continue;
      }

      try {
        await setInverseTileset(db, tilesetAId, tilesetBId);
        console.log(`[Seed] Set inverse link: ${key} <-> ${inverseKey}`);
      } catch (err) {
        console.error(`[Seed] Failed to set inverse link: ${key} <-> ${inverseKey}`, err);
        throw err;
      }
    }

    console.log('[Seed] Step 4 complete: inverse links set');

    // -----------------------------------------------------------------------
    // Step 5: Create tags
    // -----------------------------------------------------------------------
    console.log('[Seed] Step 5: Creating tags...');

    for (const [groupName, terrainNums] of Object.entries(TILESET_GROUPS)) {
      for (const num of terrainNums) {
        const key = terrainKey(num);
        const tilesetId = tilesetIds.get(key);

        if (!tilesetId) {
          console.warn(`[Seed] Cannot add tag: tileset ${key} not found`);
          continue;
        }

        try {
          await addTag(db, tilesetId, groupName);
          console.log(`[Seed] Added tag '${groupName}' to ${key}`);
        } catch (err) {
          // addTag uses onConflictDoNothing, so duplicates are silent
          console.log(`[Seed] Tag '${groupName}' already on ${key} (or added)`);
        }
      }
    }

    console.log('[Seed] Step 5 complete: tags created');

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------
    console.log('[Seed] Migration complete!');
    console.log(`[Seed] Summary: ${materialIds.size} materials, ${tilesetIds.size} tilesets`);
  } catch (err) {
    console.error('[Seed] Migration failed:', err);
    process.exit(1);
  } finally {
    await closeDrizzleClient(db);
  }
}

// Run if executed directly
seed().catch((err) => {
  console.error('[Seed] Unhandled error:', err);
  process.exit(1);
});
