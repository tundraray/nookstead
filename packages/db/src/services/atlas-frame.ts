import { eq, ilike } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { atlasFrames } from '../schema/atlas-frames';

export interface FrameInput {
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSizeX?: number;
  spriteSourceSizeY?: number;
  spriteSourceSizeW?: number;
  spriteSourceSizeH?: number;
  sourceSizeW?: number;
  sourceSizeH?: number;
  pivotX?: number;
  pivotY?: number;
  customData?: Record<string, unknown> | null;
}

export async function batchSaveFrames(
  db: DrizzleClient,
  spriteId: string,
  frames: FrameInput[]
): Promise<(typeof atlasFrames.$inferSelect)[]> {
  return db.transaction(async (tx) => {
    // Delete existing frames for this sprite
    await tx.delete(atlasFrames).where(eq(atlasFrames.spriteId, spriteId));

    if (frames.length === 0) {
      return [];
    }

    // Bulk insert all new frames
    const inserted = await tx
      .insert(atlasFrames)
      .values(
        frames.map((f) => ({
          spriteId,
          filename: f.filename,
          frameX: f.frameX,
          frameY: f.frameY,
          frameW: f.frameW,
          frameH: f.frameH,
          rotated: f.rotated ?? false,
          trimmed: f.trimmed ?? false,
          spriteSourceSizeX: f.spriteSourceSizeX ?? 0,
          spriteSourceSizeY: f.spriteSourceSizeY ?? 0,
          spriteSourceSizeW: f.spriteSourceSizeW ?? f.frameW,
          spriteSourceSizeH: f.spriteSourceSizeH ?? f.frameH,
          sourceSizeW: f.sourceSizeW ?? f.frameW,
          sourceSizeH: f.sourceSizeH ?? f.frameH,
          pivotX: f.pivotX ?? 0.5,
          pivotY: f.pivotY ?? 0.5,
          customData: f.customData ?? null,
        }))
      )
      .returning();

    return inserted;
  });
}

export async function getFramesBySprite(
  db: DrizzleClient,
  spriteId: string
): Promise<(typeof atlasFrames.$inferSelect)[]> {
  return db
    .select()
    .from(atlasFrames)
    .where(eq(atlasFrames.spriteId, spriteId))
    .orderBy(atlasFrames.filename);
}

export async function deleteFramesBySprite(
  db: DrizzleClient,
  spriteId: string
): Promise<void> {
  await db.delete(atlasFrames).where(eq(atlasFrames.spriteId, spriteId));
}

export async function searchFrameFilenames(
  db: DrizzleClient,
  query: string,
  limit = 50
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ filename: atlasFrames.filename })
    .from(atlasFrames)
    .where(ilike(atlasFrames.filename, `%${query}%`))
    .orderBy(atlasFrames.filename)
    .limit(limit);
  return rows.map((r) => r.filename);
}

export async function getFramesByFilename(
  db: DrizzleClient,
  filename: string
): Promise<(typeof atlasFrames.$inferSelect)[]> {
  return db
    .select()
    .from(atlasFrames)
    .where(eq(atlasFrames.filename, filename))
    .orderBy(atlasFrames.frameX, atlasFrames.frameY);
}

export async function listDistinctFilenames(
  db: DrizzleClient,
  limit = 500
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ filename: atlasFrames.filename })
    .from(atlasFrames)
    .orderBy(atlasFrames.filename)
    .limit(limit);
  return rows.map((r) => r.filename);
}
