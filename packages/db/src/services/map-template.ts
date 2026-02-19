import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { mapTemplates } from '../schema/map-templates';
import type { MapTemplateRecord } from '../schema/map-templates';

export interface CreateTemplateData {
  name: string;
  description?: string;
  mapType: string;
  baseWidth: number;
  baseHeight: number;
  parameters?: unknown;
  constraints?: unknown;
  grid: unknown;
  layers: unknown;
  zones?: unknown;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  parameters?: unknown;
  constraints?: unknown;
  grid?: unknown;
  layers?: unknown;
  zones?: unknown;
  version?: number;
}

export interface ListTemplatesParams {
  mapType?: string;
  isPublished?: boolean;
  limit?: number;
  offset?: number;
}

export async function createTemplate(
  db: DrizzleClient,
  data: CreateTemplateData
): Promise<MapTemplateRecord> {
  const [created] = await db.insert(mapTemplates).values(data).returning();
  return created;
}

export async function getTemplate(
  db: DrizzleClient,
  id: string
): Promise<MapTemplateRecord | null> {
  const [result] = await db
    .select()
    .from(mapTemplates)
    .where(eq(mapTemplates.id, id));
  return result ?? null;
}

export async function listTemplates(
  db: DrizzleClient,
  params: ListTemplatesParams = {}
): Promise<MapTemplateRecord[]> {
  const conditions = [];
  if (params.mapType) {
    conditions.push(eq(mapTemplates.mapType, params.mapType));
  }
  if (params.isPublished !== undefined) {
    conditions.push(eq(mapTemplates.isPublished, params.isPublished));
  }

  const baseQuery = db.select().from(mapTemplates);
  const filtered =
    conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const ordered = filtered.orderBy(desc(mapTemplates.updatedAt));

  if (params.limit !== undefined && params.offset !== undefined) {
    return ordered.limit(params.limit).offset(params.offset);
  }
  if (params.limit !== undefined) {
    return ordered.limit(params.limit);
  }

  return ordered;
}

export async function updateTemplate(
  db: DrizzleClient,
  id: string,
  data: UpdateTemplateData
): Promise<MapTemplateRecord | null> {
  const [updated] = await db
    .update(mapTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mapTemplates.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTemplate(
  db: DrizzleClient,
  id: string
): Promise<void> {
  await db.delete(mapTemplates).where(eq(mapTemplates.id, id));
}

export async function publishTemplate(
  db: DrizzleClient,
  id: string
): Promise<MapTemplateRecord | null> {
  const existing = await getTemplate(db, id);
  if (!existing) return null;

  const [updated] = await db
    .update(mapTemplates)
    .set({
      isPublished: true,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(mapTemplates.id, id))
    .returning();
  return updated ?? null;
}

export async function getPublishedTemplates(
  db: DrizzleClient,
  mapType: string
): Promise<MapTemplateRecord[]> {
  return db
    .select()
    .from(mapTemplates)
    .where(
      and(
        eq(mapTemplates.mapType, mapType),
        eq(mapTemplates.isPublished, true)
      )
    )
    .orderBy(desc(mapTemplates.updatedAt));
}
