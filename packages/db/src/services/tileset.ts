import { eq, desc, ilike, and, or, sql, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DrizzleClient } from '../core/client';
import { tilesets } from '../schema/tilesets';
import { tilesetTags } from '../schema/tileset-tags';
import { materials } from '../schema/materials';
import { editorMaps } from '../schema/editor-maps';

export interface CreateTilesetData {
  name: string;
  key: string;
  s3Key: string;
  s3Url: string;
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: string;
  fromMaterialId?: string | null;
  toMaterialId?: string | null;
  sortOrder?: number;
}

export interface UpdateTilesetData {
  name?: string;
  fromMaterialId?: string | null;
  toMaterialId?: string | null;
  inverseTilesetId?: string | null;
  sortOrder?: number;
}

export interface ListTilesetsParams {
  materialId?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export async function createTileset(
  db: DrizzleClient,
  data: CreateTilesetData
) {
  const [tileset] = await db.insert(tilesets).values(data).returning();
  return tileset;
}

export async function getTileset(db: DrizzleClient, id: string) {
  const [tileset] = await db
    .select()
    .from(tilesets)
    .where(eq(tilesets.id, id));
  return tileset ?? null;
}

export async function listTilesets(
  db: DrizzleClient,
  params?: ListTilesetsParams
) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (params?.materialId) {
    conditions.push(
      or(
        eq(tilesets.fromMaterialId, params.materialId),
        eq(tilesets.toMaterialId, params.materialId)
      )!
    );
  }

  if (params?.search) {
    conditions.push(ilike(tilesets.name, `%${params.search}%`));
  }

  if (params?.tag) {
    // Subquery: tilesets that have this tag
    conditions.push(
      sql`${tilesets.id} IN (
        SELECT ${tilesetTags.tilesetId} FROM ${tilesetTags}
        WHERE ${tilesetTags.tag} = ${params.tag}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const query = db
    .select()
    .from(tilesets)
    .where(whereClause)
    .orderBy(
      params?.sort === 'name' ? tilesets.name : desc(tilesets.createdAt)
    );

  if (params?.limit !== undefined) {
    query.limit(params.limit);
  }
  if (params?.offset !== undefined) {
    query.offset(params.offset);
  }

  return query;
}

export async function updateTileset(
  db: DrizzleClient,
  id: string,
  data: UpdateTilesetData
) {
  const [updated] = await db
    .update(tilesets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tilesets.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTileset(db: DrizzleClient, id: string) {
  const [deleted] = await db
    .delete(tilesets)
    .where(eq(tilesets.id, id))
    .returning();
  return deleted ?? null;
}

/**
 * Set bidirectional inverse link between two tilesets.
 * Both A.inverseTilesetId = B and B.inverseTilesetId = A
 * are updated in a single transaction.
 */
export async function setInverseTileset(
  db: DrizzleClient,
  tilesetAId: string,
  tilesetBId: string
) {
  return db.transaction(async (tx) => {
    // Clear any existing inverse links on both sides
    await tx
      .update(tilesets)
      .set({ inverseTilesetId: null, updatedAt: new Date() })
      .where(eq(tilesets.inverseTilesetId, tilesetAId));
    await tx
      .update(tilesets)
      .set({ inverseTilesetId: null, updatedAt: new Date() })
      .where(eq(tilesets.inverseTilesetId, tilesetBId));

    // Set new bidirectional link
    const [a] = await tx
      .update(tilesets)
      .set({ inverseTilesetId: tilesetBId, updatedAt: new Date() })
      .where(eq(tilesets.id, tilesetAId))
      .returning();
    await tx
      .update(tilesets)
      .set({ inverseTilesetId: tilesetAId, updatedAt: new Date() })
      .where(eq(tilesets.id, tilesetBId));

    return a;
  });
}

/**
 * Remove bidirectional inverse link from a tileset and its partner.
 */
export async function removeInverseTileset(
  db: DrizzleClient,
  tilesetId: string
) {
  return db.transaction(async (tx) => {
    const [tileset] = await tx
      .select({ inverseTilesetId: tilesets.inverseTilesetId })
      .from(tilesets)
      .where(eq(tilesets.id, tilesetId));

    if (tileset?.inverseTilesetId) {
      await tx
        .update(tilesets)
        .set({ inverseTilesetId: null, updatedAt: new Date() })
        .where(eq(tilesets.id, tileset.inverseTilesetId));
    }

    const [updated] = await tx
      .update(tilesets)
      .set({ inverseTilesetId: null, updatedAt: new Date() })
      .where(eq(tilesets.id, tilesetId))
      .returning();

    return updated;
  });
}

/**
 * Get the transition matrix: for each (from, to) material pair,
 * the count of tilesets and a representative tileset ID.
 */
export async function getTransitionMatrix(db: DrizzleClient) {
  const allMaterials = await db
    .select()
    .from(materials)
    .orderBy(materials.name);

  const cells = await db
    .select({
      fromId: tilesets.fromMaterialId,
      toId: tilesets.toMaterialId,
      count: count(),
      representativeId: sql<string>`MIN(${tilesets.id}::text)::uuid`,
    })
    .from(tilesets)
    .where(
      and(
        sql`${tilesets.fromMaterialId} IS NOT NULL`,
        sql`${tilesets.toMaterialId} IS NOT NULL`
      )
    )
    .groupBy(tilesets.fromMaterialId, tilesets.toMaterialId);

  return { materials: allMaterials, cells };
}

/**
 * Get editor maps that reference a tileset's key in their layers JSONB.
 */
export async function getTilesetUsage(
  db: DrizzleClient,
  tilesetKey: string
) {
  // Search the layers JSONB array for objects containing this terrainKey
  const maps = await db
    .select({ id: editorMaps.id, name: editorMaps.name })
    .from(editorMaps)
    .where(
      sql`${editorMaps.layers}::jsonb @> ${JSON.stringify([{ terrainKey: tilesetKey }])}::jsonb`
    );

  return { maps, count: maps.length };
}

/**
 * Return all tilesets with their fromMaterial and toMaterial relations
 * fully populated. Used to build the TilesetRegistry for the terrain
 * renderer.
 *
 * Uses leftJoin so tilesets without fromMaterial or toMaterial are
 * still returned (interior solid tilesets have null toMaterial).
 */
export async function listTilesetsWithMaterials(db: DrizzleClient) {
  const fromMat = alias(materials, 'from_mat');
  const toMat = alias(materials, 'to_mat');

  return db
    .select({
      key: tilesets.key,
      s3Url: tilesets.s3Url,
      fromMaterial: {
        key: fromMat.key,
        renderPriority: fromMat.renderPriority,
        color: fromMat.color,
      },
      toMaterial: {
        key: toMat.key,
        renderPriority: toMat.renderPriority,
        color: toMat.color,
      },
    })
    .from(tilesets)
    .leftJoin(fromMat, eq(tilesets.fromMaterialId, fromMat.id))
    .leftJoin(toMat, eq(tilesets.toMaterialId, toMat.id));
}
