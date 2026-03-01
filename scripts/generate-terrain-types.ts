import {
  createDrizzleClient,
  closeDrizzleClient,
  listMaterials,
} from '@nookstead/db';
import fs from 'fs';
import path from 'path';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = createDrizzleClient(databaseUrl);

  try {
    const materials = await listMaterials(db);
    const keys = materials.map((m) => `'${m.key}'`);

    if (keys.length === 0) {
      console.error('No materials found in database');
      process.exit(1);
    }

    const content = [
      '// AUTO-GENERATED — do not edit manually.',
      '// Run: pnpm generate:terrain-types',
      `export type TerrainCellType = ${keys.join(' | ')};`,
      '',
    ].join('\n');

    const outputPath = path.resolve(
      __dirname,
      '../packages/shared/src/types/terrain-cell-type.generated.ts'
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
    console.log(`Generated TerrainCellType with ${keys.length} materials`);
  } finally {
    await closeDrizzleClient(db);
  }
}

main().catch((err) => {
  console.error('Failed to generate terrain types:', err);
  process.exit(1);
});
