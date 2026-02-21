import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { editorMaps } from '../schema/editor-maps';
import type { EditorMap } from '../schema/editor-maps';

export interface CreateEditorMapData {
  name: string;
  mapType: string;
  width: number;
  height: number;
  seed?: number;
  grid: unknown;
  layers: unknown;
  walkable: unknown;
  metadata?: unknown;
  createdBy?: string;
}

export interface ListEditorMapsParams {
  mapType?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateEditorMapData {
  name?: string;
  seed?: number;
  grid?: unknown;
  layers?: unknown;
  walkable?: unknown;
  metadata?: unknown;
  width?: number;
  height?: number;
}

export async function createEditorMap(
  db: DrizzleClient,
  data: CreateEditorMapData
): Promise<EditorMap> {
  const [created] = await db.insert(editorMaps).values(data).returning();
  return created;
}

export async function getEditorMap(
  db: DrizzleClient,
  id: string
): Promise<EditorMap | null> {
  const [result] = await db
    .select()
    .from(editorMaps)
    .where(eq(editorMaps.id, id));
  return result ?? null;
}

export async function listEditorMaps(
  db: DrizzleClient,
  params?: ListEditorMapsParams
): Promise<EditorMap[]> {
  const conditions = [];
  if (params?.mapType) {
    conditions.push(eq(editorMaps.mapType, params.mapType));
  }
  if (params?.createdBy) {
    conditions.push(eq(editorMaps.createdBy, params.createdBy));
  }

  const baseQuery = db.select().from(editorMaps);
  const filtered =
    conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const ordered = filtered.orderBy(desc(editorMaps.updatedAt));

  if (params?.limit !== undefined && params?.offset !== undefined) {
    return ordered.limit(params.limit).offset(params.offset);
  }
  if (params?.limit !== undefined) {
    return ordered.limit(params.limit);
  }

  return ordered;
}

export async function updateEditorMap(
  db: DrizzleClient,
  id: string,
  data: UpdateEditorMapData
): Promise<EditorMap | null> {
  const [updated] = await db
    .update(editorMaps)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(editorMaps.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteEditorMap(
  db: DrizzleClient,
  id: string
): Promise<void> {
  await db.delete(editorMaps).where(eq(editorMaps.id, id));
}
