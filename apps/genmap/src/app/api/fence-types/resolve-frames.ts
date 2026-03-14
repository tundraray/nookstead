import { inArray } from 'drizzle-orm';
import { getDb, atlasFrames } from '@nookstead/db';

export interface ResolvedFrame {
  atlasFrameId: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

export async function resolveFrameMapping(
  db: ReturnType<typeof getDb>,
  mapping: Record<string, string>
): Promise<Record<string, ResolvedFrame>> {
  const uuids = Object.values(mapping);
  if (uuids.length === 0) return {};

  const uniqueUuids = [...new Set(uuids)];
  const frames = await db
    .select({
      id: atlasFrames.id,
      spriteId: atlasFrames.spriteId,
      frameX: atlasFrames.frameX,
      frameY: atlasFrames.frameY,
      frameW: atlasFrames.frameW,
      frameH: atlasFrames.frameH,
    })
    .from(atlasFrames)
    .where(inArray(atlasFrames.id, uniqueUuids));

  const frameMap = new Map(frames.map((f) => [f.id, f]));

  const resolved: Record<string, ResolvedFrame> = {};
  for (const [key, uuid] of Object.entries(mapping)) {
    const frame = frameMap.get(uuid);
    if (frame) {
      resolved[key] = {
        atlasFrameId: uuid,
        spriteId: frame.spriteId,
        frameX: frame.frameX,
        frameY: frame.frameY,
        frameW: frame.frameW,
        frameH: frame.frameH,
      };
    } else {
      resolved[key] = {
        atlasFrameId: uuid,
        spriteId: '',
        frameX: 0,
        frameY: 0,
        frameW: 0,
        frameH: 0,
      };
    }
  }

  return resolved;
}
