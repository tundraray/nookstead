import {
  createDrizzleClient,
  closeDrizzleClient,
  type DrizzleClient,
  type DrizzleClientOptions,
} from '../core/client';

let db: DrizzleClient | null = null;

const COLYSEUS_DEFAULTS: DrizzleClientOptions = {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
};

export function getGameDb(
  url?: string,
  options?: DrizzleClientOptions
): DrizzleClient {
  if (db) return db;

  const dbUrl = url ?? process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Pass a url argument or set DATABASE_URL.'
    );
  }

  db = createDrizzleClient(dbUrl, { ...COLYSEUS_DEFAULTS, ...options });
  return db;
}

export async function closeGameDb(): Promise<void> {
  if (db) {
    await closeDrizzleClient(db);
    db = null;
  }
}
