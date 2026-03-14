import { eq, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import { fenceTypes } from '../schema/fence-types';
import type { NewFenceType } from '../schema/fence-types';

const REQUIRED_FRAME_KEYS = [
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', '10', '11', '12', '13', '14', '15',
];

const REQUIRED_GATE_KEYS = [
  'vertical_closed',
  'vertical_open',
  'horizontal_closed',
  'horizontal_open',
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateFrameMapping(
  mapping: Record<string, string>
): void {
  for (const key of REQUIRED_FRAME_KEYS) {
    if (!mapping[key]) {
      throw new Error(`frame_mapping missing required key: "${key}"`);
    }
    if (!UUID_REGEX.test(mapping[key])) {
      throw new Error(`frame_mapping["${key}"] is not a valid UUID`);
    }
  }
  if (Object.keys(mapping).length !== 16) {
    throw new Error('frame_mapping must have exactly 16 entries');
  }
}

export function validateGateFrameMapping(
  mapping: Record<string, string>
): void {
  for (const key of REQUIRED_GATE_KEYS) {
    if (!mapping[key]) {
      throw new Error(
        `gate_frame_mapping missing required key: "${key}"`
      );
    }
    if (!UUID_REGEX.test(mapping[key])) {
      throw new Error(
        `gate_frame_mapping["${key}"] is not a valid UUID`
      );
    }
  }
  if (Object.keys(mapping).length !== 4) {
    throw new Error('gate_frame_mapping must have exactly 4 entries');
  }
}

export async function createFenceType(
  db: DrizzleClient,
  data: NewFenceType
) {
  validateFrameMapping(
    data.frameMapping as Record<string, string>
  );
  if (data.gateFrameMapping) {
    validateGateFrameMapping(
      data.gateFrameMapping as Record<string, string>
    );
  }

  const [created] = await db.insert(fenceTypes).values(data).returning();
  return created;
}

export async function getFenceType(db: DrizzleClient, id: string) {
  const [row] = await db
    .select()
    .from(fenceTypes)
    .where(eq(fenceTypes.id, id));
  return row ?? null;
}

export async function getFenceTypeByKey(db: DrizzleClient, key: string) {
  const [row] = await db
    .select()
    .from(fenceTypes)
    .where(eq(fenceTypes.key, key));
  return row ?? null;
}

export async function listFenceTypes(
  db: DrizzleClient,
  params?: { category?: string }
) {
  const query = db.select().from(fenceTypes);

  if (params?.category) {
    return query
      .where(eq(fenceTypes.category, params.category))
      .orderBy(asc(fenceTypes.sortOrder));
  }

  return query.orderBy(asc(fenceTypes.sortOrder));
}

export async function updateFenceType(
  db: DrizzleClient,
  id: string,
  data: Partial<NewFenceType>
) {
  if (data.frameMapping) {
    validateFrameMapping(
      data.frameMapping as Record<string, string>
    );
  }
  if (data.gateFrameMapping) {
    validateGateFrameMapping(
      data.gateFrameMapping as Record<string, string>
    );
  }

  const [updated] = await db
    .update(fenceTypes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(fenceTypes.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteFenceType(db: DrizzleClient, id: string) {
  await db.delete(fenceTypes).where(eq(fenceTypes.id, id)).returning();
}
