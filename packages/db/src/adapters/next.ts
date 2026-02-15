import {
  createDrizzleClient,
  closeDrizzleClient,
  type DrizzleClient,
} from '../core/client';

let db: DrizzleClient | null = null;

export function getDb(url?: string): DrizzleClient {
  if (db) return db;

  const dbUrl = url ?? process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Pass a url argument or set DATABASE_URL.'
    );
  }
  console.log('DATABASE_URL', dbUrl);
  db = createDrizzleClient(dbUrl);
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await closeDrizzleClient(db);
    db = null;
  }
}
