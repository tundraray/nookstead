import { eq, asc, count, or } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { materials } from '../schema/materials';
import { tilesets } from '../schema/tilesets';

export interface CreateMaterialData {
  name: string;
  key: string;
  color: string;
  walkable?: boolean;
  speedModifier?: number;
  swimRequired?: boolean;
  damaging?: boolean;
}

export interface UpdateMaterialData {
  name?: string;
  key?: string;
  color?: string;
  walkable?: boolean;
  speedModifier?: number;
  swimRequired?: boolean;
  damaging?: boolean;
}

export async function createMaterial(
  db: DrizzleClient,
  data: CreateMaterialData
) {
  const [material] = await db.insert(materials).values(data).returning();
  return material;
}

export async function getMaterial(db: DrizzleClient, id: string) {
  const [material] = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id));
  return material ?? null;
}

export async function getMaterialByKey(db: DrizzleClient, key: string) {
  const [material] = await db
    .select()
    .from(materials)
    .where(eq(materials.key, key));
  return material ?? null;
}

export async function listMaterials(db: DrizzleClient) {
  return db.select().from(materials).orderBy(asc(materials.name));
}

export async function updateMaterial(
  db: DrizzleClient,
  id: string,
  data: UpdateMaterialData
) {
  const [updated] = await db
    .update(materials)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(materials.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteMaterial(db: DrizzleClient, id: string) {
  const [deleted] = await db
    .delete(materials)
    .where(eq(materials.id, id))
    .returning();
  return deleted ?? null;
}

export async function countTilesetsByMaterial(
  db: DrizzleClient,
  materialId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(tilesets)
    .where(
      or(
        eq(tilesets.fromMaterialId, materialId),
        eq(tilesets.toMaterialId, materialId)
      )
    );
  return result?.count ?? 0;
}

export async function getTilesetsReferencingMaterial(
  db: DrizzleClient,
  materialId: string
) {
  return db
    .select({ id: tilesets.id, name: tilesets.name })
    .from(tilesets)
    .where(
      or(
        eq(tilesets.fromMaterialId, materialId),
        eq(tilesets.toMaterialId, materialId)
      )
    );
}
