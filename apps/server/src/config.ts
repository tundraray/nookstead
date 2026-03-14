import { COLYSEUS_PORT } from '@nookstead/shared';

export interface ServerConfig {
  port: number;
  authSecret: string;
  databaseUrl: string;
  corsOrigin: string;
  openaiApiKey: string;
}

export function loadConfig(): ServerConfig {
  const authSecret = process.env['AUTH_SECRET'];
  if (!authSecret) {
    throw new Error(
      'AUTH_SECRET environment variable is required. Set it to the same value used by NextAuth.'
    );
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to a PostgreSQL connection string.'
    );
  }

  const openaiApiKey = process.env['OPENAI_API_KEY'];
  if (!openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. Set it to your OpenAI API key.'
    );
  }

  const port = parseInt(process.env['COLYSEUS_PORT'] ?? '', 10) || COLYSEUS_PORT;
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

  return { port, authSecret, databaseUrl, corsOrigin, openaiApiKey };
}
