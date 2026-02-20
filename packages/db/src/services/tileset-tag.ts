import { eq, sql, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { tilesetTags } from '../schema/tileset-tags';

export async function setTags(
  db: DrizzleClient,
  tilesetId: string,
  tags: string[]
) {
  return db.transaction(async (tx) => {
    // Delete existing tags
    await tx
      .delete(tilesetTags)
      .where(eq(tilesetTags.tilesetId, tilesetId));

    if (tags.length === 0) return [];

    // Insert new tags
    const inserted = await tx
      .insert(tilesetTags)
      .values(tags.map((tag) => ({ tilesetId, tag })))
      .returning();

    return inserted;
  });
}

export async function getTags(
  db: DrizzleClient,
  tilesetId: string
): Promise<string[]> {
  const rows = await db
    .select({ tag: tilesetTags.tag })
    .from(tilesetTags)
    .where(eq(tilesetTags.tilesetId, tilesetId))
    .orderBy(asc(tilesetTags.tag));
  return rows.map((r) => r.tag);
}

export async function addTag(
  db: DrizzleClient,
  tilesetId: string,
  tag: string
) {
  const [inserted] = await db
    .insert(tilesetTags)
    .values({ tilesetId, tag })
    .onConflictDoNothing()
    .returning();
  return inserted ?? null;
}

export async function removeTag(
  db: DrizzleClient,
  tilesetId: string,
  tag: string
) {
  await db
    .delete(tilesetTags)
    .where(
      sql`${tilesetTags.tilesetId} = ${tilesetId} AND ${tilesetTags.tag} = ${tag}`
    );
}

export async function listDistinctTags(
  db: DrizzleClient
): Promise<{ tag: string; count: number }[]> {
  const rows = await db
    .select({
      tag: tilesetTags.tag,
      count: sql<number>`count(*)::int`,
    })
    .from(tilesetTags)
    .groupBy(tilesetTags.tag)
    .orderBy(asc(tilesetTags.tag));

  return rows;
}
