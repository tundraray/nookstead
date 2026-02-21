/**
 * Seed Script: Set renderPriority values for existing materials.
 *
 * Updates known materials with their render priority values, which determine
 * Z-ordering when the terrain renderer draws overlapping material transitions.
 * Higher priority materials are drawn on top of lower priority materials.
 *
 * Idempotent: safe to run multiple times. Updates existing records by key.
 *
 * Usage: npx tsx packages/db/src/seeds/seed-material-priorities.ts
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable set
 *   - Materials already exist in the database (created by seed-tilesets.ts)
 */

import { createDrizzleClient, closeDrizzleClient } from '../core/client';
import { getMaterialByKey, updateMaterial } from '../services/material';

/**
 * Render priority values for known materials.
 *
 * Lower values are drawn first (further back); higher values are drawn on top.
 * These values come from the material-terrain work plan spec.
 */
const MATERIAL_PRIORITIES: Record<string, number> = {
  water: 5,
  deep_water: 8,
  light_sand: 25,
  warm_sand: 28,
  grass: 40,
  dark_grass: 45,
  light_stone: 60,
  warm_stone: 65,
};

async function seed() {
  console.log('[Seed] Starting material render priority seed...');

  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = createDrizzleClient(dbUrl);

  try {
    let updated = 0;
    let skipped = 0;

    for (const [key, renderPriority] of Object.entries(MATERIAL_PRIORITIES)) {
      const material = await getMaterialByKey(db, key);

      if (!material) {
        console.warn(
          `[Seed] Material not found: ${key} (run seed-tilesets.ts first)`
        );
        skipped++;
        continue;
      }

      if (material.renderPriority === renderPriority) {
        console.log(
          `[Seed] Material already has correct priority: ${key} = ${renderPriority}`
        );
        continue;
      }

      await updateMaterial(db, material.id, { renderPriority });
      console.log(
        `[Seed] Updated material priority: ${key} = ${renderPriority}`
      );
      updated++;
    }

    console.log(
      `[Seed] Material priority seed complete: ${updated} updated, ${skipped} skipped`
    );
  } catch (err) {
    console.error('[Seed] Seed failed:', err);
    process.exit(1);
  } finally {
    await closeDrizzleClient(db);
  }
}

seed().catch((err) => {
  console.error('[Seed] Unhandled error:', err);
  process.exit(1);
});
