import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

export interface DrizzleClientOptions {
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;

export function createDrizzleClient(
  url: string,
  options?: DrizzleClientOptions
) {
  const sql = postgres(url, {
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 20,
    connect_timeout: options?.connect_timeout ?? 10,
  });

  return drizzle(sql, { schema });
}

export async function closeDrizzleClient(client: DrizzleClient) {
  // Access the underlying postgres client to close it
  await (client as unknown as { $client: postgres.Sql }).$client.end();
}
